const http = require('http');
const { detectRuntimes, chooseRuntime, runPrompt } = require('./runtimes');

const DEFAULT_PORT = 7331;

function readJsonBody(req, maxBytes = 1_000_000) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', (chunk) => {
      body += chunk;
      if (body.length > maxBytes) {
        reject(new Error('Request body too large'));
        req.destroy();
      }
    });
    req.on('end', () => {
      try {
        resolve(JSON.parse(body || '{}'));
      } catch (error) {
        reject(error);
      }
    });
  });
}

function startPeerServer({ port = DEFAULT_PORT } = {}) {
  const server = http.createServer(async (req, res) => {
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Access-Control-Allow-Origin', '*');

    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return;
    }

    if (req.url === '/health') {
      res.writeHead(200);
      res.end(JSON.stringify({ ok: true }));
      return;
    }

    if (req.url === '/models') {
      try {
        const detected = await detectRuntimes();
        const models = {};
        Object.entries(detected).forEach(([key, value]) => {
          if (value?.available) {
            models[key] = value.models || [];
          }
        });
        res.writeHead(200);
        res.end(JSON.stringify({ ok: true, models, runtimes: Object.keys(models) }));
      } catch (error) {
        res.writeHead(500);
        res.end(JSON.stringify({ ok: false, error: error.message || String(error) }));
      }
      return;
    }

    if (req.url === '/bootstrap') {
      try {
        const fs = require('fs');
        const os = require('os');
        const path = require('path');
        const peersFile = path.join(os.homedir(), '.accesslm', 'peers.json');
        const data = fs.existsSync(peersFile)
          ? JSON.parse(fs.readFileSync(peersFile, 'utf8'))
          : { peers: [] };
        res.writeHead(200);
        res.end(JSON.stringify({ ok: true, peers: data.peers || [] }));
      } catch (error) {
        res.writeHead(500);
        res.end(JSON.stringify({ ok: false, error: error.message || String(error) }));
      }
      return;
    }

    if (req.url === '/infer' && req.method === 'POST') {
      try {
        const body = await readJsonBody(req);
        const { modelId, message, features, runtime } = body;
        if (!message) {
          res.writeHead(400);
          res.end(JSON.stringify({ ok: false, error: 'Missing message.' }));
          return;
        }

        const detected = await detectRuntimes();
        const selected = chooseRuntime(runtime, detected);
        if (!selected) {
          res.writeHead(503);
          res.end(JSON.stringify({ ok: false, error: 'No local runtime available.' }));
          return;
        }

        const activeModel =
          modelId || detected[selected]?.models?.[0] || 'llama2';

        const response = await runPrompt(selected, activeModel, message, features || {});
        res.writeHead(200);
        res.end(JSON.stringify({ ok: true, response }));
        return;
      } catch (error) {
        res.writeHead(500);
        res.end(JSON.stringify({ ok: false, error: error.message || String(error) }));
        return;
      }
    }

    res.writeHead(404);
    res.end(JSON.stringify({ ok: false, error: 'Not found' }));
  });

  server.listen(port, () => {
    console.log(`AccessLM peer inference server listening on http://0.0.0.0:${port}`);
  });

  return server;
}

module.exports = { startPeerServer, DEFAULT_PORT };
