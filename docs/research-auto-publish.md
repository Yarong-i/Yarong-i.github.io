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
research server (YATC ASK, powered ~08:20–16:20 KST on weekdays)
  publish timer (separate from the ASK worker; 08:55, 09:15, 15:55, 16:08 KST)
    export: reads the ASK database read-only, public fields only, no model call, no recomputation
    unchanged since the last publish (ignoring exportedAt)? -> stop
    else commit research-export.json -> push yarong-research-data main (deploy key, that repository only)
yarong-research-data: .github/workflows/merge.yml (on push of research-export.json)
  check out the site code, merge with scripts/import-research-export.mjs (idempotent; published pre-market
  records are never replaced), check with the site build, commit the merged records
this repository: .github/workflows/deploy.yml (push to main, manual, weekdays 09:10 / 09:30 / 16:15 / 16:30 KST)
  check out main + the data repository, npm run build (astro check, build, dist guard), deploy Pages
GitHub Pages serves the built static pages: every record stays readable while the server is off.
```

- A failed export, push, merge or build changes nothing public; the next timer run, schedule or a manual workflow
  run retries.
- Re-running with the same export creates no commit and no record change.
- Code-only deploys also build from the latest records, so records never go back.
- The Pages environment deploys only from main.
- The data repository cannot start this repository's workflow without a token for this repository, so the site
  picks up new records on its schedule (GitHub may start scheduled runs some minutes late). For an immediate
  deploy, run "Deploy to GitHub Pages" manually, or add a fine-grained token (Actions: write on this repository)
  as a secret of the data repository and dispatch the workflow from merge.yml.

## Source meaning (YATC ASK)

- Rank: only the model's stated `preference_rank` (ASK-RESPONSE-V1.2+) and the `final_rank` after the checks.
  Earlier runs have no rank; list position (ASK's "1) 2)") is display order, never a rank.
- 기본 1순위 전략 = the comparison ledger's 100% exposure account: the final first choice bought at the
  regular-session open and sold at the close, compounded daily, before costs, never an order. Day and cumulative
  figures are copied from that day's post-market ledger run.
- There is no 10-point filter strategy in the source; the site shows 미연동.

## Still missing in the research system

See `docs/research-system-gaps.md`.
