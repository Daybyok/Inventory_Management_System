const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const rootDir = path.join(__dirname, '..');
const clientDir = path.join(rootDir, 'client');
const viteBin = path.join(clientDir, 'node_modules', 'vite', 'bin', 'vite.js');

if (!fs.existsSync(viteBin)) {
  console.error('Client dependencies are not installed. Run: npm --prefix client install');
  process.exit(1);
}

const children = [
  spawn(process.execPath, [path.join(rootDir, 'server.js')], {
    cwd: rootDir,
    stdio: 'inherit',
    env: process.env,
  }),
  spawn(process.execPath, [viteBin], {
    cwd: clientDir,
    stdio: 'inherit',
    env: process.env,
  }),
];

let shuttingDown = false;

function shutdown(code = 0) {
  if (shuttingDown) return;
  shuttingDown = true;
  for (const child of children) {
    if (!child.killed) child.kill();
  }
  process.exit(code);
}

for (const child of children) {
  child.on('exit', (code) => {
    if (!shuttingDown) shutdown(code ?? 0);
  });
  child.on('error', (err) => {
    console.error('Failed to start process:', err.message);
    shutdown(1);
  });
}

process.on('SIGINT', () => shutdown(0));
process.on('SIGTERM', () => shutdown(0));
