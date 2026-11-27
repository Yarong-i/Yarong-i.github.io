// One renderer for the live-trading section, used at build time (set:html) and by the browser after each poll,
// so the two never drift apart. Every value is escaped; nothing is invented (unknown stays 미확인 / 집계 전).
import { labels, formatTime, amount, signed } from './live-trading';
import type { snapshotSchema } from './live-trading';
import type { z } from 'astro/zod';
type Snapshot = z.infer<typeof snapshotSchema>;
type Status = keyof typeof labels;

const ENDED: Status[] = ['closed', 'unfilled', 'rejected', 'cancelled', 'failed', 'cancel_confirmed', 'not_sent'];
// Something still open at the broker or needing a check is marked a little brighter; everything else stays grey.
const LIVE_ORDER = /submitted|partial|planned|cancel_requested|unconfirmed/;
const HISTORY_LIMIT = 20;

const esc = (v: unknown) => String(v).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
const time = (iso: string, suffix = '') => `<time datetime="${esc(iso)}">${esc(formatTime(iso))}${suffix}</time>`;
const tag = (s: Status) => `<span class="lt-tag${LIVE_ORDER.test(s) ? ' lt-tag-live' : ''}">${esc(labels[s])}</span>`;
const block = (title: string, body: string, note = '') =>
  `<section class="lt-block"><h3 class="lt-label">${title}</h3>${body}${note ? `<p class="lt-fine">${note}</p>` : ''}</section>`;
const empty = (text: string) => `<p class="lt-empty">${esc(text)}</p>`;

const kstDay = (ms: number) => new Date(ms + 9 * 3600e3).toISOString().slice(0, 10);
const md = (d: string) => `${+d.slice(5, 7)}/${+d.slice(8, 10)}`;
// 'HH:MM' for today (KST), 'M/D HH:MM' for an older day, so an old snapshot never looks like today's.
function hm(iso: string, now: number) {
  const ms = Date.parse(iso), day = kstDay(ms), clock = new Date(ms + 9 * 3600e3).toISOString().slice(11, 16);
  return day === kstDay(now) ? clock : `${md(day)} ${clock}`;
}

/** The one-line state shown beside the title. A failed connection never turns into "no orders" or "0 shares". */
export function liveStatus(s: Snapshot | null, now: number, staleMs: number, failed = false): string {
  if (!s) return failed ? '연결 실패 · 확인된 기록 없음' : '연동 대기';
  const t = hm(s.updatedAt, now);
  const stale = now - Date.parse(s.updatedAt) > staleMs;
  const op = s.operation;
  if (!op) return stale ? `갱신 지연 · 마지막 확인 ${t}` : `자동 갱신 중 · 마지막 확인 ${t}`;
  switch (op.phase) {
    case 'off': return `실전 주문 꺼짐 · 마지막 확인 ${t}`;
    case 'before_start':
      // the start day has come but the snapshot still says "before": it is old
      if (op.startDate && kstDay(now) >= op.startDate && stale) return `갱신 지연 · 마지막 확인 ${t}`;
      return `실전 활성화 · ${op.startDate ? `${md(op.startDate)} 시작 예정` : '시작일 미확인'} · 실제 주문 ${op.realOrders}건`;
    case 'closed': return `장 마감 · 마지막 확인 ${t}`;
    default: return stale ? `갱신 지연 · 마지막 확인 ${t}` : `${op.phase === 'pre_open' ? '장 시작 전' : '장중 자동 갱신'} · 마지막 확인 ${t}`;
  }
}

/** Data generation time and the last broker check, kept apart; the browser's receive time is added separately. */
export function liveChecked(s: Snapshot | null, receivedAt?: string): string {
  if (!s) return '실제 기록이 연결되면 확인 시각과 함께 표시합니다.';
  return `데이터 생성 ${formatTime(s.updatedAt)} · 마지막 증권사 확인 ${s.brokerCheckedAt ? formatTime(s.brokerCheckedAt) : '기록 없음'}`
    + `${receivedAt ? ` · 수신 ${formatTime(receivedAt)}` : ''} · KST`;
}

