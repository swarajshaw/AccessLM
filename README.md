# AccessLM — Run LLMs on Any Laptop. No Cloud. No Login. No Cost.

> _"I ran Llama 3 70B on my 8GB laptop. No GPU. No credit card. Just AccessLM."_

AccessLM lets you run large language models — like Llama 3, Mistral, and Phi-3 — **on any device**, even a 10-year-old laptop with 8GB RAM.

No signup. No cloud. No payment. No tracking.

It works by splitting the model across peers in a decentralized network — just like BitTorrent shares files. Your device helps others… and others help you.

Built on [libp2p](https://libp2p.io/) and [Hugging Face Hub](https://huggingface.co/) — the open-source P2P framework used by researchers worldwide.

This is not a startup. This is not a company. This is open infrastructure for shared compute.

**You are not a customer. You are a co-owner.**

---

## ✅ How to Use

1. **Download** the latest version for your OS:
   → [Releases](https://github.com/swarajshaw/AccessLM/releases)

2. **Open** the app (no install needed)

3. **Enter a Hugging Face model ID** (e.g., `TheBloke/Mistral-7B-v0.1-GGUF`)

4. **Click "Run Model"**

5. **Wait 10–60 seconds** as peers share model layers or download from Hugging Face

6. **Ask your question** — and get an answer, powered by the network

---

## 🌍 Who Is This For?

- Students who can't afford GPUs
- Researchers in low-resource countries
- Teachers running AI demos on old classroom laptops
- Anyone who believes AI should be free

---

## 🔒 Privacy & Security

- Your prompts are **encrypted** and sent only to peers
- No data is stored on any server
- No IP logging. No cookies. No analytics
- You can use AccessLM as a **client only** — no need to share your own compute
- All code is open source and auditable

---

## 💡 How It Works (Technically)

1. You enter a model (e.g., `meta-llama/Meta-Llama-3-8B`)
2. AccessLM uses **libp2p DHT** to discover peers holding parts of the model
3. If no peer has it, one peer downloads from Hugging Face Hub
4. Your device runs some layers. Others run the rest
5. Your prompt flows through the network:
   `You → Peer A (Layer 1–3) → Peer B (Layer 4–6) → ... → Response → You`
6. Result appears — no server involved. Ever.

---

## 🛠️ For Developers

- Built with **Electron + Next.js + Rust (WASM)**
- MIT Licensed — fork, modify, redistribute freely
- Add new models by entering any Hugging Face GGUF model ID
- Want to share your compute? Toggle "Share My Device" in settings

---

## 📦 Build Installers

1. Build the web assets:
   `npm run build`
2. Package the desktop app:
   `npm run dist`

Notes:

- macOS `.dmg` and `.zip` are generated on macOS.
- Windows `.exe` (NSIS) is best built on Windows or a CI runner with Windows.

---

## 📬 Contribute

Found a bug? Want to add a new feature? Open an issue or PR on GitHub:
👉 https://github.com/swarajshaw/AccessLM

This project belongs to everyone.

— Built with love, not profit.
