import { getCollection } from 'astro:content';

export type FeedKind = 'game' | 'bot' | 'research' | 'site';
export const FEED_LABEL: Record<FeedKind, string> = {
  game: '게임',
  bot: '봇',
  research: '연구',
  site: '홈페이지',
};

export interface FeedItem { date: Date; kind: FeedKind; title: string; href?: string; }

const newestFirst = (a: { data: { date: Date } ; id: string }, b: { data: { date: Date }; id: string }) =>
  b.data.date.getTime() - a.data.date.getTime() || b.id.localeCompare(a.id);

/**
 * Home's "최근 소식": the newest project updates (game, bot, site) from src/content/news. Daily research records
 * are not part of it - they stay in 주식 연구 and its date list - so stock days never push project news out.
 * Only entries with a real date are included; nothing is dated by build time.
 */
export async function getFeed(limit = 3): Promise<FeedItem[]> {
  const news = (await getCollection('news', ({ data }) => !data.draft && data.home && data.kind !== 'research')).sort(newestFirst);
  return news.slice(0, limit).map(({ data }) => ({
    date: data.date,
    kind: data.kind,
    title: data.title,
    href: data.href ?? (data.project ? `/projects/${data.project}/#updates` : undefined),
  }));
}

/** A project's update log, newest first. */
export async function getProjectUpdates(projectId: string) {
  return (await getCollection('news', ({ data }) => !data.draft && data.project === projectId)).sort(newestFirst);
}

export function formatFeedDate(date: Date): string {
  return new Intl.DateTimeFormat('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit', timeZone: 'Asia/Seoul' }).format(date).replace(/\.$/, '');
}
