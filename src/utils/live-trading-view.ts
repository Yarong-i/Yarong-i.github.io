// Renderers for live trading, shared by the build (set:html) and the browser after each poll, so they never drift.
// Home = summary, /live/ = date list, /live/?date= = one day. Home, list and day all read the exporter's day summary.
// Every value is escaped. A confirmed 0 is a number; something with no record is '—' (never a made-up 0원 or "거래 없음").
// Gains are red and losses blue, as in the picks table; 0 and unknown stay neutral.
import { labels, formatTime, dayResults } from './live-trading';
import type { snapshotSchema, indexSchema, daySummary } from './live-trading';
import type { z } from 'astro/zod';
type Snapshot = z.infer<typeof snapshotSchema>;
type Index = z.infer<typeof indexSchema>;
type Day = z.infer<typeof daySummary>;
type Trade = Day['trades'][number];
type Op = NonNullable<Snapshot['operation']>;
type Status = keyof typeof labels;

const LIVE_ORDER = /submitted|partial|planned|cancel_requested|unconfirmed|in_progress|check/;
const DASH = '—';
// The executor's fixed schedule relative to the session (README): pick read −10, prepare −9, buy −5, close sell −5, report +20.
const SCHEDULE = { pick: -10, prep: -9, buy: -5, sell: -5, report: 20 };

export const esc = (v: unknown) => String(v).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
export const time = (iso: string, suffix = '') => `<time datetime="${esc(iso)}">${esc(formatTime(iso))}${suffix}</time>`;
export const tagText = (text: string, live = false) => `<span class="lt-tag${live ? ' lt-tag-live' : ''}">${esc(text)}</span>`;
export const tag = (s: Status) => tagText(labels[s], LIVE_ORDER.test(s));
const block = (title: string, body: string, note = '') =>
  `<section class="lt-block"><h3 class="lt-label">${title}</h3>${body}${note ? `<p class="lt-fine">${note}</p>` : ''}</section>`;
export const empty = (text: string) => `<p class="lt-empty">${esc(text)}</p>`;

export const won = (v: number | null | undefined) => (v === null || v === undefined ? DASH : `${Math.round(v).toLocaleString('ko-KR')}원`);
export const shares = (v: number | null | undefined) => (v === null || v === undefined ? DASH : `${v.toLocaleString('ko-KR')}주`);
/** Signed money: red gain, blue loss, neutral 0 / unknown. `known` false = no record yet -> '—'. */
export const pnlHtml = (v: number | null | undefined, known = true) => {
  if (!known || v === null || v === undefined) return `<span class="lt-flat">${DASH}</span>`;
  const r = Math.round(v);
  return `<span class="${r > 0 ? 'lt-up' : r < 0 ? 'lt-down' : 'lt-flat'}">${r > 0 ? '+' : ''}${esc(r.toLocaleString('ko-KR'))}원</span>`;
};
export const pctHtml = (v: number | null | undefined) => (v === null || v === undefined ? `<span class="lt-flat">${DASH}</span>`
  : `<span class="${v > 0 ? 'lt-up' : v < 0 ? 'lt-down' : 'lt-flat'}">${v > 0 ? '+' : ''}${esc(v.toFixed(2))}%</span>`);
export const kstDay = (ms: number) => new Date(ms + 9 * 3600e3).toISOString().slice(0, 10);
export const kstClock = (iso: string, len = 8) => new Date(Date.parse(iso) + 9 * 3600e3).toISOString().slice(11, 11 + len);
export const md = (d: string) => `${+d.slice(5, 7)}/${+d.slice(8, 10)}`;
const dow = (d: string) => '일월화수목금토'[new Date(`${d}T00:00:00Z`).getUTCDay()];
export const mdw = (d: string) => `${md(d)} (${dow(d)})`;
function hm(iso: string, now: number) {
  const ms = Date.parse(iso), day = kstDay(ms), clock = new Date(ms + 9 * 3600e3).toISOString().slice(11, 16);
  return day === kstDay(now) ? clock : `${md(day)} ${clock}`;
}
const shift = (hhmm: string | null | undefined, min: number) => {
  const [h = 9, m = 0] = (hhmm ?? '09:00').split(':').map(Number);
  const t = h * 60 + m + min;
  return `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`;
};
const times = (op?: Op | null) => {
  const open = op?.sessionOpen ?? '09:00', close = op?.sessionClose ?? '15:30';
  return { open, close, pick: shift(open, SCHEDULE.pick), prep: shift(open, SCHEDULE.prep), buy: shift(open, SCHEDULE.buy), sell: shift(close, SCHEDULE.sell), report: shift(close, SCHEDULE.report) };
};
export const isLive = (d: Day | null, op?: Op | null) => !!d && !!op && d.date === op.tradingDate && (op.phase === 'pre_open' || op.phase === 'in_session');
const isCandidate = (t: Trade) => !t.carry;
export const sold = (t?: Trade) => !!t && t.sellQty > 0;

