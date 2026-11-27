#!/usr/bin/env node
// Copies the published research records from the public data repository (Yarong-i/yarong-research-data) into
// src/content (ignored in this repository), so a local build shows the same records as the public site.
//   npm run research:pull
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'yarong-data-'));
execFileSync('git', ['clone', '--quiet', '--depth', '1', 'https://github.com/Yarong-i/yarong-research-data.git', tmp], { stdio: 'inherit' });
for (const dir of ['research', 'performance']) {
  const from = path.join(tmp, 'src', 'content', dir);
  const to = path.join('src', 'content', dir);
  fs.mkdirSync(to, { recursive: true });
  for (const f of fs.existsSync(from) ? fs.readdirSync(from) : []) if (f.endsWith('.json')) fs.copyFileSync(path.join(from, f), path.join(to, f));
}
// The last durable live-trading snapshot (pushed by the server's exporter), shown while the server is off.
const live = path.join(tmp, 'live', 'live-trading.json');
if (fs.existsSync(live)) { fs.mkdirSync('data', { recursive: true }); fs.copyFileSync(live, path.join('data', 'live-trading.json')); }
const liveIndex = path.join(tmp, 'live', 'index.json');
if (fs.existsSync(liveIndex)) { fs.mkdirSync(path.join('public', 'live'), { recursive: true }); fs.copyFileSync(liveIndex, path.join('public', 'live', 'index.json')); }
const liveDays = path.join(tmp, 'live', 'days');
if (fs.existsSync(liveDays)) {
  fs.mkdirSync(path.join('public', 'live', 'days'), { recursive: true });
  for (const f of fs.readdirSync(liveDays)) if (f.endsWith('.json')) fs.copyFileSync(path.join(liveDays, f), path.join('public', 'live', 'days', f));
}
fs.rmSync(tmp, { recursive: true, force: true });
console.log('research records copied from Yarong-i/yarong-research-data');
