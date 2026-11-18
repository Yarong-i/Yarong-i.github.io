import { defineConfig } from 'astro/config';

// RESEARCH_SOURCE=fixtures builds the site from tests/fixtures for checks. It uses its own cache and output
// folder, so fixture records can never reach dist/ or the real content cache.
const fixtures = process.env.RESEARCH_SOURCE === 'fixtures';

export default defineConfig({
  site: 'https://yarong-i.github.io',
  output: 'static',
  ...(fixtures ? { outDir: './dist-fixtures', cacheDir: './node_modules/.astro-fixtures' } : {}),
  // Writings are published exactly as written, so straight quotes and dashes are not rewritten.
  markdown: { smartypants: false },
});
