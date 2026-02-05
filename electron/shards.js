const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');

const SHARD_DIR = path.join(os.homedir(), '.accesslm', 'shards');
const REGISTRY_FILE = path.join(SHARD_DIR, 'registry.json');

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function readRegistry() {
  try {
    return JSON.parse(fs.readFileSync(REGISTRY_FILE, 'utf8'));
  } catch {
    return { shards: [] };
  }
}

function writeRegistry(registry) {
  ensureDir(SHARD_DIR);
  fs.writeFileSync(REGISTRY_FILE, JSON.stringify(registry, null, 2));
}

function sha256File(filePath) {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash('sha256');
    const stream = fs.createReadStream(filePath);
    stream.on('data', (data) => hash.update(data));
    stream.on('end', () => resolve(hash.digest('hex')));
    stream.on('error', reject);
  });
}

async function splitFileIntoShards(modelId, filePath, chunkSizeMB = 64) {
  const stat = fs.statSync(filePath);
  const chunkSize = chunkSizeMB * 1024 * 1024;
  const totalChunks = Math.ceil(stat.size / chunkSize);
  const modelDir = path.join(SHARD_DIR, modelId.replace('/', '--'));
  ensureDir(modelDir);

  const registry = readRegistry();
  const shards = [];

  for (let i = 0; i < totalChunks; i++) {
    const start = i * chunkSize;
    const end = Math.min(start + chunkSize, stat.size);
    const shardId = `${modelId.replace('/', '--')}-${i}-${start}-${end}`;
    const shardPath = path.join(modelDir, `${shardId}.bin`);

    await new Promise((resolve, reject) => {
      const read = fs.createReadStream(filePath, { start, end: end - 1 });
      const write = fs.createWriteStream(shardPath);
      read.pipe(write);
      read.on('error', reject);
      write.on('error', reject);
      write.on('finish', resolve);
    });

    const digest = await sha256File(shardPath);
    const entry = {
      shardId,
      modelId,
      file: shardPath,
      size: end - start,
      sha256: digest,
      index: i,
      total: totalChunks
    };
    shards.push(entry);
    registry.shards.push(entry);
  }

  writeRegistry(registry);
  return shards;
}

function listShardsByModel(modelId) {
  const registry = readRegistry();
  return registry.shards.filter((s) => s.modelId === modelId);
}

function getShardById(shardId) {
  const registry = readRegistry();
  return registry.shards.find((s) => s.shardId === shardId);
}

async function assembleShards(modelId, outputPath) {
  const shards = listShardsByModel(modelId).sort((a, b) => a.index - b.index);
  if (!shards.length) {
    throw new Error('No shards found for model');
  }
  ensureDir(path.dirname(outputPath));
  const write = fs.createWriteStream(outputPath);
  for (const shard of shards) {
    await new Promise((resolve, reject) => {
      const read = fs.createReadStream(shard.file);
      read.on('error', reject);
      read.on('end', resolve);
      read.pipe(write, { end: false });
    });
  }
  write.end();
  return outputPath;
}

module.exports = {
  readRegistry,
  writeRegistry,
  splitFileIntoShards,
  listShardsByModel,
  getShardById,
  sha256File,
  assembleShards
};
