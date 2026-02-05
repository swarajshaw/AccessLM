const fs = require('fs');
const os = require('os');
const path = require('path');
const net = require('net');

const PEERS_FILE = path.join(os.homedir(), '.accesslm', 'peers.json');
const MODEL_INDEX_FILE = path.join(os.homedir(), '.accesslm', 'models', 'model_index.json');
const PINS_FILE = path.join(os.homedir(), '.accesslm', 'pins.json');
const PREFERRED_FILE = path.join(os.homedir(), '.accesslm', 'preferred_peers.json');
const CAPABILITIES_FILE = path.join(os.homedir(), '.accesslm', 'capabilities.json');
const SHARD_CACHE_DIR = path.join(os.homedir(), '.accesslm', 'shards', 'cache');

function readPeers() {
  try {
    const data = JSON.parse(fs.readFileSync(PEERS_FILE, 'utf8'));
    return Array.isArray(data.peers) ? data.peers : [];
  } catch {
    return [];
  }
}

function writePeers(peers) {
  try {
    fs.mkdirSync(path.dirname(PEERS_FILE), { recursive: true });
    fs.writeFileSync(
      PEERS_FILE,
      JSON.stringify({ updated_at: Date.now(), peers }, null, 2)
    );
  } catch {
    // ignore
  }
}

function pickPeer(peers = []) {
  if (!peers.length) return null;
  const shuffled = [...peers].sort(() => 0.5 - Math.random());
  return shuffled[0];
}

function readModelIndex() {
  try {
    return JSON.parse(fs.readFileSync(MODEL_INDEX_FILE, 'utf8'));
  } catch {
    return {};
  }
}

function readPins() {
  try {
    const data = JSON.parse(fs.readFileSync(PINS_FILE, 'utf8'));
    return Array.isArray(data.pins) ? data.pins : [];
  } catch {
    return [];
  }
}

function writePins(pins) {
  try {
    fs.mkdirSync(path.dirname(PINS_FILE), { recursive: true });
    fs.writeFileSync(PINS_FILE, JSON.stringify({ pins }, null, 2));
  } catch {
    // ignore
  }
}

function readCapabilities() {
  try {
    return JSON.parse(fs.readFileSync(CAPABILITIES_FILE, 'utf8'));
  } catch {
    return {};
  }
}

function writeCapabilities(capabilities) {
  try {
    fs.mkdirSync(path.dirname(CAPABILITIES_FILE), { recursive: true });
    fs.writeFileSync(CAPABILITIES_FILE, JSON.stringify(capabilities, null, 2));
  } catch {
    // ignore
  }
}

function sha256Buffer(buffer) {
  const crypto = require('crypto');
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

function readPreferredPeers() {
  try {
    const data = JSON.parse(fs.readFileSync(PREFERRED_FILE, 'utf8'));
    return data || {};
  } catch {
    return {};
  }
}

function writePreferredPeers(preferred) {
  try {
    fs.mkdirSync(path.dirname(PREFERRED_FILE), { recursive: true });
    fs.writeFileSync(PREFERRED_FILE, JSON.stringify(preferred, null, 2));
  } catch {
    // ignore
  }
}

function updatePreferredPeer(modelId, peer) {
  if (!modelId || !peer) return;
  const preferred = readPreferredPeers();
  preferred[modelId] = {
    peer_id: peer.peer_id,
    ip: peer.ip,
    port: peer.port || 7331,
    last_used: Date.now()
  };
  writePreferredPeers(preferred);
}

function getPreferredPeer(modelId) {
  const preferred = readPreferredPeers();
  return preferred[modelId] || null;
}

function clearPreferredPeer(modelId) {
  const preferred = readPreferredPeers();
  if (!modelId) return preferred;
  delete preferred[modelId];
  writePreferredPeers(preferred);
  return preferred;
}

function clearCapabilities() {
  writeCapabilities({});
  return {};
}

function isPinned(peer, pins) {
  return pins.some((p) => p.peer_id === peer.peer_id || p.ip === peer.ip);
}

function scorePeer(peer) {
  const latency = peer.latency_ms ?? 1000;
  const failures = peer.failures ?? 0;
  const ok = peer.ok ? 1 : 0;
  const latencyScore = Math.max(0, 100 - Math.floor(latency / 10));
  const failurePenalty = failures * 15;
  return Math.max(0, latencyScore + ok * 10 - failurePenalty);
}

function isAllowedPeerIp(ip) {
  if (!ip || net.isIP(ip) === 0) return false;
  if (ip.startsWith('127.') || ip === '::1') return false;
  if (ip.startsWith('169.254.')) return false;
  if (ip.startsWith('0.')) return false;
  return true;
}

function normalizePeer(peer) {
  if (!peer?.ip || !isAllowedPeerIp(peer.ip)) return null;
  return peer;
}

async function checkPeerHealth(peer, timeoutMs = 1500) {
  if (!normalizePeer(peer)) return { ok: false };
  const url = `http://${peer.ip}:7331/health`;
  const controller = new AbortController();
  const start = Date.now();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: controller.signal });
    const data = await res.json().catch(() => ({}));
    return {
      ok: res.ok && data.ok === true,
      latency_ms: Date.now() - start
    };
  } catch {
    return { ok: false };
  } finally {
    clearTimeout(timeout);
  }
}

