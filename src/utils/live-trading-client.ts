import { snapshotSchema, formatTime } from './live-trading';
import { liveBodyHtml } from './live-trading-view';
import { liveTradingConfig as config } from '../data/live-trading-config';
export function connectLiveTrading() {
  const root = document.querySelector<HTMLElement>('#live-trading');
  if (!root || root.dataset.connected) return;
  root.dataset.connected = 'true';
  const badge = root.querySelector<HTMLElement>('.connection')!;
  const body = root.querySelector<HTMLElement>('[data-live-body]')!;
  const checked = root.querySelector<HTMLElement>('[data-live-checked]')!;
  badge.setAttribute('role', 'status');
  const endpoint = root.dataset.endpoint;
  if (!endpoint) return;
  let url: URL;
  try {
    url = new URL(endpoint, location.origin);
    if (url.protocol !== 'https:' || url.username || url.password) throw new Error();
  } catch { badge.textContent = '연동 주소 설정 오류'; return; }
  // The build-time snapshot's time; a fetched snapshot older than this (time going backwards) is rejected.
  let lastTime = Date.parse(root.dataset.snapshotTime ?? '') || 0;
  let lastPayload = ''; let failed = false; let busy = false; let timer: ReturnType<typeof setTimeout>;
  const freshness = () => {
    badge.textContent = failed ? '연결 실패 · 이전 기록 유지' : !lastTime ? '연결 확인 중' : Date.now() - lastTime > config.staleMs ? '업데이트 지연 · 이전 기록' : '자동 갱신 중';
  };
  async function poll() {
    if (busy || document.hidden) return;
    busy = true; clearTimeout(timer);
    const controller = new AbortController(); const timeout = setTimeout(() => controller.abort(), config.timeoutMs);
    try {
      const response = await fetch(url.href, { cache: 'no-store', credentials: 'omit', signal: controller.signal, headers: { Accept: 'application/json' } });
      if (!response.ok) throw new Error('HTTP');
      const snapshot = snapshotSchema.parse(await response.json()); const stamp = Date.parse(snapshot.updatedAt);
      if (stamp < lastTime || stamp > Date.now() + 60_000) throw new Error('Invalid timestamp');
      const payload = JSON.stringify(snapshot);
      if (payload !== lastPayload) { body.innerHTML = liveBodyHtml(snapshot, false); lastPayload = payload; }
      lastTime = stamp; failed = false;
      // 원본 확인 = the server's updatedAt (when it read the ledger); 수신 = when this browser got it. Never merged.
      checked.textContent = `원본 확인 ${formatTime(snapshot.updatedAt)} KST · 수신 ${formatTime(new Date().toISOString())} KST · 확인 시점 기준 상태입니다.`;
    } catch { failed = true; } finally { clearTimeout(timeout); busy = false; freshness(); if (!document.hidden) timer = setTimeout(poll, config.pollMs); }
  }
  document.addEventListener('visibilitychange', () => { clearTimeout(timer); if (!document.hidden) { freshness(); void poll(); } });
  window.addEventListener('pagehide', () => clearTimeout(timer));
  window.addEventListener('pageshow', () => { if (!document.hidden) void poll(); });
  freshness(); void poll();
}
