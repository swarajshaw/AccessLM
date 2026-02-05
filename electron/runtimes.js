const { spawnSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');
const https = require('https');

let cachedRuntimes = null;
let cachedAt = 0;
const RUNTIME_CACHE_MS = 15000;

const MODEL_REGISTRY = path.join(os.homedir(), '.accesslm', 'models', 'registry.json');

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function readRegistry() {
  try {
    return JSON.parse(fs.readFileSync(MODEL_REGISTRY, 'utf8'));
  } catch {
    return {};
  }
}

function writeRegistry(registry) {
  ensureDir(path.dirname(MODEL_REGISTRY));
  fs.writeFileSync(MODEL_REGISTRY, JSON.stringify(registry, null, 2));
}

function listLocalModels() {
  return readRegistry();
}

function registerLocalModel(modelId, fileEntry) {
  if (!modelId || !fileEntry) throw new Error('Model ID and file path are required.');
  const registry = readRegistry();
  registry[modelId] = fileEntry;
  writeRegistry(registry);
  return registry;
}

function deleteLocalModel(modelId) {
  const registry = readRegistry();
  const entry = registry[modelId];
  if (!entry) return { ok: false, error: 'Model not found.' };
  const filePath = typeof entry === 'string' ? entry : entry?.path;
  if (filePath && fs.existsSync(filePath)) {
    try {
      fs.unlinkSync(filePath);
    } catch {
      // ignore file delete errors
    }
  }
  delete registry[modelId];
  writeRegistry(registry);
  return { ok: true };
}

function which(cmd) {
  const result = spawnSync('which', [cmd], { encoding: 'utf8' });
  if (result.status === 0) return result.stdout.trim();
  return null;
}

async function fetchJson(url, timeoutMs = 1500) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

function findBundledPython() {
  const devBundled = path.join(__dirname, 'resources', 'python', 'bin', 'python3');
  if (fs.existsSync(devBundled)) return devBundled;
  const packaged = path.join(process.resourcesPath || '', 'python', 'bin', 'python3');
  if (process.resourcesPath && fs.existsSync(packaged)) return packaged;
  return null;
}

function hasPythonModule(pythonBin, moduleName) {
  if (!pythonBin) return false;
  const result = spawnSync(pythonBin, ['-c', `import ${moduleName}`], { encoding: 'utf8' });
  return result.status === 0;
}

async function detectRuntimes() {
  if (cachedRuntimes && Date.now() - cachedAt < RUNTIME_CACHE_MS) {
    return cachedRuntimes;
  }
  const ollama = await fetchJson('http://localhost:11434/api/tags');
  const lmstudio = await fetchJson('http://localhost:1234/v1/models');
  const vllm = await fetchJson('http://localhost:8000/v1/models');
  const exo = await fetchJson('http://localhost:8080/v1/models');
  const llamaCppPyPort = Number(process.env.ACCESSLM_LLAMA_CPP_PY_PORT) || 8001;
  const mlxPort = Number(process.env.ACCESSLM_MLX_PORT) || 8081;
  const llamaCppPy = await fetchJson(`http://localhost:${llamaCppPyPort}/v1/models`);
  const llamaCli = which('llama-cli') || which('llama.cpp') || which('llama');
  const mlxServer = await fetchJson(`http://localhost:${mlxPort}/v1/models`);
  const bundledPython = findBundledPython() || (which('python3') || which('python'));
  const hasLlamaCppPy = hasPythonModule(bundledPython, 'llama_cpp');
  const hasMlxLm = hasPythonModule(bundledPython, 'mlx_lm');

  cachedRuntimes = {
    ollama: {
      available: !!ollama,
      models: ollama?.models?.map((m) => m.name) || []
    },
    lmstudio: {
      available: !!lmstudio,
      models: lmstudio?.data?.map((m) => m.id) || []
    },
    vllm: {
      available: !!vllm,
      models: vllm?.data?.map((m) => m.id) || []
    },
    exo: {
      available: !!exo,
      models: exo?.data?.map((m) => m.id) || []
    },
    llamaCppPy: {
      available: !!llamaCppPy || hasLlamaCppPy,
      models: llamaCppPy?.data?.map((m) => m.id) || []
    },
    mlx: {
      available: !!mlxServer || hasMlxLm,
      models: mlxServer?.data?.map((m) => m.id) || []
    },
    llamaCpp: {
      available: !!llamaCli,
      path: llamaCli
    }
  };
  cachedAt = Date.now();
  return cachedRuntimes;
}

function chooseRuntime(preferred, detected) {
  if (preferred && detected[preferred]?.available) return preferred;
  if (detected.ollama.available) return 'ollama';
  if (detected.lmstudio.available) return 'lmstudio';
  if (detected.vllm.available) return 'vllm';
  if (detected.exo.available) return 'exo';
  if (detected.mlx?.available) return 'mlx';
  if (process.platform === 'darwin' && detected.llamaCppPy?.available) return 'llamaCppPy';
  if (detected.llamaCpp.available) return 'llamaCpp';
  return null;
}

async function runPrompt(runtime, modelId, prompt, features = {}) {
  const cleanedPrompt = String(prompt || '').trim();
  if (!cleanedPrompt) throw new Error('Prompt is empty.');
  const searchHint = features.search
    ? 'Search mode is enabled. You do NOT have live web access. If the user asks for real-time info, say you cannot browse and answer from local knowledge.'
    : '';

  if (runtime === 'ollama') {
    const res = await fetch('http://localhost:11434/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: modelId,
        prompt: searchHint ? `${searchHint}\n\n${cleanedPrompt}` : cleanedPrompt,
        stream: false
      })
    });
    const data = await res.json();
    return data.response || 'No response from Ollama.';
  }

  const openAiUrls = {
    lmstudio: 'http://localhost:1234/v1/chat/completions',
    vllm: 'http://localhost:8000/v1/chat/completions',
    exo: 'http://localhost:8080/v1/chat/completions',
    mlx: `http://localhost:${Number(process.env.ACCESSLM_MLX_PORT) || 8081}/v1/chat/completions`,
    llamaCppPy: `http://localhost:${Number(process.env.ACCESSLM_LLAMA_CPP_PY_PORT) || 8001}/v1/chat/completions`
  };

  if (runtime in openAiUrls) {
    const url = openAiUrls[runtime];
    const payload = {
      model: modelId,
      messages: [
        ...(searchHint ? [{ role: 'system', content: searchHint }] : []),
        { role: 'user', content: cleanedPrompt }
      ],
      temperature: features.thinking ? 0.2 : 0.7
    };
    let lastErr = null;
    const attempts = runtime === 'mlx' ? 8 : 3;
    const delayMs = runtime === 'mlx' ? 1000 : 500;
    for (let attempt = 0; attempt < attempts; attempt += 1) {
      try {
        const res = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        const data = await res.json();
        return data.choices?.[0]?.message?.content || 'No response from runtime.';
      } catch (err) {
        lastErr = err;
        await new Promise((r) => setTimeout(r, delayMs));
      }
    }
    throw new Error(lastErr?.message || 'Runtime request failed.');
  }

  if (runtime === 'llamaCpp') {
    const registry = readRegistry();
    const entry = registry[modelId];
    const modelPath = typeof entry === 'string' ? entry : entry?.path;
    if (!modelPath) throw new Error('Model not downloaded for llama.cpp.');
    const llamaBin = which('llama-cli') || which('llama.cpp') || which('llama');
    if (!llamaBin) throw new Error('llama.cpp binary not found in PATH.');
    const cpuThreads = Math.max(1, (os.cpus()?.length || 4) - 1);
    const finalPrompt = searchHint ? `${searchHint}\n\n${cleanedPrompt}` : cleanedPrompt;
    const args = [
      '-m',
      modelPath,
      '-p',
      finalPrompt,
      '-n',
      String(features.maxTokens || 256),
      '-t',
      String(features.threads || cpuThreads),
      '-b',
      String(features.batchSize || 256),
      '--ctx-size',
      String(features.ctxSize || 2048),
      '--temp',
      String(features.thinking ? 0.2 : 0.7),
      '--simple-io'
    ];
    const baseEnv = { ...process.env };
    const runOnce = (env) =>
      spawnSync(llamaBin, args, {
      encoding: 'utf8',
      timeout: features.timeoutMs || 60000,
      maxBuffer: 10 * 1024 * 1024,
      env
    });

    let result = runOnce(baseEnv);
    const stderrText = String(result.stderr || '');
    const stdoutText = String(result.stdout || '');
    const metalError = /ggml_metal|tensor api disabled|metal/i.test(stderrText + stdoutText);

    if (process.platform === 'darwin' && metalError) {
      const cpuEnv = {
        ...baseEnv,
        GGML_METAL_DISABLE: '1',
        GGML_METAL_USE_TENSOR: '0',
        GGML_METAL: '0',
        LLAMA_METAL: '0'
      };
      const cpuArgs = [...args, '--n-gpu-layers', '0', '--no-mmap'];
      result = spawnSync(llamaBin, cpuArgs, {
        encoding: 'utf8',
        timeout: features.timeoutMs || 60000,
        maxBuffer: 10 * 1024 * 1024,
        env: cpuEnv
      });
    }

    if (result.error && result.error.code === 'ETIMEDOUT') {
      throw new Error('llama.cpp timed out. Try a smaller model or reduce context size.');
    }
    if (result.status !== 0) {
      const errText = String(result.stderr || '').trim();
      throw new Error(errText || 'llama.cpp failed.');
    }
    const output = String(result.stdout || '').trim();
    if (!output && String(result.stderr || '').trim()) {
      // Avoid failing on metal warnings if we still got a successful run.
      return output;
    }
    return output;
  }

  throw new Error('No runtime available.');
}