async function refreshPeerHealth() {
  const peers = readPeers().map(normalizePeer).filter(Boolean);
  if (!peers.length) return [];
  const pins = readPins();
  const capabilities = readCapabilities();
  const refreshed = [];
  for (const peer of peers) {
    const health = await checkPeerHealth(peer);
    const payload = await fetchPeerModels(peer);
    const peerModels = payload?.models || {};
    const peerRuntimes = payload?.runtimes || [];
    capabilities[peer.peer_id || peer.ip] = {
      models: peerModels,
      runtimes: peerRuntimes,
      updated_at: Date.now()
    };
    const failures = health.ok ? 0 : (peer.failures || 0) + 1;
    const updated = {
      ...peer,
      ok: health.ok,
      latency_ms: health.latency_ms ?? peer.latency_ms,
      failures,
      last_seen: Date.now(),
      pinned: isPinned(peer, pins),
      peerModels,
      peerRuntimes
    };
    updated.score = scorePeer(updated);
    refreshed.push(updated);
  }
  const sorted = refreshed.sort((a, b) => {
    if (a.pinned && !b.pinned) return -1;
    if (b.pinned && !a.pinned) return 1;
    return (b.score || 0) - (a.score || 0);
  });
  writeCapabilities(capabilities);
  writePeers(sorted);
  return sorted;
}

function pinPeer(peer) {
  const pins = readPins();
  if (!isPinned(peer, pins)) {
    pins.push({ peer_id: peer.peer_id, ip: peer.ip });
    writePins(pins);
  }
  return pins;
}

function unpinPeer(peer) {
  const pins = readPins();
  const filtered = pins.filter((p) => p.peer_id !== peer.peer_id && p.ip !== peer.ip);
  writePins(filtered);
  return filtered;
}

function parseModelIndexPeers(modelIndex, modelId) {
  const key = `model:${modelId}`;
  const values = modelIndex[key] || [];
  return values
    .map((entry) => {
      const parts = entry.split('|');
      if (parts.length < 3) return null;
      return { peer_id: parts[0], ip: parts[1], port: Number(parts[2]) || 7331 };
    })
    .filter(Boolean);
}

async function fetchPeerModels(peer, timeoutMs = 2500) {
  if (!normalizePeer(peer)) return null;
  const url = `http://${peer.ip}:7331/models`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) return null;
    const data = await res.json();
    if (!data.ok) return null;
    return { models: data.models || {}, runtimes: data.runtimes || [] };
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

async function fetchBootstrap(peer, timeoutMs = 2500) {
  if (!normalizePeer(peer)) return [];
  const url = `http://${peer.ip}:7331/bootstrap`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) return [];
    const data = await res.json();
    return data.ok && Array.isArray(data.peers) ? data.peers : [];
  } catch {
    return [];
  } finally {
    clearTimeout(timeout);
  }
}

async function relayBootstrap() {
  const peers = readPeers().map(normalizePeer).filter(Boolean);
  const discovered = [];
  for (const peer of peers.slice(0, 5)) {
    const list = await fetchBootstrap(peer);
    if (list.length) discovered.push(...list);
  }
  if (!discovered.length) return peers;
  const merged = [...peers];
  for (const p of discovered) {
    if (!merged.find((m) => m.peer_id === p.peer_id || m.ip === p.ip)) {
      merged.push(p);
    }
  }
  writePeers(merged);
  return merged;
}

async function findPeersForModel(modelId) {
  const index = readModelIndex();
  const indexedPeers = parseModelIndexPeers(index, modelId);
  if (indexedPeers.length) return indexedPeers.map(normalizePeer).filter(Boolean);

  const peers = readPeers().map(normalizePeer).filter(Boolean);
  if (!peers.length) return [];
  const results = [];
  for (const peer of peers) {
    const payload = await fetchPeerModels(peer);
    if (!payload) continue;
    const allModels = Object.values(payload.models || {}).flat();
    if (allModels.includes(modelId)) {
      results.push({ ...peer, peerModels: payload.models, peerRuntimes: payload.runtimes });
    }
  }
  return results;
}

