#!/usr/bin/env node
// Copies the published research records from the research-data branch into src/content (ignored on main),
// so a local build shows the same records as the public site.
//   npm run research:pull
import { execFileSync } from 'node:child_process';
const git = (...args) => execFileSync('git', args, { stdio: 'inherit' });
git('fetch', '--quiet', 'origin', 'research-data');
git('checkout', 'origin/research-data', '--', 'src/content/research', 'src/content/performance');
git('reset', '--quiet', '--', 'src/content/research', 'src/content/performance');
console.log('research records copied from origin/research-data');
