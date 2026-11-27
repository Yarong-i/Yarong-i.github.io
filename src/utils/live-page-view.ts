// /live/ in the 주식 연구 layout: big title, the recent day as a model table with the method beside it, then
// 날짜별 기록 (date -> model rows), and a date/model detail. The recommendation text comes from the research record of
// that date's operating model (embedded at build); the trading part from the live archive. They are linked only by
// date + operating model + ticker; without that evidence the page says 미연동. Live P&L is never the mock P&L.
import type { z } from 'astro/zod';
import { formatTime } from './live-trading';
import type { snapshotSchema, indexSchema, daySummary } from './live-trading';
import type { LiveResearchDay } from './live-research';
import {
  esc, tagText, tag, empty, won, shares, pnlHtml, pctHtml, kstDay, kstClock, isLive, sold, resultLabel, resultDetail,
  eventsOf, timelineHtml, tradeHtml, dayLink, stockHeroes,
} from './live-trading-view';
type Snapshot = z.infer<typeof snapshotSchema>;
type Index = z.infer<typeof indexSchema>;
type Day = z.infer<typeof daySummary>;
type Trade = Day['trades'][number];
type Row = Index['days'][number];

export const LIVE_SLUG = 'm-claude-sonnet-5';
const DASH = '—';
const dow = (d: string) => '일월화수목금토'[new Date(`${d}T00:00:00Z`).getUTCDay()];
export const longDate = (d: string) => `${d.slice(0, 4)}. ${+d.slice(5, 7)}. ${+d.slice(8, 10)}. (${dow(d)})`;
const dot = (d: string) => `${d.slice(5, 7)}.${d.slice(8, 10)}`;
const slugOf = (r?: LiveResearchDay) => r?.run?.slug ?? LIVE_SLUG;

type RPick = NonNullable<LiveResearchDay['run']>['picks'][number];
export type Link = { key: 'linked' | 'waiting' | 'missing' | 'mismatch' | 'none'; text: string; pick?: RPick };
const rankText = (p: RPick) => (p.rank !== null ? `최종 ${p.rank}순위` : `발표 순서 ${p.order}`);
/**
 * How a buy decision relates to the research record of one date's operating model. `sym` is the ticker the executor
 * decided to buy that day (the plan's pick), whatever happened to the order afterwards.
 * - no research for the date yet (or the run is still 발표 대기)       -> 추천 반영 대기
 * - research published but no operating run                           -> 미연동
 * - exactly one pick of that run has the same ticker                   -> linked (by ticker code, never by name)
 * - a ticker that none of the picks has                                -> 미연동
 * - no buy decision: the research outcome with its own label (추천 없음 / 실행 실패 / 추천 미발행 · 근거 검증 실패)
 */
export function linkState(r: LiveResearchDay | undefined, sym: string | null): Link {
  if (!r || (!r.run && r.models === 0) || r.run?.state.key === 'pending') return { key: 'waiting', text: '추천 반영 대기' };
  if (!r.run) return { key: 'missing', text: '미연동 · 그날 운영 모델의 추천 기록 없음' };
  if (sym) {
    const hits = r.run.picks.filter((p) => p.ticker === sym);
    if (hits.length === 1) return { key: 'linked', text: `${rankText(hits[0]!)} · 실전 판단 대상`, pick: hits[0] };
    return { key: 'mismatch', text: `미연동 · 매수 판단 종목 ${sym}과 일치하는 추천 없음` };
  }
  return { key: 'none', text: r.run.picks.length ? '' : `${r.run.state.label}${r.run.state.note ? ` · ${r.run.state.note}` : ''}` };
}
const daySym = (day: { pick?: { symbol: string } | null; stocks?: { symbol: string; role: string }[] } | null) =>
  day?.pick?.symbol ?? day?.stocks?.find((x) => x.role === 'candidate')?.symbol ?? null;
