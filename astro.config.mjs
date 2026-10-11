import { defineConfig } from 'astro/config';

export default defineConfig({
  site: 'https://yarong-i.github.io',
  output: 'static',
  // Writings are published exactly as written, so straight quotes and dashes are not rewritten.
  markdown: { smartypants: false },
});
