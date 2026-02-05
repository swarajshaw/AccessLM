'use client';
import { useEffect, useState } from 'react';

export default function Home() {
  const [osHint, setOsHint] = useState('mac');

  const detectOs = () => {
    if (typeof window === 'undefined') return 'mac';
    const ua = navigator.userAgent.toLowerCase();
    const platform = (navigator.platform || '').toLowerCase();
    if (ua.includes('win') || platform.includes('win')) return 'win';
    if (ua.includes('mac') || platform.includes('mac')) return 'mac';
    if (ua.includes('linux') || platform.includes('linux')) return 'linux';
    return 'mac';
  };

  useEffect(() => {
    setOsHint(detectOs());
  }, []);

  const downloads = {
    mac: {
      label: 'Download for macOS (.dmg)',
      file: 'AccessLM-2.1.0.dmg'
    },
    win: {
      label: 'Download for Windows (.exe)',
      file: 'AccessLM-2.1.0.exe'
    },
    linux: {
      label: 'Download for Linux (.deb)',
      file: 'accesslm_2.1.0_amd64.deb'
    }
  };

  return (
    <div className="min-h-screen bg-[#0b0b0f] text-white">
      <div className="relative overflow-hidden">
        <div className="absolute -top-32 -left-32 h-96 w-96 rounded-full bg-[#2dd4bf] opacity-20 blur-[120px]"></div>
        <div className="absolute -bottom-40 -right-40 h-[520px] w-[520px] rounded-full bg-[#60a5fa] opacity-20 blur-[140px]"></div>

        <div className="max-w-6xl mx-auto px-6 py-14">
          <header className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-xl bg-white/10 border border-white/15 flex items-center justify-center">
                <div className="h-3 w-3 rounded-full bg-[#22d3ee]"></div>
              </div>
              <div className="text-lg font-semibold tracking-wide">AccessLM</div>
            </div>
            <nav className="hidden md:flex items-center gap-6 text-sm text-white/70">
              <a className="hover:text-white" href="#mission">Mission</a>
              <a className="hover:text-white" href="#how">How It Works</a>
              <a className="hover:text-white" href="#roadmap">Roadmap</a>
              <a className="hover:text-white" href="/downloads">Downloads</a>
            </nav>
          </header>

          <section className="mt-16 grid gap-10 lg:grid-cols-[1.2fr_1fr] items-center">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs text-white/80">
                <span className="h-2 w-2 rounded-full bg-emerald-400"></span>
                Open, peer-to-peer AI access
              </div>
              <h1 className="mt-6 text-4xl md:text-6xl font-semibold leading-tight">
                Run frontier LLMs on everyday laptops.
              </h1>
              <p className="mt-5 text-lg text-white/75 max-w-xl">
                AccessLM pools idle CPU, RAM, and GPU across a peer network, so students and researchers can run large models without cloud bills or gatekeepers.
              </p>
              <div className="mt-7 flex flex-wrap items-center gap-4">
                <a
                  className="rounded-xl bg-white text-black px-6 py-3 text-sm font-semibold hover:bg-white/90"
                  href={`/downloads/${downloads[osHint].file}`}
                >
                  {downloads[osHint].label}
                </a>
                <a
                  className="rounded-xl border border-white/20 px-6 py-3 text-sm font-semibold text-white/90 hover:border-white/40"
                  href="/desktop"
                >
                  Try the P2P Chatbot
                </a>
                <a
                  className="rounded-xl border border-white/20 px-6 py-3 text-sm font-semibold text-white/90 hover:border-white/40"
                  href="/downloads"
                >
                  See all downloads
                </a>
              </div>
              <div className="mt-6 text-xs text-white/50">
                No login. No tracking. MIT licensed. Built for open access.
              </div>
            </div>

            <div className="rounded-3xl border border-white/10 bg-white/5 p-6 shadow-[0_0_80px_rgba(96,165,250,0.15)]">
              <div className="text-sm text-white/60">Live status</div>
              <div className="mt-3 rounded-2xl bg-black/40 p-4 border border-white/10">
                <div className="text-white/80">Finding peers for Llama 3 70B...</div>
                <div className="mt-2 text-xs text-white/50">3 peers online · 2 shards discovered</div>
              </div>
              <div className="mt-6 grid gap-3 text-sm">
                <div className="flex items-center justify-between rounded-xl border border-white/10 bg-white/5 px-4 py-3">
                  <span>Compute shared today</span>
                  <span className="text-emerald-300">14.2 GPU hours</span>
                </div>
                <div className="flex items-center justify-between rounded-xl border border-white/10 bg-white/5 px-4 py-3">
                  <span>Models available</span>
                  <span className="text-sky-300">1,200+</span>
                </div>
                <div className="flex items-center justify-between rounded-xl border border-white/10 bg-white/5 px-4 py-3">
                  <span>Network latency</span>
                  <span className="text-white/80">86 ms</span>
                </div>
              </div>
            </div>
          </section>
        </div>
      </div>

      <section id="mission" className="max-w-6xl mx-auto px-6 py-20">
        <div className="grid gap-8 lg:grid-cols-2">
          <div>
            <h2 className="text-3xl font-semibold">Access for everyone, not just GPU owners.</h2>
            <p className="mt-4 text-white/70">
              AccessLM is open infrastructure for AI. It lets students, educators, and researchers run powerful models by pooling fragmented resources across peers. No accounts, no tokens, no surveillance.
            </p>
          </div>
          <div className="grid gap-4">
            <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
              <div className="text-sm text-white/60">For students</div>
              <div className="mt-2 text-white/80">Run Llama 3 70B on a shared swarm without a $5k GPU.</div>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
              <div className="text-sm text-white/60">For labs</div>
              <div className="mt-2 text-white/80">Pool idle campus machines into a private P2P inference fabric.</div>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
              <div className="text-sm text-white/60">For everyone</div>
              <div className="mt-2 text-white/80">Open source, auditable, and GDPR-compliant by design.</div>
            </div>
          </div>
        </div>
      </section>

      <section id="chat" className="max-w-6xl mx-auto px-6 py-20">
        <div className="grid gap-10 lg:grid-cols-[1.1fr_1fr] items-center">
          <div>
            <h2 className="text-3xl font-semibold">Chat like a local model, powered by peers.</h2>
            <p className="mt-4 text-white/70">
              AccessLM keeps the conversation local while the network supplies the missing compute. Upload files, toggle
              thinking or search, and keep your context on device.
            </p>
            <div className="mt-6 flex flex-wrap gap-4 text-sm">
              <a className="rounded-lg border border-white/20 px-4 py-2 hover:border-white/40" href="/downloads">
                Download the app
              </a>
              <a className="rounded-lg border border-white/20 px-4 py-2 hover:border-white/40" href="https://github.com/accesslm/accesslm">
                Open-source code
              </a>
              <a className="rounded-lg border border-white/20 px-4 py-2 hover:border-white/40" href="/privacy">
                Privacy
              </a>
              <a className="rounded-lg border border-white/20 px-4 py-2 hover:border-white/40" href="/security">
                Security
              </a>
            </div>
          </div>
          <div className="rounded-3xl border border-white/10 bg-white/5 p-6">
            <div className="flex items-center justify-between text-xs text-white/60">
              <div>AccessLM Chat</div>
              <div>Model: Mistral 7B</div>
            </div>
            <div className="mt-4 space-y-3">
              <div className="rounded-2xl bg-black/40 border border-white/10 px-4 py-3 text-sm text-white/80">
                Welcome to AccessLM. Your prompt stays local while the network lends you compute.
              </div>
              <div className="rounded-2xl bg-emerald-500/20 border border-emerald-400/20 px-4 py-3 text-sm text-white/90 ml-10">
                Summarize the last three papers on decentralized inference.
              </div>
              <div className="rounded-2xl bg-black/40 border border-white/10 px-4 py-3 text-sm text-white/80">
                Connecting to 4 peers. Fetching shards for Llama 3 70B...
              </div>
            </div>
            <div className="mt-4 flex items-center gap-2 text-xs text-white/60">
              <span className="rounded-full bg-white/10 px-2 py-1">Thinking</span>
              <span className="rounded-full bg-white/10 px-2 py-1">Search</span>
              <span className="rounded-full bg-white/10 px-2 py-1">Upload</span>
            </div>
          </div>
        </div>
      </section>

      <section id="how" className="bg-[#0f1117] border-y border-white/10">
        <div className="max-w-6xl mx-auto px-6 py-20">
          <h2 className="text-3xl font-semibold">How it works</h2>
          <div className="mt-10 grid gap-6 md:grid-cols-3">
            <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
              <div className="text-sm text-emerald-300">1. Discover</div>
              <div className="mt-2 text-white/80">Find peers holding model shards using P2P discovery.</div>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
              <div className="text-sm text-emerald-300">2. Split</div>
              <div className="mt-2 text-white/80">Models are sliced into layers and distributed across devices.</div>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
              <div className="text-sm text-emerald-300">3. Run</div>
              <div className="mt-2 text-white/80">Your prompt flows through the swarm and returns a response.</div>
            </div>
          </div>
          <div className="mt-8 text-sm text-white/60">
            Everything is encrypted. No prompts are stored. No central servers exist.
          </div>
        </div>
      </section>

      <section id="roadmap" className="max-w-6xl mx-auto px-6 py-20">
        <h2 className="text-3xl font-semibold">Roadmap</h2>
        <div className="mt-10 grid gap-6 md:grid-cols-2">
          <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
            <div className="text-sm text-sky-300">Now</div>
            <div className="mt-2 text-white/80">Cross-platform desktop app with P2P inference and model sharing.</div>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
            <div className="text-sm text-sky-300">Next</div>
            <div className="mt-2 text-white/80">Hugging Face model pool, shard caching, and campus LAN mode.</div>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
            <div className="text-sm text-sky-300">Soon</div>
            <div className="mt-2 text-white/80">Distributed training experiments and offline-first educator kits.</div>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
            <div className="text-sm text-sky-300">Always</div>
            <div className="mt-2 text-white/80">Open source, privacy first, and free for everyone.</div>
          </div>
        </div>
      </section>

      <section className="max-w-6xl mx-auto px-6 pb-24">
        <div className="rounded-3xl border border-white/10 bg-gradient-to-r from-[#1f2937] to-[#0f172a] p-10">
          <h3 className="text-2xl font-semibold">AccessLM is open infrastructure.</h3>
          <p className="mt-3 text-white/70 max-w-2xl">
            We are not a startup. We are a community tool that turns idle hardware into shared intelligence. You can contribute, fork, or deploy AccessLM anywhere.
          </p>
          <div className="mt-6 flex flex-wrap gap-4">
            <a className="rounded-xl bg-white text-black px-6 py-3 text-sm font-semibold hover:bg-white/90" href="/downloads">
              Get AccessLM
            </a>
            <a className="rounded-xl border border-white/20 px-6 py-3 text-sm font-semibold text-white/90 hover:border-white/40" href="https://github.com/accesslm/accesslm">
              View source
            </a>
          </div>
        </div>
      </section>
    </div>
  );
}
