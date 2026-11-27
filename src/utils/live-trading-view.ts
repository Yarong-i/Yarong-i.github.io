// Renderers for live trading, shared by the build (set:html) and the browser after each poll, so they never drift.
// Home = summary, /live/ = date list (comparison), /live/?date= = one day (orders and fills). Every value is escaped;
// a confirmed 0 is a number, something that cannot be computed yet is '—', nothing is invented.
// Reading order of a stock: stage label -> stock name (largest) + code -> order/holding state -> actual fill amount.
import { labels, formatTime, dayResults } from './live-trading';
import type { snapshotSchema, indexSchema, daySummary } from './live-trading';
import type { z } from 'astro/zod';
type Snapshot = z.infer<typeof snapshotSchema>;
type Index = z.infer<typeof indexSchema>;
type Day = z.infer<typeof daySummary>;
type Trade = Day['trades'][number];
type Op = NonNullable<Snapshot['operation']>;
type Status = keyof typeof labels;

// Open at the broker or needing a check: a brighter outline; everything else stays grey (text labels, no colours).
const LIVE_ORDER = /submitted|partial|planned|cancel_requested|unconfirmed|in_progress|check/;
const DASH = '—';
// The executor's fixed schedule relative to the session (README): pick read −10, prepare −9, buy −5, close sell −5, report +20.
const SCHEDULE = { pick: -10, prep: -9, buy: -5, sell: -5, report: 20 };

export const esc = (v: unknown) => String(v).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
const time = (iso: string, suffix = '') => `<time datetime="${esc(iso)}">${esc(formatTime(iso))}${suffix}</time>`;
const tagText = (text: string, live = false) => `<span class="lt-tag${live ? ' lt-tag-live' : ''}">${esc(text)}</span>`;
const tag = (s: Status) => tagText(labels[s], LIVE_ORDER.test(s));
const resultTag = (r: keyof typeof dayResults) => tagText(dayResults[r], LIVE_ORDER.test(r));
const block = (title: string, body: string, note = '') =>
  `<section class="lt-block"><h3 class="lt-label">${title}</h3>${body}${note ? `<p class="lt-fine">${note}</p>` : ''}</section>`;
const empty = (text: string) => `<p class="lt-empty">${esc(text)}</p>`;

const won = (v: number | null | undefined) => (v === null || v === undefined ? DASH : `${Math.round(v).toLocaleString('ko-KR')}원`);
const shares = (v: number | null | undefined) => (v === null || v === undefined ? DASH : `${v.toLocaleString('ko-KR')}주`);
const pnl = (v: number | null | undefined) => (v === null || v === undefined ? DASH : `${v > 0 ? '+' : ''}${Math.round(v).toLocaleString('ko-KR')}원`);
const pct = (v: number | null | undefined) => (v === null || v === undefined ? DASH : `${v > 0 ? '+' : ''}${v.toFixed(2)}%`);
const kstDay = (ms: number) => new Date(ms + 9 * 3600e3).toISOString().slice(0, 10);
const kstClock = (iso: string, len = 8) => new Date(Date.parse(iso) + 9 * 3600e3).toISOString().slice(11, 11 + len);
export const md = (d: string) => `${+d.slice(5, 7)}/${+d.slice(8, 10)}`;
const dow = (d: string) => '일월화수목금토'[new Date(`${d}T00:00:00Z`).getUTCDay()];
const mdw = (d: string) => `${md(d)} (${dow(d)})`;
// 'HH:MM' for today (KST), 'M/D HH:MM' for an older day, so an old snapshot never looks like today's.
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
const live = (d: Day | null, op?: Op | null) => !!d && !!op && d.date === op.tradingDate && (op.phase === 'pre_open' || op.phase === 'in_session');

/** Stable links. Discord alerts use dayLink(date, event). */
export const dayLink = (date: string, event?: string) => `/live/?date=${encodeURIComponent(date)}${event ? `&event=${encodeURIComponent(event)}` : ''}`;
export const researchLink = (date: string) => `/research/${date}/#m-claude-sonnet-5`;

