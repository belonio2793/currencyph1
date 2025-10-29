#!/usr/bin/env node
// Restarting supervisor for populate-nearby-batch
import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';

const LOG = path.resolve(process.cwd(), 'populate-nearby-batch.log');
const RETRY_DELAY_MS = Number(process.env.RETRY_DELAY_MS || 30000);
let child = null;
let stopping = false;

function start() {
  const out = fs.createWriteStream(LOG, { flags: 'a' });
  out.write('\n=== STARTING populate-nearby-batch: ' + new Date().toISOString() + ' ===\n');

  child = spawn(process.platform === 'win32' ? 'npm.cmd' : 'npm', ['run', 'populate-nearby-batch'], {
    env: { ...process.env },
    stdio: ['ignore', 'pipe', 'pipe']
  });

  child.stdout.pipe(out);
  child.stderr.pipe(out);

  child.on('exit', (code, signal) => {
    out.write(`\nProcess exited with code=${code} signal=${signal} at ${new Date().toISOString()}\n`);
    if (stopping) {
      out.end('Stopped by user\n');
      process.exit(0);
    }
    out.write(`Restarting in ${RETRY_DELAY_MS / 1000}s...\n`);
    setTimeout(() => start(), RETRY_DELAY_MS);
  });

  child.on('error', (err) => {
    out.write(`\nChild process error: ${err.message}\n`);
  });
}

function stop() {
  stopping = true;
  if (child && !child.killed) {
    child.kill('SIGTERM');
    setTimeout(() => {
      if (child && !child.killed) child.kill('SIGKILL');
    }, 5000);
  } else {
    process.exit(0);
  }
}

process.on('SIGINT', stop);
process.on('SIGTERM', stop);

start();
