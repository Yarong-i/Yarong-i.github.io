#!/usr/bin/env node
// Astro 7.0.6 keeps collection entries in <cacheDir>/data-store.json and, when a collection folder becomes empty,
// does not drop entries whose files were deleted: the deleted page is still generated, even into a clean dist/.
// Removing the store before every build makes each build read the content folders as they are.
//   node scripts/clean-content-cache.mjs              # real build cache (node_modules/.astro)
//   node scripts/clean-content-cache.mjs --fixtures   # fixture build cache (node_modules/.astro-fixtures)
import fs from 'node:fs';
const dir = process.argv.includes('--fixtures') ? 'node_modules/.astro-fixtures' : 'node_modules/.astro';
for (const file of ['data-store.json']) {
  const target = `${dir}/${file}`;
  if (fs.existsSync(target)) { fs.rmSync(target); console.log(`removed ${target}`); }
}
