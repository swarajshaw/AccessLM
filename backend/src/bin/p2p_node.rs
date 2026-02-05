use std::collections::BTreeMap;
use std::net::IpAddr;
use std::path::PathBuf;
use std::time::Duration;

use dirs::home_dir;
use libp2p::identify::{Behaviour as Identify, Config as IdentifyConfig, Event as IdentifyEvent};
use libp2p::kad::{store::MemoryStore, Behaviour as Kademlia, Event as KademliaEvent, GetRecordOk, PutRecordOk, Record, Quorum};
use libp2p::mdns::{tokio::Behaviour as Mdns, Event as MdnsEvent};
use libp2p::ping::{Behaviour as Ping, Config as PingConfig, Event as PingEvent};
use libp2p::swarm::{NetworkBehaviour, SwarmEvent};
use libp2p::{identity, noise, tcp, yamux, Multiaddr, PeerId, SwarmBuilder};
use serde::Serialize;
use tokio::time::interval;
use futures::StreamExt;

#[derive(NetworkBehaviour)]
struct AccessLmBehaviour {
    mdns: Mdns,
    identify: Identify,
    ping: Ping,
    kad: Kademlia<MemoryStore>,
}

#[derive(Serialize, Clone)]
struct PeerRecord {
    peer_id: String,
    ip: String,
    last_seen: u64,
}

#[derive(Serialize)]
struct PeerFile {
    updated_at: u64,
    peers: Vec<PeerRecord>,
}

fn peers_path() -> PathBuf {
    let mut dir = home_dir().unwrap_or_else(|| PathBuf::from("."));
    dir.push(".accesslm");
    std::fs::create_dir_all(&dir).ok();
    dir.push("peers.json");
    dir
}

fn announce_path() -> PathBuf {
    let mut dir = home_dir().unwrap_or_else(|| PathBuf::from("."));
    dir.push(".accesslm");
    std::fs::create_dir_all(&dir).ok();
    dir.push("models");
    std::fs::create_dir_all(&dir).ok();
    dir.push("announce.json");
    dir
}

fn lookup_path() -> PathBuf {
    let mut dir = home_dir().unwrap_or_else(|| PathBuf::from("."));
    dir.push(".accesslm");
    std::fs::create_dir_all(&dir).ok();
    dir.push("models");
    std::fs::create_dir_all(&dir).ok();
    dir.push("lookup.json");
    dir
}

fn model_index_path() -> PathBuf {
    let mut dir = home_dir().unwrap_or_else(|| PathBuf::from("."));
    dir.push(".accesslm");
    std::fs::create_dir_all(&dir).ok();
    dir.push("models");
    std::fs::create_dir_all(&dir).ok();
    dir.push("model_index.json");
    dir
}

fn get_local_ip() -> Option<IpAddr> {
    if let Ok(addrs) = if_addrs::get_if_addrs() {
        for iface in addrs {
            if !iface.is_loopback() {
                return Some(iface.ip());
            }
        }
    }
    None
}

fn peer_server_port() -> u16 {
    std::env::var("ACCESSLM_PEER_PORT")
        .ok()
        .and_then(|v| v.parse::<u16>().ok())
        .unwrap_or(7331)
}

fn extract_ip(addr: &Multiaddr) -> Option<IpAddr> {
    addr.iter().find_map(|p| match p {
        libp2p::multiaddr::Protocol::Ip4(ip) => Some(IpAddr::V4(ip)),
        libp2p::multiaddr::Protocol::Ip6(ip) => Some(IpAddr::V6(ip)),
        _ => None,
    })
}

fn now_ts() -> u64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs()
}

