import { getCollection, type CollectionEntry } from 'astro:content';

export type ResearchDay = CollectionEntry<'research'>;
export type ModelRun = ResearchDay['data']['models'][number];
export type Pick = ModelRun['premarket']['picks'][number];
export type PriceResult = ModelRun['postmarket']['results'][number];
export type Performance = CollectionEntry<'performance'>;

export const PREMARKET_LABEL: Record<ModelRun['premarket']['status'], string> = {
  pending: '발표 대기',
  published: '발표',
  'no-picks': '추천 없음',
  failed: '실행 실패',
};
/**
 * The premarket state shown everywhere (Home, date list, detail, strategy rule). A failed run is 추천 미발행 only
 * when the record carries the research system's reason code for it; otherwise it stays 실행 실패. 추천 없음 is
 * only the research system's own no-picks status.
 */
export type PremarketKey = ModelRun['premarket']['status'] | 'withheld';
export function premarketState(run: ModelRun): { key: PremarketKey; label: string; note?: string } {
  const pre = run.premarket;
  if (pre.status === 'failed' && pre.reasonCode === 'EVIDENCE_ALL_EXCLUDED') {
    const n = pre.excluded.length;
    return { key: 'withheld', label: '추천 미발행', note: n > 0 ? `근거 검증 실패 · 제안 ${n}종목 모두 제외` : '근거 검증 실패' };
  }
  return { key: pre.status, label: PREMARKET_LABEL[pre.status] };
}
export const POSTMARKET_LABEL: Record<ModelRun['postmarket']['status'], string> = {
  pending: '장후 대기',
  reviewed: '장후 반영',
  nothing: '복기 대상 없음',
  failed: '장후 실패',
};

/** The mock-strategy buy threshold. It decides only whether the filter strategy buys; it never hides a pick. */
export const FILTER_SCORE = 10;
export const STRATEGY_LABEL = { base: '기본 전략', filter10: `${FILTER_SCORE}점 필터 전략` } as const;

/** Public research days, newest trading day first. */
export async function getResearchDays(): Promise<ResearchDay[]> {
  const days = await getCollection('research', ({ data }) => !data.draft);
  return days.sort((a, b) => b.data.date.getTime() - a.data.date.getTime());
}

export async function getPerformance(): Promise<Performance[]> {
  return getCollection('performance');
}