export const linkOf = (r: LiveResearchDay | undefined, day: Parameters<typeof daySym>[0]) => linkState(r, daySym(day));
/** The record of a carried sale names its buy date; link only when exactly one such record exists. */
function carryOrigin(s: Snapshot, t: Trade, date: string): string | null {
  const recs = s.records.filter((r) => r.symbol === t.symbol && r.tradingDate && r.tradingDate < date && r.events.some((e) => kstDay(Date.parse(e.at)) === date));
  return recs.length === 1 ? recs[0]!.tradingDate! : null;
}
/** Day return of the realized part: P&L ÷ cost of what was sold (proceeds − P&L), before costs. */
const dayPct = (pnl: number, proceeds: number) => (proceeds && proceeds - pnl ? (pnl / (proceeds - pnl)) * 100 : null);

function picksCell(r?: LiveResearchDay, max = 3) {
  const run = r?.run;
  if (!run) return `<span class="lp-state">${r && r.models > 0 ? '미연동 · 운영 모델 기록 없음' : '추천 반영 대기'}</span>`;
  if (run.state.key === 'pending') return `<span class="lp-state">추천 반영 대기</span>`;
  if (!run.picks.length) return `<span class="lp-state" data-status="${esc(run.state.key)}">${esc(run.state.label)}${run.state.note ? `<small> · ${esc(run.state.note)}</small>` : ''}</span>`;
  return run.picks.slice(0, max).map((p) => `<span class="lp-pick">${esc(p.name)} <small>${esc(p.ticker)}</small> <b>${p.score !== null ? `${p.score}점` : '점수 없음'}</b></span>`).join('');
}

