# Research auto-publish

How the daily stock-research records reach the public site. Server names, addresses and paths are kept out of
this public repository; the server-side files live only on the research server.

## Data flow

```
research server (YATC ASK, powered ~08:20–16:20 KST on weekdays)
  publish timer (separate from the ASK worker; 08:55, 09:15, 15:55, 16:08 KST)
    export: reads the ASK database read-only, public fields only, no model call, no recomputation
    unchanged since the last publish (ignoring exportedAt)? -> stop
    else commit research-export.json -> push branch research-data (dedicated deploy key)
research-data branch
  .github/workflows/research-trigger.yml -> starts "Deploy to GitHub Pages" on main (workflow_dispatch)
main: .github/workflows/deploy.yml
  check out main (code) + research-data (records, export)
  scripts/import-research-export.mjs  (idempotent merge; published pre-market records are never replaced)
  npm run build (astro check, build, dist guard)
  only after a successful build: save merged records to research-data, deploy Pages
GitHub Pages serves the built static pages: every record stays readable while the server is off.
```

- A failed export, push or build changes nothing public; the next timer run or a manual workflow run retries.
- Re-running with the same export creates no commit on research-data and no record change.
- Code-only deploys also build from the latest research-data, so records never go back.
- Backstop: the deploy workflow also runs on weekdays at 09:30 and 16:20 KST.

## Source meaning (YATC ASK)

- Rank: only the model's stated `preference_rank` (ASK-RESPONSE-V1.2+) and the `final_rank` after the checks.
  Earlier runs have no rank; list position (ASK's "1) 2)") is display order, never a rank.
- 기본 1순위 전략 = the comparison ledger's 100% exposure account: the final first choice bought at the
  regular-session open and sold at the close, compounded daily, before costs, never an order. Day and cumulative
  figures are copied from that day's post-market ledger run.
- There is no 10-point filter strategy in the source; the site shows 미연동.

## Access and protection

- The server pushes with a dedicated deploy key (write access). A deploy key with write access can push to any
  branch of the repository; the key itself does not limit branches. What limits it is a repository ruleset that
  restricts creating, updating and deleting every branch except `research-data`, with only repository admins
  allowed to bypass. Check that the ruleset is active before adding the key.
- The deploy workflow writes only to research-data. The Pages environment deploys only from main.

## Still missing in the research system

See `docs/research-system-gaps.md`.
