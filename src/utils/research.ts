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

export interface PerfCell {
  text: string;
  tone: 'up' | 'down' | 'flat' | 'none';
  /** Short state next to the value: 잠정 / 현금 / 가격 확정 대기. */
  note?: string;
  /** The model's own cumulative period, start~as of (shown with every cumulative). */
  period?: string;
  /** Short source flags shown under the cumulative: 잠정 포함 / 미대조 포함. */
  flags?: string[];
}
/** What 성과 기준 보기 lists for one model: its own period and the source's flags with their dates. */
export interface PerfBasis { period?: string; provisional: string[]; unverified: string[]; }
const tone = (v: number): PerfCell['tone'] => (v > 0 ? 'up' : v < 0 ? 'down' : 'flat');

/**
 * Main-table cells for one model on one trading day, all from the research system's base strategy:
 * the day's own ledger snapshot when it exists; otherwise 장후 대기 for the day and the latest published
 * cumulative with its real as-of date; 집계 전 when the model has no strategy figures yet (e.g. a model added later).
 * Flags come only from this model's own figures for the same as-of date: a later or earlier snapshot's flags and
 * another model's flags are never borrowed.
 */
export function strategyCells(run: ModelRun, latest?: Performance): { day: PerfCell; cum: PerfCell; basis: PerfBasis } {
  const s = run.strategy?.base;
  const matchingLedger = latest && (!s || s.asOf === isoDay(latest.data.asOf)) ? latest.data : undefined;
  const provisional = [...new Set([...(matchingLedger?.includesProvisional ?? []), ...(s && s.final === false ? [s.asOf] : [])])].sort();
  const unverified = [...(matchingLedger?.unverifiedCorrections ?? [])].sort();
  const flags = [provisional.length ? '잠정 포함' : undefined, unverified.length ? '미대조 포함' : undefined].filter((x): x is string => Boolean(x));
  if (s) {
    // The period is the model's own: a model added later starts later, so its cumulative names its start.
    const period = `${s.startDate ? `${shortDay(s.startDate)}~` : ''}${shortDay(s.asOf)}`;
    const day: PerfCell = isPct(s.dayPct)
      ? { text: formatPct(s.dayPct), tone: tone(s.dayPct), note: !s.executed ? '현금' : s.final ? undefined : '잠정' }
      : s.dayPending ? { text: '미완료', tone: 'none', note: '가격 확정 대기' } : { text: '미확인', tone: 'none' };
    const cum: PerfCell = isPct(s.cumPct)
      ? { text: formatPct(s.cumPct), tone: tone(s.cumPct), period, flags }
      : s.cumPending ? { text: '미완료', tone: 'none', period, note: '가격 확정 대기' } : { text: '미확인', tone: 'none', period };
    return { day, cum, basis: { period, provisional, unverified } };
  }
  if (latest) {
    const v = latest.data.cumulativePct;
    const period = `${latest.data.startDate ? `${monthDay(latest.data.startDate)}~` : ''}${shortDay(isoDay(latest.data.asOf))}`;
    return { day: { text: '장후 대기', tone: 'none' },
      cum: isPct(v) ? { text: formatPct(v), tone: tone(v), period, flags } : { text: '미완료', tone: 'none', period, note: '가격 확정 대기' },
      basis: { period, provisional, unverified } };
  }
  const waiting = run.postmarket.status === 'pending';
  return { day: { text: waiting ? '장후 대기' : '집계 전', tone: 'none' }, cum: { text: '집계 전', tone: 'none' }, basis: { provisional: [], unverified: [] } };
}

/**
 * Names on Home: the short name, except where two models share it (Astra / Astra 6.2), where each shows its full
 * label so the versions are told apart (GPT-6 Astra / GPT-6.2 Astra). A role note in parentheses is dropped (the
 * role has its own mark).
 */
export function tableNames(runs: ModelRun[]): Map<string, string> {
  const first = (r: ModelRun): string => (r.short ?? r.label ?? r.model).split(/\s+/)[0] ?? r.model;
  const counts = new Map<string, number>();
  for (const r of runs) counts.set(first(r), (counts.get(first(r)) ?? 0) + 1);
  return new Map(runs.map((r) => [r.model, (counts.get(first(r))! > 1 ? (r.label ?? r.short ?? r.model) : (r.short ?? r.label ?? r.model))
    .replace(/\s*\([^)]*\)\s*$/, '')]));
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

/* ---------- 누적 모의 성과 graph (Home) ---------- */

/**
 * Fixed look per model id (never by display name), so GPT-6 Astra and GPT-6.2 Astra never share a colour or a
 * line. A model not listed here takes the next colour and marker no other model on the graph uses. Markers
 * differ too, so a line is never told apart by colour alone.
 */