async function sendRemotePrompt(peer, payload, timeoutMs = 8000) {
  if (!normalizePeer(peer)) throw new Error('Invalid peer data');
  const port = peer.port || 7331;
  const url = `http://${peer.ip}:${port}/infer`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: controller.signal
    });
    const data = await res.json();
    if (!data.ok) throw new Error(data.error || 'Remote inference failed');
    return data.response || '';
  } finally {
    clearTimeout(timeout);
  }
}

async function fetchShardList(peer, modelId, timeoutMs = 5000) {
  if (!normalizePeer(peer)) return [];
  const url = `http://${peer.ip}:7331/shards?modelId=${encodeURIComponent(modelId)}`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) return [];
    const data = await res.json();
    return data.ok ? data.shards || [] : [];
  } catch {
    return [];
  } finally {
    clearTimeout(timeout);
  }
}

async function downloadShard(peer, shard, timeoutMs = 15000) {
  if (!normalizePeer(peer)) throw new Error('Invalid peer data');
  const url = `http://${peer.ip}:${peer.port || 7331}/shards/${encodeURIComponent(shard.shardId)}`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) throw new Error('Failed to download shard');
    const buffer = Buffer.from(await res.arrayBuffer());
    const digest = sha256Buffer(buffer);
    if (shard.sha256 && digest !== shard.sha256) {
      throw new Error('Shard integrity check failed');
    }
    const modelDir = path.join(SHARD_CACHE_DIR, shard.modelId.replace('/', '--'));
    fs.mkdirSync(modelDir, { recursive: true });
    const filePath = path.join(modelDir, `${shard.shardId}.bin`);
    fs.writeFileSync(filePath, buffer);
    return { filePath, sha256: digest };
  } finally {
    clearTimeout(timeout);
  }
}

async function downloadMissingShards(peers, modelId) {
  const shardsByPeer = [];
  for (const peer of peers) {
    const list = await fetchShardList(peer, modelId);
    if (list.length) shardsByPeer.push({ peer, shards: list });
  }
  const allShards = shardsByPeer.flatMap((item) => item.shards);
  const unique = new Map();
  for (const shard of allShards) {
    if (!unique.has(shard.shardId)) unique.set(shard.shardId, shard);
  }
  const needed = Array.from(unique.values());
  const results = [];
  for (const shard of needed) {
    const source = shardsByPeer.find((item) =>
      item.shards.find((s) => s.shardId === shard.shardId)
    );
    if (!source) continue;
    try {
      const res = await downloadShard(source.peer, shard);
      results.push({ shardId: shard.shardId, filePath: res.filePath });
    } catch {
      // skip failed shard
    }
  }
  return results;
}

function hasAllShards(modelId, requiredCount) {
  const registry = require('./shards').readRegistry();
  const shards = registry.shards.filter((s) => s.modelId === modelId);
  if (!shards.length) return false;
  if (requiredCount != null) return shards.length >= requiredCount;
  const totals = new Set(shards.map((s) => s.total));
  if (totals.size !== 1) return false;
  return shards.length === shards[0].total;
}

async function sendRemotePromptWithFallback(peers, payload, modelId, retry = 2) {
  const preferred = modelId ? getPreferredPeer(modelId) : null;
  const prioritized = preferred
    ? [
        peers.find((p) => p.peer_id === preferred.peer_id || p.ip === preferred.ip),
        ...peers
      ].filter(Boolean)
    : peers;

  const shuffled = [...prioritized].sort((a, b) => {
    const aScore = a.score ?? 0;
    const bScore = b.score ?? 0;
    if (a.pinned && !b.pinned) return -1;
    if (b.pinned && !a.pinned) return 1;
    return bScore - aScore;
  });
  let lastError = null;
  for (const peer of shuffled) {
    let attempt = 0;
    while (attempt <= retry) {
      try {
        const response = await sendRemotePrompt(peer, payload);
        if (modelId) updatePreferredPeer(modelId, peer);
        return response;
      } catch (error) {
        lastError = error;
        const backoff = 400 * Math.pow(2, attempt);
        await new Promise((resolve) => setTimeout(resolve, backoff));
        attempt += 1;
      }
    }
  }
  throw lastError || new Error('No peers responded.');
}

module.exports = {
  readPeers,
  readModelIndex,
  findPeersForModel,
  fetchBootstrap,
  refreshPeerHealth,
  relayBootstrap,
  pinPeer,
  unpinPeer,
  getPreferredPeer,
  clearPreferredPeer,
  readCapabilities,
  clearCapabilities,
  pickPeer,
  sendRemotePrompt,
  sendRemotePromptWithFallback,
  fetchShardList,
  downloadShard,
  downloadMissingShards,
  hasAllShards
};
