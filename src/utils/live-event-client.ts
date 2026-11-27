// /live/?date=YYYY-MM-DD&event=<id>: reads that date's public archive every 10 s. Until the event is in it the page
// says '해당 기록 반영 대기' (an alert can arrive before the upload); then it shows the event and everything after it,
// and keeps updating. A failed read keeps the last good record and its time; it never turns into "no record".
import { snapshotSchema, formatTime } from './live-trading';
import { liveEventHtml } from './live-trading-view';
import { liveTradingConfig as config, archiveUrls } from '../data/live-trading-config';
import type { z } from 'astro/zod';
type Snapshot = z.infer<typeof snapshotSchema>;

export function connectLiveEvent() {
  const root = document.querySelector<HTMLElement>('#live-event');
  if (!root) return;
  const state = root.querySelector<HTMLElement>('[data-event-state]')!;
  const checked = root.querySelector<HTMLElement>('[data-event-checked]')!;
  const body = root.querySelector<HTMLElement>('[data-event-body]')!;
  const q = new URLSearchParams(location.search);
  const date = q.get('date') ?? '', id = q.get('event') ?? '';
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^[a-z][a-z0-9-]{0,60}$/.test(id)) {
    state.textContent = '잘못된 기록 링크';
    body.innerHTML = '<p class="lt-empty">날짜와 사건 ID가 있는 링크만 열 수 있습니다.</p>';
    return;
  }
  const urls = archiveUrls(date);
  let shown: Snapshot | null = null, found = false, lastPayload = '', timer: ReturnType<typeof setTimeout>, busy = false;

  // null = no source has this date yet (waiting), throws = no source could be read (connection failure)
  async function fetchArchive(): Promise<Snapshot | null> {
    let missing = false, failed = false;
    for (const u of urls) {
      const controller = new AbortController(); const t = setTimeout(() => controller.abort(), config.timeoutMs);
      try {
        const r = await fetch(u, { cache: 'no-store', credentials: 'omit', signal: controller.signal, headers: { Accept: 'application/json' } });
        if (r.status === 404) { missing = true; continue; }  // not uploaded yet here; try the next source
        if (!r.ok) throw new Error('HTTP');
        return snapshotSchema.parse(await r.json());
      } catch { failed = true; } finally { clearTimeout(t); }
    }
    if (missing && !failed) return null;  // every reachable source says: not there yet
    throw new Error('unreachable');
  }

  async function poll() {
    if (busy || document.hidden) return;
    busy = true; clearTimeout(timer);
    try {
      const s = await fetchArchive().catch(() => undefined);
      if (s === undefined) {
        state.textContent = shown ? `연결 실패 · 보관본 반영 ${formatTime(shown.updatedAt)} 기록 유지` : '연결 실패 · 다시 시도 중';
      } else {
        // never step back to an older archive than the one shown
        if (s && (!shown || Date.parse(s.updatedAt) >= Date.parse(shown.updatedAt))) {
          const html = liveEventHtml(s, id);
          if (html) {
            const payload = JSON.stringify({ ...s, updatedAt: '', brokerCheckedAt: '' });
            if (payload !== lastPayload) { body.innerHTML = html; lastPayload = payload; }
            if (!found) { found = true; document.title = `${date} 실전 운용 기록 — YARONG`; }
            shown = s;
            // a date archive is rewritten only when its content changes, so its time is when it last changed
            checked.textContent = `보관본 반영 ${formatTime(s.updatedAt)} · 마지막 증권사 확인 ${s.brokerCheckedAt ? formatTime(s.brokerCheckedAt) : '기록 없음'} · 수신 ${formatTime(new Date().toISOString())} · KST`;
          }
        }
        if (!found) {
          state.textContent = '해당 기록 반영 대기 · 10초마다 다시 확인';
          body.innerHTML = `<p class="lt-empty">${date} 기록에 이 사건(${id})이 아직 올라오지 않았습니다. 올라오면 자동으로 표시합니다.</p>`;
        } else {
          state.textContent = `자동 갱신 중 · 보관본 반영 ${formatTime(shown!.updatedAt)}`;
        }
      }
    } finally { busy = false; if (!document.hidden) timer = setTimeout(poll, config.pollMs); }
  }
  document.addEventListener('visibilitychange', () => { clearTimeout(timer); if (!document.hidden) void poll(); });
  window.addEventListener('pagehide', () => clearTimeout(timer));
  void poll();
}