/** Display group of a day's result: 거래 없음 / 실행 실패 are groups, the detail goes in the reason line. */
export const resultLabel = (r: keyof typeof dayResults) => (r === 'no_pick' || r === 'not_attempted' ? '거래 없음' : r === 'pick_failed' ? '실행 실패' : dayResults[r]);
export const resultTag = (r: keyof typeof dayResults) => tagText(resultLabel(r), LIVE_ORDER.test(r));
export const resultDetail = (r: keyof typeof dayResults, reason: string | null) =>
  r === 'no_pick' ? (reason && reason !== '추천 없음' ? `추천 없음 · ${reason}` : '추천 없음') : r === 'pick_failed' ? `추천 생성 실패${reason && reason !== '추천 실패' ? ` · ${reason}` : ''}` : reason;

/** Stable links. Discord alerts use dayLink(date, event). */
export const dayLink = (date: string, event?: string) => `/live/?date=${encodeURIComponent(date)}${event ? `&event=${encodeURIComponent(event)}` : ''}`;
export const researchLink = (date: string) => `/research/${date}/#m-claude-sonnet-5`;

/** The one-line state of the data. A failed connection never turns into "no orders" or "0 shares". */
export function liveStatus(s: Snapshot | null, now: number, staleMs: number, failed = false): string {
  if (!s) return failed ? '미연동 · 연결 실패' : '미연동';
  const t = hm(s.updatedAt, now);
  const stale = now - Date.parse(s.updatedAt) > staleMs;
  const op = s.operation;
  if (!op) return stale ? `갱신 지연 · 마지막 확인 ${t}` : `자동 갱신 중 · 마지막 확인 ${t}`;
  switch (op.phase) {
    case 'off': return `실전 주문 꺼짐 · 마지막 확인 ${t}`;
    case 'before_start':
      if (op.startDate && kstDay(now) >= op.startDate && stale) return `갱신 지연 · 마지막 확인 ${t}`;
      return `실전 활성화 · ${op.startDate ? `${md(op.startDate)} 시작 예정` : '시작일 미확인'} · 실제 주문 ${op.realOrders}건`;
    case 'closed': return `장 마감 · 마지막 확인 ${t}`;
    default: return stale ? `갱신 지연 · 마지막 확인 ${t}` : `${op.phase === 'pre_open' ? '장 시작 전' : '장중 자동 갱신'} · 마지막 확인 ${t}`;
  }
}

export function liveChecked(s: Snapshot | null, receivedAt?: string): string {
  if (!s) return '실제 기록이 연결되면 확인 시각과 함께 표시합니다.';
  return `마지막 정상 확인 ${formatTime(s.updatedAt)} · 마지막 증권사 확인 ${s.brokerCheckedAt ? formatTime(s.brokerCheckedAt) : '기록 없음'}`
    + `${receivedAt ? ` · 수신 ${formatTime(receivedAt)}` : ''} · KST`;
}

// ---------------------------------------------------------------- trade flow: 추천 대기 → 매수 주문 → 체결·보유 → 청산
type StepState = 'done' | 'current' | 'failed' | 'todo';
type Flow = { steps: { label: string; state: StepState; note: string }[]; live: boolean };
const STEPS = ['추천 대기', '매수 주문', '체결·보유', '청산'];

export function flowOf(d: Day | null, op: Op | null | undefined, t: Trade | undefined, carry = false): Flow {
  const live = d ? isLive(d, op) : false;
  const mk = (at: number, state: 'current' | 'failed' | 'done', note: string, notes: string[] = []) => ({
    live, steps: STEPS.map((label, i) => ({ label, state: (i < at ? 'done' : i === at ? state : 'todo') as StepState, note: i === at ? note : notes[i] ?? '' })),
  });
  if (!d) return { live: false, steps: STEPS.map((label) => ({ label, state: 'todo' as StepState, note: '' })) };
  if (carry && t) {
    if (!t.sellOrderQty) return mk(3, 'current', `이월 ${shares(t.heldBefore ?? t.heldAfter)} · 시가 매도 예정`);
    if (!t.heldAfter) return mk(3, 'done', `${shares(t.sellQty)} 매도 완료`);
    return mk(3, t.sellCancelState === 'confirmed' ? 'failed' : 'current', t.sellCancelState === 'confirmed' ? `${shares(t.sellQty)} 매도 · ${shares(t.heldAfter)} 계속 이월` : t.sellQty ? `일부 매도 ${t.sellQty}/${t.sellOrderQty}주` : '매도 주문 접수');
  }
  if (d.pickStatus === 'waiting' || (!d.pick && d.result === 'in_progress' && !t)) return mk(0, 'current', '추천 확인 전');
  if (d.result === 'no_pick') return mk(0, 'failed', '추천 없음');
  if (d.result === 'pick_failed') return mk(0, 'failed', '추천 생성 실패');
  if (!t || t.orderQty === null) return mk(1, d.result === 'not_attempted' ? 'failed' : 'current', d.result === 'not_attempted' ? '매수 미시도' : '주문 예정', ['추천 확인']);
  const n = ['추천 확인'];
  switch (t.orderState) {
    case 'planned': return mk(1, 'current', `주문 예정 · ${shares(t.orderQty)}`, n);
    case 'not_sent': return mk(1, 'failed', '주문 미전송 · 실행 실패', n);
    case 'rejected': return mk(1, 'failed', '증권사 거절 · 0주', n);
    case 'unconfirmed': return mk(1, 'current', '접수 결과 확인 중', n);
    case 'buy_submitted': return mk(1, 'current', `접수 · 체결 전 ${shares(t.orderQty)}`, n);
  }
  const buyNote = `${t.filledQty}/${t.orderQty}주 체결`;
  if (t.orderState === 'buy_partial' || t.orderState === 'cancel_requested')
    return mk(2, 'current', `일부 체결 ${t.filledQty}/${t.orderQty}주${t.cancelState === 'requested' ? ' · 잔량 취소 확인 중' : ''}`, [...n, '접수']);
  if (!t.filledQty) return mk(2, 'failed', `0주 체결 · 잔량 ${shares(t.cancelledQty || t.orderQty)} 취소`, [...n, '접수']);
  const m = [...n, '접수', buyNote];
  if (!t.sellOrderQty) return mk(2, 'current', `보유 ${shares(t.heldAfter)}`, m);
  if (!t.heldAfter) return mk(3, 'done', `${shares(t.sellQty)} 매도 완료`, m);
  if (t.sellCancelState === 'confirmed') return mk(3, 'failed', `${shares(t.sellQty)} 매도 · ${shares(t.heldAfter)} 이월`, m);
  return mk(3, 'current', t.sellQty ? `일부 매도 ${t.sellQty}/${t.sellOrderQty}주` : '매도 주문 접수 · 체결 전', m);
}

