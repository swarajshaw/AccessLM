const { spawnSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');
const https = require('https');

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

async function detectRuntimes() {
  const ollama = await fetchJson('http://localhost:11434/api/tags');
  const lmstudio = await fetchJson('http://localhost:1234/v1/models');
  const vllm = await fetchJson('http://localhost:8000/v1/models');
  const exo = await fetchJson('http://localhost:8080/v1/models');
  const llamaCli = which('llama-cli') || which('llama.cpp') || which('llama');

  return {
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
    llamaCpp: {
      available: !!llamaCli,
      path: llamaCli
    }
  };
}

function chooseRuntime(preferred, detected) {
  if (preferred && detected[preferred]?.available) return preferred;
  if (detected.ollama.available) return 'ollama';
  if (detected.lmstudio.available) return 'lmstudio';
  if (detected.vllm.available) return 'vllm';
  if (detected.exo.available) return 'exo';
  if (detected.llamaCpp.available) return 'llamaCpp';
  return null;
}

async function runPrompt(runtime, modelId, prompt, features = {}) {
  if (runtime === 'ollama') {
    const res = await fetch('http://localhost:11434/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: modelId, prompt, stream: false })
    });
    const data = await res.json();
    return data.response || 'No response from Ollama.';
  }

  const openAiUrls = {
    lmstudio: 'http://localhost:1234/v1/chat/completions',
    vllm: 'http://localhost:8000/v1/chat/completions',
    exo: 'http://localhost:8080/v1/chat/completions'
  };

  if (runtime in openAiUrls) {
    const res = await fetch(openAiUrls[runtime], {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: modelId,
        messages: [{ role: 'user', content: prompt }],
        temperature: features.thinking ? 0.2 : 0.7
      })
    });
    const data = await res.json();
    return data.choices?.[0]?.message?.content || 'No response from runtime.';
  }

  if (runtime === 'llamaCpp') {
    const registry = readRegistry();
    const modelPath = registry[modelId];
    if (!modelPath) throw new Error('Model not downloaded for llama.cpp.');
    const llamaBin = which('llama-cli') || which('llama.cpp') || which('llama');
    if (!llamaBin) throw new Error('llama.cpp binary not found in PATH.');
    const result = spawnSync(llamaBin, ['-m', modelPath, '-p', prompt], { encoding: 'utf8' });
    if (result.status !== 0) throw new Error(result.stderr || 'llama.cpp failed.');
    return result.stdout.trim();
  }

  throw new Error('No runtime available.');
}

function sanitizeModelIdForPath(modelId) {
  return String(modelId || '')
    .trim()
    .replace(/[^a-zA-Z0-9._-]/g, '_');
}

async function downloadFromHuggingFace(modelId) {
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

  await new Promise((resolve, reject) => {
    const file = fs.createWriteStream(filePath);
    https.get(downloadUrl, (response) => {
      if (response.statusCode !== 200) {
        reject(new Error(`Download failed: ${response.statusCode}`));
        return;
      }
      response.pipe(file);
      file.on('finish', () => file.close(resolve));
    }).on('error', (err) => {
      fs.unlinkSync(filePath);
      reject(err);
    });
  });

  const registry = readRegistry();
  registry[modelId] = filePath;
  writeRegistry(registry);

  return { filePath, fileName: preferred };
}

module.exports = {
  detectRuntimes,
  chooseRuntime,
  runPrompt,
  downloadFromHuggingFace
};
