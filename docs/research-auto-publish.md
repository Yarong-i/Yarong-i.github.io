# Research auto-publish

How the daily stock-research records reach the public site. Server names, addresses and paths are kept out of
this public repository; the server-side files live only on the research server.

## Two repositories

| repository | holds | who writes |
|---|---|---|
| `Yarong-i/Yarong-i.github.io` (this) | site code | the owner (rulesets block deletions/force pushes; admin bypass) |
| `Yarong-i/yarong-research-data` (public) | `research-export.json`, merged records | the research server's deploy key; that repository's merge workflow |

Why not one repository with a `research-data` branch: a deploy key's pushes are evaluated as the repository owner,
so the admin bypass of the branch ruleset applied to the key as well (checked 2026-11-18: rule-suite result
`bypass` for the key's probe pushes). The key's write access is therefore limited by *where it is registered* —
only on the data repository — not by branch rules. It has no access to the site repository.

## Data flow

```
research server (YATC ASK, powered ~08:20–16:20 KST on weekdays; ASK's own schedule and logic are unchanged)
  publish timer, separate from the ASK worker:
    every minute 08:25–08:59 and 15:35–15:59, every 5 min 09:00–09:55, every 2 min 16:00–16:18 KST
    export: reads the ASK database read-only, public fields only, no model call, no recomputation
      - today's models without a finalized run: 발표 대기 until the send deadline (+ late grace),
        then "발표 기한까지 기록된 추천이 없습니다"; earlier days never get placeholders
    unchanged since the last publish (ignoring exportedAt)? -> stop   (so most runs do nothing)
    else commit research-export.json -> push yarong-research-data main (deploy key, that repository only)
yarong-research-data: .github/workflows/merge.yml (push of research-export.json, retries on a schedule)
  always merges the LATEST export on main, with the site's importer (idempotent; published pre-market records
  are never replaced), checks with the site build, commits the merged records,
  then starts the site deploy with SITE_DEPLOY_TOKEN (skipped with a notice when the secret is absent)
this repository: .github/workflows/deploy.yml
  workflow_dispatch from the data repository (normal path), push to main, manual,
  schedule as retry: weekdays 08:45 / 08:55 / 09:10 / 09:30 / 16:15 / 16:30 KST
  check out main + the latest records, npm run build (astro check, build, dist guard), deploy Pages
GitHub Pages serves the built static pages: every record stays readable while the server is off.
```

Target: a recommendation sent around 08:30 is public within a few minutes, before 08:55.

- A failed export, push, merge or deploy changes nothing public; the next timer run, scheduled retry or a manual
  run repeats it with the same data and recovers. Re-running with the same export creates no commit.
- No step can move records backwards: the server always exports the current database, merge and deploy always
  read the latest main, pre-market records are never replaced, postmarket only moves from pending/provisional,
  and performance files only move to a newer as-of date.
- Home calls a record 오늘의 주식 연구 only when its trading day is today (KST, checked in the browser); otherwise
  it shows 최근 주식 연구 with the 최근 기록 badge.

## Setting up the immediate site deploy (owner only, once)

The data repository's GITHUB_TOKEN cannot start a workflow in this repository, so it needs a token that can.

1. GitHub → Settings → Developer settings → Personal access tokens → Fine-grained tokens → Generate new token.
   - Resource owner: Yarong-i · Repository access: **Only select repositories → Yarong-i/Yarong-i.github.io**
   - Repository permissions: **Actions: Read and write** (Metadata: read-only is added automatically). Nothing else.
   - Expiration: your choice; renew it before it expires (the scheduled deploys keep working without it).
2. Store it as a secret of the data repository without showing it anywhere:
   `gh secret set SITE_DEPLOY_TOKEN --repo Yarong-i/yarong-research-data` (paste the token when asked).
3. Run "Merge research export" once (Actions → Run workflow) and check that its last step says
   "Site deploy requested." and that "Deploy to GitHub Pages" starts in this repository.

## Source meaning (YATC ASK)

- Rank: only the model's stated `preference_rank` (ASK-RESPONSE-V1.2+) and the `final_rank` after the checks.
  Earlier runs have no rank; list position (ASK's "1) 2)") is display order, never a rank.
- 기본 1순위 전략 = the comparison ledger's 100% exposure account: the final first choice bought at the
  regular-session open and sold at the close, compounded daily, before costs, never an order. Day and cumulative
  figures are copied from that day's post-market ledger run.
- There is no 10-point filter strategy in the source; the site shows 미연동.

## Still missing in the research system

See `docs/research-system-gaps.md`.