export function flowHtml(f: Flow) {
  // A finished day's flow is a record, not a live state: no step is highlighted as "now".
  return `<ol class="lt-flow${f.live ? ' is-live' : ' is-record'}" aria-label="거래 진행 단계">${f.steps.map((s) =>
    `<li class="is-${s.state}"${s.state === 'current' && f.live ? ' aria-current="step"' : ''}><span class="lt-flow-dot" aria-hidden="true"></span><b>${esc(s.label)}</b>${s.note ? `<small>${esc(s.note)}</small>` : ''}${s.state === 'failed' ? '<span class="sr-only"> (중단)</span>' : ''}</li>`).join('')}</ol>`;
}

// ---------------------------------------------------------------- stocks of a day
type Hero = { stage: string; name: string; code: string | null; state: string; amountLabel: string; amount: number | null; pnl: number | null; pnlKnown: boolean; live: boolean; flow: Flow };

function candidateHero(d: Day | null, op: Op | null | undefined, t: Trade | undefined, sym: { symbol: string; name: string | null } | null): Hero {
  const T = times(op), now = isLive(d, op), flow = flowOf(d, op, t);
  const code = sym?.symbol ?? null, name = sym?.name ?? sym?.symbol ?? '';
  const base = { name, code, live: false, flow, amountLabel: '체결금액', amount: t ? t.buyAmount : null, pnl: t ? t.realizedPnl : null, pnlKnown: sold(t) };
  if (!sym) {
    if (!d) return { ...base, stage: '오늘의 매수 후보', name: '첫 추천 대기', state: DASH, amount: null };
    if (d.pickStatus === 'waiting') return { ...base, stage: '오늘의 매수 후보', name: '추천 대기', state: `${T.pick} Sonnet 1순위 확인 후 ${T.buy} 시가 단일가 매수 주문 예정`, live: now };
    return { ...base, stage: '오늘의 매수 후보', name: d.result === 'pick_failed' ? '추천 생성 실패' : '추천 없음', state: resultDetail(d.result, d.reason) ?? '신규 매수 없음' };
  }
  const stage0 = d && !now && d.date !== op?.tradingDate ? '매수 후보' : '오늘의 매수 후보';
  if (!t || t.orderQty === null || t.orderState === 'planned' || t.orderState === 'not_sent') {
    const state = d?.result === 'not_attempted' ? `매수 미시도 · ${(d.reason ?? '').replace(/^추천은 있었지만 매수 미시도 · /, '')}`
      : t?.orderState === 'not_sent' ? '주문 미전송 · 실행 실패'
      : t?.orderQty ? `${T.buy} 시가 단일가 매수 주문 예정 · ${shares(t.orderQty)}` : `${T.buy} 시가 단일가 매수 주문 예정`;
    return { ...base, stage: stage0, state, live: !!t?.orderQty && now };
  }
  const rest = Math.max(0, (t.orderQty ?? 0) - t.filledQty - t.cancelledQty);
  if (t.orderState === 'rejected') return { ...base, stage: '매수 주문 거절', state: '증권사 거절 · 0주 체결' };
  if (t.orderState === 'unconfirmed') return { ...base, stage: '매수 주문 접수', state: `${shares(t.orderQty)} 주문 · 결과 확인 중`, live: true };
  if (t.orderState !== 'done') {
    const c = t.cancelState === 'requested' ? ` · 잔량 ${shares(rest)} 취소 확인 중` : rest ? ` · 잔량 ${shares(rest)}` : '';
    return { ...base, stage: '매수 주문 접수', state: t.filledQty ? `${shares(t.orderQty)} 주문 · ${shares(t.filledQty)} 체결${c}` : `${shares(t.orderQty)} 주문 접수 · 체결 전`, live: true };
  }
  if (!t.filledQty) return { ...base, stage: '매수 미체결', state: `${shares(t.orderQty)} 주문 · 0주 체결 · 잔량 ${shares(t.cancelledQty || t.orderQty)} 취소 확인` };
  if (!t.heldAfter) return { ...base, stage: '매도 완료', state: `${shares(t.filledQty)} 매수 · ${shares(t.sellQty)} 매도 · 평균 ${won(t.avgSellPrice)}` };
  const sell = t.sellOrderQty === null ? (now ? `${T.sell} 종가 매도 예정` : '다음 거래일 시가 매도 예정')
    : t.sellCancelState === 'confirmed' ? `종가 ${shares(t.sellQty)} 매도 · ${shares(t.heldAfter)} 다음 거래일 이월` : '종가 매도 주문 접수 · 체결 전';
  return { ...base, stage: '보유 중', state: `${shares(t.heldAfter)} 보유 · 평균 ${won(t.avgBuyPrice)} · ${sell}`, live: now };
}

