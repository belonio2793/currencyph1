#!/usr/bin/env node

import fs from 'fs';
import { spawn } from 'child_process';
import path from 'path';

const logFile = '/tmp/populate-nearby.log';
const limit = process.env.LIMIT || '15';

const outStream = fs.createWriteStream(logFile, { flags: 'a' });

console.log(`[${new Date().toISOString()}] Starting population with LIMIT=${limit}`);
console.log(`[${new Date().toISOString()}] Log file: ${logFile}\n`);

const proc = spawn('node', ['scripts/populate-nearby-real-tripadvisor.js'], {
  env: { ...process.env, LIMIT: limit },
  stdio: ['inherit', 'pipe', 'pipe']
});

proc.stdout.pipe(outStream);
proc.stderr.pipe(outStream);

proc.stdout.on('data', (data) => {
  process.stdout.write(data);
});

proc.stderr.on('data', (data) => {
  process.stderr.write(data);
});

proc.on('close', (code) => {
  console.log(`\n[${new Date().toISOString()}] Process exited with code ${code}`);
  console.log(`\nTo see full log: cat ${logFile}\n`);
  process.exit(code);
});