export function liveBodyHtml(s: Snapshot | null, error: boolean): string {
  const op = s?.operation;
  const operators = s?.operators ?? [];
  const records = [...(s?.records ?? [])].sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt));
  const active = records.filter((r) => !ENDED.includes(r.status));
  const waiting = error ? '기록 확인 불가' : s ? null : '실제 기록 연결 전';

  // ① 운영 모델
  const opLine = op ? [op.orderSend ? '실전 주문 ON' : '실전 주문 OFF', op.startDate && !operators.length ? `${op.startDate} 시작` : '', `실제 주문 ${op.realOrders}건`].filter(Boolean).join(' · ') : '';
  const models = operators.length
    ? `<ul class="lt-rows">${operators.map((o) => `<li class="lt-model"><strong>${esc(o.model)}</strong><span>${esc(o.since)} ~ ${esc(o.through)}${opLine ? ` · ${esc(opLine)}` : ''}</span></li>`).join('')}</ul>`
    : op ? `<ul class="lt-rows"><li class="lt-model"><strong>${esc(op.model)}</strong><span>${esc(opLine)}</span></li></ul>`
    : empty(waiting ?? '운용 중인 모델 미확인');

  // ② 실전 성적: same number size as the picks table, never a headline figure
  const perf = operators.length
    ? operators.map((o) => `<dl class="lt-perf" aria-label="${esc(o.model)} 실전 성적">
        <div><dt>누적 수익률</dt><dd>${esc(signed(o.returnPct, '%'))}</dd></div>
        <div><dt>실현 손익</dt><dd>${esc(signed(o.realizedPnl, '원'))}</dd></div>
        <div><dt>평가 손익</dt><dd>${esc(signed(o.unrealizedPnl, '원'))}</dd></div>
        <div><dt>청산 · 수익 거래</dt><dd>${esc(amount(o.closedTrades, '건'))} · ${esc(amount(o.winningTrades, '건'))}</dd></div>
      </dl><p class="lt-fine">${operators.length > 1 ? `${esc(o.model)} · ` : ''}${o.costBasis === 'net' ? '비용 반영 후' : o.costBasis === 'gross' ? '비용 반영 전' : '비용 반영 여부 미확인'} · 수익률 기준: ${esc(o.returnMethod ?? '미확인')} · ${time(o.updatedAt, ' KST 확인')}</p>`).join('')
    : empty(waiting ?? (op?.phase === 'before_start' ? '집계 전 · 실전 시작 후 확인된 실거래 성과만 표시합니다' : '집계 전 · 확인된 실거래 성과만 표시합니다'));

  // ③ 현재 상태
  const now = active.length
    ? `<ul class="lt-rows">${active.map((r) => {
        const has = (v: number | null | undefined) => v !== null && v !== undefined;
        const facts = [
          r.tradingDate ? `거래일 ${md(r.tradingDate)}` : '',
          `주문 ${amount(r.requestedQuantity, '주')} · 체결 ${amount(r.filledQuantity, '주')}`,
          has(r.cancelledQuantity) && r.cancelledQuantity! > 0 ? `취소 ${amount(r.cancelledQuantity!, '주')}` : '',
          r.averagePrice !== null ? `평균 체결가 ${amount(r.averagePrice, '원')}` : '',
          r.filledAmount ? `매수 ${amount(r.filledAmount, '원')}` : '',
          r.soldQuantity ? `매도 ${amount(r.soldQuantity, '주')} ${amount(r.soldAmount ?? null, '원')}${has(r.averageSellPrice) ? ` (평균 ${amount(r.averageSellPrice!, '원')})` : ''}` : '',
          has(r.realizedPnl) && r.soldQuantity ? `전략 손익 ${signed(r.realizedPnl!, '원')}` : '',
          `보유 ${amount(r.heldQuantity, '주')}`,
          r.carriedQuantity ? `이월 ${amount(r.carriedQuantity, '주')}` : '',
          r.takeProfitPrice !== null ? `익절 기준 ${amount(r.takeProfitPrice, '원')}` : '',
          r.stopLossPrice !== null ? `손절 기준 ${amount(r.stopLossPrice, '원')}` : '',
        ].filter(Boolean);
        return `<li class="lt-pos">
          <div class="lt-stock"><strong>${esc(r.name)}</strong><small>${esc(r.symbol)} · ${esc(r.model)}</small></div>
          <div class="lt-state">${tag(r.status)}<small>${r.statusSince ? `${time(r.statusSince)}부터 · ` : ''}${time(r.updatedAt, ' 기록')}</small></div>
          <p class="lt-facts">${facts.map(esc).join(' · ')}</p></li>`;
      }).join('')}</ul>`
    : empty(waiting ?? (op && op.realOrders === 0 ? '실제 주문 0건' : records.length ? '진행 중인 거래 없음' : '공개된 거래 기록 없음'));

  // ④ 시각별 이력 (newest first)
  const events = records.flatMap((r) => r.events.map((e) => ({ ...e, name: r.name, symbol: r.symbol })))
    .sort((a, b) => Date.parse(b.at) - Date.parse(a.at));
  const history = events.length
    ? `<ol class="lt-history">${events.slice(0, HISTORY_LIMIT).map((e) => `<li>${time(e.at)}<span>${e.status ? tag(e.status) : ''}</span>
        <p><strong>${esc(e.name)}</strong> <small>${esc(e.symbol)}</small> ${esc(e.text)}</p></li>`).join('')}</ol>`
    : empty(waiting ?? '아직 공개된 이벤트가 없습니다');

  return block('운영 모델', models)
    + block('실전 성적', perf)
    + block('현재 상태', now, '−1.5%·+3%는 관찰 기록이며 익절·손절 주문이 아닙니다. 증권사 접수는 체결이 아닙니다.')
    + block('시각별 이력', history, events.length > HISTORY_LIMIT ? `최근 ${HISTORY_LIMIT}건 · KST` : 'KST · 실제 발생·확인 시각');
}