function carryHero(d: Day, op: Op | null | undefined, t: Trade | undefined, sym: { symbol: string; name: string | null }, buyDate: string | null): Hero {
  const T = times(op), now = isLive(d, op);
  const held = t?.heldBefore ?? t?.heldAfter ?? 0;
  const from = buyDate ? ` · ${md(buyDate)} 매수분` : '';
  const base = { stage: '이월 보유 · 매도 우선', name: sym.name ?? sym.symbol, code: sym.symbol, live: now, flow: flowOf(d, op, t, true),
    amountLabel: '매도 금액', amount: t ? t.sellAmount : null, pnl: t ? t.realizedPnl : null, pnlKnown: sold(t) };
  if (!t || t.sellOrderQty === null) return { ...base, state: `${shares(held)} 이월${from} · ${now ? `${T.buy} 시가 매도 예정` : '매도 기록 없음'}` };
  if (!t.heldAfter) return { ...base, live: false, stage: '이월 보유 · 매도 완료', state: `${shares(t.sellQty)} 매도${from} · 평균 ${won(t.avgSellPrice)}` };
  return { ...base, state: `${shares(held)} 이월${from} · ${shares(t.sellQty)} 매도${t.sellCancelState === 'requested' ? ' · 잔량 취소 확인 중' : t.sellCancelState === 'confirmed' ? ` · ${shares(t.heldAfter)} 계속 이월` : ' · 매도 주문 접수'}` };
}

/** Buy date of a carried stock, only when exactly one earlier trade record of that stock has activity that day. */
const buyDateOf = (records: Snapshot['records'] | undefined, symbol: string, date: string) => {
  const recs = (records ?? []).filter((r) => r.symbol === symbol && r.tradingDate && r.tradingDate < date);
  return recs.length === 1 ? recs[0]!.tradingDate! : null;
};
export function stockHeroes(d: Day | null, op: Op | null | undefined, records?: Snapshot['records']): Hero[] {
  if (!d) return [candidateHero(null, op, undefined, null)];
  const out: Hero[] = [];
  const cand = d.stocks?.find((s) => s.role === 'candidate') ?? (d.pick ?? null);
  out.push(candidateHero(d, op, d.trades.find((t) => isCandidate(t) && t.symbol === cand?.symbol) ?? d.trades.find(isCandidate), cand ?? null));
  // carried shares (also when today's pick is the same stock, which the stocks list then holds only once)
  const carried = d.trades.filter((t) => t.carry);
  for (const t of carried) out.push(carryHero(d, op, t, { symbol: t.symbol, name: t.name }, buyDateOf(records, t.symbol, d.date)));
  for (const c of d.stocks?.filter((s) => s.role === 'carry' && !carried.some((t) => t.symbol === s.symbol)) ?? []) out.push(carryHero(d, op, undefined, c, buyDateOf(records, c.symbol, d.date)));
  return out;
}

function heroHtml(h: Hero, small = false) {
  return `<div class="lt-hero${small ? ' lt-hero-sub' : ''}">
    <p class="lt-stage">${tagText(h.stage, h.live)}</p>
    <p class="lt-stock-name"><strong>${esc(h.name)}</strong>${h.code ? `<small>${esc(h.code)}</small>` : ''}</p>
    <p class="lt-stock-state">${esc(h.state)}</p>
    <dl class="lt-hero-nums"><div><dt>${esc(h.amountLabel)}</dt><dd>${esc(won(h.amount))}</dd></div><div><dt>실현손익</dt><dd>${pnlHtml(h.pnl, h.pnlKnown)}</dd></div></dl>
    ${flowHtml(h.flow)}</div>`;
}
const heroesHtml = (hs: Hero[]) => `<div class="lt-heroes">${hs.map((h, k) => heroHtml(h, k > 0)).join('')}</div>`;