// ---------------------------------------------------------------- recent day (top)
export function topHtml(ix: Index | null, research: LiveResearchDay[], failed: boolean): string {
  if (!ix) return `<div class="lp-today">${empty(failed ? '미연동 · 실전 기록을 읽지 못했습니다 · 다시 시도 중' : '실전 기록 확인 중')}</div>`;
  const row = ix.days[0];
  const planned = !row && ix.startDate ? ix.startDate : null;
  const date = row?.date ?? planned;
  const r = research.find((x) => x.date === date);
  const op = ix.operators?.[0];
  const link = row ? linkOf(r, row) : null;
  // the pick the day's buy decision matches (by ticker); without a match, the run's first pick is shown as the day's recommendation only
  const top = link?.key === 'linked' ? link.pick : r?.run?.picks.find((p) => p.ticker === (r.run!.top ?? '')) ?? r?.run?.picks[0];
  const name = r?.run?.name ?? ix.model;
  const sold = (row?.sellAmount ?? 0) > 0;
  const head = date
    ? `<p class="date"><time datetime="${esc(date)}"><span class="md">${esc(dot(date))}</span><span class="dow">${esc(dow(date))}</span></time><span class="yr">실전 거래일 · ${esc(date.slice(0, 4))}</span></p>`
    : `<p class="date"><span class="md empty">기록 전</span></p>`;
  const stock = row && link?.key === 'linked' && top
    ? `<a href="${esc(dayLink(date!))}#${esc(slugOf(r))}"><span class="name">${esc(top.name)}</span><span class="ticker">${esc(top.ticker)}</span></a>`
    : row?.name ? `<a href="${esc(dayLink(date!))}#${esc(slugOf(r))}"><span class="name">${esc(row.name)}</span><span class="ticker">${esc(row.symbol ?? '')}</span></a>`
    : `<span class="lp-state">${planned || !r?.run ? esc(linkState(r, null).text || '추천 반영 대기') : esc(r.run.state.label)}</span>`;
  const status = row ? `${tagText(resultLabel(row.result), row.result === 'in_progress')}${resultDetail(row.result, row.reason) ? `<small class="note">${esc(resultDetail(row.result, row.reason))}</small>` : ''}`
    : `${tagText('예정')}<small class="note">첫 운영일</small>`;
  const dayCell = row && sold ? `<span class="v">${pctHtml(dayPct(row.realizedPnl, row.sellAmount ?? 0))}</span><small class="note">${pnlHtml(row.realizedPnl)}</small>` : `<span class="v lp-flat">${DASH}</span><small class="note">${row ? '매도 전' : '예정'}</small>`;
  const cumCell = op && op.returnPct !== null && op.returnPct !== undefined ? `<span class="v">${pctHtml(op.returnPct)}</span><small class="note">${pnlHtml(op.realizedPnl)}</small><small class="period">${esc(dot(op.since))}~${esc(dot(op.through))}</small>` : `<span class="v lp-flat">${DASH}</span><small class="note">매도 전</small>`;
  return `<div class="lp-today">
    <div class="head"><p class="label"><span>최근 실전 운용</span> <span class="recent">${row ? '최근 기록' : '예정'}</span></p>${head}</div>
    <p class="perf-label"><strong>실전 성과 · 매도 체결분 기준</strong><span>${ix.startDate ? `누적 시작 ${esc(dot(ix.startDate))}` : ''}</span><span>비용 반영 전 · 모의 성과 아님</span></p>
    <table class="lp-table">
      <caption class="sr-only">${date ? esc(date) : ''} 운영 모델의 추천과 실전 매매</caption>
      <thead><tr><th scope="col">모델</th><th scope="col">추천 종목</th><th scope="col" class="num">점수</th><th scope="col">실제 매매</th><th scope="col" class="num">당일 청산 수익률</th><th scope="col" class="num">누적 매도분<br>원가 대비 수익률</th></tr></thead>
      <tbody><tr>
        <th scope="row" class="model"><span class="mname">${esc(name)}</span><span class="mmeta"><span class="role operating">운영</span>${r?.run?.publishedAt ? `<small>발표 ${esc(r.run.publishedAt)}</small>` : ''}</span></th>
        <td class="stock">${stock}${link && link.key !== 'linked' && link.text ? `<small class="note">${esc(link.text)}</small>` : ''}</td>
        <td class="num score">${top && link?.key === 'linked' && top.score !== null ? `${top.score}<small>점</small>` : `<span class="muted">${DASH}</span>`}</td>
        <td class="status">${status}</td>
        <td class="num perf" data-label="당일 청산 수익률">${dayCell}</td>
        <td class="num perf" data-label="누적 매도분 원가 대비 수익률">${cumCell}</td>
      </tr></tbody>
    </table>
    <details class="basis"><summary>성과 기준 보기</summary><div class="basis-body">
      <p><strong>당일 청산 수익률</strong> 그날 매도 체결된 수량의 실현손익 ÷ 그 수량의 매입원가(평균단가 기준). 이월분을 판 날은 그 매도도 포함합니다. 그날 매도가 없으면 ‘—’입니다.</p>
      <p><strong>누적 매도분 원가 대비 수익률</strong> 실전 시작일부터의 실현손익 합 ÷ 지금까지 매도된 수량의 매입원가 합. 날짜별 수익률을 곱해 잇지 않습니다.</p>
      <p>매도된 수량만 대상입니다. 남은 수량의 평가손익과 계좌 전체 수익률은 포함하지 않습니다. 모두 수수료·제세금 차감 전이며 입출금은 수익으로 보지 않습니다. 주식 연구의 모의 성과와 섞지 않습니다.</p>
    </div></details>
    <p class="links">${date ? `<a class="go" href="${esc(dayLink(date))}">이날 실전 상세 <span aria-hidden="true">→</span></a>` : ''}<a class="go quiet" href="#records">날짜별 기록 <span aria-hidden="true">→</span></a></p>
  </div>`;
}

// ---------------------------------------------------------------- 날짜별 기록
export function recordsHtml(ix: Index | null, research: LiveResearchDay[], today: string, failed: boolean): { html: string; count: number } {
  if (!ix) return { html: empty(failed ? '미연동 · 날짜별 기록을 읽지 못했습니다' : '날짜별 기록 확인 중'), count: 0 };
  const planned = ix.startDate && ix.startDate >= today && !ix.days.some((d) => d.date === ix.startDate) ? ix.startDate : null;
  const dayLi = (date: string, row: Row | null) => {
    const r = research.find((x) => x.date === date);
    const link = row ? linkOf(r, row) : null;
    const name = r?.run?.name ?? ix.model;
    const status = row ? `실전 ${resultLabel(row.result)}` : '예정';
    const detail = row ? resultDetail(row.result, row.reason) : '첫 운영일';
    const realized = row && (row.sellAmount ?? 0) > 0 ? ` · 실현 ${pnlHtml(row.realizedPnl)}` : '';
    return `<li><a class="day-date" href="${esc(dayLink(date))}">${esc(longDate(date))}</a>
      <ul class="runs"><li><a href="${esc(dayLink(date))}#${esc(slugOf(r))}">
        <span class="model">${esc(name)}</span>
        <span class="picks">${picksCell(r)}${link && link.key !== 'linked' && link.text ? `<small class="lp-warn">${esc(link.text)}</small>` : ''}</span>
        <span class="sessions"><span>장전 ${r?.run?.publishedAt ? esc(r.run.publishedAt) : DASH}</span><span class="lp-live" data-result="${row ? esc(row.result) : 'planned'}">${esc(status)}${realized}</span></span>
      </a>${detail ? `<small class="lp-detail">${esc(detail)}</small>` : ''}</li></ul></li>`;
  };
  const items = [...(planned ? [dayLi(planned, null)] : []), ...ix.days.map((d) => dayLi(d.date, d))];
  return { html: items.length ? `<ol class="days">${items.join('')}</ol>` : empty('아직 운영일이 없습니다'), count: ix.days.length };
}

