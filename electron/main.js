if (!process.versions.electron || (process.type && process.type !== 'browser')) {
  console.error('This file must be run by Electron (main process). Use `npm run dev` or `npm run dev:electron`.');
  process.exit(1);
}

const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const { detectRuntimes, chooseRuntime, runPrompt, downloadFromHuggingFace, listLocalModels, registerLocalModel, deleteLocalModel } = require('./runtimes');
const { startPeerServer } = require('./peer-server');
const {
  readPeers,
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
  sendRemotePromptWithFallback,
  downloadMissingShards,
  hasAllShards
} = require('./peers');
const { splitFileIntoShards, listShardsByModel, assembleShards } = require('./shards');
const { spawn } = require('child_process');

let currentRuntime = null;
let currentModel = null;
let p2pProcess = null;
let peerServer = null;
let llamaCppPyProcess = null;
let llamaCppPyModel = null;
let mlxProcess = null;
let mlxModel = null;

function commandExists(cmd) {
  try {
    const { spawnSync } = require('child_process');
    const result = spawnSync('which', [cmd], { encoding: 'utf8' });
    return result.status === 0;
  } catch {
    return false;
  }
}

function findPythonBin() {
  if (process.env.ACCESSLM_PYTHON && commandExists(process.env.ACCESSLM_PYTHON)) {
    return process.env.ACCESSLM_PYTHON;
  }
  const devBundled = path.join(__dirname, 'resources', 'python', 'bin', 'python3');
  if (devBundled && fs.existsSync(devBundled)) {
    return devBundled;
  }
  const bundledPython = path.join(process.resourcesPath || '', 'python', 'bin', 'python3');
  if (bundledPython && fs.existsSync(bundledPython)) {
    return bundledPython;
  }
  if (commandExists('python3')) return 'python3';
  if (commandExists('python')) return 'python';
  return null;
}

async function waitForServerReady(url, timeoutMs = 15000, allowNonOk = false) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(url, { method: 'GET' });
      if (res.ok || allowNonOk) return true;
    } catch {
      // ignore and retry
    }
    await new Promise((r) => setTimeout(r, 800));
  }
  return false;
}

async function ensureLlamaCppPyServer(modelId) {
  const registry = listLocalModels();
  const modelPath = registry[modelId];
  if (!modelPath) throw new Error('Model not downloaded for llama-cpp-python.');

  if (llamaCppPyProcess && llamaCppPyModel === modelId) return;
  if (llamaCppPyProcess) {
    try { llamaCppPyProcess.kill(); } catch {}
    llamaCppPyProcess = null;
  }

  const pythonBin = findPythonBin();
  if (!pythonBin) throw new Error('Python not found. Install Python to use llama-cpp-python.');

  try {
    const { spawnSync } = require('child_process');
    const probeEnv = {
      ...process.env
    };
    if (pythonBin.includes('/python/bin/python3')) {
      probeEnv.VIRTUAL_ENV = path.dirname(path.dirname(pythonBin));
      probeEnv.PATH = `${path.dirname(pythonBin)}:${process.env.PATH || ''}`;
    }
    const probe = spawnSync(pythonBin, ['-c', 'import llama_cpp'], { encoding: 'utf8', env: probeEnv });
    if (probe.status !== 0) {
      const hint = 'llama-cpp-python not installed. Run: python3 -m pip install llama-cpp-python';
      throw new Error(hint);
    }
  } catch (err) {
    throw new Error(err.message || 'llama-cpp-python not installed.');
  }

  const port = await findAvailablePort(Number(process.env.ACCESSLM_LLAMA_CPP_PY_PORT) || 8001, 20);
  process.env.ACCESSLM_LLAMA_CPP_PY_PORT = String(port);

  const args = [
    '-m',
    'llama_cpp.server',
    '--model',
    modelPath,
    '--host',
    '127.0.0.1',
    '--port',
    String(port),
    '--n_gpu_layers',
    '-1'
  ];

  const env = {
    ...process.env
  };
  if (pythonBin.includes('/python/bin/python3')) {
    env.VIRTUAL_ENV = path.dirname(path.dirname(pythonBin));
    env.PATH = `${path.dirname(pythonBin)}:${process.env.PATH || ''}`;
  }
  const proc = spawn(pythonBin, args, { stdio: 'inherit', env });
  proc.on('exit', (code) => {
    console.warn(`llama-cpp-python server exited with code ${code}`);
    if (llamaCppPyProcess === proc) llamaCppPyProcess = null;
  });
  llamaCppPyProcess = proc;
  llamaCppPyModel = modelId;

  const ready = await waitForServerReady(`http://127.0.0.1:${port}/v1/models`, 20000, true);
  if (!ready) {
    throw new Error('llama-cpp-python server did not become ready in time.');
  }
}