/** The one-line state of the data. A failed connection never turns into "no orders" or "0 shares". */
export function liveStatus(s: Snapshot | null, now: number, staleMs: number, failed = false): string {
  if (!s) return failed ? '연결 실패 · 확인된 기록 없음' : '연동 대기';
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

/** Last normal check (ledger read while the executor runs) and the last broker check, kept apart. */
export function liveChecked(s: Snapshot | null, receivedAt?: string): string {
  if (!s) return '실제 기록이 연결되면 확인 시각과 함께 표시합니다.';
  return `마지막 정상 확인 ${formatTime(s.updatedAt)} · 마지막 증권사 확인 ${s.brokerCheckedAt ? formatTime(s.brokerCheckedAt) : '기록 없음'}`
    + `${receivedAt ? ` · 수신 ${formatTime(receivedAt)}` : ''} · KST`;
}

// ---------------------------------------------------------------- stocks of a day
type Hero = { stage: string; name: string; code: string | null; state: string; amount: string; holding: boolean; live: boolean };
const isCandidate = (t: Trade) => !t.carry;

function candidateHero(d: Day | null, op: Op | null | undefined, t: Trade | undefined, sym: { symbol: string; name: string | null } | null): Hero {
  const T = times(op), now = live(d, op);
  const code = sym?.symbol ?? null, name = sym?.name ?? sym?.symbol ?? '';
  const base = { name, code, holding: false, live: false };
  // no stock yet
  if (!sym) {
    if (!d) return { ...base, stage: '오늘의 매수 후보', name: '첫 추천 대기', state: op?.startDate ? `${md(op.startDate)} 첫 운영일 · ${T.pick} Sonnet 1순위 확인 후 ${T.buy} 시가 단일가 매수 주문 예정` : DASH, amount: `실제 체결금액 ${won(0)}` };
    if (d.pickStatus === 'waiting') return { ...base, stage: '오늘의 매수 후보', name: '추천 대기', state: `${T.pick} Sonnet 1순위 확인 후 ${T.buy} 시가 단일가 매수 주문 예정`, amount: `실제 체결금액 ${won(0)}` };
    const why = d.result === 'pick_failed' ? '추천 생성 실패' : '추천 없음';
    return { ...base, stage: '오늘의 매수 후보', name: why, state: d.reason ?? '신규 매수 없음', amount: `실제 체결금액 ${won(0)}` };
  }
  const stage0 = d && !now && d.date !== op?.tradingDate ? '매수 후보' : '오늘의 매수 후보';
  // a pick that was never ordered (or not yet) stays a candidate, never looks like a holding
  if (!t || t.orderQty === null || t.orderState === 'planned' || t.orderState === 'not_sent') {
    const state = d?.result === 'not_attempted' ? `매수 미시도 · ${(d.reason ?? '').replace(/^추천은 있었지만 매수 미시도 · /, '')}`
      : t?.orderQty ? `${T.buy} 시가 단일가 매수 주문 예정 · ${shares(t.orderQty)}` : `${T.buy} 시가 단일가 매수 주문 예정`;
    return { ...base, stage: stage0, state, amount: `실제 체결금액 ${won(0)}`, live: !!t?.orderQty && now };
  }
  const amount = `실제 체결금액 ${won(t.buyAmount)}${t.sellAmount ? ` · 매도 ${won(t.sellAmount)}` : ''}`;
  const rest = Math.max(0, (t.orderQty ?? 0) - t.filledQty - t.cancelledQty);
  if (t.orderState === 'rejected') return { ...base, stage: '매수 주문 거절', state: '증권사 거절 · 0주 체결', amount };
  if (t.orderState === 'unconfirmed') return { ...base, stage: '매수 주문 접수', state: `${shares(t.orderQty)} 주문 · 결과 확인 중`, amount, live: true };
  if (t.orderState !== 'done') {  // still live at the broker
    const c = t.cancelState === 'requested' ? ` · 잔량 ${shares(rest)} 취소 확인 중` : rest ? ` · 잔량 ${shares(rest)}` : '';
    return { ...base, stage: '매수 주문 접수', state: `${shares(t.orderQty)} 주문 · ${shares(t.filledQty)} 체결${c}`, amount, holding: t.filledQty > 0, live: true };
  }
  if (!t.filledQty) return { ...base, stage: '매수 미체결', state: `${shares(t.orderQty)} 주문 · 0주 체결 · 잔량 ${shares(t.cancelledQty || t.orderQty)} 취소 확인`, amount };
  if (!t.heldAfter) return { ...base, stage: '매도 완료', state: `${shares(t.filledQty)} 매수 · ${shares(t.sellQty)} 매도 · 실현 ${pnl(t.realizedPnl)}`, amount };
  const sell = t.sellOrderQty === null ? (now ? `${T.sell} 종가 매도 예정` : '다음 거래일 시가 매도 예정')
    : t.sellCancelState === 'confirmed' ? `종가 ${shares(t.sellQty)} 매도 · ${shares(t.heldAfter)} 다음 거래일 이월` : '종가 매도 주문 접수';
  return { ...base, stage: '보유 중', state: `${shares(t.heldAfter)} 보유 · ${sell}`, amount, holding: true, live: now };
}

function carryHero(d: Day, op: Op | null | undefined, t: Trade | undefined, sym: { symbol: string; name: string | null }): Hero {
  const T = times(op), now = live(d, op);
  const held = t?.heldBefore ?? t?.heldAfter ?? 0;
  const base = { stage: '이월 보유 · 매도 우선', name: sym.name ?? sym.symbol, code: sym.symbol, holding: true, live: now };
  if (!t || t.sellOrderQty === null) return { ...base, state: `${shares(held)} 이월 · ${now ? `${T.buy} 시가 매도 예정` : '매도 기록 없음'}`, amount: `매도 금액 ${won(0)}` };
  const amount = `매도 금액 ${won(t.sellAmount)}`;
  if (!t.heldAfter) return { ...base, holding: false, stage: '이월 보유 · 매도 완료', state: `${shares(t.sellQty)} 매도 · 실현 ${pnl(t.realizedPnl)}`, amount };
  return { ...base, state: `${shares(held)} 이월 · ${shares(t.sellQty)} 매도${t.sellCancelState === 'requested' ? ' · 잔량 취소 확인 중' : t.sellCancelState === 'confirmed' ? ` · ${shares(t.heldAfter)} 계속 이월` : ' · 매도 주문 접수'}`, amount };
}

/** Today's candidate first, then carried holdings ('이월 보유 · 매도 우선'); both named when they differ. */
export function stockHeroes(d: Day | null, op: Op | null | undefined): Hero[] {
  if (!d) return [candidateHero(null, op, undefined, null)];
  const out: Hero[] = [];
  const cand = d.stocks?.find((s) => s.role === 'candidate') ?? (d.pick ?? null);
  out.push(candidateHero(d, op, d.trades.find((t) => isCandidate(t) && t.symbol === cand?.symbol) ?? d.trades.find(isCandidate), cand ?? null));
  for (const c of d.stocks?.filter((s) => s.role === 'carry') ?? []) out.push(carryHero(d, op, d.trades.find((t) => t.carry && t.symbol === c.symbol), c));
  return out;
}

function heroHtml(h: Hero, small = false) {
  return `<div class="lt-hero${small ? ' lt-hero-sub' : ''}">
    <p class="lt-stage">${tagText(h.stage, h.live)}</p>
    <p class="lt-stock-name"><strong>${esc(h.name)}</strong>${h.code ? `<small>${esc(h.code)}</small>` : ''}</p>
    <p class="lt-stock-state">${esc(h.state)}</p>
    <p class="lt-stock-amount">${esc(h.amount)}</p></div>`;
}
const heroesHtml = (hs: Hero[]) => `<div class="lt-heroes">${hs.map((h, k) => heroHtml(h, k > 0)).join('')}</div>`;

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
      if (t.cancelState === 'requested') return `잔량 ${shares((t.orderQty ?? 0) - t.filledQty - t.cancelledQty)} 취소 확인 대기`;
      if (t.orderState === 'buy_submitted') return '시가 체결 확인';
      if (t.sellOrderQty === null && t.heldAfter) return `${T.sell} 종가 매도 ${shares(t.heldAfter)}`;
      if (t.sellOrderQty !== null && t.sellCancelState !== 'confirmed' && t.heldAfter) return `${T.close} 종가 체결 확인`;
      return `${T.report} 장후 보고`;
    }
  }
}