// ---------------------------------------------------------------- events (timeline)
type Ev = { id: string | null; at: string; status?: Status; who: string; text: string };
const isObservation = (e: Ev) => !!e.id && e.id.startsWith('o');
export function eventsOf(s: Snapshot | null, date?: string): Ev[] {
  const inDay = (at: string) => !date || kstDay(Date.parse(at)) === date;
  return [...(s?.records ?? []).flatMap((r) => r.events.filter((e) => inDay(e.at)).map((e) => ({ id: e.id ?? null, at: e.at, status: e.status, who: `${r.name} ${r.symbol}`, text: e.text }))),
    ...(s?.dayEvents ?? []).filter((e) => (!date || e.date === date) && (date || !e.test)).map((e) => ({ id: e.id, at: e.at, status: undefined, who: e.test ? '연결 시험' : '운영', text: e.text }))]
    .sort((a, b) => Date.parse(a.at) - Date.parse(b.at));
}
/** Dots on a line. data-ev lets the page mark an event as new only when it appears after the first load. */
export function timelineHtml(evs: Ev[], opts: { focus?: string | null; linkDate?: string; clockLen?: number } = {}) {
  return `<ol class="lt-timeline">${evs.map((e) => {
    const focus = !!e.id && e.id === opts.focus;
    const clock = opts.clockLen ? `${md(kstDay(Date.parse(e.at)))} ${kstClock(e.at, opts.clockLen)}` : kstClock(e.at);
    const when = `<time datetime="${esc(e.at)}">${esc(clock)}</time>`;
    const link = e.id ? `<a class="lt-at" href="${esc(dayLink(opts.linkDate ?? kstDay(Date.parse(e.at)), e.id))}">${when}</a>` : when;
    const mark = isObservation(e) ? tagText('관찰 · 주문 아님') : e.status ? tag(e.status) : '';
    return `<li${e.id ? ` data-ev="${esc(e.id)}"` : ''}${focus ? ' class="lt-focus" aria-current="true" id="focus"' : ''}${isObservation(e) ? ' data-kind="obs"' : ''}>
      <span class="lt-tl-dot" aria-hidden="true"></span><p class="lt-tl-head">${link} ${mark}</p>
      <p class="lt-tl-text"><strong>${esc(e.who)}</strong> ${esc(e.text)}${focus ? ' <small>· 링크한 사건</small>' : ''}</p></li>`;
  }).join('')}</ol>`;
}

/** What the executor does next, from the phase and the target day's own state. */
export function nextAction(s: Snapshot | null): string {
  const op = s?.operation;
  if (!op) return DASH;
  const T = times(op);
  const d = s?.day ?? null;
  const t = d?.date === op.tradingDate ? d.trades.find(isCandidate) : undefined;
  const carriedNow = d?.trades.filter((x) => x.heldAfter).reduce((a, x) => a + x.heldAfter, 0) ?? 0;
  switch (op.phase) {
    case 'off': return '실전 주문 꺼짐 · 예정된 주문 없음';
    case 'before_start': return op.startDate ? `${md(op.startDate)} ${T.prep} 첫 주문 준비 · ${T.buy} 시가 단일가 매수 주문 예정` : DASH;
    case 'closed': return carriedNow ? `다음 거래일 ${T.buy} 이월분 ${shares(carriedNow)} 시가 매도 예정` : `다음 거래일 ${T.prep} 주문 준비`;
    case 'pre_open': return t?.orderQty ? `${T.buy} 시가 단일가 매수 주문 예정 · ${shares(t.orderQty)}` : `${T.prep} 주문 준비 · ${T.buy} 시가 단일가 매수 주문 예정`;
    default: {
      if (!t) return d?.result === 'no_pick' || d?.result === 'pick_failed' || d?.result === 'not_attempted' ? `오늘 신규 매수 없음 · 다음 거래일 ${T.prep} 주문 준비` : `${T.prep} 주문 준비`;
      if (t.orderState === 'planned') return `${T.buy} 시가 단일가 매수 주문 예정 · ${shares(t.orderQty)}`;
      if (t.orderState === 'rejected') return `오늘 신규 매수 없음 · 다음 거래일 ${T.prep} 주문 준비`;
      if (t.cancelState === 'requested') return `잔량 ${shares((t.orderQty ?? 0) - t.filledQty - t.cancelledQty)} 취소 확인 대기`;
      if (t.orderState === 'buy_submitted') return '시가 체결 확인';
      if (t.sellOrderQty === null && t.heldAfter) return `${T.sell} 종가 매도 ${shares(t.heldAfter)} · −1.5%·+3%는 관찰만`;
      if (t.sellOrderQty !== null && t.sellCancelState !== 'confirmed' && t.heldAfter) return `${T.close} 종가 체결 확인`;
      return `${T.report} 장후 보고`;
    }
  }
}

