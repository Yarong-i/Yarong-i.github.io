#!/usr/bin/env node
// Builds the site from tests/fixtures into dist-fixtures/ (own cache) for checking research layouts and rules.
import { spawnSync } from 'node:child_process';
const env = { ...process.env, RESEARCH_SOURCE: 'fixtures' };
const run = (cmd, args) => { const r = spawnSync(cmd, args, { stdio: 'inherit', env, shell: process.platform === 'win32' }); if (r.status !== 0) process.exit(r.status ?? 1); };
run('node', ['scripts/clean-content-cache.mjs', '--fixtures']);
run('npx', ['astro', 'build']);
