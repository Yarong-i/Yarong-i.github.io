// One renderer for the live-trading section, used at build time (set:html) and by the browser after each poll,
// so the two never drift apart. Every value is escaped; nothing is invented (unknown stays 미확인 / 집계 전).
import { labels, formatTime, amount, signed } from './live-trading';
import type { snapshotSchema } from './live-trading';
import type { z } from 'astro/zod';
type Snapshot = z.infer<typeof snapshotSchema>;
type Status = keyof typeof labels;

const ENDED: Status[] = ['closed', 'unfilled', 'rejected', 'cancelled', 'failed'];
// A live order at the broker (accepted or partly filled) is marked a little brighter; everything else stays grey.
const LIVE_ORDER = /submitted|partial/;
const HISTORY_LIMIT = 20;

const esc = (v: unknown) => String(v).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
const time = (iso: string, suffix = '') => `<time datetime="${esc(iso)}">${esc(formatTime(iso))}${suffix}</time>`;
const tag = (s: Status) => `<span class="lt-tag${LIVE_ORDER.test(s) ? ' lt-tag-live' : ''}">${esc(labels[s])}</span>`;
const block = (title: string, body: string, note = '') =>
  `<section class="lt-block"><h3 class="lt-label">${title}</h3>${body}${note ? `<p class="lt-fine">${note}</p>` : ''}</section>`;
const empty = (text: string) => `<p class="lt-empty">${esc(text)}</p>`;

export function liveBodyHtml(s: Snapshot | null, error: boolean): string {
  const operators = s?.operators ?? [];
  const records = [...(s?.records ?? [])].sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt));
  const active = records.filter((r) => !ENDED.includes(r.status));
  const waiting = error ? '기록 확인 불가' : s ? null : '실제 기록 연결 전';

  // ① 운영 모델
  const models = operators.length
    ? `<ul class="lt-rows">${operators.map((o) => `<li class="lt-model"><strong>${esc(o.model)}</strong><span>${esc(o.since)} ~ ${esc(o.through)}</span></li>`).join('')}</ul>`
    : empty(waiting ?? '운용 중인 모델 미확인');

  // ② 실전 성적: same number size as the picks table, never a headline figure
  const perf = operators.length
    ? operators.map((o) => `<dl class="lt-perf" aria-label="${esc(o.model)} 실전 성적">
        <div><dt>누적 수익률</dt><dd>${esc(signed(o.returnPct, '%'))}</dd></div>
        <div><dt>실현 손익</dt><dd>${esc(signed(o.realizedPnl, '원'))}</dd></div>
        <div><dt>평가 손익</dt><dd>${esc(signed(o.unrealizedPnl, '원'))}</dd></div>
        <div><dt>청산 · 수익 거래</dt><dd>${esc(amount(o.closedTrades, '건'))} · ${esc(amount(o.winningTrades, '건'))}</dd></div>
      </dl><p class="lt-fine">${operators.length > 1 ? `${esc(o.model)} · ` : ''}${o.costBasis === 'net' ? '비용 반영 후' : o.costBasis === 'gross' ? '비용 반영 전' : '비용 반영 여부 미확인'} · 수익률 기준: ${esc(o.returnMethod ?? '미확인')} · ${time(o.updatedAt, ' KST 확인')}</p>`).join('')
    : empty(waiting ?? '집계 전 · 확인된 실거래 성과만 표시합니다');

  // ③ 현재 상태
  const now = active.length
    ? `<ul class="lt-rows">${active.map((r) => {
        const facts = [
          `체결 ${amount(r.filledQuantity, '주')} / 주문 ${amount(r.requestedQuantity, '주')}`,
          `보유 ${amount(r.heldQuantity, '주')}`,
          r.averagePrice !== null ? `평균 매수가 ${amount(r.averagePrice, '원')}` : '',
          r.takeProfitPrice !== null ? `익절 기준 ${amount(r.takeProfitPrice, '원')}` : '',
          r.stopLossPrice !== null ? `손절 기준 ${amount(r.stopLossPrice, '원')}` : '',
        ].filter(Boolean);
        return `<li class="lt-pos">
          <div class="lt-stock"><strong>${esc(r.name)}</strong><small>${esc(r.symbol)} · ${esc(r.model)}</small></div>
          <div class="lt-state">${tag(r.status)}<small>${r.statusSince ? `${time(r.statusSince)}부터 · ` : ''}${time(r.updatedAt, ' 확인')}</small></div>
          <p class="lt-facts">${facts.map(esc).join(' · ')}</p></li>`;
      }).join('')}</ul>`
    : empty(waiting ?? (records.length ? '진행 중인 거래 없음' : '공개된 거래 기록 없음'));

  // ④ 시각별 이력 (newest first)
  const events = records.flatMap((r) => r.events.map((e) => ({ ...e, name: r.name, symbol: r.symbol })))
    .sort((a, b) => Date.parse(b.at) - Date.parse(a.at));
  const history = events.length
    ? `<ol class="lt-history">${events.slice(0, HISTORY_LIMIT).map((e) => `<li>${time(e.at)}<span>${e.status ? tag(e.status) : ''}</span>
        <p><strong>${esc(e.name)}</strong> <small>${esc(e.symbol)}</small> ${esc(e.text)}</p></li>`).join('')}</ol>`
    : empty(waiting ?? '아직 공개된 이벤트가 없습니다');

  return block('운영 모델', models)
    + block('실전 성적', perf)
    + block('현재 상태', now, '조건 대기는 주문 접수가 아니고, 주문 접수는 체결 완료가 아닙니다.')
    + block('시각별 이력', history, events.length > HISTORY_LIMIT ? `최근 ${HISTORY_LIMIT}건 · KST` : 'KST · 실제 발생·확인 시각');
}