// ---------------------------------------------------------------- date · model detail
type Step = { label: string; state: 'done' | 'current' | 'failed' | 'todo' | 'skip'; note: string; at?: string };
/** 매수 대기 → 매수 시도 → 주문 접수 → 체결 → 보유 → 청산 조건 감시 → 매도 주문 → 청산, from the records only. */
function actionSteps(t: Trade | undefined, d: Day, s: Snapshot, live: boolean): Step[] {
  const evs = (s.records.find((r) => r.symbol === t?.symbol)?.events ?? []).filter((e) => kstDay(Date.parse(e.at)) === d.date);
  const at = (...st: string[]) => evs.find((e) => e.status && st.includes(e.status))?.at;
  const obs = evs.filter((e) => e.id?.startsWith('o'));
  const steps: Step[] = [];
  const cur = (cond: boolean) => (cond && live ? 'current' : 'done') as Step['state'];
  steps.push({ label: '매수 대기', state: d.pick || t ? 'done' : d.pickStatus === 'waiting' ? cur(true) : 'failed', note: d.pick ? `${d.pick.name ?? d.pick.symbol} 매수 대상` : d.pickStatus === 'waiting' ? '추천 확인 전' : resultDetail(d.result, d.reason) ?? '추천 없음', at: at('planned') });
  if (!t || t.orderQty === null || t.orderState === 'planned') {
    if (d.result === 'not_attempted' || d.result === 'no_pick' || d.result === 'pick_failed') steps.push({ label: '매수 시도', state: 'failed', note: `미매수 · ${resultDetail(d.result, d.reason) ?? '사유 미확인'}` });
    else steps.push({ label: '매수 시도', state: cur(true), note: t?.orderQty ? `시가 단일가 ${shares(t.orderQty)} 주문 예정` : '주문 예정', at: at('planned') });
    return steps;
  }
  if (t.orderState === 'not_sent') { steps.push({ label: '매수 시도', state: 'failed', note: '주문 미전송 · 실행 실패' }); return steps; }
  steps.push({ label: '매수 시도', state: 'done', note: `${shares(t.orderQty)} 지정가 주문 전송` });
  if (t.orderState === 'rejected') { steps.push({ label: '주문 접수', state: 'failed', note: '증권사 거절 · 0주', at: at('rejected') }); return steps; }
  if (t.orderState === 'unconfirmed') { steps.push({ label: '주문 접수', state: cur(true), note: '접수 결과 확인 중 · 재전송 없음', at: at('unconfirmed') }); return steps; }
  steps.push({ label: '주문 접수', state: t.orderState === 'buy_submitted' ? cur(true) : 'done', note: t.orderState === 'buy_submitted' ? '접수 · 체결 전' : '증권사 접수', at: at('buy_submitted') });
  if (t.orderState === 'buy_submitted') return steps;
  const rest = Math.max(0, (t.orderQty ?? 0) - t.filledQty - t.cancelledQty);
  const cancel = t.cancelState === 'requested' ? ` · 잔량 ${shares(rest)} 취소 확인 중` : t.cancelState === 'confirmed' && t.cancelledQty ? ` · 잔량 ${shares(t.cancelledQty)} 취소 확인` : '';
  if (!t.filledQty) { steps.push({ label: '체결', state: 'failed', note: `0주 체결 · 미체결${cancel}`, at: at('cancel_confirmed', 'unfilled') }); return steps; }
  const partial = t.filledQty < (t.orderQty ?? 0);
  steps.push({ label: partial ? '일부 체결' : '체결', state: t.orderState === 'buy_partial' || t.orderState === 'cancel_requested' ? cur(true) : 'done',
    note: `${t.filledQty}/${t.orderQty}주 · 평균 ${won(t.avgBuyPrice)} · ${won(t.buyAmount)}${cancel}`, at: at('buy_partial', 'holding') });
  const holdingNow = t.heldAfter > 0 && t.sellOrderQty === null;
  steps.push({ label: '보유', state: cur(holdingNow), note: `${shares(t.filledQty)} 보유${t.heldAfter && !holdingNow ? ` → 마감 ${shares(t.heldAfter)}` : ''}` });
  steps.push({ label: '청산 조건 감시', state: cur(holdingNow), note: `−1.5%·+3% 관찰만 · 주문 아님${obs.length ? ` · ${obs.map((e) => `${kstClock(e.at, 5)} ${e.text.startsWith('+3') ? '+3%' : '−1.5%'} 도달`).join(', ')}` : ''}`, at: obs[0]?.at });
  if (t.sellOrderQty === null) return steps;
  const sellLive = t.heldAfter > 0 && t.sellCancelState !== 'confirmed';
  steps.push({ label: '매도 주문', state: cur(sellLive && !t.sellQty), note: `${shares(t.sellOrderQty)} 종가 단일가 · 접수${t.sellQty ? ` · ${t.sellQty}/${t.sellOrderQty}주 체결` : ' · 체결 전'}`, at: at('sell_submitted') });
  if (!t.heldAfter) steps.push({ label: '청산', state: 'done', note: `${shares(t.sellQty)} 매도 · 평균 ${won(t.avgSellPrice)} · ${won(t.sellAmount)}`, at: at('closed') });
  else if (t.sellCancelState === 'confirmed') steps.push({ label: '청산', state: 'failed', note: `${shares(t.sellQty)} 매도 · ${shares(t.heldAfter)} 다음 거래일 이월`, at: at('carried') });
  else steps.push({ label: '청산', state: cur(true), note: t.sellQty ? `일부 매도 ${t.sellQty}/${t.sellOrderQty}주` : '체결 대기' });
  return steps;
}
const stepsHtml = (steps: Step[], live: boolean) => `<ol class="lp-steps${live ? ' is-live' : ''}">${steps.map((s) =>
  `<li class="is-${s.state}"${s.state === 'current' ? ' aria-current="step"' : ''}><span class="lp-dot" aria-hidden="true"></span><b>${esc(s.label)}</b>${s.at ? ` <time datetime="${esc(s.at)}">${esc(kstClock(s.at))}</time>` : ''}<small>${esc(s.note)}</small>${s.state === 'failed' ? '<span class="sr-only"> (중단)</span>' : ''}</li>`).join('')}</ol>`;

