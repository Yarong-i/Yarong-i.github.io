// /live/: date list or one day. Reads the public bucket first, then the site's build copy, every 10 s.
// A day link waits ('해당 기록 반영 대기') until its event is in the archive, then highlights it. A failed read keeps
// the last good record and its time; it never turns into "no orders".
import { snapshotSchema, indexSchema, formatTime } from './live-trading';
import { indexHtml, dayHtml, md } from './live-trading-view';
import { liveTradingConfig as config, archiveUrls, indexUrls } from '../data/live-trading-config';
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
  const title = root.querySelector<HTMLElement>('[data-page-title]')!;
  const state = root.querySelector<HTMLElement>('[data-page-state]')!;
  const checked = root.querySelector<HTMLElement>('[data-page-checked]')!;
  const body = root.querySelector<HTMLElement>('[data-page-body]')!;
  const q = new URLSearchParams(location.search);
  const date = q.get('date'), event = q.get('event');
  if ((date !== null && !/^\d{4}-\d{2}-\d{2}$/.test(date)) || (event !== null && !/^[a-z][a-z0-9-]{0,60}$/.test(event))) {
    state.textContent = '잘못된 기록 링크';
    body.innerHTML = '<p class="lt-empty">날짜(YYYY-MM-DD)와 사건 ID 형식이 맞지 않습니다. <a href="/live/">날짜별 목록</a></p>';
    return;
  }
  let index: z.infer<typeof indexSchema> | null = null;
  let day: z.infer<typeof snapshotSchema> | null = null;
  let shownAt = '', painted = '', scrolled = false, timer: ReturnType<typeof setTimeout>, busy = false;
  if (date) { title.textContent = `${md(date)} 실전 상세`; document.title = `${date} 실전 기록 — YARONG`; }

  async function poll() {
    if (busy || document.hidden) return;
    busy = true; clearTimeout(timer);
    let failed = false;
    try {
      try {
        const ix = await readFirst(indexUrls(), (v) => indexSchema.parse(v));
        if (ix && (!index || Date.parse(ix.updatedAt) >= Date.parse(index.updatedAt))) index = ix;
      } catch { if (!date) failed = true; }
      if (date) {
        try {
          const s = await readFirst(archiveUrls(date), (v) => snapshotSchema.parse(v));
          if (s && (!day || Date.parse(s.updatedAt) >= Date.parse(day.updatedAt))) day = s;
        } catch { failed = true; }
      }
      const days = index?.days.map((d) => d.date).sort() ?? [];
      const nav = date ? { prev: [...days].reverse().find((d) => d < date), next: days.find((d) => d > date) } : {};
      const html = date ? dayHtml(date, day, event, nav) : indexHtml(index, failed);
      if (html !== painted) { body.innerHTML = html; painted = html; }
      const found = !event || !!body.querySelector('.lt-focus');
      if (event && found && !scrolled) { body.querySelector('.lt-focus')?.scrollIntoView({ block: 'center' }); scrolled = true; }
      const src = date ? day : index;
      if (src) shownAt = src.updatedAt;
      state.textContent = failed ? (shownAt ? `연결 실패 · ${formatTime(shownAt)} 기록 유지` : '연결 실패 · 다시 시도 중')
        : event && !found ? '해당 기록 반영 대기 · 10초마다 다시 확인'
        : date && !day ? '이 날짜 기록 없음 · 10초마다 다시 확인'
        : '자동 갱신 중';
      checked.textContent = shownAt ? `${date ? '보관본 반영' : '목록 갱신'} ${formatTime(shownAt)} · 수신 ${formatTime(new Date().toISOString())} · KST` : '';
    } finally { busy = false; if (!document.hidden) timer = setTimeout(poll, config.pollMs); }
  }
  document.addEventListener('visibilitychange', () => { clearTimeout(timer); if (!document.hidden) void poll(); });
  window.addEventListener('pagehide', () => clearTimeout(timer));
  void poll();
}
