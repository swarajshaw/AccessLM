const fs = require('fs');
const path = require('path');

const outDir = path.join(__dirname, '..', 'client', 'out');
const srcNext = path.join(outDir, '_next');
const desktopDir = path.join(outDir, 'desktop');
const desktopNext = path.join(desktopDir, '_next');

if (!fs.existsSync(outDir)) {
  console.error('No client/out directory found. Run the Next.js build first.');
  process.exit(1);
}

if (!fs.existsSync(srcNext)) {
  console.error('No client/out/_next directory found. Build output is missing.');
  process.exit(1);
}

if (!fs.existsSync(desktopDir)) {
  console.error('No client/out/desktop directory found. Desktop export is missing.');
  process.exit(1);
}

fs.rmSync(desktopNext, { recursive: true, force: true });
fs.cpSync(srcNext, desktopNext, { recursive: true });

console.log('Copied /_next assets into /desktop/_next for packaged desktop build.');
