import { getCollection } from 'astro:content';
import { getResearchDays, formatResearchDate } from './research';

export type FeedKind = 'game' | 'bot' | 'research' | 'site' | 'writing';
export const FEED_LABEL: Record<FeedKind, string> = {
  game: '게임 패치',
  bot: '봇 업데이트',
  research: '새 연구',
  site: '사이트',
  writing: '새 글',
};

export interface FeedItem { date: Date; kind: FeedKind; title: string; href?: string; }

/**
 * Home's "최근 소식": dated news files, every public research day, and writings grouped by the day they were
 * published. Only entries that carry a real date are included; nothing is dated by build time.
 */
export async function getFeed(limit = 6): Promise<FeedItem[]> {
  const news = await getCollection('news', ({ data }) => !data.draft);
  const research = await getResearchDays();
  const writings = await getCollection('writings', ({ data }) => !data.draft && data.publishedAt !== undefined);

  const items: FeedItem[] = news.map(({ data }) => ({ date: data.date, kind: data.kind, title: data.title, href: data.href }));
  // Only the newest research day goes into the feed (dated by its trading day); the full list is on /research.
  for (const day of research.slice(0, 1)) {
    const names = day.data.models.flatMap((m) => m.premarket.picks.map((p) => p.name));
    items.push({
      date: day.data.date,
      kind: 'research',
      title: `${formatResearchDate(day.data.date)} 거래일 연구${names.length ? ` · ${[...new Set(names)].join(', ')}` : ''}`,
      href: `/research/${day.id}/`,
    });
  }

  const byDay = new Map<string, { date: Date; titles: string[] }>();
  for (const w of writings) {
    const date = w.data.publishedAt!;
    const key = date.toISOString().slice(0, 10);
    const group = byDay.get(key) ?? { date, titles: [] };
    group.titles.push(w.data.title);
    byDay.set(key, group);
  }
  for (const { date, titles } of byDay.values()) {
    items.push({
      date,
      kind: 'writing',
      title: titles.length === 1 ? `「${titles[0]}」 공개` : `글 ${titles.length}편 공개`,
      href: '/writings',
    });
  }

  return items.sort((a, b) => b.date.getTime() - a.date.getTime()).slice(0, limit);
}

export function formatFeedDate(date: Date): string {
  return new Intl.DateTimeFormat('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit', timeZone: 'Asia/Seoul' }).format(date).replace(/\.$/, '');
}