const kst = (opts: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat('ko-KR', { timeZone: 'Asia/Seoul', ...opts });

export function formatResearchDate(date: Date): string {
  return kst({ year: 'numeric', month: '2-digit', day: '2-digit', weekday: 'short' }).format(date);
}
export const isoDay = (date: Date) => date.toISOString().slice(0, 10);

/** "11.03 (월) 08:19" in KST for an ISO timestamp; undefined input stays undefined. */
export function formatStamp(iso?: string, withDate = true): string | undefined {
  if (!iso) return undefined;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return undefined;
  const parts = Object.fromEntries(kst({ month: '2-digit', day: '2-digit', weekday: 'short', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })
    .formatToParts(d).map((p) => [p.type, p.value]));
  const time = `${parts.hour}:${parts.minute}`;
  return withDate ? `${parts.month}.${parts.day} (${parts.weekday}) ${time}` : time;
}

export function formatPct(value: number): string {
  const sign = value > 0 ? '+' : value < 0 ? '−' : '';
  return `${sign}${Math.abs(value).toFixed(2)}%`;
}
/** A figure the research system stated; null/undefined means not computable yet or not linked - never 0. */
export const isPct = (v: number | null | undefined): v is number => typeof v === 'number' && Number.isFinite(v);

/** The ledger's exposures: share of the day's starting equity put into the final first choice. */
export const EXPOSURES = [
  { key: '1.0', label: '100%' },
  { key: '0.5', label: '50%' },
  { key: '0.3', label: '30%' },
] as const;
/** "11.27" from "2026-11-27" or a Date. */
export const monthDay = (d?: string | Date) => (d ? (typeof d === 'string' ? d : d.toISOString().slice(0, 10)).slice(5, 10).replace('-', '.') : undefined);

export const modelSlug = (model: string) => `m-${model.toLowerCase().replace(/[^a-z0-9가-힣]+/g, '-').replace(/^-|-$/g, '')}`;

/** Regular-session open→close change of the stock, only from a confirmed open and close. */
export function openToClose(result?: PriceResult): number | undefined {
  if (!result || result.status === 'unconfirmed' || !result.open || result.close === undefined) return undefined;
  return ((result.close - result.open) / result.open) * 100;
}

export function resultFor(run: ModelRun, ticker: string): PriceResult | undefined {
  return run.postmarket.results.find((r) => r.ticker === ticker);
}

/** What to show in the 시가→종가 cell. Never a 0 for a missing value. */
export function returnCell(run: ModelRun, pick: Pick): { text: string; value?: number; tone: 'up' | 'down' | 'flat' | 'none' } {
  const value = openToClose(resultFor(run, pick.ticker));
  if (value !== undefined) return { text: formatPct(value), value, tone: value > 0 ? 'up' : value < 0 ? 'down' : 'flat' };
  if (run.postmarket.status === 'pending') return { text: '장후 대기', tone: 'none' };
  if (run.postmarket.status === 'failed') return { text: '장후 실패', tone: 'none' };
  return { text: '미확인', tone: 'none' };
}

/**
 * The first choice the source declares: the final rank after its checks when present (finalRank 1), otherwise a
 * declared rank 1. Undefined when the source declared no rank - list position is never used.
 */
export const firstRanked = (run: ModelRun) =>
  run.premarket.picks.find((p) => p.finalRank === 1) ?? (run.premarket.picks.some((p) => p.finalRank !== undefined) ? undefined : run.premarket.picks.find((p) => p.rank === 1));
export const hasRanks = (run: ModelRun) => run.premarket.picks.some((p) => p.rank !== undefined || p.finalRank !== undefined);
export const displayName = (run: { model: string; label?: string; short?: string }, short = false) => (short ? run.short : run.label) ?? run.label ?? run.model;

/** Home shows each model's first-ranked pick when ranks exist, otherwise every pick (nothing is hidden by score). */
export function homePicks(run: ModelRun): Pick[] {
  if (run.premarket.status !== 'published') return [];
  const first = firstRanked(run);
  return first ? [first] : run.premarket.picks;
}

export interface StrategyDecision { buys: boolean | undefined; text: string; }
/**
 * Whether each mock strategy's BUY CONDITION is met on this day, from the rules as defined: base = a first-ranked
 * pick exists; filter10 = that pick's score is FILTER_SCORE or more. This is the rule check only. Whether the
 * research system actually recorded a mock buy is `executedText`, and returns come only from its ledger.
 */
export function strategyDecisions(run: ModelRun): { base: StrategyDecision; filter10: StrategyDecision } {
  const status = run.premarket.status;
  if (status === 'pending') return { base: { buys: undefined, text: '발표 대기' }, filter10: { buys: undefined, text: '발표 대기' } };
  if (status !== 'published') {
    const text = `매수 없음 (${premarketState(run).label})`;
    return { base: { buys: false, text }, filter10: { buys: false, text } };
  }
  const first = firstRanked(run);
  if (!first) {
    const text = '1순위 미지정 · 판단 보류';
    return { base: { buys: undefined, text }, filter10: { buys: undefined, text } };
  }
  const base = { buys: true, text: `조건 충족 · ${first.name}` };
  if (first.score === undefined) return { base, filter10: { buys: undefined, text: '점수 없음 · 판단 보류' } };
  return {
    base,
    filter10: first.score >= FILTER_SCORE
      ? { buys: true, text: `조건 충족 · ${first.name} ${first.score}점` }
      : { buys: false, text: `조건 미충족 · ${first.score}점 < ${FILTER_SCORE}점` },
  };
}

type StrategyKey = 'base' | 'filter10';
/** The research system's own record of whether the mock buy happened. Absent → 미연동. */
export function executedText(run: ModelRun, key: StrategyKey): string {
  const s = run.strategy?.[key];
  if (!s) return '미연동';
  if (s.executed) return `모의 매수 실행${s.name ? ` · ${s.name}` : ''}`;
  return `모의 매수 없음${s.detail ? ` · ${s.detail}` : ' · 현금 유지'}`;
}

const shortDay = (iso: string) => iso.slice(5).replace('-', '.');

export interface PerfCell { text: string; note?: string; tone: 'up' | 'down' | 'flat' | 'none'; }
const tone = (v: number): PerfCell['tone'] => (v > 0 ? 'up' : v < 0 ? 'down' : 'flat');

/**
 * Main-table cells for one model on one trading day, all from the research system's base strategy:
 * the day's own ledger snapshot when it exists; otherwise 장후 대기 for the day and the latest published
 * cumulative with its real as-of date; 미연동 when there is no strategy data at all.
 */
export function strategyCells(run: ModelRun, latest?: Performance): { day: PerfCell; cum: PerfCell } {
  const s = run.strategy?.base;
  // Only attach ledger qualifications to the matching snapshot; never borrow a later period's flags.
  const matchingLedger = latest && (!s || s.asOf === isoDay(latest.data.asOf)) ? latest.data : undefined;
  const qualifications = [
    matchingLedger?.includesProvisional.length ? `잠정 종가 포함: ${matchingLedger.includesProvisional.map(shortDay).join(', ')}` : undefined,
    matchingLedger?.unverifiedCorrections.length ? `KRX 공식 미대조 정정 종가 포함: ${matchingLedger.unverifiedCorrections.map(shortDay).join(', ')}` : undefined,
  ].filter(Boolean).join(' · ');
  const qualify = (note: string) => [note, qualifications].filter(Boolean).join(' · ');
  if (s) {
    // The period is the model's own: a model added later starts later, so its cumulative names its start.
    const period = `${s.startDate ? `${shortDay(s.startDate)}~` : ''}${shortDay(s.asOf)}`;
    const day: PerfCell = isPct(s.dayPct)
      ? { text: formatPct(s.dayPct), tone: tone(s.dayPct), note: !s.executed ? '현금' : s.final ? undefined : '잠정' }
      : s.dayPending ? { text: '미완료', tone: 'none', note: '가격 확정 대기' } : { text: '미확인', tone: 'none' };
    const cum: PerfCell = isPct(s.cumPct)
      ? { text: formatPct(s.cumPct), tone: tone(s.cumPct), note: qualify(`${period}${s.final ? '' : ' · 잠정 포함'}`) }
      : s.cumPending ? { text: '미완료', tone: 'none', note: `${period} · 가격 확정 대기` } : { text: '미확인', tone: 'none' };
    return { day, cum };
  }
  if (latest) {
    const v = latest.data.cumulativePct;
    const period = `${latest.data.startDate ? `${monthDay(latest.data.startDate)}~` : ''}${shortDay(isoDay(latest.data.asOf))}`;
    return { day: { text: '장후 대기', tone: 'none' },
      cum: isPct(v) ? { text: formatPct(v), tone: tone(v), note: qualify(period) } : { text: '미완료', tone: 'none', note: `${period} · 가격 확정 대기` } };
  }
  return { day: { text: '미연동', tone: 'none' }, cum: { text: '미연동', tone: 'none' } };
}

export const latestPerformance = (perf: Performance[], model: string, key: StrategyKey = 'base') =>
  perf.find((p) => p.data.model === model && p.data.strategy === key);

/** Name the importer gives a run that recorded no model. Such runs stay in the day records but have no strategy. */
export const UNKNOWN_MODEL = '모델 미기록';

/** Named models that appear in any research day, in first-seen order (newest day first). */
export function modelsIn(days: ResearchDay[]): string[] {
  const seen: string[] = [];
  for (const d of days) for (const m of d.data.models) if (m.model !== UNKNOWN_MODEL && !seen.includes(m.model)) seen.push(m.model);
  return seen;
}
