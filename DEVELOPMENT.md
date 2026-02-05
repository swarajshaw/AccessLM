# AccessLM - Decentralized AI Access Platform

AccessLM enables running large language models on any device through a peer-to-peer network, without requiring powerful hardware or cloud services.

## 🚀 Quick Start

### Prerequisites
- Node.js (v18 or higher)
- Rust (with wasm32 target)
- npm or yarn

### Installation

1. Clone the repository:
```bash
git clone https://github.com/swarajshaw/AccessLM.git
cd accesslm
```

2. Install dependencies:
```bash
npm install
cd client && npm install
```

3. Build the Rust WASM backend:
```bash
cd backend
./build-wasm.sh
```

4. Run the development server:
```bash
npm run dev
```

This will start both the Next.js development server and the Electron app.

## 🏗️ Project Structure

```
accesslm/
├── client/                 # Next.js frontend
│   ├── app/               # Main pages
│   ├── components/        # Reusable components
│   ├── lib/              # Utility functions
│   └── public/           # Static assets
├── electron/             # Electron wrapper
│   ├── main.js           # Main process
│   └── preload.js        # Preload script
├── backend/              # Rust WASM backend
│   ├── src/             # Rust source code
│   ├── Cargo.toml       # Rust dependencies
│   └── build-wasm.sh    # Build script
├── public/               # Public assets
└── icons/                # Application icons
```

## 🛠️ Development

### Running in Development Mode
```bash
npm run dev
```

### Building for Production
```bash
# Build the Next.js app
cd client && npm run build && npm run export

# Package the Electron app
npm run dist
```

### Building the WASM Backend
```bash
cd backend
./build-wasm.sh
```

## 🌐 Features

- **P2P Model Sharing**: Share model fragments across peers
- **Hugging Face Integration**: Access any GGUF model from Hugging Face Hub
- **Cross-Platform**: Works on Windows, macOS, and Linux
- **Privacy First**: No data collection, all processing local
- **GPU Optional**: Run models on CPU with quantized weights

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🎯 Roadmap

- [ ] Full libp2p integration for P2P networking
- [ ] Real model sharding and distribution
- [ ] Hugging Face model downloader
- [ ] Performance optimizations
- [ ] Mobile app support
- [ ] Advanced privacy controls
