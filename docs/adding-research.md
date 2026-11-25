# Stock research records

## Where the data comes from

`src/content/research/YYYY-MM-DD.json` — one file per trading day (the day the recommendation is for) — and
`src/content/performance/*.json` are published in the public data repository **Yarong-i/yarong-research-data**
(ignored in this repository). The research server's export is merged there by that repository's workflow with
`scripts/import-research-export.mjs` (`docs/research-auto-publish.md`). Locally, `npm run research:pull` copies them.

Older records were first imported from the YATC ASK office store on a PC:

```
npm run research:import              # %LOCALAPPDATA%\YATC-ASK-Office\records\runs
npm run research:import -- <dir>     # another copy of that runs folder
npm run research:import -- --dry-run # show changes only
```

Importer rules:

- Only `mode: LIVE` and `finalized: true` runs. `DRY_RUN` runs are never published.
- A day is created only when a LIVE premarket run exists for it.
- The premarket part of a day is written once and never overwritten. Later imports only fill the postmarket part
  of the same day. If the source premarket changes, the importer warns and keeps the published version — add an
  entry to `corrections` by hand (`{ "at": ISO time, "note": "what changed" }`).
- `registeredAt` is when the day was first added to the homepage. Each model's `publishedAt` is the time the
  research system sent the recommendation. Both are kept and shown separately.
- The model name comes only from the run; a run without one is stored as `모델 미기록`.
- Internal fields (config hashes, code commit, outbox ids, raw model output, evidence ids) are not copied.

## What the site shows and computes

- Every pick is shown whatever its score. 10 points is the buy condition of the filter strategy, not a display
  condition.
- `order` is the published list position. `rank` is set only when the research system declares a rank; then Home
  shows each model's first-ranked pick and the full list stays on the day page. Without ranks Home shows every pick.
- 시가→종가 is the stock's regular-session change, computed only from a confirmed open and close. Missing values
  are shown as 장후 대기 / 미확인, never as 0.
- Strategy buy decisions follow the stated rules (base: buy the first-ranked pick; filter10: the same pick only at
  10 points or more). Without a declared rank the decision is shown as 판단 보류.
- Strategy returns are never computed on the site. Per-day returns come from `models[].strategy`, cumulative
  results from `src/content/performance/*.json` (`model`, `strategy: base|filter10`, `asOf`, `cumulativePct`,
  `trades?`, `days?`, `basis`, `source`). Without them the site shows 미연동.
- Statuses: premarket `pending` (발표 대기) · `published` · `no-picks` (정상 실행, 추천 없음) · `failed` (실행 실패);
  a `failed` premarket with `reasonCode: "EVIDENCE_ALL_EXCLUDED"` is 추천 미발행 ("근거 검증 실패 · 제안 N종목 모두
  제외"): the research system dropped every proposal in its evidence checks (`excluded` keeps each one and its
  reason; they are not recommendations). The code comes only from the source's check result, never from an
  announcement time or an empty pick list (`premarketState` in src/utils/research.ts is the one place it is read);
  postmarket `pending` · `reviewed` · `nothing` · `failed`; a day with `market: "closed"` is 휴장.

## Checking with fixtures

`tests/fixtures/` holds fictional records (source `QA-FIXTURE`, year 2030, stocks `9000xx`).
`npm run build:fixtures` builds them into `dist-fixtures/` with its own cache (`node_modules/.astro-fixtures`).
They never enter `src/content` or `dist/`.

## Build safety

- `prebuild` removes `node_modules/.astro/data-store.json`. Astro 7.0.6 otherwise keeps entries whose files were
  deleted (seen when a collection folder became empty) and still generates their pages, even into a clean `dist/`.
- `build` ends with `scripts/check-dist.mjs`, which fails if a `dist/research/<date>/` page has no source file or
  if `QA-FIXTURE` appears anywhere in `dist/`.

## News

`src/content/news/<slug>.md` for game patches, bot updates and site changes:

```markdown
---
date: 2026-11-19
kind: game            # game | bot | research | site
title: 폐품 공장 v4 테스트 시작
href: /projects/junk-factory/   # optional
---
```

Use the real date. The newest research day and writings (by `publishedAt`, grouped per day) join the feed
automatically.
