import type { CollectionEntry } from 'astro:content';

export function getWritingExcerpt(writing: CollectionEntry<'writings'>): string {
  const manualExcerpt = writing.data.excerpt?.trim();
  if (manualExcerpt) return manualExcerpt;

  const lines = (writing.body ?? '')
    .split(/\r?\n/)
    .map((line) => line
      .replace(/^#{1,6}\s+/, '')
      .replace(/^[-*>]\s+/, '')
      .replace(/!\[[^\]]*\]\([^)]*\)/g, '')
      .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
      .replace(/[*_`~]/g, '')
      .trim())
    .filter(Boolean)
    .slice(0, 3);

  return lines.join(' ');
}