function sanitizeModelIdForPath(modelId) {
  return String(modelId || '')
    .trim()
    .replace(/[^a-zA-Z0-9._-]/g, '_');
}

async function downloadFromHuggingFace(modelId, onProgress) {
  const apiUrl = `https://huggingface.co/api/models/${modelId}`;
  const meta = await fetchJson(apiUrl, 5000);
  if (!meta) throw new Error('Unable to reach Hugging Face.');

  const candidates = (meta.siblings || [])
    .map((file) => file.rfilename)
    .filter((name) => name.endsWith('.gguf'));

  if (candidates.length === 0) {
    throw new Error('No GGUF file found for this model. Use a GGUF repo like *-GGUF.');
  }

  const preferred = candidates.find((n) => n.toLowerCase().includes('q4_k_m')) || candidates[0];
  const downloadUrl = `https://huggingface.co/${modelId}/resolve/main/${preferred}`;

  const safeId = sanitizeModelIdForPath(modelId);
  const modelDir = path.join(os.homedir(), '.accesslm', 'models', safeId);
  ensureDir(modelDir);
  const filePath = path.join(modelDir, preferred);

  const downloadWithRedirects = (url, redirects = 0) => new Promise((resolve, reject) => {
    if (redirects > 5) {
      reject(new Error('Download failed: too many redirects'));
      return;
    }
    const file = fs.createWriteStream(filePath);
    https.get(url, (response) => {
      const total = Number(response.headers['content-length'] || 0);
      let received = 0;
      if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
        file.close(() => {});
        fs.unlinkSync(filePath);
        downloadWithRedirects(response.headers.location, redirects + 1).then(resolve).catch(reject);
        return;
      }
      if (response.statusCode !== 200) {
        file.close(() => {});
        fs.unlinkSync(filePath);
        reject(new Error(`Download failed: ${response.statusCode}`));
        return;
      }
      response.on('data', (chunk) => {
        received += chunk.length;
        if (onProgress) {
          onProgress({ received, total });
        }
      });
      response.pipe(file);
      file.on('finish', () => file.close(resolve));
    }).on('error', (err) => {
      file.close(() => {});
      fs.unlinkSync(filePath);
      reject(err);
    });
  });

  await downloadWithRedirects(downloadUrl);

  const registry = readRegistry();
  registry[modelId] = { path: filePath, type: 'gguf' };
  writeRegistry(registry);

  return { filePath, fileName: preferred };
}

module.exports = {
  detectRuntimes,
  chooseRuntime,
  runPrompt,
  downloadFromHuggingFace,
  listLocalModels,
  registerLocalModel,
  deleteLocalModel
};
