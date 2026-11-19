#!/usr/bin/env node
// Merges a public export from the 158 server (deploy/158/export_public.py) into the homepage content.
//
//   npm run research:import-export -- <research-export.json> [--dry-run]
//
// Merge rules (idempotent: importing the same export twice changes nothing):
// - A day keeps its date and its first registeredAt. Days are never re-dated.
// - A published premarket record is never replaced. If the export differs, a warning is printed and the
//   published one is kept (record a real change by hand in `corrections`).
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
    const { premarket, postmarket, strategy, runs = [], ...meta } = m;
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
    if (entry.premarket.status === 'pending' && premarket.status !== 'pending') { entry.premarket = premarket; notes.push(`${m.short}:premarket`); }
    else if (!same(core(entry.premarket), core(premarket))) warn(`${day.date} ${m.model}: export premarket differs from the published record; kept the published one`);
    const old = entry.postmarket ?? { status: 'pending', results: [] };
    if (old.status === 'pending') {
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
