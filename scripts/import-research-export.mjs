#!/usr/bin/env node
// Merges a public export from the 158 server (deploy/158/export_public.py) into the homepage content.
//
//   npm run research:import-export -- <research-export.json> [--dry-run]
//
// Merge rules (idempotent: importing the same export twice changes nothing):
// - A day keeps its date and its first registeredAt. Days are never re-dated.
// - A published premarket record is never replaced, and never goes back to pending or failed. If the export
//   differs, a warning is printed and the published one is kept (record a real change by hand in `corrections`).
// - A premarket stored as failed (e.g. "made but sending not confirmed" when the export ran while the message was
//   still being sent) becomes published only when the research system now states, for the SAME run, that it was
//   announced: status published, an announcement time on that trading day (KST), the same PREMARKET run id(s) and
//   the same picks. Having picks is not enough. The failed version is kept in premarketHistory and the change is
//   named in the day's corrections (previous state, when it was corrected, why). Anything else is warned and kept.
// - A failed premarket whose proposals were ALL dropped by the research system's evidence checks carries
//   reasonCode EVIDENCE_ALL_EXCLUDED (shown as 추천 미발행, not 실행 실패 and not 추천 없음). It is set only from
//   the source's own check result: the export's reasonCode, or its ranking status '제안 종목 모두 근거 점검 미통과',
//   together with no picks and every dropped proposal listed with its reason. An announcement time or an empty
//   pick list alone never sets it. A stored record that lacks it gets it once, when the export states the same
//   premarket; the earlier version is kept in premarketHistory and the day's corrections say why.
// - Postmarket and the day's strategy figures follow the research system's CURRENT statement of the day: filled
//   when pending, replaced when their values change (provisional close confirmed - same price too, its status and
//   source change -, corrected close, day restated after a later correction, a corrected early review). The
//   replaced version is kept in postmarketHistory with replacedAt and the change is appended to corrections;
//   the same statement imported again changes nothing. Never back to pending. The first publishedAt is kept.
//   The premarket part is untouched by this.
// - Corrections are appended once each (same time + ticker = same correction).
// - Performance files hold the latest published cumulative figures; replaced only by a newer or equal asOf.
// - Only the fields listed in the export are written; nothing is computed here.
import fs from 'node:fs';
import path from 'node:path';

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const file = args.find((a) => !a.startsWith('--'));
if (!file) { console.error('usage: import-research-export.mjs <export.json> [--dry-run]'); process.exit(2); }
const exp = JSON.parse(fs.readFileSync(file, 'utf8'));
if (exp.exportVersion !== 'YARONG-PUBLIC-EXPORT-V1') { console.error(`unknown export version ${exp.exportVersion}`); process.exit(2); }

const ORIGIN = '158 서버 공개용 내보내기';
const researchDir = path.resolve('src/content/research');
const perfDir = path.resolve('src/content/performance');
const now = new Date().toISOString();
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
// What a published premarket record IS: its status, announcement time and picks. Wording of a failure note and
// fields the older store did not have (excluded list, rank check) are not a change of the recommendation.
const core = (pre) => ({
  status: pre.status, publishedAt: pre.publishedAt ? new Date(pre.publishedAt).toISOString() : undefined,
  picks: (pre.picks ?? []).map(({ ticker, name, score, rank, finalRank, reasons, risks, changeConditions }) =>
    ({ ticker, name, score, rank, finalRank, reasons, risks, changeConditions })),
});
// What a published postmarket SAYS: per stock its status, open, close and close status, and the day's base
// strategy figures. A change here is a revision (kept in postmarketHistory, named in corrections); anything
// else (wording, source text, version tag, which run restated the day) is not.
const resultCore = (r) => ({ ticker: r.ticker, status: r.status, open: r.open ?? null, close: r.close ?? null,
  closeStatus: r.closeStatus ?? null });
const stratCore = (s) => (s?.base ? { executed: s.base.executed, category: s.base.category ?? null,
  ticker: s.base.ticker ?? null, dayPct: s.base.dayPct ?? null, cumPct: s.base.cumPct ?? null, final: s.base.final } : null);
