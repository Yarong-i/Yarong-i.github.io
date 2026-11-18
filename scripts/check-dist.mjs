#!/usr/bin/env node
// Post-build guard for the real build (dist/):
// 1. every generated /research/<date>/ page has a public source file in src/content/research;
// 2. no fixture record (source system "QA-FIXTURE") or fixture marker appears anywhere in the output.
import fs from 'node:fs';
import path from 'node:path';

const dist = 'dist';
const problems = [];
const researchOut = path.join(dist, 'research');
if (fs.existsSync(researchOut)) {
  for (const id of fs.readdirSync(researchOut)) {
    if (!fs.statSync(path.join(researchOut, id)).isDirectory()) continue;
    const src = path.join('src/content/research', `${id}.json`);
    if (!fs.existsSync(src)) problems.push(`dist/research/${id}/ has no source file ${src}`);
    else if (JSON.parse(fs.readFileSync(src, 'utf8')).draft === true) problems.push(`dist/research/${id}/ was built from a draft`);
  }
}
const walk = (dir) => fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(path.join(dir, e.name)) : [path.join(dir, e.name)]));
for (const file of walk(dist).filter((f) => /\.(html|json|js|xml|txt)$/.test(f))) {
  if (fs.readFileSync(file, 'utf8').includes('QA-FIXTURE')) problems.push(`${file} contains fixture data (QA-FIXTURE)`);
}
if (problems.length) {
  console.error(`check-dist: ${problems.length} problem(s)\n- ${problems.join('\n- ')}`);
  process.exit(1);
}
console.log('check-dist: research pages match their source files; no fixture data in dist/');