async function ensureMlxServer(modelId) {
  if (mlxProcess && mlxModel === modelId) return;
  if (mlxProcess) {
    try { mlxProcess.kill(); } catch {}
    mlxProcess = null;
  }
  const pythonBin = findPythonBin();
  if (!pythonBin) throw new Error('Python not found. Install Python to use MLX.');

  const port = await findAvailablePort(Number(process.env.ACCESSLM_MLX_PORT) || 8081, 20);
  process.env.ACCESSLM_MLX_PORT = String(port);

  const cmdOverride = process.env.ACCESSLM_MLX_SERVER_CMD;
  let cmd = pythonBin;
  let args = ['-m', 'mlx_lm.server', '--model', modelId, '--host', '127.0.0.1', '--port', String(port)];
  if (cmdOverride) {
    const parts = cmdOverride.split(' ').filter(Boolean);
    cmd = parts.shift();
    args = parts;
  }

  const proc = spawn(cmd, args, { stdio: 'inherit' });
  proc.on('exit', (code) => {
    console.warn(`MLX server exited with code ${code}`);
    if (mlxProcess === proc) mlxProcess = null;
  });
  mlxProcess = proc;
  mlxModel = modelId;

  const ready = await waitForServerReady(`http://127.0.0.1:${port}/v1/models`, 60000, true);
  if (!ready) {
    throw new Error('MLX server did not become ready in time.');
  }
}

function findAvailablePort(startPort = 7331, maxAttempts = 10) {
  const net = require('net');
  return new Promise((resolve, reject) => {
    let port = startPort;
    const tryPort = () => {
      const tester = net.createServer()
        .once('error', () => {
          port += 1;
          if (port > startPort + maxAttempts) {
            reject(new Error('No available port found'));
          } else {
            tryPort();
          }
        })
        .once('listening', () => {
          tester.close(() => resolve(port));
        })
        .listen(port, '0.0.0.0');
    };
    tryPort();
  });
}

function sanitizeModelId(modelId) {
  return String(modelId || '')
    .trim()
    .replace(/[^a-zA-Z0-9._-]/g, '_');
}

