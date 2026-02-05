// This is the main entry point for the application
// It will start both the Next.js dev server and the Electron app

const { spawn } = require('child_process');
const path = require('path');
const http = require('http');

// Get the path to the electron executable
const electronPath = 'npx electron';

function waitForServer(url, timeoutMs = 20000) {
  const startedAt = Date.now();
  return new Promise((resolve, reject) => {
    const tick = () => {
      const req = http.get(url, (res) => {
        res.resume();
        if (res.statusCode && res.statusCode < 500) {
          resolve();
        } else if (Date.now() - startedAt > timeoutMs) {
          reject(new Error(`Server not ready at ${url} (status ${res.statusCode})`));
        } else {
          setTimeout(tick, 500);
        }
      });
      req.on('error', () => {
        if (Date.now() - startedAt > timeoutMs) {
          reject(new Error(`Server not reachable at ${url}`));
        } else {
          setTimeout(tick, 500);
        }
      });
    };
    tick();
  });
}

async function start() {
  // Use a fixed port for the website (default 3000) so web and desktop stay separate
  const { default: getPort } = await import('get-port');
  const desiredPort = Number(process.env.PORT || 3000);
  const port = await getPort({ port: [desiredPort] });
  if (port !== desiredPort) {
    console.error(
      `Port ${desiredPort} is already in use. ` +
      `Stop the process using it or set PORT to another value.`
    );
    process.exit(1);
  }
  console.log(`Starting AccessLM development environment on port ${port}...`);

  // Start Next.js dev server
  console.log('Starting Next.js dev server...');
  const nextServer = spawn('npm', ['run', 'dev'], {
    cwd: path.join(__dirname, 'client'),
    stdio: 'inherit',
    env: { ...process.env, PORT: String(port) }
  });

  // Wait for Next.js to be reachable before launching Electron
  const desktopUrl = `http://localhost:${port}/desktop`;
  console.log('Waiting for Next.js to be ready...');
  await waitForServer(desktopUrl);

  console.log('Starting Electron app...');
  const electronApp = spawn('npx', ['electron', '.'], {
    cwd: __dirname,
    stdio: 'inherit',
    env: {
      ...process.env,
      ELECTRON_START_URL: desktopUrl
    }
  });

  electronApp.on('close', (code) => {
    console.log(`Electron app exited with code ${code}`);
    process.exit(code);
  });

  nextServer.on('close', (code) => {
    console.log(`Next.js server exited with code ${code}`);
    process.exit(code);
  });
}

start().catch((err) => {
  console.error('Failed to start dev environment:', err);
  process.exit(1);
});
