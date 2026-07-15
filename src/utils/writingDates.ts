import type { CollectionEntry } from 'astro:content';

type Writing = CollectionEntry<'writings'>;

const time = (date?: Date) => date?.getTime();
const compareTitle = (a: Writing, b: Writing) => a.data.title.localeCompare(b.data.title, 'ko-KR');

function compareByWrittenAt(a: Writing, b: Writing, direction: 'newest' | 'oldest'): number {
  const aTime = time(a.data.writtenAt);
  const bTime = time(b.data.writtenAt);

  if (aTime === undefined && bTime === undefined) {
    return b.data.publishedAt.getTime() - a.data.publishedAt.getTime() || compareTitle(a, b);
  }
  if (aTime === undefined) return 1;
  if (bTime === undefined) return -1;

  const writtenOrder = direction === 'newest' ? bTime - aTime : aTime - bTime;
  return writtenOrder
    || b.data.publishedAt.getTime() - a.data.publishedAt.getTime()
    || compareTitle(a, b);
}

export function sortWritings(writings: readonly Writing[], direction: 'newest' | 'oldest' = 'newest'): Writing[] {
  return [...writings].sort((a, b) => compareByWrittenAt(a, b, direction));
}

export function formatWritingDate(date: Date, style: 'numeric' | 'long' = 'numeric'): string {
  return style === 'long'
    ? new Intl.DateTimeFormat('ko-KR', { dateStyle: 'long' }).format(date)
    : new Intl.DateTimeFormat('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit' }).format(date);
}