// ---------------------------------------------------------------- home (summary)
export function homeSideHtml(s: Snapshot | null, statusText: string): string {
  return `<dl class="lt-side-facts">
    <div><dt>운영 모델</dt><dd>${esc(s?.operation?.model ?? DASH)}</dd></div>
    <div><dt>현재 상태</dt><dd><span class="connection">${esc(statusText)}</span></dd></div>
    <div><dt>다음 행동</dt><dd>${esc(nextAction(s))}</dd></div>
  </dl>`;
}

export function homeBodyHtml(s: Snapshot | null, error: boolean): string {
  if (!s) return empty(error ? '기록 확인 불가' : '실제 기록 연결 전');
  const op = s.operation, d = s.day ?? null;
  const before = op?.phase === 'before_start' || (!d && (op?.realOrders ?? 0) === 0);
  const date = d?.date ?? (before ? op?.startDate : op?.tradingDate) ?? null;
  const lead = d?.trades.find(isCandidate);
  const vals = before && !d
    ? { held: shares(0), real: pnl(0), avg: DASH, ret: DASH }
    : { held: shares(d?.heldAfter), real: pnl(d?.realizedPnl), avg: won(lead?.avgBuyPrice ?? null), ret: pct(d?.trades.find((t) => t.returnPct !== null)?.returnPct ?? null) };
  const events = [...s.records.flatMap((r) => r.events.map((e) => ({ at: e.at, text: `${r.name} ${r.symbol} · ${e.text}`, status: e.status, id: e.id }))),
    ...(s.dayEvents ?? []).filter((e) => !e.test).map((e) => ({ at: e.at, text: e.text, status: undefined, id: e.id }))]
    .sort((a, b) => Date.parse(b.at) - Date.parse(a.at));
  const last = events[0];
  return `<p class="lt-dateline"><span>대상 날짜</span> <strong>${date ? esc(mdw(date)) : DASH}</strong>${before && !d ? ' <small>첫 운영일 예정</small>' : ''}${d ? ` ${resultTag(d.result)}` : ''}</p>
    ${heroesHtml(stockHeroes(d, op))}
    <dl class="lt-nums lt-nums-4">
      <div><dt>보유 수량</dt><dd>${esc(vals.held)}</dd></div>
      <div><dt>실현손익</dt><dd>${esc(vals.real)}</dd></div>
      <div><dt>평균 체결가</dt><dd>${esc(vals.avg)}</dd></div>
      <div><dt>거래 수익률</dt><dd>${esc(vals.ret)}</dd></div>
    </dl>
    <div class="lt-recent"><span class="lt-target-label">최근 이벤트</span>${last
      ? `<p>${last.id ? `<a class="lt-at" href="${esc(dayLink(kstDay(Date.parse(last.at)), last.id))}">${time(last.at)}</a>` : time(last.at)} ${last.status ? tag(last.status) : ''} ${esc(last.text)}</p>`
      : `<p>${DASH}</p>`}</div>
    ${date ? `<p class="lt-go"><a class="lt-day-link" href="${esc(dayLink(date))}">이날 실전 상세 <span aria-hidden="true">→</span></a></p>` : ''}`;
}