const MODEL_LOOK: Record<string, { color: string; marker: Marker }> = {
  'claude-sonnet-5': { color: '#F5F5F7', marker: 'circle' },
  'claude-opus-5-5': { color: '#E8A24A', marker: 'square' },
  'gpt-6-astra': { color: '#5BB8F0', marker: 'triangle' },
  'claude-fable-5-2': { color: '#C98BE8', marker: 'diamond' },
  'gpt-6.2-astra': { color: '#4FD39A', marker: 'cross' },
};
export type Marker = 'circle' | 'square' | 'triangle' | 'diamond' | 'cross';
const SPARE = ['#F08A8A', '#B8C45A', '#7FA0FF', '#D6B37A', '#9EE6E0', '#F2C6E8', '#C7C7CC'];
const MARKERS: Marker[] = ['circle', 'square', 'triangle', 'diamond', 'cross'];
/** Looks for the models on one graph: listed ids keep theirs, the others take unused ones in order. */
export function modelLooks(models: string[]): Map<string, { color: string; marker: Marker }> {
  const out = new Map<string, { color: string; marker: Marker }>();
  const used = new Set(models.filter((m) => MODEL_LOOK[m]).map((m) => MODEL_LOOK[m]!.color));
  const palette = [...Object.values(MODEL_LOOK).map((l) => l.color), ...SPARE].filter((c) => !used.has(c));
  let k = 0;
  models.forEach((m, i) => {
    out.set(m, MODEL_LOOK[m] ?? { color: palette[k++ % palette.length]!, marker: MARKERS[i % MARKERS.length]! });
  });
  return out;
}

export interface ChartPoint { date: string; cum: number; provisional: boolean; unverified: boolean; }
export interface ChartSeries {
  model: string; name: string; color: string; marker: Marker;
  points: ChartPoint[];
  /** Runs of points with no recorded trading day missing between them; a missing day breaks the line. */
  segments: ChartPoint[][];
  /** Trading days after the first point with no figure for this model (shown as 기록 없음). */
  missing: string[];
}

/**
 * The base first-choice strategy's cumulative per model and per as-of day, exactly as each day's record states it
 * (strategy.base with asOf equal to that trading day and a numeric cumPct). Nothing is computed from daily
 * returns, nothing is carried forward, nothing is drawn before a model's first figure.
 * - Models are keyed by id, in the order the latest record lists them, then any other model with figures.
 *   A run whose model was not recorded (모델 미기록) is not attributed to any model.
 * - 잠정: a day up to this point has final=false, or the latest performance file lists it as provisional.
 *   미대조: the latest performance file lists a KRX-unverified corrected close on or before this day.
 *   (The same sources the table uses, so the latest point and the table agree.)
 */
export function performanceSeries(days: ResearchDay[], performance: Performance[]): { dates: string[]; series: ChartSeries[] } {
  const asc = [...days].sort((a, b) => a.data.date.getTime() - b.data.date.getTime());
  const trading = asc.filter((d) => d.data.market !== 'closed').map((d) => isoDay(d.data.date));
  const latest = days[0];
  const order: string[] = [];
  for (const m of latest?.data.models ?? []) if (m.model !== UNKNOWN_MODEL && !order.includes(m.model)) order.push(m.model);
  const raw = new Map<string, { date: string; cum: number; final: boolean }[]>();
  for (const d of asc) {
    const date = isoDay(d.data.date);
    for (const m of d.data.models) {
      if (m.model === UNKNOWN_MODEL) continue;
      const b = m.strategy?.base;
      if (!b || b.asOf !== date || !isPct(b.cumPct)) continue;
      const list = raw.get(m.model) ?? [];
      if (!list.some((x) => x.date === date)) list.push({ date, cum: b.cumPct, final: b.final });
      raw.set(m.model, list);
    }
  }
  for (const id of raw.keys()) if (!order.includes(id)) order.push(id);
  const names = tableNames(latest?.data.models ?? []);
  const nameOf = (id: string) => names.get(id)
    ?? (asc.flatMap((d) => d.data.models).reverse().find((m) => m.model === id)?.short)
    ?? performance.find((p) => p.data.model === id)?.data.short ?? id;
  const dateSet = new Set<string>();
  const looks = modelLooks(order);
  const series = order.map((model) => {
    const perf = latestPerformance(performance, model);
    const provList = perf?.data.includesProvisional ?? [];
    const unvList = perf?.data.unverifiedCorrections ?? [];
    const list = raw.get(model) ?? [];
    let anyProvisional = false;
    const points: ChartPoint[] = list.map((x) => {
      if (!x.final || provList.includes(x.date)) anyProvisional = true;
      dateSet.add(x.date);
      return { date: x.date, cum: x.cum, provisional: anyProvisional || provList.some((d) => d <= x.date), unverified: unvList.some((d) => d <= x.date) };
    });
    const segments: ChartPoint[][] = [];
    const missing: string[] = [];
    points.forEach((pt, i) => {
      const prev = points[i - 1];
      const gap = prev ? trading.filter((t) => t > prev.date && t < pt.date) : [];
      missing.push(...gap);
      if (!prev || gap.length) segments.push([pt]); else segments.at(-1)!.push(pt);
    });
    return { model, name: nameOf(model), ...looks.get(model)!, points, segments, missing };
  });
  return { dates: [...dateSet].sort(), series };
}
