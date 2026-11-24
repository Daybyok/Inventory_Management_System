const { spawn } = require('child_process');
const path = require('path');

const rootDir = path.join(__dirname, '..');
const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm';

const children = [
  spawn(process.execPath, [path.join(rootDir, 'server.js')], {
    cwd: rootDir,
    stdio: 'inherit',
    env: process.env,
  }),
  spawn(npmCommand, ['--prefix', path.join(rootDir, 'client'), 'run', 'dev'], {
    cwd: rootDir,
    stdio: 'inherit',
    shell: process.platform === 'win32',
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