#[tokio::main]
async fn main() {
    env_logger::init();

    let local_key = identity::Keypair::generate_ed25519();
    let local_peer_id = PeerId::from(local_key.public());
    println!("AccessLM P2P node starting. PeerId: {local_peer_id}");

    let mut swarm = SwarmBuilder::with_existing_identity(local_key)
        .with_tokio()
        .with_tcp(
            tcp::Config::default(),
            noise::Config::new,
            yamux::Config::default,
        )
        .expect("transport")
        .with_behaviour(|key| {
            let mdns = Mdns::new(Default::default(), PeerId::from(key.public()))
                .expect("mdns");
            let identify = Identify::new(
                IdentifyConfig::new("accesslm/0.1.0".into(), key.public()),
            );
            let ping = Ping::new(PingConfig::new().with_interval(Duration::from_secs(15)));
            let store = MemoryStore::new(PeerId::from(key.public()));
            let kad = Kademlia::new(PeerId::from(key.public()), store);
            AccessLmBehaviour { mdns, identify, ping, kad }
        })
        .expect("behaviour")
        .build();

    let port = std::env::var("ACCESSLM_P2P_PORT")
        .ok()
        .and_then(|v| v.parse::<u16>().ok())
        .unwrap_or(7332);
    let listen_addr: Multiaddr = format!("/ip4/0.0.0.0/tcp/{port}").parse().unwrap();
    swarm.listen_on(listen_addr).expect("listen");

    if let Ok(bootstrap) = std::env::var("ACCESSLM_BOOTSTRAP") {
        for addr in bootstrap.split(',').map(str::trim).filter(|s| !s.is_empty()) {
            if let Ok(multiaddr) = addr.parse::<Multiaddr>() {
                println!("Dialing bootstrap: {}", multiaddr);
                let _ = swarm.dial(multiaddr);
            }
        }
    }

    let peers_file = peers_path();
    let announce_file = announce_path();
    let lookup_file = lookup_path();
    let model_index_file = model_index_path();
    let mut peers: BTreeMap<String, PeerRecord> = BTreeMap::new();
    let mut ticker = interval(Duration::from_secs(3));
    let mut announce_tick = interval(Duration::from_secs(10));
    let mut lookup_tick = interval(Duration::from_secs(8));
    let mut model_index: BTreeMap<String, Vec<String>> = BTreeMap::new();

    loop {
        tokio::select! {
            event = swarm.select_next_some() => match event {
                SwarmEvent::NewListenAddr { address, .. } => {
                    println!("Listening on {}", address);
                }
                SwarmEvent::Behaviour(AccessLmBehaviourEvent::Mdns(MdnsEvent::Discovered(list))) => {
                    for (peer, addr) in list {
                        if let Some(ip) = extract_ip(&addr) {
                            let record = PeerRecord {
                                peer_id: peer.to_string(),
                                ip: ip.to_string(),
                                last_seen: now_ts(),
                            };
                            peers.insert(peer.to_string(), record);
                        }
                    }
                }
                SwarmEvent::Behaviour(AccessLmBehaviourEvent::Mdns(MdnsEvent::Expired(list))) => {
                    for (peer, _addr) in list {
                        peers.remove(&peer.to_string());
                    }
                }
                SwarmEvent::Behaviour(AccessLmBehaviourEvent::Identify(IdentifyEvent::Received { peer_id, info })) => {
                    if let Some(addr) = info.listen_addrs.iter().find_map(extract_ip) {
                        let record = PeerRecord {
                            peer_id: peer_id.to_string(),
                            ip: addr.to_string(),
                            last_seen: now_ts(),
                        };
                        peers.insert(peer_id.to_string(), record);
                    } else {
                        peers.entry(peer_id.to_string()).and_modify(|p| p.last_seen = now_ts());
                    }
                }
                SwarmEvent::Behaviour(AccessLmBehaviourEvent::Ping(PingEvent { peer, .. })) => {
                    peers.entry(peer.to_string()).and_modify(|p| p.last_seen = now_ts());
                }
                SwarmEvent::Behaviour(AccessLmBehaviourEvent::Kad(KademliaEvent::RoutingUpdated { peer, addresses, .. })) => {
                    if let Some(addr) = addresses.iter().find_map(extract_ip) {
                        let record = PeerRecord {
                            peer_id: peer.to_string(),
                            ip: addr.to_string(),
                            last_seen: now_ts(),
                        };
                        peers.insert(peer.to_string(), record);
                    }
                }
                SwarmEvent::Behaviour(AccessLmBehaviourEvent::Kad(KademliaEvent::OutboundQueryProgressed { result, .. })) => {
                    match result {
                        libp2p::kad::QueryResult::PutRecord(Ok(PutRecordOk { key })) => {
                            println!("Published model record: {:?}", key);
                        }
                        libp2p::kad::QueryResult::GetRecord(Ok(GetRecordOk::FoundRecord(record))) => {
                            let key = String::from_utf8_lossy(record.record.key.as_ref()).to_string();
                            let value = String::from_utf8_lossy(&record.record.value).to_string();
                            model_index.entry(key).or_default().push(value);
                        }
                        _ => {}
                    }
                }
                _ => {}
            },
            _ = ticker.tick() => {
                let data = PeerFile {
                    updated_at: now_ts(),
                    peers: peers.values().cloned().collect(),
                };
                if let Ok(json) = serde_json::to_string_pretty(&data) {
                    let _ = std::fs::write(&peers_file, json);
                }
            }
            _ = announce_tick.tick() => {
                if let Ok(content) = std::fs::read_to_string(&announce_file) {
                    if let Ok(list) = serde_json::from_str::<Vec<String>>(&content) {
                        if let Some(ip) = std::env::var("ACCESSLM_PEER_HOST").ok().and_then(|v| v.parse().ok()).or_else(get_local_ip) {
                            let port = peer_server_port();
                            for model_id in list {
                                let key = Record::new(
                                    format!("model:{}", model_id).into_bytes(),
                                    format!("{}|{}|{}", local_peer_id, ip, port).into_bytes(),
                                );
                                let _ = swarm
                                    .behaviour_mut()
                                    .kad
                                    .put_record(key, Quorum::One);
                            }
                        }
                    }
                }
            }
            _ = lookup_tick.tick() => {
                if let Ok(content) = std::fs::read_to_string(&lookup_file) {
                    if let Ok(list) = serde_json::from_str::<Vec<String>>(&content) {
                        for model_id in list {
                            let _ = swarm
                                .behaviour_mut()
                                .kad
                                .get_record(format!("model:{}", model_id).into_bytes().into());
                        }
                        if let Ok(json) = serde_json::to_string_pretty(&model_index) {
                            let _ = std::fs::write(&model_index_file, json);
                        }
                    }
                }
            }
        }
    }
}
