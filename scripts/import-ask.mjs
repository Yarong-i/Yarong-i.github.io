#!/usr/bin/env node
// Imports finalized LIVE records from the YATC ASK office store into src/content/research/YYYY-MM-DD.json.
//
//   npm run research:import                 # default store: %LOCALAPPDATA%\YATC-ASK-Office\records\runs
//   npm run research:import -- <runs-dir>   # another copy of the store
//   npm run research:import -- --dry-run    # print what would change, write nothing
//
// Rules (see docs/adding-research.md):
// - Only mode LIVE and finalized runs. DRY_RUN runs are tests and are never published.
// - A day's premarket recommendation is written once and never overwritten. Later imports only fill the
//   postmarket part of the same day. A difference in the source premarket is reported, not applied;
//   record such a change by hand in `corrections`.
// - `registeredAt` is the time the day was first added to the homepage. It is kept on later imports.
// - Nothing is calculated here except copying values. Strategy results are not derived from these records.
// - Internal fields (config hashes, code commits, outbox ids, raw model output, evidence ids) are not copied.
import fs from 'node:fs';
import path from 'node:path';

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const runsDir = args.find((a) => !a.startsWith('--'))
  ?? path.join(process.env.LOCALAPPDATA ?? '', 'YATC-ASK-Office', 'records', 'runs');
const outDir = path.resolve('src/content/research');
const SOURCE = 'YATC ASK';

if (!fs.existsSync(runsDir)) {
  console.error(`Record store not found: ${runsDir}`);
  process.exit(1);
}

const runs = fs.readdirSync(runsDir)
  .filter((f) => /^(PREMARKET|POSTMARKET)-\d+\.json$/.test(f))
  .map((f) => {
    const file = JSON.parse(fs.readFileSync(path.join(runsDir, f), 'utf8'));
    return { file: f, ...(file.body ?? file) };
  })
  .filter((r) => r.mode === 'LIVE' && r.finalized === true);

const sentAt = (run) => (run.delivery ?? []).find((d) => d.status === 'SENT')?.sent_at;
const texts = (list, key) => (Array.isArray(list) ? list.map((x) => (typeof x === 'string' ? x : x?.[key])).filter(Boolean) : []);
const modelOf = (run) => run.result?.model_id ?? run.result?.model_report?.primary ?? run.result?.model_report?.requested;

function premarketOf(run) {
  const picks = run.result?.picks ?? [];
  if (run.status === 'RECOMMENDED') {
    return {
      status: picks.length ? 'published' : 'no-picks',
      publishedAt: sentAt(run),
      picks: picks.map((p, i) => ({
        order: i + 1,
        ticker: String(p.ticker),
        name: p.name,
        ...(typeof p.screen_score === 'number' ? { score: p.screen_score } : {}),
        reasons: texts(p.reasons, 'text_ko'),
        risks: texts(p.risks, 'text_ko'),
        changeConditions: texts(p.change_conditions, 'condition_ko'),
      })),
    };
  }
  if (run.status === 'ANALYSIS_FAILED') {
    const raw = String(run.status_detail ?? '');
    const detail = raw.startsWith('응답 거부') ? '모델 응답이 검증 기준을 통과하지 못해 추천을 내지 않았습니다.'
      : raw.startsWith('TIMEOUT') ? '제한 시간 안에 형식에 맞는 답변을 만들지 못해 추천을 내지 않았습니다.'
      : '분석을 끝내지 못해 추천을 내지 않았습니다.';
    return {
      status: 'failed',
      publishedAt: sentAt(run),
      detail,
      picks: [],
    };
  }
  return null;
}