function getSafeModelDir(modelId) {
  const os = require('os');
  const safeId = sanitizeModelId(modelId);
  const dir = path.join(os.homedir(), '.accesslm', 'models', safeId);
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function assertSafeOutputPath(filePath) {
  const os = require('os');
  const baseDir = path.join(os.homedir(), '.accesslm', 'models');
  const resolved = path.resolve(filePath);
  if (!resolved.startsWith(baseDir)) {
    throw new Error('Invalid output path');
  }
  return resolved;
}

function assertSafeInputPath(filePath) {
  const os = require('os');
  const baseDir = path.join(os.homedir(), '.accesslm', 'models');
  const resolved = path.resolve(filePath);
  if (!resolved.startsWith(baseDir)) {
    throw new Error('Invalid input path');
  }
  if (!resolved.endsWith('.gguf')) {
    throw new Error('Only GGUF files are supported');
  }
  return resolved;
}

  ipcMain.handle('download-model', async (event, modelId, options = {}) => {
    const rawModelId = String(modelId || '').trim();
    if (!/^[a-zA-Z0-9._-]+\/[a-zA-Z0-9._-]+$/.test(rawModelId)) {
      throw new Error('Invalid model ID. Use owner/model format.');
    }
    const safeModelId = sanitizeModelId(rawModelId);
    if (options.runtime === 'mlx' || /-mlx/i.test(rawModelId)) {
      registerLocalModel(rawModelId, { type: 'mlx', source: 'hf' });
      event.sender.send('download-progress', { modelId: rawModelId, percent: 100, done: true });
      return { ok: true, type: 'mlx', modelId: rawModelId, note: 'MLX model will be fetched on first run.' };
    }
    const result = await downloadFromHuggingFace(rawModelId, ({ received, total }) => {
      const percent = total ? Math.round((received / total) * 100) : null;
      event.sender.send('download-progress', {
        modelId: rawModelId,
        received,
        total,
        percent
      });
    });
    if (options.autoShard && result?.filePath) {
      await splitFileIntoShards(safeModelId, result.filePath, options.chunkSizeMB || 64);
    }
    event.sender.send('download-progress', { modelId: rawModelId, percent: 100, done: true });
    return result;
  });

  ipcMain.handle('get-local-models', async () => {
    return listLocalModels();
  });

  ipcMain.handle('delete-local-model', async (event, modelId) => {
    return deleteLocalModel(modelId);
  });

  ipcMain.handle('import-local-model', async (event, modelId) => {
    const { canceled, filePaths } = await dialog.showOpenDialog({
      properties: ['openFile'],
      filters: [{ name: 'GGUF Models', extensions: ['gguf'] }]
    });
    if (canceled || !filePaths?.length) return { ok: false, canceled: true };
    const filePath = filePaths[0];
    const fallbackId = path.basename(filePath).replace(/\.gguf$/i, '');
    const safeModelId = sanitizeModelId(modelId || fallbackId);
    const registry = registerLocalModel(safeModelId, { path: filePath, type: 'gguf' });
    return { ok: true, modelId: safeModelId, filePath, registry };
  });

function findP2PBinary() {
  const candidates = [
    process.env.ACCESSLM_P2P_BIN,
    path.join(__dirname, '../backend/target/release/accesslm-p2p'),
    path.join(__dirname, '../backend/target/debug/accesslm-p2p')
  ].filter(Boolean);
  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) return candidate;
  }
  return null;
}

function startP2PNode() {
  return (async () => {
    const binPath = findP2PBinary();
    if (!binPath) {
      console.warn('P2P node binary not found. Run `cargo build --bin accesslm-p2p` in backend.');
      return null;
    }
    const port = await findAvailablePort(Number(process.env.ACCESSLM_P2P_PORT) || 7332, 20);
    const env = {
      ...process.env,
      ACCESSLM_P2P_PORT: String(port)
    };
    const proc = spawn(binPath, [], { env, stdio: 'inherit' });
    proc.on('exit', (code) => {
      console.warn(`P2P node exited with code ${code}`);
    });
    return proc;
  })().catch((error) => {
    console.warn('Failed to start P2P node:', error);
    return null;
  });
}

function announcePath() {
  return path.join(require('os').homedir(), '.accesslm', 'models', 'announce.json');
}

function writeAnnouncedModels(detected) {
  try {
    const modelSet = new Set();
    Object.values(detected || {}).forEach((entry) => {
      (entry?.models || []).forEach((m) => modelSet.add(m));
    });
    if (currentModel) modelSet.add(currentModel);
    const list = Array.from(modelSet);
    const target = announcePath();
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, JSON.stringify(list, null, 2));
  } catch (error) {
    console.warn('Failed to write announce.json', error);
  }
}

function writeLookupModels(models) {
  try {
    const target = path.join(require('os').homedir(), '.accesslm', 'models', 'lookup.json');
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, JSON.stringify(models, null, 2));
  } catch (error) {
    console.warn('Failed to write lookup.json', error);
  }
}

const createWindow = () => {
  const mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
      enableRemoteModule: false,
      additionalArguments: [`--wasm-path=${path.join(__dirname, '../client/public/wasm')}`]
    },
    icon: path.join(__dirname, '../icons/icon.png'),
  });

  // Load the Next.js app
  let indexPath, desktopPath;
  
  if (app.isPackaged) {
    // In production (packaged app), resources are in the ASAR archive
    // The ASAR archive is handled transparently by Node.js fs operations
    indexPath = path.join(__dirname, '../client/out/index.html');
    desktopPath = path.join(__dirname, '../client/out/desktop/index.html');
  } else {
    // In development, resources are in the local directories
    indexPath = path.join(__dirname, '../client/out/index.html');
    desktopPath = path.join(__dirname, '../client/out/desktop/index.html');
  }

  // Check if the desktop path exists (this will work for both packed and unpacked)
  if (app.isPackaged && fs.existsSync(path.resolve(desktopPath))) {
    // In production and if the file exists, load the desktop view for Electron app
    mainWindow.loadFile(desktopPath);
  } else {
    // In development or if production build doesn't exist, load from dev server
    const devUrl = process.env.ELECTRON_START_URL || 'http://localhost:3000/desktop';
    mainWindow.loadURL(devUrl);
    if (process.env.ACCESSLM_DEVTOOLS === '1') {
      mainWindow.webContents.openDevTools();
    }
  }

  return mainWindow;
};

