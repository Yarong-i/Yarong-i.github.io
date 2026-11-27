import { snapshotSchema, labels, amount, signed, formatTime } from './live-trading';
import { liveTradingConfig as config } from '../data/live-trading-config';
import type { z } from 'astro/zod';
type Snapshot = z.infer<typeof snapshotSchema>;
export function connectLiveTrading() {
  const root = document.querySelector<HTMLElement>('#live-trading');
  if (!root || root.dataset.connected) return;
  root.dataset.connected = 'true';
  const badge = root.querySelector<HTMLElement>('.connection')!;
  badge.setAttribute('role', 'status');
  const endpoint = root.dataset.endpoint;
  if (!endpoint) return;
  let url: URL;
  try {
    url = new URL(endpoint, location.origin);
    if (url.protocol !== 'https:' || url.username || url.password) throw new Error();
  } catch { badge.textContent = '연동 주소 설정 오류'; return; }
  const scope = [...root.attributes].filter(a => a.name.startsWith('data-astro-cid-')).map(a => a.name);
  function el(tag: string, className = '', text?: string) {
    const node = document.createElement(tag); node.className = className;
    for (const a of scope) node.setAttribute(a, '');
    if (text !== undefined) node.textContent = text;
    return node;
  }
  const pair = (label: string, value: string) => { const n = el('div'); n.append(el('dt','',label),el('dd','',value)); return n; };
  const time = (value: string) => {const n=el('time','',`${formatTime(value)} KST`);n.setAttribute('datetime',value);return n;};
  const tone = (s: string) => /failed|rejected|stop_loss/.test(s)?'alert':/submitted|partial/.test(s)?'order':/waiting/.test(s)?'waiting':'neutral';
  function render(s: Snapshot) {
    const operators=s.operators??[];
    const overview=root!.querySelector('.overview')!;
    const blocks=[['운영 모델',operators.length?operators.map(o=>o.model).join(' / '):'미확인'],['진행 중 기록',`${s.records.filter(r=>!['closed','unfilled','rejected','cancelled','failed'].includes(r.status)).length}건`],['기록 갱신 방식','10초마다 확인']];
    overview.replaceChildren(...blocks.map(([k,v])=>{const n=el('div');n.append(el('span','',k),el('strong','',v));return n;}));
    const performance=root!.querySelector('.performance')!;
    performance.replaceChildren(...(operators.length?operators:[null]).map(o=>{
      const n=el('article','performance-card'); const row=el('div','row');row.append(el('h3','',o?.model??'실전 성적'),el('span','muted',o?`${o.since} ~ ${o.through}`:'집계 전'));
      const ret=el('div','return',signed(o?.returnPct??null,'%'));ret.append(el('span','','누적 수익률'));
      const metrics=el('dl','metrics');metrics.append(pair('실현 손익',signed(o?.realizedPnl??null,'원')),pair('평가 손익',signed(o?.unrealizedPnl??null,'원')),pair('청산 거래',amount(o?.closedTrades??null,'건')),pair('수익 거래',amount(o?.winningTrades??null,'건')));
      n.append(row,ret,metrics,el('p','muted',o?`${o.costBasis==='net'?'비용 반영 후':o.costBasis==='gross'?'비용 반영 전':'비용 반영 여부 미확인'} · 수익률 기준: ${o.returnMethod??'미확인'}`:'확인된 실거래 성과만 표시합니다.'));if(o)n.append(time(o.updatedAt));return n;
    }));
    const positions=root!.querySelector('.body-grid > section')!;
    const heading=positions.querySelector('h3')!;
    positions.replaceChildren(heading);
    if(!s.records.length)positions.append(el('p','empty','공개된 거래 기록이 없습니다.'));
    for(const r of [...s.records].sort((a,b)=>Date.parse(b.updatedAt)-Date.parse(a.updatedAt))){
      const n=el('article','position');n.dataset.tone=tone(r.status);
      const row=el('div','row');row.append(el('h4','',`${r.name} ${r.symbol}`),el('span','badge',labels[r.status]));
      const state=el('div','state');state.append(el('span','','마지막 확인 상태'),el('strong','',labels[r.status]),time(r.updatedAt));if(r.statusSince)state.append(el('small','',`${formatTime(r.statusSince)}부터`));
      const metrics=el('dl','metrics');metrics.append(pair('매수 체결 금액',amount(r.filledAmount,'원')),pair('체결 / 주문 수량',`${amount(r.filledQuantity,'주')} / ${amount(r.requestedQuantity,'주')}`),pair('보유 수량',amount(r.heldQuantity,'주')),pair('평균 매수가',amount(r.averagePrice,'원')),pair('익절 기준가',amount(r.takeProfitPrice,'원')),pair('손절 기준가',amount(r.stopLossPrice,'원')));
      n.append(row,el('p','muted',`운용 모델 ${r.model}`),state,metrics,el('p','muted','조건 대기는 주문 접수가 아닙니다. 체결 확인 전에는 매매 완료로 표시하지 않습니다.'));positions.append(n);
    }
    const timeline=root!.querySelector('.timeline')!;
    root!.querySelector('.timeline-panel .empty')?.remove();
    const events=s.records.flatMap(r=>r.events.map(e=>({...e,name:r.name,symbol:r.symbol,model:r.model}))).sort((a,b)=>Date.parse(b.at)-Date.parse(a.at));
    timeline.replaceChildren(...events.map(e=>{const n=el('li');n.dataset.tone=tone(e.status??'');n.append(time(e.at));if(e.status)n.append(el('strong','event-status',labels[e.status]));n.append(el('h4','',`${e.name} ${e.symbol} · ${e.model}`),el('p','',e.text));return n;}));
    if(!events.length)root!.querySelector('.timeline-panel')!.append(el('p','empty','아직 공개된 이벤트가 없습니다.'));
  }
  let lastTime=Date.parse(root.dataset.snapshotTime??'')||0;
  let lastPayload=''; let failed=false; let busy=false; let timer: ReturnType<typeof setTimeout>;
  const freshness=()=>{
    badge.textContent=failed?'연결 실패 · 이전 기록 유지':!lastTime?'연결 확인 중':Date.now()-lastTime>config.staleMs?'업데이트 지연 · 이전 기록':'자동 갱신 중';
  };
  async function poll(){
    if(busy||document.hidden)return;
    busy=true;clearTimeout(timer);
    const controller=new AbortController();const timeout=setTimeout(()=>controller.abort(),config.timeoutMs);
    try{
      const response=await fetch(url.href,{cache:'no-store',credentials:'omit',signal:controller.signal,headers:{Accept:'application/json'}});
      if(!response.ok)throw new Error('HTTP');
      const snapshot=snapshotSchema.parse(await response.json());const stamp=Date.parse(snapshot.updatedAt);
      if(stamp<lastTime||stamp>Date.now()+60_000)throw new Error('Invalid timestamp');
      const payload=JSON.stringify(snapshot);
      if(payload!==lastPayload){render(snapshot);lastPayload=payload;}
      lastTime=stamp;failed=false;
      root!.querySelector(':scope > p.muted')!.textContent=`원본 확인 ${formatTime(snapshot.updatedAt)} KST · 수신 ${formatTime(new Date().toISOString())} KST · 기록 시각 기준 상태입니다.`;
    }catch{failed=true;}finally{clearTimeout(timeout);busy=false;freshness();if(!document.hidden)timer=setTimeout(poll,config.pollMs);}
  }
  document.addEventListener('visibilitychange',()=>{clearTimeout(timer);if(!document.hidden){freshness();void poll();}});
  window.addEventListener('pagehide',()=>clearTimeout(timer));
  window.addEventListener('pageshow',()=>{if(!document.hidden)void poll();});
  freshness();void poll();
}