function postmarketOf(run) {
  if (run.status === 'NOTHING_TO_REVIEW') return { status: 'nothing', detail: '복기할 장전 추천이 없었습니다.', results: [] };
  if (run.status !== 'REVIEWED') return null;
  return {
    status: 'reviewed',
    publishedAt: sentAt(run),
    results: (run.result?.reviews ?? []).map((r) => {
      const bar = r.session_bar;
      if (!r.error && bar?.status === 'COMPLETE' && typeof bar.open === 'number' && typeof bar.close === 'number') {
        return {
          ticker: String(r.ticker), name: r.name, status: 'confirmed',
          open: bar.open, close: bar.close,
          ...(typeof bar.prev_close === 'number' ? { prevClose: bar.prev_close } : {}),
          basis: '정규장 09:00 분봉 시가 → 15:30 종가 단일가',
        };
      }
      return { ticker: String(r.ticker), name: r.name, status: 'unconfirmed', note: '정규장 시가·종가를 확정하지 못했습니다.' };
    }),
  };
}

// Group by trading date. For a date with several LIVE premarket runs, a RECOMMENDED one wins, then the latest.
const byDate = new Map();
for (const run of runs) {
  const day = byDate.get(run.trading_date) ?? { pre: [], post: [] };
  (run.kind === 'PREMARKET' ? day.pre : day.post).push(run);
  byDate.set(run.trading_date, day);
}
const pickRun = (list, preferred) => [...list].sort((a, b) => (Number(b.status === preferred) - Number(a.status === preferred)) || b.id - a.id)[0];

const now = new Date().toISOString();
let written = 0;
for (const [date, { pre, post }] of [...byDate].sort()) {
  const preRun = pickRun(pre, 'RECOMMENDED');
  const postRun = pickRun(post, 'REVIEWED');
  const premarket = preRun ? premarketOf(preRun) : null;
  if (preRun && !premarket) console.warn(`${date}: premarket status ${preRun.status} is not mapped; skipped`);
  const postmarket = postRun ? postmarketOf(postRun) : null;
  if (postRun && !postmarket) console.warn(`${date}: postmarket status ${postRun.status} is not mapped; left pending`);
  // A day is published only when a LIVE premarket run exists for it. A postmarket "nothing to review"
  // without any premarket run (before the service went live) is not a research day.
  if (!premarket) {
    if (postmarket && postmarket.status !== 'nothing') console.warn(`${date}: postmarket without a premarket run; skipped`);
    continue;
  }

  // The model is taken only from the run. A run that recorded no model is shown as such, never guessed.
  const model = modelOf(preRun) ?? '모델 미기록';
  const file = path.join(outDir, `${date}.json`);
  const existing = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : null;
  const record = existing ?? {
    date, market: 'open', registeredAt: now, corrections: [],
    source: { system: SOURCE, runs: [], origins: ['YATC-ASK-Office PC 보관본'] }, models: [],
  };
  let changed = !existing;
  let entry = record.models.find((m) => m.model === model);
  if (!entry) {
    entry = { model, premarket: premarket ?? { status: 'pending', picks: [] }, postmarket: { status: 'pending', results: [] } };
    record.models.push(entry);
    changed = true;
  } else if (premarket && JSON.stringify(entry.premarket) !== JSON.stringify(premarket)) {
    if (entry.premarket.status === 'pending') { entry.premarket = premarket; changed = true; }
    else console.warn(`${date} ${model}: source premarket differs from the published record; kept the published one (add a correction by hand if needed)`);
  }
  if (postmarket && entry.postmarket.status === 'pending') { entry.postmarket = postmarket; changed = true; }
  const ids = [preRun, postRun].filter(Boolean).map((r) => `${r.kind}-${r.id}`);
  for (const id of ids) if (!record.source.runs.includes(id)) { record.source.runs.push(id); changed = true; }

  if (!changed) continue;
  if (existing) record.updatedAt = now;
  written += 1;
  const picks = entry.premarket.picks.map((p) => `${p.name}(${p.ticker}) ${p.score ?? '-'}점`).join(', ');
  console.log(`${existing ? 'update' : 'add   '} ${date} ${model} pre=${entry.premarket.status} post=${entry.postmarket.status} ${picks}`);
  if (!dryRun) fs.writeFileSync(file, `${JSON.stringify(record, null, 2)}\n`, 'utf8');
}
console.log(`${dryRun ? '[dry-run] ' : ''}${written} day(s) ${dryRun ? 'would change' : 'written'} from ${runs.length} LIVE runs in ${runsDir}`);