const postCore = (pm, st) => ({ status: pm?.status ?? 'pending', results: (pm?.results ?? []).map(resultCore), strategy: stratCore(st) });
const bare = (s) => (s?.base ? { ...s, base: Object.fromEntries(Object.entries(s.base).filter(([k]) => k !== 'restatedBy')) } : s ?? null);
const STATUS_KO = { confirmed: '확정', provisional: '잠정', unconfirmed: '미확인' };
const wonText = (v) => (typeof v === 'number' ? `${v.toLocaleString('ko-KR')}원` : '없음');
const pctText = (v) => (typeof v === 'number' ? `${v >= 0 ? '+' : ''}${v.toFixed(2)}%` : '미완료');
// The before -> after of the values that changed, as text (nothing is computed from them).
function changeText(before, after) {
  const parts = [];
  for (const a of after.results) {
    const b = before.results.find((x) => x.ticker === a.ticker);
    if (!b) { parts.push(`${a.ticker} 가격 추가`); continue; }
    const bits = [];
    if (b.close !== a.close) bits.push(`종가 ${wonText(b.close)} → ${wonText(a.close)}`);
    else if (b.status !== a.status || b.closeStatus !== a.closeStatus) bits.push(`종가 ${wonText(a.close)} 그대로`);
    if (b.open !== a.open) bits.push(`시가 ${wonText(b.open)} → ${wonText(a.open)}`);
    if (b.status !== a.status) bits.push(`${STATUS_KO[b.status] ?? b.status} → ${STATUS_KO[a.status] ?? a.status}`);
    if (b.closeStatus !== a.closeStatus) bits.push(`근거 ${b.closeStatus ?? '없음'} → ${a.closeStatus ?? '없음'}`);
    if (bits.length) parts.push(`${a.ticker} ${bits.join(', ')}`);
  }
  const bs = before.strategy, as = after.strategy;
  if (as && bs) {
    if (bs.dayPct !== as.dayPct) parts.push(`당일 ${pctText(bs.dayPct)} → ${pctText(as.dayPct)}`);
    if (bs.cumPct !== as.cumPct) parts.push(`누적 ${pctText(bs.cumPct)} → ${pctText(as.cumPct)}`);
    if (bs.final !== as.final) parts.push(as.final ? '성과 확정' : '성과 잠정');
  } else if (as && !bs) parts.push('성과 추가');
  return parts.join(' · ');
}
const kstDate = (iso) => new Date(new Date(iso).getTime() + 9 * 3600e3).toISOString().slice(0, 10);
const kstTime = (iso) => new Date(new Date(iso).getTime() + 9 * 3600e3).toISOString().slice(11, 19);
const premarketRuns = (list) => (list ?? []).filter((r) => /^PREMARKET/.test(r)).sort();
// Why a stored failed premarket may NOT be recovered from this export (undefined = it may). See the header.
function recoveryBlock(entry, pre, runs, date, recordRuns) {
  if (entry.premarket.status !== 'failed') return 'stored premarket is not failed';
  if (pre.status !== 'published') return 'export does not say published';
  if (!pre.publishedAt || Number.isNaN(new Date(pre.publishedAt).getTime())) return 'no announcement time';
  if (kstDate(pre.publishedAt) !== date) return `announcement ${pre.publishedAt} is not on ${date} (KST)`;
  const now = premarketRuns(runs), stored = premarketRuns(entry.runs?.length ? entry.runs : recordRuns);
  if (!now.length || !same(now, stored)) return `run ${now.join(',') || '-'} is not the stored run ${stored.join(',') || '-'}`;
  if (!(entry.premarket.picks ?? []).length || !same(core(entry.premarket).picks, core(pre).picks)) return 'picks differ';
  return undefined;
}
// The research system's ranking status for a run whose every proposal failed the evidence checks.
const ALL_EXCLUDED_RANK_STATUS = '제안 종목 모두 근거 점검 미통과';
function allExcluded(pre) {
  if (pre.status !== 'failed' || (pre.picks ?? []).length) return false;
  const ex = pre.excluded ?? [];
  if (!ex.length || !ex.every((x) => x.reason)) return false;
  return pre.reasonCode === 'EVIDENCE_ALL_EXCLUDED' || pre.rankStatus === ALL_EXCLUDED_RANK_STATUS;
}
const withReason = (pre) => (allExcluded(pre) && !pre.reasonCode ? { ...pre, reasonCode: 'EVIDENCE_ALL_EXCLUDED' } : pre);
const excludedCore = (pre) => (pre.excluded ?? []).map(({ ticker, reason }) => ({ ticker, reason }));
const write = (target, data) => { if (!dryRun) fs.writeFileSync(target, `${JSON.stringify(data, null, 2)}\n`, 'utf8'); };
const stats = { added: 0, updated: 0, unchanged: 0, warnings: 0, perf: 0 };
const warn = (msg) => { stats.warnings += 1; console.warn(`warn  ${msg}`); };