// ---------------------------------------------------------------- home (summary)
/** Left column: data state always; model and next action once trading has started (before that they sit in the 첫 운영 대기 group). */
export function homeSideHtml(s: Snapshot | null, statusText: string): string {
  const before = s?.operation?.phase === 'before_start';
  return `<dl class="lt-side-facts">
    ${before ? '' : `<div><dt>운영 모델</dt><dd>${esc(s?.operation?.model ?? DASH)}</dd></div>`}
    <div><dt>현재 상태</dt><dd><span class="connection">${esc(statusText)}</span></dd></div>
    ${before ? '' : `<div><dt>다음 행동</dt><dd>${esc(nextAction(s))}</dd></div>`}
  </dl>`;
}

export function homeBodyHtml(s: Snapshot | null, error: boolean): string {
  if (!s) return empty(error ? '기록 확인 불가 · 미연동' : '미연동 · 실제 기록 연결 전');
  const op = s.operation, d = s.day ?? null;
  if (op?.phase === 'before_start' && !d) {
    // Before the first day: one group around "첫 운영 대기"; empty performance stays small, nothing invented.
    return `<div class="lt-wait">
      <p class="lt-stage">${tagText('실전 시작 전')}</p>
      <p class="lt-stock-name"><strong>첫 운영 대기</strong></p>
      <dl class="lt-wait-facts">
        <div><dt>운영 모델</dt><dd>${esc(op.model)}</dd></div>
        <div><dt>시작 예정일</dt><dd>${op.startDate ? esc(mdw(op.startDate)) : DASH}</dd></div>
        <div><dt>다음 행동</dt><dd>${esc(nextAction(s))}</dd></div>
      </dl>
      ${flowHtml(flowOf(null, op, undefined))}
      <p class="lt-mini">실제 주문 ${esc(op.realOrders)}건 · 보유 0주 · 매수 0원 · 실현손익 ${DASH} · 청산 수익률 ${DASH}</p>
    </div>
    ${op.startDate ? `<p class="lt-go"><a class="lt-day-link" href="${esc(dayLink(op.startDate))}">${esc(md(op.startDate))} 실전 상세 <span aria-hidden="true">→</span></a></p>` : ''}`;
  }
  const date = d?.date ?? op?.tradingDate ?? null;
  const lead = d?.trades.find(isCandidate);
  const anySale = !!d?.trades.some(sold);
  const evs = eventsOf(s).filter((e) => !date || kstDay(Date.parse(e.at)) === date).slice(-3).reverse();
  return `<p class="lt-dateline"><span>대상 날짜</span> <strong>${date ? esc(mdw(date)) : DASH}</strong>${d ? ` ${resultTag(d.result)}` : ''}${d && !isLive(d, op) ? ' <small>그날 마감 기준</small>' : ''}</p>
    ${heroesHtml(stockHeroes(d, op, s.records))}
    <dl class="lt-nums lt-nums-4">
      <div><dt>보유 수량</dt><dd>${esc(shares(d?.heldAfter))}</dd></div>
      <div><dt>실현손익</dt><dd>${pnlHtml(d?.realizedPnl, anySale)}</dd></div>
      <div><dt>평균 체결가</dt><dd>${esc(won(lead?.avgBuyPrice ?? null))}</dd></div>
      <div><dt>청산 수익률 <small>매도분 원가 대비</small></dt><dd>${pctHtml(d?.trades.find((t) => t.returnPct !== null)?.returnPct ?? null)}</dd></div>
    </dl>
    <div class="lt-recent"><span class="lt-target-label">최근 이벤트</span>${evs.length ? timelineHtml(evs) : `<p>${DASH}</p>`}</div>
    ${date ? `<p class="lt-go"><a class="lt-day-link" href="${esc(dayLink(date))}">이날 실전 상세 <span aria-hidden="true">→</span></a></p>` : ''}`;
}

// ---------------------------------------------------------------- /live/ (date list, newest first)
const stockCell = (d: { name: string | null; symbol: string | null; stocks?: { symbol: string; name: string | null; role: string }[] }) => {
  const list = d.stocks?.length ? d.stocks : d.symbol ? [{ symbol: d.symbol, name: d.name, role: 'candidate' }] : [];
  if (!list.length) return DASH;
  return list.map((x) => `<span class="lt-cellstock"><strong>${esc(x.name ?? x.symbol)}</strong> <small>${esc(x.symbol)}${x.role === 'carry' ? ' · 이월' : list.length > 1 ? ' · 후보' : ''}</small></span>`).join('');
};

