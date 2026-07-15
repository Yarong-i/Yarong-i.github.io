# Architecture

## Build and publishing flow

```mermaid
flowchart LR
  P[Project Markdown\nsrc/content/projects] --> C[Astro Content Collections\nsrc/content.config.ts]
  W[Writing Markdown\nsrc/content/writings] --> C
  C --> Q[getCollection / render]
  Q --> H[Home, lists, Archive]
  Q --> D[Static detail paths]
  U[utils/writingDates.ts\nutils/writings.ts] --> H
  U --> D
  L[BaseLayout + components + global CSS] --> H
  L --> D
  H --> B[astro check + astro build]
  D --> B
  B --> O[Static dist artifact]
  G[Push to main] --> A[GitHub Actions\nwithastro/action@v6]
  A --> B
  O --> X[actions/deploy-pages@v5]
  X --> S[https://yarong-i.github.io]
```

Content is loaded and validated at build time. There is no database, API server, CMS request, or runtime rendering in the checked-in application. The only page-side interaction is the Writings list script, which filters and reorders already-rendered DOM entries.

## File relationships

```mermaid
flowchart TD
  BC[BaseLayout.astro] --> HD[Header.astro]
  BC --> FT[Footer.astro]
  BC --> CSS[global.css]

  HOME[index.astro] --> PL[ProjectList.astro]
  HOME --> WL[WritingList.astro]
  PROJECTS[projects/index.astro] --> PL
  WRITINGS[writings/index.astro] --> WL

  WD[writings/[id].astro] --> EX[getWritingExcerpt]
  WD --> DT[formatWritingDate]
  WL --> EX
  WL --> DT
  HOME --> SORT[sortWritings]
  WRITINGS --> SORT

  PD[projects/[id].astro] --> GENERIC[Generic detail + rendered Markdown]
  PD -->|caseStudy present| CASE[Structured case-study sections]
```

All pages use `BaseLayout`, even where the arrows above focus only on shared data components. `BaseLayout` is responsible for the canonical URL, metadata, skip link, header, footer, and global styles.

## Collection-to-route behavior

```mermaid
flowchart TD
  PC[projects collection] --> PA[All projects]
  PA --> PI[/projects list]
  PA --> PP[getStaticPaths: every project]
  PP --> PG{caseStudy present?}
  PG -->|No| GN[Generic project page]
  PG -->|Yes| CS[Case-study project page]

  WC[writings collection] --> DF{draft is false?}
  DF -->|No| OMIT[Omitted from site output]
  DF -->|Yes| PUB[Public writing set]
  PUB --> WI[/writings list + browser tools]
  PUB --> WP[getStaticPaths: writing details]
  PUB --> AR[Archive]
  PUB --> HM[Home: first four after sorting]
```

The projects collection has no publication filter. `featured` affects only Home's Selected Projects section; `status === 'In Development'` affects only Home's current-work section; `private` is displayed as access metadata but is not authorization.

## Writing date, search, and excerpt flow

`sortWritings` treats `writtenAt` as the primary chronology, `publishedAt` as a tie-breaker/fallback ordering for undated entries, and Korean-locale title as the final stable tie-breaker. Archive uses `writtenAt` year and a final `DATE UNKNOWN` group.

`WritingList` serializes lower-cased title, raw Markdown body, tags, and ISO dates into `data-*` attributes. The Writings page script performs substring search, exact selected-tag matching, in-DOM sorting, visible count updates, and random navigation among visible entries.

`getWritingExcerpt` returns a trimmed explicit `excerpt` when supplied. Otherwise it cleans the first two non-empty Markdown lines and joins them. The same excerpt is rendered on cards and used as the writing detail's meta description.

## Static page count formula

```text
top-level static routes (6)
+ every project entry (5)
+ every non-draft writing entry (23)
= 34 HTML pages at the inspected commit
```

The six top-level pages are `/`, `/projects/`, `/writings/`, `/archive/`, `/about/`, and `/404.html` (output filename conventions are determined by Astro). A successful build is the authoritative confirmation of generated artifacts.
