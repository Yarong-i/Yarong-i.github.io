#!/usr/bin/env node
// Merges a public export from the 158 server (deploy/158/export_public.py) into the homepage content.
//
//   npm run research:import-export -- <research-export.json> [--dry-run]
//
// Merge rules (idempotent: importing the same export twice changes nothing):
// - A day keeps its date and its first registeredAt. Days are never re-dated.
// - A published premarket record is never replaced. If the export differs, a warning is printed and the
//   published one is kept (record a real change by hand in `corrections`).
// - Postmarket is filled when pending, and replaced only when it held provisional prices that the export now
//   has in another state (e.g. the next-day confirmed close). The premarket part is untouched by this.
// - A day's strategy figures are the research system's own snapshot for that day; written once.
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
    const hadProvisional = (entry.postmarket?.results ?? []).some((r) => r.status === 'provisional');
    if ((entry.postmarket?.status ?? 'pending') === 'pending' ? postmarket.status !== 'pending' : hadProvisional && !same(entry.postmarket, postmarket)) {
      entry.postmarket = postmarket; notes.push(`${m.short}:postmarket`);
    }
    if (strategy && !entry.strategy) { entry.strategy = strategy; notes.push(`${m.short}:strategy`); }
    entry.runs ??= [];
    for (const r of runs) if (!entry.runs.includes(r)) { entry.runs.push(r); notes.push(`${m.short}:run`); }
  }
  for (const c of day.corrections ?? []) {
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
