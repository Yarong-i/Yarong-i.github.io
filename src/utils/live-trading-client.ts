// Home summary: polls the public bucket's latest.json every 10 s (no rebuild needed). A failed or older read keeps
// the last good snapshot and its time; the state line ages honestly (장 마감 / 갱신 지연 · 마지막 확인 HH:MM).
import { snapshotSchema } from './live-trading';
import { homeSideHtml, homeBodyHtml, liveStatus, liveChecked } from './live-trading-view';
import { liveTradingConfig as config } from '../data/live-trading-config';
import type { z } from 'astro/zod';
type Snapshot = z.infer<typeof snapshotSchema>;

export function connectLiveTrading() {
  const root = document.querySelector<HTMLElement>('#live-trading');
  if (!root || root.dataset.connected) return;
  root.dataset.connected = 'true';
  const side = root.querySelector<HTMLElement>('[data-live-side]')!;
  const body = root.querySelector<HTMLElement>('[data-live-body]')!;
  const checked = root.querySelector<HTMLElement>('[data-live-checked]')!;
  const errored = root.dataset.error !== undefined;
  let current: Snapshot | null = null;
  try {
    const raw = root.querySelector('[data-live-embedded]')?.textContent;
    current = raw ? snapshotSchema.parse(JSON.parse(raw)) : null;
  } catch { current = null; }
  let failed = false;
  const paintSide = () => {
    if (errored && !current) return;
    side.innerHTML = homeSideHtml(current, liveStatus(current, Date.now(), config.staleMs, failed));
    side.querySelector('.connection')?.setAttribute('role', 'status');
  };
  paintSide();
  const endpoint = root.dataset.endpoint;
  if (!endpoint) {
    const tick = setInterval(paintSide, config.pollMs);  // the embedded snapshot only ages
    window.addEventListener('pagehide', () => clearInterval(tick));
    return;
  }
  let url: URL;
  try {
    url = new URL(endpoint, location.origin);
    if (url.protocol !== 'https:' || url.username || url.password) throw new Error();
  } catch { side.querySelector('.connection')!.textContent = '연동 주소 설정 오류'; return; }
  let lastTime = Date.parse(root.dataset.snapshotTime ?? '') || 0;
  let lastPayload = ''; let busy = false; let timer: ReturnType<typeof setTimeout>;
  async function poll() {
    if (busy || document.hidden) return;
    busy = true; clearTimeout(timer);
    const controller = new AbortController(); const timeout = setTimeout(() => controller.abort(), config.timeoutMs);
    try {
      const response = await fetch(url.href, { cache: 'no-store', credentials: 'omit', signal: controller.signal, headers: { Accept: 'application/json' } });
      if (!response.ok) throw new Error('HTTP');
      const snapshot = snapshotSchema.parse(await response.json()); const stamp = Date.parse(snapshot.updatedAt);
      if (stamp < lastTime || stamp > Date.now() + 60_000) throw new Error('Invalid timestamp');
      const payload = JSON.stringify({ ...snapshot, updatedAt: '', brokerCheckedAt: '' });
      if (payload !== lastPayload) { body.innerHTML = homeBodyHtml(snapshot, false); lastPayload = payload; }
      lastTime = stamp; failed = false; current = snapshot;
      checked.textContent = liveChecked(snapshot, new Date().toISOString());
    } catch { failed = true; } finally { clearTimeout(timeout); busy = false; paintSide(); if (!document.hidden) timer = setTimeout(poll, config.pollMs); }
  }
  document.addEventListener('visibilitychange', () => { clearTimeout(timer); if (!document.hidden) { paintSide(); void poll(); } });
  window.addEventListener('pagehide', () => clearTimeout(timer));
  window.addEventListener('pageshow', () => { if (!document.hidden) void poll(); });
  void poll();
}
