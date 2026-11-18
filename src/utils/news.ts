import { getCollection } from 'astro:content';
import { getResearchDays, formatResearchDate } from './research';

export type FeedKind = 'game' | 'bot' | 'research' | 'site';
export const FEED_LABEL: Record<FeedKind, string> = {
  game: '게임 패치',
  bot: '봇 업데이트',
  research: '새 연구',
  site: '사이트',
};

export interface FeedItem { date: Date; kind: FeedKind; title: string; href?: string; }

/**
 * Home's "최근 소식": dated news files and research days (dated by their trading day). Personal writings are
 * not part of the feed. The limit is applied after everything is merged and sorted, so no slot stays empty
 * while dated items exist. Only entries that carry a real date are included; nothing is dated by build time.
 */
export async function getFeed(limit = 6): Promise<FeedItem[]> {
  const news = await getCollection('news', ({ data }) => !data.draft);
  const research = await getResearchDays();

  const items: FeedItem[] = news.map(({ data }) => ({ date: data.date, kind: data.kind, title: data.title, href: data.href }));
  for (const day of research) {
    const names = day.data.models.flatMap((m) => m.premarket.picks.map((p) => p.name));
    items.push({
      date: day.data.date,
      kind: 'research',
      title: `${formatResearchDate(day.data.date)} 거래일 연구${names.length ? ` · ${[...new Set(names)].join(', ')}` : ''}`,
      href: `/research/${day.id}/`,
    });
  }

  return items.sort((a, b) => b.date.getTime() - a.date.getTime()).slice(0, limit);
}

export function formatFeedDate(date: Date): string {
  return new Intl.DateTimeFormat('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit', timeZone: 'Asia/Seoul' }).format(date).replace(/\.$/, '');
}