// ---------------------------------------------------------------- /live/ (date list)
const stockCell = (d: { name: string | null; symbol: string | null; stocks?: { symbol: string; name: string | null; role: string }[] }) => {
  const list = d.stocks?.length ? d.stocks : d.symbol ? [{ symbol: d.symbol, name: d.name, role: 'candidate' }] : [];
  if (!list.length) return DASH;
  return list.map((x) => `<span class="lt-cellstock"><strong>${esc(x.name ?? x.symbol)}</strong> <small>${esc(x.symbol)}${x.role === 'carry' ? ' · 이월' : list.length > 1 ? ' · 후보' : ''}</small></span>`).join('');
};

export function indexHtml(ix: Index | null, error: boolean): string {
  if (!ix) return empty(error ? '날짜 목록을 불러오지 못했습니다 · 다시 시도 중' : '날짜 목록 확인 중');
  const op = ix.operators?.[0];
  const totals = op
    ? `<dl class="lt-nums lt-nums-4"><div><dt>누적 실현손익</dt><dd>${esc(pnl(op.realizedPnl))}</dd></div>
        <div><dt>누적 수익률</dt><dd>${esc(pct(op.returnPct))}</dd></div>
        <div><dt>청산 · 수익 거래</dt><dd>${esc(op.closedTrades ?? DASH)} · ${esc(op.winningTrades ?? DASH)}</dd></div>
        <div><dt>평가손익</dt><dd>${esc(pnl(op.unrealizedPnl))}</dd></div></dl>
       <p class="lt-fine">${op.costBasis === 'gross' ? '비용 반영 전' : op.costBasis === 'net' ? '비용 반영 후' : '비용 반영 여부 미확인'} · ${esc(op.returnMethod ?? '')}</p>`
    : '';
  const rows = ix.days.length
    ? `<table class="lt-table"><thead><tr><th>날짜</th><th>종목</th><th>결과</th><th class="num">실제 매수</th><th class="num">실현손익</th><th class="num">남은 수량</th></tr></thead><tbody>
      ${ix.days.map((d) => `<tr>
        <td><a href="${esc(dayLink(d.date))}">${esc(mdw(d.date))}</a></td>
        <td>${stockCell(d)}</td>
        <td>${resultTag(d.result)}${d.reason ? `<small class="lt-reason">${esc(d.reason)}</small>` : ''}</td>
        <td class="num">${esc(won(d.buyAmount))}</td><td class="num">${esc(pnl(d.realizedPnl))}</td><td class="num">${esc(shares(d.heldAfter))}</td></tr>`).join('')}
      </tbody></table>`
    : empty(ix.startDate ? `아직 운영일이 없습니다 · 첫 운영일 ${mdw(ix.startDate)}` : '아직 운영일이 없습니다');
  return (totals ? block('누적', totals) : '') + block('운영일', rows, '시작일 이전 날짜와 연결 시험은 운영일에 넣지 않습니다. 날짜를 누르면 그날 기준 주문·체결을 봅니다.');
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
  if (t.sellOrderQty === null) return t.heldAfter ? '아직 없음' : DASH;
  const c = t.sellCancelState === 'confirmed' ? ` · 잔량 ${shares(t.sellCancelledQty)} 취소 확인` : t.sellCancelState === 'requested' ? ' · 잔량 취소 요청 중' : '';
  return `${shares(t.sellQty)} / 주문 ${shares(t.sellOrderQty)} · 평균 ${won(t.avgSellPrice)} · ${won(t.sellAmount)}${c}`;
}
function tradeHtml(t: Trade) {
  return `<section class="lt-trade"><h4>${esc(t.name ?? t.symbol)} <small>${esc(t.symbol)}${t.carry ? ' · 이월 보유 · 매도 우선' : ''}</small>${t.orderState && t.orderState in labels ? ` ${tag(t.orderState as Status)}` : ''}</h4>
    <dl class="lt-kv">
      ${t.carry ? `<div><dt>전일 이월</dt><dd>${esc(shares(t.heldBefore ?? null))}</dd></div>` : `<div><dt>주문 수량</dt><dd>${esc(shares(t.orderQty))}</dd></div>
      <div><dt>체결 수량</dt><dd>${esc(shares(t.filledQty))}</dd></div>
      <div><dt>평균 체결가</dt><dd>${esc(won(t.avgBuyPrice))}</dd></div>
      <div><dt>매수 금액</dt><dd>${esc(won(t.buyAmount))}</dd></div>
      <div><dt>취소 결과</dt><dd>${esc(cancelText(t))}</dd></div>`}
      <div><dt>${t.carry ? '이월분 매도' : '종가 매도'}</dt><dd>${esc(sellText(t))}</dd></div>
      <div><dt>이월 잔량</dt><dd>${esc(shares(t.heldAfter))}</dd></div>
      <div><dt>실현손익</dt><dd>${esc(pnl(t.realizedPnl))}</dd></div>
      <div><dt>거래 수익률</dt><dd>${esc(pct(t.returnPct))}</dd></div>
    </dl></section>`;
}