export function indexHtml(ix: Index | null, error: boolean, today: string): string {
  if (!ix) return empty(error ? '미연동 · 날짜 목록을 읽지 못했습니다 · 다시 시도 중' : '날짜 목록 확인 중');
  const op = ix.operators?.[0];
  const totals = op
    ? `<dl class="lt-nums lt-nums-4"><div><dt>누적 실현손익</dt><dd>${pnlHtml(op.realizedPnl, (op.closedTrades ?? 0) > 0)}</dd></div>
        <div><dt>누적 수익률</dt><dd>${pctHtml(op.returnPct)}</dd></div>
        <div><dt>청산 · 수익 거래</dt><dd>${esc(op.closedTrades ?? DASH)} · ${esc(op.winningTrades ?? DASH)}</dd></div>
        <div><dt>평가손익</dt><dd>${pnlHtml(op.unrealizedPnl)}</dd></div></dl>
       <p class="lt-fine">${op.costBasis === 'gross' ? '비용 반영 전' : op.costBasis === 'net' ? '비용 반영 후' : '비용 반영 여부 미확인'} · ${esc(op.returnMethod ?? '')}</p>`
    : '';
  // the start date shows as 예정 until it has a record (never as 거래 없음)
  const planned = ix.startDate && ix.startDate >= today && !ix.days.some((d) => d.date === ix.startDate)
    ? `<tr class="is-planned"><td><a href="${esc(dayLink(ix.startDate))}">${esc(mdw(ix.startDate))}</a><small class="lt-reason">${esc(ix.model)}</small></td><td>${DASH}</td><td>${tagText('예정')}<small class="lt-reason">첫 운영일</small></td><td class="num">${DASH}</td></tr>` : '';
  const rows = ix.days.map((d) => `<tr>
        <td><a href="${esc(dayLink(d.date))}">${esc(mdw(d.date))}</a><small class="lt-reason">${esc(d.model ?? ix.model)}</small></td>
        <td>${stockCell(d)}</td>
        <td>${resultTag(d.result)}${resultDetail(d.result, d.reason) ? `<small class="lt-reason">${esc(resultDetail(d.result, d.reason))}</small>` : ''}</td>
        <td class="num">${pnlHtml(d.realizedPnl, (d.sellAmount ?? 0) > 0)}</td></tr>`).join('');
  const table = planned || rows
    ? `<table class="lt-table"><thead><tr><th>날짜 · 운영 모델</th><th>종목</th><th>매매 상태</th><th class="num">실현손익</th></tr></thead><tbody>${planned}${rows}</tbody></table>`
    : empty('아직 운영일이 없습니다');
  return (totals ? block('누적', totals) : '') + block('날짜별 기록 (최신순)', table, '실현손익은 매도 기록이 있는 날만 표시합니다(비용 반영 전). 시작일 이전 날짜와 연결 시험은 운영일이 아닙니다.');
}

// ---------------------------------------------------------------- /live/?date= (one day)
function cancelText(t: Trade) {
  const rest = Math.max(0, (t.orderQty ?? 0) - t.filledQty - t.cancelledQty);
  switch (t.cancelState) {
    case 'requested': return `잔량 ${shares(rest)} 취소 요청 중 · 확인 전`;
    case 'confirmed': return `잔량 ${shares(t.cancelledQty)} 취소 확인`;
    case 'unresolved': return '취소 결과 미확인';
    default: return t.orderQty === null ? DASH : rest && t.orderState !== 'done' ? `잔량 ${shares(rest)} 대기` : '없음';
  }
}
function sellText(t: Trade) {
  if (t.sellOrderQty === null) return t.heldAfter ? '아직 없음 · −1.5%·+3%는 관찰만' : DASH;
  const c = t.sellCancelState === 'confirmed' ? ` · 잔량 ${shares(t.sellCancelledQty)} 취소 확인` : t.sellCancelState === 'requested' ? ' · 잔량 취소 요청 중' : '';
  return `${shares(t.sellQty)} / 주문 ${shares(t.sellOrderQty)} · 평균 ${won(t.avgSellPrice)} · ${won(t.sellAmount)}${c}`;
}
export function tradeHtml(t: Trade) {
  return `<section class="lt-trade"><h4>${esc(t.name ?? t.symbol)} <small>${esc(t.symbol)}${t.carry ? ' · 이월 보유 · 매도 우선' : ''}</small>${t.orderState && t.orderState in labels ? ` ${tag(t.orderState as Status)}` : ''}</h4>
    <dl class="lt-kv">
      ${t.carry ? `<div><dt>전일 이월</dt><dd>${esc(shares(t.heldBefore ?? null))}</dd></div>` : `<div><dt>주문 수량</dt><dd>${esc(shares(t.orderQty))}</dd></div>
      <div><dt>체결 수량</dt><dd>${esc(shares(t.filledQty))}</dd></div>
      <div><dt>평균 체결가</dt><dd>${esc(won(t.avgBuyPrice))}</dd></div>
      <div><dt>매수 금액</dt><dd>${esc(won(t.buyAmount))}</dd></div>
      <div><dt>취소 결과</dt><dd>${esc(cancelText(t))}</dd></div>`}
      <div><dt>${t.carry ? '이월분 매도' : '종가 매도'}</dt><dd>${esc(sellText(t))}</dd></div>
      <div><dt>이월 잔량</dt><dd>${esc(shares(t.heldAfter))}</dd></div>
      <div><dt>실현손익</dt><dd>${pnlHtml(t.realizedPnl, sold(t))}</dd></div>
      <div><dt>청산 수익률 <small>매도분 원가 대비</small></dt><dd>${pctHtml(t.returnPct)}</dd></div>
    </dl></section>`;
}
const navHtmlFor = (nav: { prev?: string; next?: string }) => `<p class="lt-nav">${nav.prev ? `<a href="${esc(dayLink(nav.prev))}">← ${esc(mdw(nav.prev))}</a>` : '<span></span>'}<a href="/live/">목록으로</a>${nav.next ? `<a href="${esc(dayLink(nav.next))}">${esc(mdw(nav.next))} →</a>` : '<span></span>'}</p>`;

