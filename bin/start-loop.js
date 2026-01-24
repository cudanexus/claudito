#!/usr/bin/env node

/**
 * Runs build-and-start in a loop for development.
 * When the server exits (e.g., via Development > Shutdown), it rebuilds and restarts.
 * Press Ctrl+C twice quickly to fully exit.
 */

const { spawn } = require('child_process');
const path = require('path');

// Enable dev mode via environment variable
process.env.CLAUDITO_DEV_MODE = '1';

const isWindows = process.platform === 'win32';
const npm = isWindows ? 'npm.cmd' : 'npm';

let lastExitTime = 0;
let isExiting = false;

function run() {
  console.log('\n=== Starting build and run cycle ===\n');

  const child = spawn(npm, ['run', 'build-and-start'], {
    cwd: path.resolve(__dirname, '..'),
    stdio: 'inherit',
    shell: true,
    env: { ...process.env, CLAUDITO_DEV_MODE: '1' }
  });

  child.on('exit', (code) => {
    if (isExiting) {
      process.exit(code || 0);
    }

    const now = Date.now();

    if (now - lastExitTime < 2000) {
      console.log('\n=== Quick restart detected, exiting loop ===\n');
      process.exit(code || 0);
    }

    lastExitTime = now;
    console.log(`\n=== Server exited with code ${code}, restarting in 1 second... ===\n`);
    setTimeout(run, 1000);
  });

  child.on('error', (err) => {
    console.error('Failed to start process:', err.message);
    setTimeout(run, 2000);
  });
}

process.on('SIGINT', () => {
  const now = Date.now();

  if (now - lastExitTime < 2000) {
    console.log('\n=== Exiting loop ===\n');
    isExiting = true;
    process.exit(0);
  }

  lastExitTime = now;
  console.log('\n=== Press Ctrl+C again to exit loop ===\n');
});

console.log('Starting build-and-start loop (Ctrl+C twice to exit)...');
run();
