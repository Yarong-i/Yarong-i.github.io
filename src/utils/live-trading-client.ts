import { snapshotSchema } from './live-trading';
import { liveBodyHtml, liveStatus, liveChecked } from './live-trading-view';
import { liveTradingConfig as config } from '../data/live-trading-config';
import type { z } from 'astro/zod';
type Snapshot = z.infer<typeof snapshotSchema>;
export function connectLiveTrading() {
  const root = document.querySelector<HTMLElement>('#live-trading');
  if (!root || root.dataset.connected) return;
  root.dataset.connected = 'true';
  const badge = root.querySelector<HTMLElement>('.connection')!;
  const body = root.querySelector<HTMLElement>('[data-live-body]')!;
  const checked = root.querySelector<HTMLElement>('[data-live-checked]')!;
  badge.setAttribute('role', 'status');
  // The snapshot embedded at build time (last durable copy). Only its time and phase are needed for the state line.
  let current: Snapshot | null = null;
  try {
    const e = JSON.parse(root.dataset.embedded ?? 'null');
    if (e) current = { version: 1, records: [], updatedAt: e.updatedAt, operation: e.operation ?? undefined };
  } catch { current = null; }
  let failed = false;
  const freshness = () => {
    if (root.dataset.error === undefined) badge.textContent = liveStatus(current, Date.now(), config.staleMs, failed);
  };
  freshness();
  const endpoint = root.dataset.endpoint;
  if (!endpoint) {
    // No live endpoint: the embedded snapshot only ages; re-evaluate so 장중 → 갱신 지연 happens on time.
    const tick = setInterval(freshness, config.pollMs);
    window.addEventListener('pagehide', () => clearInterval(tick));
    return;
  }
  let url: URL;
  try {
    url = new URL(endpoint, location.origin);
    if (url.protocol !== 'https:' || url.username || url.password) throw new Error();
  } catch { badge.textContent = '연동 주소 설정 오류'; return; }
  // A fetched snapshot older than the one shown (time going backwards) is rejected.
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
      if (payload !== lastPayload) { body.innerHTML = liveBodyHtml(snapshot, false); lastPayload = payload; }
      lastTime = stamp; failed = false; current = snapshot;
      // 데이터 생성 = the server's updatedAt; 수신 = when this browser got it. Never merged.
      checked.textContent = liveChecked(snapshot, new Date().toISOString());
    } catch { failed = true; } finally { clearTimeout(timeout); busy = false; freshness(); if (!document.hidden) timer = setTimeout(poll, config.pollMs); }
  }
  document.addEventListener('visibilitychange', () => { clearTimeout(timer); if (!document.hidden) { freshness(); void poll(); } });
  window.addEventListener('pagehide', () => clearTimeout(timer));
  window.addEventListener('pageshow', () => { if (!document.hidden) void poll(); });
  void poll();
}