/** One day as of that day. `state`: loaded | none (no file) | failed (could not read) — kept apart, never "거래 없음". */
export function dayHtml(date: string, s: Snapshot | null, focus: string | null, nav: { prev?: string; next?: string; startDate?: string | null; today: string; failed?: boolean }): string {
  const d = s?.summary ?? null, op = s?.operation;
  const events = eventsOf(s, date);
  const later = (s?.records ?? []).filter((r) => r.events.some((e) => kstDay(Date.parse(e.at)) > date))
    .map((r) => kstDay(Math.min(...r.events.filter((e) => kstDay(Date.parse(e.at)) > date).map((e) => Date.parse(e.at)))));
  const f = focus ? events.find((e) => e.id === focus) : undefined;
  const banner = f ? `<p class="lt-linked"><span class="lt-target-label">링크한 사건</span><strong>${esc(f.who)}</strong> ${isObservation(f) ? tagText('관찰 · 주문 아님') : f.status ? tag(f.status) : ''} <span>${esc(kstClock(f.at))} · ${esc(f.text)}</span> <a href="#focus">타임라인에서 보기 ↓</a></p>` : '';
  const noFile = !s;
  const label = d ? resultTag(d.result)
    : noFile ? tagText(nav.failed ? '미연동' : nav.startDate && date >= nav.today && date >= nav.startDate ? '예정일' : '기록 없음')
    : tagText('운영일 아님');
  const basis = d && isLive(d, op) && s ? `마지막 확인 ${kstClock(s.updatedAt, 5)} KST 기준` : d ? '그날 마감 기준' : '';
  const detail = d ? resultDetail(d.result, d.reason) : null;
  const head = `<p class="lt-dateline"><span>거래일</span> <strong>${esc(mdw(date))}</strong> ${label}${basis ? ` <small>${esc(basis)}</small>` : ''}</p>
    ${d ? heroesHtml(stockHeroes(d, op)) : ''}
    ${detail ? `<p class="lt-fine">${esc(detail)}</p>` : ''}
    ${date <= nav.today ? `<p class="lt-links"><a href="${esc(researchLink(date))}">그날 Sonnet 추천 상세 <span aria-hidden="true">→</span></a></p>` : ''}`;
  if (noFile) {
    const why = nav.failed ? '기록을 읽지 못했습니다 (미연동). 이전에 확인한 내용이 없어 비워 둡니다 · 10초마다 다시 확인'
      : nav.startDate && date >= nav.startDate && date >= nav.today ? '예정된 운영일입니다. 주문·체결이 기록되면 자동으로 표시합니다.'
      : '이 날짜의 실전 기록이 없습니다.';
    return head + empty(why) + navHtmlFor(nav);
  }
  const totals = d ? `<dl class="lt-nums lt-nums-4">
      <div><dt>실제 매수금액</dt><dd>${esc(won(d.buyAmount))}</dd></div>
      <div><dt>실현손익 <small>비용 전</small></dt><dd>${pnlHtml(d.realizedPnl, d.trades.some(sold))}</dd></div>
      <div><dt>평가손익</dt><dd>${pnlHtml(d.unrealizedPnl)}</dd></div>
      <div><dt>남은 수량</dt><dd>${esc(shares(d.heldAfter))}</dd></div></dl>
    <p class="lt-fine">비용 ${d.costConfirmed ? `확정 · 수수료 ${won(d.fee)} · 제세금 ${won(d.tax)}` : '미확정 · 장후 보고 후 확정'}${d.reportAt ? ` · 장후 보고 ${esc(formatTime(d.reportAt))}` : ''} · 평가손익은 장후 보고 기준</p>` : '';
  const trades = d?.trades.length ? d.trades.map(tradeHtml).join('') : d ? empty(detail ?? '주문 기록 없음') : '';
  const timeline = events.length ? timelineHtml(events, { focus, linkDate: date }) : empty('이날 기록된 사건이 없습니다');
  return banner + head + (totals ? block('그날 결과', totals) : '')
    + (d ? block('주문과 체결', trades, '−1.5%·+3%는 관찰 기록이며 익절·손절 주문이 아닙니다. 증권사 접수는 체결이 아닙니다.') : '')
    + block('주문·체결 타임라인 (KST)', timeline, later.length ? `이 거래의 이후 기록: ${[...new Set(later)].map((x) => `<a href="${esc(dayLink(x))}">${esc(mdw(x))}</a>`).join(', ')}` : '')
    + navHtmlFor(nav);
}