for (const day of exp.days) {
  const target = path.join(researchDir, `${day.date}.json`);
  const existing = fs.existsSync(target) ? JSON.parse(fs.readFileSync(target, 'utf8')) : null;
  const record = existing ?? {
    date: day.date, market: day.market ?? 'open', registeredAt: now, corrections: [],
    source: { system: exp.system, runs: [], origins: [] }, models: [],
  };
  record.source.origins ??= [];
  const notes = [];
  const dayChanges = [];

  for (const m of day.models) {
    const { premarket: sourcePre, postmarket, strategy, runs = [], ...meta } = m;
    const premarket = withReason(sourcePre);
    // Same model id, or the same source run (a record made before per-model run ids were kept).
    let entry = record.models.find((x) => x.model === m.model)
      ?? record.models.find((x) => runs.some((r) => (x.runs?.length ? x.runs : record.source.runs).includes(r) && r.startsWith('PREMARKET-')));
    if (!entry) {
      entry = { ...meta, runs, premarket, postmarket, ...(strategy ? { strategy } : {}) };
      record.models.push(entry);
      notes.push(`+${m.short ?? m.model}`);
      continue;
    }
    // Names describe a model; copy them only onto a record of that same model id.
    const fields = entry.model === m.model ? ['key', 'label', 'short', 'role'] : ['key', 'role'];
    for (const k of fields) if (meta[k] !== undefined && entry[k] === undefined) { entry[k] = meta[k]; notes.push(`${m.short}:${k}`); }
    const block = entry.premarket.status === 'failed' && premarket.status === 'published'
      ? recoveryBlock(entry, premarket, runs, day.date, record.source.runs) : 'n/a';
    if (entry.premarket.status === 'pending' && premarket.status !== 'pending') { entry.premarket = premarket; notes.push(`${m.short}:premarket`); }
    else if (block === undefined) {
      // Failed -> published for the same run: the research system confirmed the sending after this was stored.
      const old = entry.premarket;
      entry.premarketHistory ??= [];
      // A failed premarket was stored with postmarket 'nothing' (no picks to review). That no longer holds: the
      // postmarket goes back to waiting and the normal rules below fill it. A real review is never touched.
      const oldPost = entry.postmarket?.status === 'nothing' ? entry.postmarket : undefined;
      entry.premarketHistory.push({ replacedAt: now, reason: 'sent-confirmed', premarket: old, ...(oldPost ? { postmarket: oldPost } : {}) });
      entry.premarket = premarket;
      if (oldPost) entry.postmarket = { status: 'pending', results: [] };
      const run = premarketRuns(runs).join(', ');
      dayChanges.push({ at: now, ticker: `${m.model}:premarket`,
        note: `${m.short ?? m.model} 장전 상태 정정: 실행 실패(발송 미확인) → 정상 발표. 연구 시스템이 같은 실행(${run})의 `
          + `발송 완료를 ${kstTime(premarket.publishedAt)}(KST)로 확인했습니다. 추천 종목과 점수는 바뀌지 않았습니다.` });
      notes.push(`${m.short}:premarket recovered`);
    }
    else if (!same(core(entry.premarket), core(premarket))) warn(`${day.date} ${m.model}: export premarket differs from the stored record; kept the stored one`
      + (block !== 'n/a' ? ` (not recovered: ${block})` : ''));
    // A stored failed premarket without its reason code, where the export states the same premarket (same status,
    // time, picks and dropped proposals) with the all-excluded check result: add the code once, keep the earlier
    // version, name the change. Picks, dropped proposals, postmarket and figures are not touched.
    if (entry.premarket.status === 'failed' && !entry.premarket.reasonCode && premarket.reasonCode === 'EVIDENCE_ALL_EXCLUDED'
        && allExcluded(entry.premarket) && same(core(entry.premarket), core(premarket))
        && same(excludedCore(entry.premarket), excludedCore(premarket))) {
      const old = entry.premarket;
      entry.premarketHistory ??= [];
      entry.premarketHistory.push({ replacedAt: now, reason: 'reason-code-added', premarket: old });
      entry.premarket = { ...old, reasonCode: 'EVIDENCE_ALL_EXCLUDED' };
      const n = old.excluded.length;
      dayChanges.push({ at: now, ticker: `${m.model}:premarket-reason`,
        note: `${m.short ?? m.model} 장전 상태 설명 보강: 실행 실패 → 추천 미발행(근거 검증 실패 · 제안 ${n}종목 모두 제외). `
          + `근거: 연구 시스템 기록 '${old.rankStatus ?? ALL_EXCLUDED_RANK_STATUS}'와 종목별 제외 사유 ${n}건. 제외 종목·사유와 장후 기록은 바뀌지 않았습니다.` });
      notes.push(`${m.short}:premarket reason`);
    }
    // An export that does not say published for a premarket stored as published (e.g. an older 'failed' export)
    // also derives its postmarket from that state ('nothing'); none of it is applied.
    const rejected = entry.premarket.status === 'published' && premarket.status !== 'published';
    const old = entry.postmarket ?? { status: 'pending', results: [] };
    if (rejected) { /* premarket kept above with a warning; postmarket and strategy stay as stored */ }
    else if (old.status === 'pending') {
      if (postmarket.status !== 'pending') { entry.postmarket = postmarket; notes.push(`${m.short}:postmarket`); }
      if (strategy && (postmarket.status !== 'pending' || !entry.strategy) && !same(entry.strategy, strategy)) { entry.strategy = strategy; notes.push(`${m.short}:strategy`); }
    } else if (postmarket.status !== 'pending') {
      // Never backwards to pending. The research system's current statement of the day replaces the published
      // one when its values change: a provisional close confirmed (same price: status and source change), a
      // corrected close, a day restated after a later correction. The earlier version is kept in
      // postmarketHistory with when it was replaced, and the change is named in the day's corrections.
      const before = postCore(old, entry.strategy), after = postCore(postmarket, strategy ?? entry.strategy);
      if (!same(before, after)) {
        entry.postmarketHistory ??= [];
        entry.postmarketHistory.push({ replacedAt: exp.exportedAt, revision: old.revision ?? null, postmarket: old,
                                       ...(entry.strategy ? { strategy: entry.strategy } : {}) });
        const text = changeText(before, after);
        entry.postmarket = { ...postmarket, ...(old.publishedAt ? { publishedAt: old.publishedAt } : {}) };
        if (strategy) entry.strategy = strategy;
        // ticker is the dedupe key of a correction (same time + key = same correction): one per model.
        if (text) dayChanges.push({ at: exp.exportedAt, ticker: `${m.model}:${after.results[0]?.ticker ?? ''}`,
                                    note: `${m.short ?? m.model} 장후 값 갱신: ${text}` });
        notes.push(`${m.short}:postmarket revised`);
      } else {
        // Same values; wording, source text or version tag differ: updated quietly (no history entry). Which
        // ledger run restated the day (restatedBy) changes every day and is not a change by itself.
        const next = { ...postmarket, ...(old.publishedAt ? { publishedAt: old.publishedAt } : {}) };
        if (!same(old, next) || (strategy && !same(bare(entry.strategy), bare(strategy)))) {
          entry.postmarket = next;
          if (strategy) entry.strategy = strategy;
          notes.push(`${m.short}:postmarket meta`);
        }
      }
    }
    entry.runs ??= [];
    for (const r of runs) if (!entry.runs.includes(r)) { entry.runs.push(r); notes.push(`${m.short}:run`); }
  }
  for (const c of [...(day.corrections ?? []), ...dayChanges]) {
    if (!record.corrections.some((x) => x.at === c.at && (x.ticker ?? null) === (c.ticker ?? null))) { record.corrections.push(c); notes.push('correction'); }
  }
  for (const r of day.models.flatMap((m) => m.runs ?? [])) if (!record.source.runs.includes(r)) record.source.runs.push(r);

  if (!existing) { record.source.origins.push(ORIGIN); stats.added += 1; console.log(`add    ${day.date} ${day.models.map((m) => `${m.short}:${m.premarket.status}`).join(' ')}`); write(target, record); continue; }
  if (!notes.length) { stats.unchanged += 1; continue; }
  if (!record.source.origins.includes(ORIGIN)) record.source.origins.push(ORIGIN);
  record.updatedAt = now;
  stats.updated += 1;
  console.log(`update ${day.date} ${notes.join(', ')}`);
  write(target, record);
}

for (const p of exp.performance ?? []) {
  const slug = p.model.toLowerCase().replace(/[^a-z0-9]+/g, '-');
  const target = path.join(perfDir, `${slug}-${p.strategy}.json`);
  const old = fs.existsSync(target) ? JSON.parse(fs.readFileSync(target, 'utf8')) : null;
  if (old && old.asOf > p.asOf) { warn(`${target}: existing asOf ${old.asOf} is newer than ${p.asOf}; kept`); continue; }
  if (old && same(old, p)) continue;
  stats.perf += 1;
  console.log(`perf   ${p.short ?? p.model} ${p.strategy} cum ${p.cumulativePct.toFixed(2)}% as of ${p.asOf}`);
  write(target, p);
}
console.log(`${dryRun ? '[dry-run] ' : ''}days added ${stats.added}, updated ${stats.updated}, unchanged ${stats.unchanged}; performance files ${stats.perf}; warnings ${stats.warnings}`);
