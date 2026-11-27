// /live/: the 주식 연구-style index (recent day table + 날짜별 기록) or one date/model detail (?date=, #m-model,
// &event=). Reads the public bucket first, then the site's build copy, every 10 s. A failed read keeps the last good
// record and its time; nothing turns into "no trade" or 0원 for lack of a record.
import { snapshotSchema, indexSchema, formatTime } from './live-trading';
import { topHtml, recordsHtml, dayDetailHtml, longDate } from './live-page-view';
import type { LiveResearchDay } from './live-research';
import { liveTradingConfig as config, archiveUrls, indexUrls } from '../data/live-trading-config';
import { newEventMarker } from './live-new-events';
import type { z } from 'astro/zod';

/** First source that has it; null = every reachable source says "not there yet"; throws = none could be read. */
async function readFirst<T>(urls: string[], parse: (v: unknown) => T): Promise<T | null> {
  let missing = false, failed = false;
  for (const u of urls) {
    const controller = new AbortController(); const t = setTimeout(() => controller.abort(), config.timeoutMs);
    try {
      const r = await fetch(u, { cache: 'no-store', credentials: 'omit', signal: controller.signal, headers: { Accept: 'application/json' } });
      if (r.status === 404 || r.status === 403) { missing = true; continue; }
      if (!r.ok) throw new Error('HTTP');
      return parse(await r.json());
    } catch { failed = true; } finally { clearTimeout(t); }
  }
  if (missing && !failed) return null;
  throw new Error('unreachable');
}

export function connectLivePage() {
  const root = document.querySelector<HTMLElement>('#live-page');
  if (!root) return;
  let research: LiveResearchDay[] = [];
  try { research = JSON.parse(document.querySelector('[data-live-research]')?.textContent ?? '[]'); } catch { research = []; }
  const q = new URLSearchParams(location.search);
  const date = q.get('date'), event = q.get('event');
  const indexView = root.querySelector<HTMLElement>('[data-mode-index]')!;
  const dayView = root.querySelector<HTMLElement>('[data-mode-day]')!;
  const bad = (date !== null && !/^\d{4}-\d{2}-\d{2}$/.test(date)) || (event !== null && !/^[a-z][a-z0-9-]{0,60}$/.test(event));
  if (date || bad) { indexView.hidden = true; dayView.hidden = false; }
  const state = root.querySelector<HTMLElement>(date || bad ? '[data-day-state]' : '[data-page-state]')!;
  const checked = root.querySelector<HTMLElement>(date || bad ? '[data-day-checked]' : '[data-page-checked]')!;
  if (bad) {
    root.querySelector('[data-day-title]')!.textContent = '잘못된 기록 링크';
    root.querySelector('[data-live-day]')!.innerHTML = '<p class="lt-empty">날짜(YYYY-MM-DD)와 사건 ID 형식이 맞지 않습니다. <a href="/live/">실전 운용</a></p>';
    return;
  }
  if (date) { root.querySelector('[data-day-title]')!.textContent = longDate(date); document.title = `${longDate(date)} 실전 운용 — YARONG`; }
  const top = root.querySelector<HTMLElement>('[data-live-top]');
  const records = root.querySelector<HTMLElement>('[data-live-records]');
  const count = root.querySelector<HTMLElement>('[data-records-count]');
  const dayBox = root.querySelector<HTMLElement>('[data-live-day]')!;
  const today = new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 10);
  let index: z.infer<typeof indexSchema> | null = null;
  let day: z.infer<typeof snapshotSchema> | null = null;
  let shownAt = '', painted = '', jumped = false, timer: ReturnType<typeof setTimeout>, busy = false;
  const markNew = newEventMarker();
  const paint = (el: HTMLElement | null, html: string) => { if (el && el.dataset.html !== html) { el.innerHTML = html; el.dataset.html = html; } };

  async function poll() {
    if (busy || document.hidden) return;
    busy = true; clearTimeout(timer);
    let failed = false, dayFailed = false;
    try {
      try {
        const ix = await readFirst(indexUrls(), (v) => indexSchema.parse(v));
        if (ix && (!index || Date.parse(ix.updatedAt) >= Date.parse(index.updatedAt))) index = ix;
      } catch { if (!date) failed = true; }
      if (date) {
        try {
          const s = await readFirst(archiveUrls(date), (v) => snapshotSchema.parse(v));
          if (s && (!day || Date.parse(s.updatedAt) >= Date.parse(day.updatedAt))) day = s;
        } catch { failed = true; dayFailed = true; }
        const days = index?.days.map((d) => d.date).sort() ?? [];
        const html = dayDetailHtml(date, day, research, event, {
          prev: [...days].reverse().find((d) => d < date), next: days.find((d) => d > date), startDate: index?.startDate ?? null, today, failed: dayFailed && !day });
        if (html !== painted) { dayBox.innerHTML = html; painted = html; if (day) markNew(dayBox); }
        // jump once: to the linked event, or to the model section named in the address (#m-...)
        if (!jumped) {
          const target = (event && dayBox.querySelector('#focus')) || (location.hash.length > 1 && document.getElementById(decodeURIComponent(location.hash.slice(1))));
          if (target) { target.scrollIntoView({ block: event ? 'center' : 'start' }); jumped = true; }
          else if (!event && day) jumped = true;
        }
      } else {
        paint(top, topHtml(index, research, failed));
        const rec = recordsHtml(index, research, today, failed);
        paint(records, rec.html);
        if (count) count.textContent = index ? `${rec.count}일` : '';
      }
      const found = !event || !!dayBox.querySelector('.lt-focus');
      const src = date ? day : index;
      if (src) shownAt = src.updatedAt;
      state.textContent = failed ? (shownAt ? `연결 실패 · ${formatTime(shownAt)} 기록 유지` : '미연동 · 연결 실패 · 다시 시도 중')
        : event && !found ? '해당 기록 반영 대기 · 10초마다 다시 확인'
        : date && !day ? (index?.startDate && date >= index.startDate && date >= today ? '예정일 · 10초마다 다시 확인' : '이 날짜 기록 없음 · 10초마다 다시 확인')
        : '자동 갱신 중';
      checked.textContent = shownAt ? `${date ? '보관본 반영' : '목록 갱신'} ${formatTime(shownAt)} · 수신 ${formatTime(new Date().toISOString())} · KST` : '';
    } finally { busy = false; if (!document.hidden) timer = setTimeout(poll, config.pollMs); }
  }
  document.addEventListener('visibilitychange', () => { clearTimeout(timer); if (!document.hidden) void poll(); });
  window.addEventListener('pagehide', () => clearTimeout(timer));
  void poll();
}