export function dayDetailHtml(date: string, s: Snapshot | null, research: LiveResearchDay[], focus: string | null,
  nav: { prev?: string; next?: string; startDate?: string | null; today: string; failed: boolean }): string {
  const r = research.find((x) => x.date === date);
  const d = s?.summary ?? null, op = s?.operation;
  const live = !!d && isLive(d, op);
  const link = d ? linkOf(r, d) : null;
  const run = r?.run;
  const slug = slugOf(r);
  const scheduled = !s && !nav.failed && !!nav.startDate && date >= nav.startDate && date >= nav.today;
  const events = eventsOf(s, date);
  const f = focus ? events.find((e) => e.id === focus) : undefined;
  const meta = `<dl class="meta-grid">
      <div><dt>운영 모델</dt><dd>${esc(run?.name ?? d?.model ?? 'Claude Sonnet 5')}${run ? ` <small>${esc(run.model)}</small>` : ''}</dd></div>
      <div><dt>실전 상태</dt><dd>${d ? esc(resultLabel(d.result)) : scheduled ? '예정' : nav.failed ? '미연동' : '기록 없음'}</dd></div>
      <div><dt>기준</dt><dd>${d ? (live && s ? `마지막 확인 ${esc(kstClock(s.updatedAt, 5))} KST` : '그날 마감 기준') : DASH}</dd></div>
      <div><dt>마지막 정상 확인</dt><dd>${s ? esc(formatTime(s.updatedAt)) : DASH}</dd></div>
      <div><dt>마지막 증권사 확인</dt><dd>${s?.brokerCheckedAt ? esc(formatTime(s.brokerCheckedAt)) : DASH}</dd></div>
    </dl>`;
  const banner = f ? `<p class="lp-linked"><span>링크한 사건</span> <strong>${esc(f.who)}</strong> ${f.status ? tag(f.status) : ''} ${esc(kstClock(f.at))} · ${esc(f.text)} <a href="#focus">이력에서 보기 ↓</a></p>` : '';
  // the recommendation of that date's operating model (research record)
  const picks = run ? (run.picks.length ? `<ol class="picks">${run.picks.map((p) => {
      const target = link?.key === 'linked' && link.pick?.ticker === p.ticker;
      const bought = target && d!.trades.some((t) => !t.carry && t.symbol === p.ticker && t.orderQty !== null && t.orderState !== 'planned');
      const order = rankText(p);
      return `<li${target ? ' class="is-target"' : ''}><div class="pick-head"><span class="order">${esc(order)}${target ? (bought ? ' · 실전 대상 · 주문함' : ' · 실전 판단 대상 · 주문 없음') : ''}</span>
        <h3>${esc(p.name)} <small>${esc(p.ticker)}</small></h3><span class="score">${p.score !== null ? `${p.score}<small>점</small>` : '<small>점수 없음</small>'}</span></div>
        <div class="texts">${p.reasons.length ? `<div><h4>선정 이유</h4><ul>${p.reasons.map((x) => `<li>${esc(x)}</li>`).join('')}</ul></div>` : ''}${p.risks.length ? `<div><h4>위험</h4><ul>${p.risks.map((x) => `<li>${esc(x)}</li>`).join('')}</ul></div>` : ''}${p.conditions.length ? `<div><h4>판단이 바뀌는 조건</h4><ul>${p.conditions.map((x) => `<li>${esc(x)}</li>`).join('')}</ul></div>` : ''}</div></li>`;
    }).join('')}</ol>` : `<p class="detail">${esc(run.state.label)}${run.state.note ? ` · ${esc(run.state.note)}` : ''}${run.detail ? ` · ${esc(run.detail)}` : ''}</p>`)
    : `<p class="detail">${esc(linkState(r, null).text)} · ${r && r.models > 0 ? '그날 운영 모델의 추천 기록이 없습니다.' : '그날 장전 추천이 게시되면 표시합니다.'}</p>`;
  const linkNote = link && link.key !== 'linked' && link.text ? `<p class="lp-warn">${esc(link.text)}</p>` : '';
  // the live action on that recommendation
  let action = '';
  if (d) {
    const cand = d.trades.find((t) => !t.carry && (t.symbol === d.pick?.symbol || !d.pick)) ?? d.trades.find((t) => !t.carry);
    const carries = d.trades.filter((t) => t.carry);
    const heroes = stockHeroes(d, op, s!.records);
    const totals = `<dl class="lp-nums"><div><dt>실제 매수금액</dt><dd>${esc(won(d.buyAmount))}</dd></div>
      <div><dt>실제 매도금액</dt><dd>${esc(won(d.sellAmount))}</dd></div>
      <div><dt>실현손익 <small>비용 전</small></dt><dd>${pnlHtml(d.realizedPnl, d.trades.some(sold))}</dd></div>
      <div><dt>평가손익</dt><dd>${pnlHtml(d.unrealizedPnl)}</dd></div>
      <div><dt>남은 수량</dt><dd>${esc(shares(d.heldAfter))}</dd></div></dl>
      <p class="hint">청산 수익률은 그날 매도된 수량의 실현손익 ÷ 그 수량의 매입원가입니다. 남은 수량의 평가손익과 계좌 전체 수익률은 포함하지 않습니다.</p>
      <p class="hint">비용 ${d.costConfirmed ? `확정 · 수수료 ${esc(won(d.fee))} · 제세금 ${esc(won(d.tax))}` : '미확정 · 장후 보고 후 확정'}${d.reportAt ? ` · 장후 보고 ${esc(formatTime(d.reportAt))}` : ''}</p>`;
    action = `<div class="lp-action"><h3>실전 행동</h3>
      <p class="lp-actionhead">${esc(heroes[0]?.name ?? '')}${heroes[0]?.code ? ` <small>${esc(heroes[0].code)}</small>` : ''} ${tagText(heroes[0]?.stage ?? resultLabel(d.result), heroes[0]?.live)}</p>
      ${stepsHtml(actionSteps(cand, d, s!, live), live)}
      ${cand ? tradeHtml(cand) : `<p class="detail">미매수 · ${esc(resultDetail(d.result, d.reason) ?? '사유 미확인')}</p>`}
      ${carries.map((t) => {
        const bd = carryOrigin(s!, t, date);
        const rb = bd ? research.find((x) => x.date === bd) : undefined;
        const lk = bd ? linkState(rb, t.symbol) : null;
        const origin = !bd ? '최초 매수 추천: 미연동 · 최초 매수일을 하나로 특정할 수 없음'
          : lk!.key === 'linked' ? `최초 매수 추천: <a href="${esc(dayLink(bd))}#${esc(slugOf(rb))}">${esc(longDate(bd))} ${esc(rb!.run!.name)} · ${esc(lk!.pick!.name)} ${esc(lk!.pick!.ticker)} · ${esc(rankText(lk!.pick!))}${lk!.pick!.score !== null ? ` ${lk!.pick!.score}점` : ''}</a>`
          : `최초 매수 ${esc(longDate(bd))} · ${esc(lk!.text)}`;
        return `<h3 class="lp-carry">이월 보유 · 매도 우선 — ${esc(t.name ?? t.symbol)} <small>${esc(t.symbol)}</small></h3><p class="lp-origin">${origin}</p>${tradeHtml(t)}`;
      }).join('')}
      ${totals}</div>`;
  }
  const history = `<div class="lp-history"><h3>주문·체결 이력 <small>KST</small></h3>${events.length ? timelineHtml(events, { focus, linkDate: date }) : empty(scheduled ? '예정일 · 아직 기록 없음' : '이날 기록된 사건이 없습니다')}</div>`;
  const section = `<section id="${esc(slug)}" class="model">
      <header class="model-head"><h2>${esc(run?.name ?? d?.model ?? 'Claude Sonnet 5')}<span class="role">운영</span></h2>
        <p class="sessions"><span>장전 ${run ? `${esc(run.state.label)}${run.publishedAt ? ` · ${esc(run.publishedAt)}` : ''}` : esc(linkState(r, null).text)}</span><span>실전 ${d ? esc(resultLabel(d.result)) : scheduled ? '예정' : nav.failed ? '미연동' : '기록 없음'}</span></p></header>
      ${run ? `<p class="model-id">모델 ${esc(run.model)} · 추천 출처 주식 연구 · 실전 기록 출처 실전 운용 장부</p>` : ''}
      ${linkNote}${picks}${action}${s ? history : ''}
    </section>`;
  const noFile = !s ? `<p class="closed"><strong>${scheduled ? '예정일' : nav.failed ? '미연동' : '기록 없음'}</strong>${scheduled ? '예정된 운영일입니다. 주문·체결이 기록되면 자동으로 표시합니다.' : nav.failed ? '실전 기록을 읽지 못했습니다. 10초마다 다시 확인합니다.' : '이 날짜의 실전 기록이 없습니다.'}</p>` : '';
  const pager = `<nav class="pager" aria-label="실전 기록 날짜 이동">${nav.prev ? `<a class="btn btn-ghost" href="${esc(dayLink(nav.prev))}">← ${esc(longDate(nav.prev))}</a>` : '<span></span>'}${nav.next ? `<a class="btn btn-ghost" href="${esc(dayLink(nav.next))}">${esc(longDate(nav.next))} →</a>` : ''}</nav>`;
  return meta + banner + noFile + (s || run ? section : '') + pager;
}