const navHtmlFor = (nav: { prev?: string; next?: string }) => `<p class="lt-nav">${nav.prev ? `<a href="${esc(dayLink(nav.prev))}">← ${esc(mdw(nav.prev))}</a>` : '<span></span>'}<a href="/live/">날짜별 목록</a>${nav.next ? `<a href="${esc(dayLink(nav.next))}">${esc(mdw(nav.next))} →</a>` : '<span></span>'}</p>`;

/** One day as of that day; `focus` = the event a link points at (shown first, with its stock). */
export function dayHtml(date: string, s: Snapshot | null, focus: string | null, nav: { prev?: string; next?: string }): string {
  const d = s?.summary ?? null, op = s?.operation;
  const events = [...(s?.records ?? []).flatMap((r) => r.events.filter((e) => kstDay(Date.parse(e.at)) === date)
      .map((e) => ({ id: e.id ?? null, at: e.at, status: e.status, who: `${r.name} ${r.symbol}`, text: e.text }))),
    ...(s?.dayEvents ?? []).filter((e) => e.date === date).map((e) => ({ id: e.id, at: e.at, status: undefined, who: e.test ? '연결 시험' : '운영', text: e.text }))]
    .sort((a, b) => Date.parse(a.at) - Date.parse(b.at));
  const later = (s?.records ?? []).filter((r) => r.events.some((e) => kstDay(Date.parse(e.at)) > date))
    .map((r) => kstDay(Math.min(...r.events.filter((e) => kstDay(Date.parse(e.at)) > date).map((e) => Date.parse(e.at)))));
  const f = focus ? events.find((e) => e.id === focus) : undefined;
  const banner = f ? `<p class="lt-linked"><span class="lt-target-label">링크한 사건</span><strong>${esc(f.who)}</strong> ${f.status ? tag(f.status) : ''} <span>${esc(kstClock(f.at))} · ${esc(f.text)}</span> <a href="#focus">타임라인에서 보기 ↓</a></p>` : '';
  const basis = d && live(d, op) && s ? `마지막 확인 ${kstClock(s.updatedAt, 5)} KST 기준` : d ? '그날 마감 기준' : '';
  const head = `<p class="lt-dateline"><span>거래일</span> <strong>${esc(mdw(date))}</strong> ${d ? resultTag(d.result) : tagText(s ? '운영일 아님' : '기록 전')}${basis ? ` <small>${esc(basis)}</small>` : ''}</p>
    ${d ? heroesHtml(stockHeroes(d, op)) : ''}
    ${d?.reason ? `<p class="lt-fine">${esc(d.reason)}</p>` : ''}
    <p class="lt-links"><a href="${esc(researchLink(date))}">그날 Sonnet 추천 상세 <span aria-hidden="true">→</span></a></p>`;
  const totals = d ? `<dl class="lt-nums lt-nums-4">
      <div><dt>실제 매수금액</dt><dd>${esc(won(d.buyAmount))}</dd></div>
      <div><dt>실현손익 <small>비용 전</small></dt><dd>${esc(pnl(d.realizedPnl))}</dd></div>
      <div><dt>평가손익</dt><dd>${esc(pnl(d.unrealizedPnl))}</dd></div>
      <div><dt>남은 수량</dt><dd>${esc(shares(d.heldAfter))}</dd></div></dl>
    <p class="lt-fine">비용 ${d.costConfirmed ? `확정 · 수수료 ${won(d.fee)} · 제세금 ${won(d.tax)}` : '미확정 · 장후 보고 후 확정'}${d.reportAt ? ` · 장후 보고 ${esc(formatTime(d.reportAt))}` : ''} · 평가손익은 장후 보고 기준</p>` : '';
  const trades = d?.trades.length ? d.trades.map(tradeHtml).join('') : d ? empty(d.reason ?? '주문 없음') : empty('이 날짜는 운영일이 아닙니다 (시작 전이거나 연결 시험만 있는 날).');
  if (!s) return head + empty('아직 이날 기록이 없습니다. 주문·체결이 기록되면 자동으로 표시합니다.') + navHtmlFor(nav);
  const timeline = events.length
    ? `<ol class="lt-history">${events.map((e) => `<li${e.id && e.id === focus ? ' class="lt-focus" aria-current="true" id="focus"' : ''}>${e.id ? `<a class="lt-at" href="${esc(dayLink(date, e.id))}"><time datetime="${esc(e.at)}">${esc(kstClock(e.at))}</time></a>` : `<time datetime="${esc(e.at)}">${esc(kstClock(e.at))}</time>`}<span>${e.status ? tag(e.status) : ''}</span>
        <p><strong>${esc(e.who)}</strong> ${esc(e.text)}${e.id && e.id === focus ? ' <small>· 링크한 사건</small>' : ''}</p></li>`).join('')}</ol>`
    : empty('이날 기록된 사건이 없습니다');
  const navHtml = navHtmlFor(nav);
  return banner + head + (totals ? block('그날 결과', totals) : '') + (d ? block('주문과 체결', trades, '−1.5%·+3%는 관찰 기록이며 익절·손절 주문이 아닙니다. 증권사 접수는 체결이 아닙니다.') : '')
    + block('타임라인 (KST)', timeline, later.length ? `이 거래의 이후 기록: ${[...new Set(later)].map((x) => `<a href="${esc(dayLink(x))}">${esc(mdw(x))}</a>`).join(', ')}` : '')
    + navHtml;
}