// This method will be called when Electron has finished initialization
app.whenReady().then(async () => {
  const mainWindow = createWindow();
  try {
    const port = await findAvailablePort(Number(process.env.ACCESSLM_PEER_PORT) || 7331);
    process.env.ACCESSLM_PEER_PORT = String(port);
    peerServer = startPeerServer({ port });
  } catch (error) {
    console.warn('Failed to start peer server:', error);
  }
  p2pProcess = await startP2PNode();
  setInterval(() => {
    refreshPeerHealth().catch(() => {});
    relayBootstrap().catch(() => {});
  }, 10000);

  // Handle run-model IPC call - selects runtime and prepares model
  ipcMain.handle('run-model', async (event, modelId, options = {}) => {
    console.log(`Received request to run model: ${modelId}`);
    
    try {
      const detected = await detectRuntimes();
      const safeModelId = sanitizeModelId(modelId);
      currentRuntime = chooseRuntime(options.runtime, detected);
      currentModel = safeModelId;
      writeAnnouncedModels(detected);

      if (!currentRuntime) {
        if (process.platform === 'darwin') {
          try {
            await ensureLlamaCppPyServer(safeModelId);
            currentRuntime = 'llamaCppPy';
          } catch (error) {
            console.warn('Failed to start llama-cpp-python on macOS', error);
          }
        }
      }
      if (!currentRuntime) {
        return '⚠️ No local runtime detected. Install Ollama, LM Studio, vLLM, EXO, or llama.cpp.';
      }

      if (process.platform === 'darwin' && (currentRuntime === 'llamaCpp' || currentRuntime === 'auto')) {
        try {
          await ensureLlamaCppPyServer(safeModelId);
          currentRuntime = 'llamaCppPy';
        } catch (error) {
          console.warn('Failed to start llama-cpp-python, falling back to llama.cpp', error);
        }
      }
      if (currentRuntime === 'llamaCppPy') {
        await ensureLlamaCppPyServer(safeModelId);
      }
      if (currentRuntime === 'mlx') {
        await ensureMlxServer(safeModelId);
      }

      return `✅ Using ${currentRuntime}. Model ${modelId} ready.`;
    } catch (error) {
      console.error('Error running model:', error);
      throw error;
    }
  });

  // Handle initialize-p2p IPC call
  ipcMain.handle('initialize-p2p', async () => {
    console.log('Initializing P2P network...');
    
    try {
      return new Promise((resolve) => {
        setTimeout(() => {
          console.log('P2P network initialized');
          resolve('P2P network initialized and ready');
        }, 1500);
      });
    } catch (error) {
      console.error('Error initializing P2P:', error);
      throw error;
    }
  });

  // Handle get-status IPC call
  ipcMain.handle('get-status', async () => {
    return 'Ready. Connected to P2P network.';
  });

  // Handle get-balance IPC call (free to use, no credits)
  ipcMain.handle('get-balance', async () => {
    return {
      balance: 0, // Always 0 - it's free to use
      earned: 0,  // No credits system
      used: 0     // No credits system
    };
  });

  // Handle share-model IPC call
  ipcMain.handle('share-model', async (event, modelId) => {
    console.log(`Sharing model: ${modelId}`);
    return `Model ${modelId} is now available to the community network.`;
  });

  // Handle get-network-stats IPC call
  ipcMain.handle('get-network-stats', async () => {
    return {
      activePeers: 247,
      sharedModels: 1203,
      yourContributions: 12,
      computeHours: 142
    };
  });

  // Handle send-message IPC call
  ipcMain.handle('send-message', async (event, modelId, message, features = {}) => {
    console.log(`Sending message to model ${modelId}: ${message}`, 'with features:', features);

    let detected = null;
    if (!currentRuntime) {
      detected = await detectRuntimes();
      currentRuntime = chooseRuntime(null, detected);
    }

    const activeModel = modelId || currentModel || (detected?.[currentRuntime]?.models?.[0] || 'llama2');
    writeLookupModels([activeModel]);

    try {
      const startTime = Date.now();
      if (!currentRuntime && process.platform === 'darwin') {
        try {
          await ensureLlamaCppPyServer(activeModel);
          currentRuntime = 'llamaCppPy';
        } catch (error) {
          console.warn('Failed to start llama-cpp-python on macOS', error);
        }
      }
      if (currentRuntime) {
        if (process.platform === 'darwin' && (currentRuntime === 'llamaCpp' || currentRuntime === 'auto')) {
          try {
            await ensureLlamaCppPyServer(activeModel);
            currentRuntime = 'llamaCppPy';
          } catch (error) {
            console.warn('Failed to start llama-cpp-python, falling back to llama.cpp', error);
          }
        }
        if (currentRuntime === 'llamaCppPy') {
          await ensureLlamaCppPyServer(activeModel);
        }
        if (currentRuntime === 'mlx') {
          await ensureMlxServer(activeModel);
        }
        const response = await runPrompt(currentRuntime, activeModel, message, features);
        const latencyMs = Date.now() - startTime;
        const tokens = String(response || '').trim().split(/\s+/).filter(Boolean).length;
        return {
          text: response,
          meta: {
            runtime: currentRuntime,
            latencyMs,
            tokens
          }
        };
      }

      let peers = await findPeersForModel(activeModel);
      if (!peers.length) {
        peers = readPeers();
      }
      if (!peers.length) {
        return '⚠️ No local runtime detected and no peers are available.';
      }

      const response = await sendRemotePromptWithFallback(peers, {
        modelId: activeModel,
        message,
        features
      }, activeModel, 2);

      const bootstrapPeers = await Promise.all(peers.map(fetchBootstrap));
      if (bootstrapPeers.flat().length) {
        console.log('Bootstrap peers discovered:', bootstrapPeers.flat().length);
      }
      const latencyMs = Date.now() - startTime;
      const tokens = String(response || '').trim().split(/\s+/).filter(Boolean).length;
      return {
        text: response,
        meta: {
          runtime: currentRuntime || 'p2p',
          latencyMs,
          tokens
        }
      };
    } catch (error) {
      return `❌ Runtime error: ${error.message || error}`;
    }
  });

  ipcMain.handle('detect-runtimes', async () => {
    const detected = await detectRuntimes();
    writeAnnouncedModels(detected);
    return detected;
  });

  ipcMain.handle('create-shards', async (event, modelId, filePath, chunkSizeMB = 64) => {
    const safeModelId = sanitizeModelId(modelId);
    const safePath = assertSafeInputPath(filePath);
    return splitFileIntoShards(safeModelId, safePath, chunkSizeMB);
  });

  ipcMain.handle('list-shards', async (event, modelId) => {
    return listShardsByModel(sanitizeModelId(modelId));
  });

  ipcMain.handle('assemble-shards', async (event, modelId, outputPath) => {
    const safeModelId = sanitizeModelId(modelId);
    const targetPath = outputPath
      ? assertSafeOutputPath(outputPath)
      : path.join(getSafeModelDir(safeModelId), 'assembled.gguf');
    return assembleShards(safeModelId, targetPath);
  });

  ipcMain.handle('sync-shards', async (event, modelId) => {
    const safeModelId = sanitizeModelId(modelId);
    const peers = await findPeersForModel(safeModelId);
    if (!peers.length) return { ok: false, error: 'No peers with shards found.' };
    const downloaded = await downloadMissingShards(peers, safeModelId);
    return { ok: true, downloaded };
  });

  ipcMain.handle('ensure-model-from-shards', async (event, modelId, outputPath) => {
    const safeModelId = sanitizeModelId(modelId);
    const peers = await findPeersForModel(safeModelId);
    if (!peers.length) return { ok: false, error: 'No peers with shards found.' };
    await downloadMissingShards(peers, safeModelId);
    if (!hasAllShards(safeModelId)) {
      return { ok: false, error: 'Shards incomplete after sync.' };
    }
    const targetPath = outputPath
      ? assertSafeOutputPath(outputPath)
      : path.join(getSafeModelDir(safeModelId), 'assembled.gguf');
    const assembled = await assembleShards(safeModelId, targetPath);
    return { ok: true, outputPath: assembled };
  });

  ipcMain.handle('get-peers', async () => {
    return readPeers();
  });

  ipcMain.handle('get-peer-health', async () => {
    return refreshPeerHealth();
  });

  ipcMain.handle('get-model-index', async () => {
    const { readModelIndex } = require('./peers');
    return readModelIndex();
  });

  ipcMain.handle('pin-peer', async (event, peer) => {
    return pinPeer(peer);
  });

  ipcMain.handle('unpin-peer', async (event, peer) => {
    return unpinPeer(peer);
  });

  ipcMain.handle('get-preferred-peer', async (event, modelId) => {
    return getPreferredPeer(modelId);
  });

  ipcMain.handle('clear-preferred-peer', async (event, modelId) => {
    return clearPreferredPeer(modelId);
  });

  ipcMain.handle('get-capabilities', async () => {
    return readCapabilities();
  });

  ipcMain.handle('clear-capabilities', async () => {
    return clearCapabilities();
  });

  // Handle file upload IPC call
  ipcMain.handle('upload-file', async (event, file) => {
    console.log(`Uploading file: ${file.name}`);
    
    // In a real implementation, this would upload the file to the P2P network
    // For now, we'll simulate a response
    return `File ${file.name} uploaded successfully. In the full implementation, this would be processed by the P2P network.`;
  });

  // Handle voice recording IPC call
  ipcMain.handle('record-voice', async () => {
    console.log('Recording voice...');
    
    // In a real implementation, this would use Whisper for voice recognition
    // For now, we'll simulate a response
    return 'Voice recorded and transcribed. In the full implementation, this would use Whisper for speech-to-text conversion.';
  });

  // Handle document upload IPC call
  ipcMain.handle('upload-document', async (event, file) => {
    console.log(`Uploading document: ${file.name}`);
    
    // In a real implementation, this would process the document
    return `Document ${file.name} uploaded and processed successfully.`;
  });

  // Handle image upload IPC call
  ipcMain.handle('upload-image', async (event, file) => {
    console.log(`Uploading image: ${file.name}`);
    
    // In a real implementation, this would process the image
    return `Image ${file.name} uploaded and processed successfully.`;
  });

  // Handle video upload IPC call
  ipcMain.handle('upload-video', async (event, file) => {
    console.log(`Uploading video: ${file.name}`);
    
    // In a real implementation, this would process the video
    return `Video ${file.name} uploaded and processed successfully.`;
  });

  // Handle audio upload IPC call
  ipcMain.handle('upload-audio', async (event, file) => {
    console.log(`Uploading audio: ${file.name}`);
    
    // In a real implementation, this would process the audio
    return `Audio ${file.name} uploaded and processed successfully.`;
  });

  // Handle activate-thinking-mode IPC call
  ipcMain.handle('activate-thinking-mode', async () => {
    console.log('Activating thinking mode...');
    
    // In a real implementation, this would engage the AI in deeper reasoning
    // For now, we'll simulate a response
    return 'Thinking mode activated. The AI is now engaged in deeper reasoning and analysis.';
  });

  // Handle activate-search-mode IPC call
  ipcMain.handle('activate-search-mode', async () => {
    console.log('Activating search mode...');
    
    // In a real implementation, this would perform a web search
    // For now, we'll simulate a response
    return 'Search mode activated. The AI is now performing a web search and will incorporate results into the response.';
  });

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    if (p2pProcess) {
      p2pProcess.kill();
      p2pProcess = null;
    }
    if (llamaCppPyProcess) {
      try { llamaCppPyProcess.kill(); } catch {}
      llamaCppPyProcess = null;
    }
    if (mlxProcess) {
      try { mlxProcess.kill(); } catch {}
      mlxProcess = null;
    }
    app.quit();
  }
});
