# Yarong homepage project handoff

This document records the repository state inspected on 2026-07-15 at commit `4a4509915158ae8ff2a87753213f6bf3ed58205a`. It describes checked-in files and executable behavior; it does not assume untracked infrastructure.

## 1. Repository overview

`yarong-digital-archive` is Yarong's monochrome personal archive for projects, poetry/prose/fragments, and profile information. The home page describes the site as a place to build systems and record what remains in writing.

- Stack: Astro 7.0.6, TypeScript, Astro Content Collections, Markdown/MDX loaders, plain Astro components, scoped/global CSS, and browser-native TypeScript/JavaScript. There is no UI framework or server runtime.
- Package manager: npm; `package-lock.json` uses lockfile version 3. The workflow requests `npm@latest`.
- Node: `.nvmrc` contains `22`; `package.json` permits `>=22 <24`. Use Node.js 22. The inspection shell itself reported Node 24.18.0 and npm 11.16.0, which is outside the supported range.
- Build: `npm run build` executes `astro check && astro build`; Astro uses `output: 'static'`.
- Deployment: pushes to `main` trigger `.github/workflows/deploy.yml`, which builds with `withastro/action@v6`, uploads a Pages artifact, then deploys it with `actions/deploy-pages@v5`.
- Branch: `main`, tracking `origin/main`; it was clean before documentation work began.
- Latest commit: `4a45099` (`chore: pin Node.js 22 for development`, 2026-07-15 13:45:18 +09:00).
- Remote: `https://github.com/Yarong-i/Yarong-i.github.io.git` for fetch and push.
- Public site: `https://yarong-i.github.io`, from `astro.config.mjs`. The repository name also identifies it as the GitHub user site.

## 2. Actual folder structure

```text
.
├─ .github/workflows/deploy.yml
├─ docs/adding-writings.md
├─ scripts/new-writing.mjs
├─ public/favicon.svg
├─ src/
│  ├─ components/{Header,Footer,ProjectList,WritingList}.astro
│  ├─ content/projects/*.md
│  ├─ content/writings/*.md
│  ├─ layouts/BaseLayout.astro
│  ├─ pages/
│  │  ├─ index.astro, archive.astro, about.astro, 404.astro
│  │  ├─ projects/{index,[id]}.astro
│  │  └─ writings/{index,[id]}.astro
│  ├─ styles/global.css
│  ├─ utils/{writings,writingDates}.ts
│  └─ content.config.ts
├─ astro.config.mjs
├─ package.json / package-lock.json
├─ .nvmrc
└─ tsconfig.json
```

### `src/components`

- `Header.astro`: logo and Projects/Writings/Archive/About navigation; sets `aria-current` from the current path. It has an additional 560px mobile breakpoint.
- `Footer.astro`: site statement, back-to-top link, current year, location, and Astro credit; mobile adjustment at 600px.
- `ProjectList.astro`: numbered project rows linking to `/projects/{id}/`; renders description, category, and status.
- `WritingList.astro`: writing cards with date/category, title, extracted excerpt, and tags. When `searchable` is enabled it emits lower-cased title/body/tag and date data attributes used by the Writings page's client-side tools.

### `src/content`

- `projects/`: five Markdown project records. Frontmatter drives lists and details; Markdown bodies render only through the ordinary project detail branch.
- `writings/`: 23 Markdown writing records. All currently have `draft: false` and `writtenAt`.
- Collection definitions are not in this directory: Astro 7 uses the root-of-`src` file `src/content.config.ts` with `glob` loaders.

### `src/pages`

Astro file routes for Home, Projects, project detail, Writings, writing detail, Archive, About, and 404. Dynamic `[id]` routes use `getStaticPaths`, so they are expanded during the static build.

### `src/utils`

- `writingDates.ts`: canonical writing sorting and Korean date formatting.
- `writings.ts`: manual or body-derived excerpts.

### `scripts`

- `new-writing.mjs`: interactive creation of one new Markdown writing file with validated slug/date/category and exclusive file creation.

### `docs`

- `adding-writings.md`: existing author workflow, date semantics, draft warning, validation, and path-specific staging guidance.
- `project-handoff.md`: this operational inventory.
- `architecture.md`: data and build relationships.

### `.github/workflows`

- `deploy.yml`: Pages build/deploy on `main` push or manual dispatch. Permissions are limited to contents read, Pages write, and OIDC token write; concurrent Pages runs cancel the older in-progress run.

## 3. Page structure

| Page | Route source | Data and components |
|---|---|---|
| Home | `src/pages/index.astro` | Loads all projects; shows featured projects sorted by descending year, four newest public writings via `sortWritings`, and projects whose status equals `In Development`. Uses `BaseLayout`, `ProjectList`, `WritingList`. |
| Projects | `src/pages/projects/index.astro` | All projects sorted by descending `year`; uses `BaseLayout` and `ProjectList`. |
| Project detail | `src/pages/projects/[id].astro` | Static path for every project. Uses `BaseLayout`; renders either the generic facts/Markdown body or structured case-study sections based on presence of `data.caseStudy`. |
| Writings | `src/pages/writings/index.astro` | Non-draft writings sorted newest-first by `writtenAt`; builds tag options; uses `BaseLayout` and searchable `WritingList`. Client script handles search, tag, order, count, empty state, and random navigation. |
| Writing detail | `src/pages/writings/[id].astro` | Static paths only for non-drafts. Uses `render`, `getWritingExcerpt`, `formatWritingDate`, and `BaseLayout`; poetry gets specialized header/body layout. |
| Archive | `src/pages/archive.astro` | Combines all projects and non-draft writings, groups them by project year or writing `writtenAt` year, and places `DATE UNKNOWN` last. |
| About | `src/pages/about.astro` | Static copy and GitHub profile link in `BaseLayout`; no collection data. |
| 404 | `src/pages/404.astro` | Static not-found page in `BaseLayout`. |

`BaseLayout.astro` imports global CSS and shared header/footer, builds canonical URLs from `Astro.site`, and provides description, theme color, favicon, Open Graph basics, and skip link.

## 4. Design system

The checked-in implementation is a dark monochrome editorial system.

- Colors: `--bg #080808`, `--surface #101010`, `--text #f2f2ee`, `--muted #b8b8b1`, `--faint #85857f`, `--line #292927`. White is used on project hover; the case-study safety section inverts text/background.
- Typography: Google Fonts imports Space Grotesk (display/UI headings), Noto Sans KR (body/Korean), and DM Mono (metadata). Large headings use tight line-height, negative tracking, and often uppercase. Body weight is 300 with 1.75 line-height; prose is capped at 720px and uses 2.0 line-height.
- Width/spacing: `--max: 1320px`; `--gutter: clamp(1.25rem, 4vw, 4rem)`. `.shell` centers this width. Page and section spacing use responsive `clamp()` values. Lists use ruled rows and grids rather than isolated cards.
- Grids: project rows are four columns on desktop; writings are two columns; case-study sections use split, seven-step pipeline, and two-column capability layouts.
- Breakpoints actually present: global 800px; header 560px; footer/home 600px; archive/about/project facts 650px; case study 720px and 1024px; Writings tools 900px and 420px.
- Motion: shared `--ease: cubic-bezier(.22, 1, .36, 1)`; general reveal is 700ms with 18px upward travel; home hero lines use 600ms with 70/200ms delays; hover transitions are roughly 200–300ms.
- Reduced motion: global `prefers-reduced-motion: reduce` disables smooth scrolling and collapses animation/transition duration to `.01ms`; Home explicitly removes hero-line animation.
- Texture: `body::before` uses a very low-opacity (`.025`) fixed SVG fractal-noise overlay. It is static, not a particle system.

Required design constraints for future work: do not introduce neon, purple, excessive gradients, repeated rounded cards, unnecessary particles, or excessive/heavy shadows. Preserve the restrained monochrome, ruled-grid, editorial character. The current CSS contains no gradients or box shadows and explicitly sets form controls to `border-radius: 0`.

## 5. Content Collections

`src/content.config.ts` defines both collections with `glob({ pattern: '**/*.{md,mdx}' })`.

### Projects schema

Required: `title`, `description`, `category`, `status` (strings), `year` (number), and `technologies` (string array). `featured` and `private` are booleans defaulting to false. Optional fields are `repository` (validated URL), `cover` (string), and structured `caseStudy`.

`caseStudy`, when present, requires `subtitle`, `meta`, string arrays for `overview`, `problems`, `pipeline`, `capabilities`, `safety`, and `status`; a `principles` array of `{ title, description }`; and `closing`. Presence of this object—not title, ID, `private`, or another flag—selects the specialized case-study page.

### Writings schema and dates

Required: `title`, `publishedAt` (coerced date), `tags` (string array), and `category`. `draft` defaults to false. `writtenAt`, `updatedAt`, and `excerpt` are optional.

- `writtenAt`: actual creation date. It controls normal list ordering and Archive year. Do not invent it; omission is supported.
- `publishedAt`: date the writing was added/published on the site. It is a secondary ordering tie-breaker and is always displayed on detail pages.
- `updatedAt`: optional date of a later content revision; shown on the detail page only when present.

Draft filtering is explicit at each writing consumer: Home, Writings, Archive, and writing `getStaticPaths` call `getCollection('writings', ({ data }) => !data.draft)`. Therefore drafts have no generated writing detail page and do not appear in those lists. A draft committed to this public repository is still publicly readable as source.

All projects get a static detail route regardless of `private`. All non-draft writings get a static detail route. Static top-level routes are always built.

## 6. Writings system

- Canonical initial order: `sortWritings(..., 'newest')`. Entries with `writtenAt` sort newest-first; missing `writtenAt` entries follow dated entries. Ties use newer `publishedAt`, then Korean-locale title. Oldest mode reverses only the `writtenAt` comparison; missing dates still stay last and tie-breakers remain published-newest/title.
- Archive: project entries group by numeric `year`; writings group by `writtenAt` year. Numeric groups descend. Missing `writtenAt` goes to the final `DATE UNKNOWN` group with internal secondary ordering by `publishedAt`, then title.
- Writings display: an undated item says `Date unknown`. Archive uses uppercase `DATE UNKNOWN`.
- Search: client-side substring match over lower-cased `data-title`, full raw Markdown `data-body`, and joined tags. It does not use an index, tokenizer, fuzzy search, or server call.
- Tag filter: exact lower-cased token membership after splitting the space-joined `data-tags` string. This means a tag containing spaces cannot match correctly even though the schema permits it; this is a current implementation limitation.
- Random: chooses uniformly from currently visible DOM items and clicks its detail link. With zero visible items it does nothing.
- Excerpt: a non-empty manual `excerpt` wins. Otherwise the first two non-empty Markdown lines are cleaned of heading/list/quote markers, images, link destinations, and basic emphasis/code/strike markers, then joined with one space.
- `npm run writing:new`: prompts for title; validates a lowercase alphanumeric/hyphen slug and refuses overwrite; accepts optional real `YYYY-MM-DD` `writtenAt`; restricts category to `poetry`, `prose`, or `fragment`; parses comma-separated tags; defaults draft to yes; writes `publishedAt` as the local current date; and creates `src/content/writings/{slug}.md` with `flag: 'wx'`.

To add a writing: use Node 22, run `npm run writing:new`, fill the generated file's body, verify dates/tags/category/draft, remember that committed drafts are public source, run the required checks, review the diff, and stage only that explicit file path if a commit is later requested. Do not alter another writing's original prose as collateral cleanup.

## 7. Projects system

Generic project details show category, status, year, `private` as an Access label, description, technology tags, and rendered Markdown body. The optional `repository` and `cover` schema fields are not rendered by the current project detail template.

Local Alpha Agent contains the only current `caseStudy` object. `[id].astro` detects that object and renders its structured hero, overview, problems, research pipeline, capabilities, validation principles, safety boundary, technology, current status, and closing instead of the generic Markdown body.

To add another case study, add a project Markdown file satisfying the normal project schema plus every required `caseStudy` field. No page-code branch keyed to a specific ID is needed. Validate the schema and responsive pipeline/section layout with the standard checks. If a different case-study shape is required, update both the Zod schema and `[id].astro` deliberately.

Do not publish API keys, tokens, `.env` values, credentials, brokerage/account/bank information, personal identifiers, internal server addresses/configuration, private repository URLs, trading endpoints, live-order details, proprietary datasets, or information that would expose a private system. `private: true` is only visible metadata and does not prevent generation or publication.

## 8. Deployment

`astro.config.mjs` sets `site: 'https://yarong-i.github.io'` and `output: 'static'`. It has no `base` because `Yarong-i.github.io` is a GitHub Pages user site served at the domain root, not a project site served at `/{repository}/`. Root-relative links such as `/projects` and `/favicon.svg` depend on that root deployment.

Flow after an authorized push: `main` push → GitHub Actions checkout → `withastro/action@v6` installs with npm and runs the Astro build/upload → deploy job waits for build → `actions/deploy-pages@v5` publishes the artifact to the `github-pages` environment.

Potential “works locally, fails in deployment” points:

- using a Node version outside the repository range locally (notably Node 24) while the action selects a supported environment from project metadata;
- case-sensitive path/import differences between Windows and Ubuntu;
- untracked local files or ignored assets referenced by pages;
- absolute filesystem paths or Windows-only separators;
- malformed collection frontmatter that was not exercised before push;
- root/base URL assumptions if the repository/site type changes;
- remote Google Font availability affects appearance, though not normally the static build;
- `latest` versions for `@astrojs/check`, TypeScript, npm, and action majors can expose future changes even though Astro itself is pinned.

## 9. Current content and static output

At the inspected commit:

- Public writings: 23.
- Draft writings: 0.
- Projects: 5.
- Case-study projects: 1, `local-alpha-agent.md` / route `/projects/local-alpha-agent/`.
- Expected static HTML pages from route logic: 34 = 6 top-level pages (Home, Projects, Writings, Archive, About, 404) + 5 project details + 23 public writing details. Confirm this against `dist/**/*.html` after a successful Node 22 build.

## 10. Working rules

- Never use `git add .`; stage reviewed paths explicitly.
- Never use `git clean`.
- Never commit `.env`, tokens, credentials, account/bank information, or server information.
- Never commit `node_modules`, `dist`, `.astro`, logs, ZIP/PDF artifacts, screenshots, or generated image files. `.gitignore` already covers most of these (`*.png`, `*.jpg`, and `*.jpeg` are also ignored).
- Never modify existing writing/project original prose without an explicit request.
- Never push before an explicit user request.
- Use Node.js 22. Run `npm run astro check`, `npm run build`, and `git diff --check`; then inspect `git diff` and `git status --short`.

## 11. Known cautions

- GitHub authentication may differ between a Codex environment and a normal Windows terminal even on the same machine. If push authentication is unavailable in Codex, Codex can stop after an explicitly requested local commit and the user can push from the normal Windows terminal.
- Node 24 is intentionally excluded by `package.json`; the latest commit added `.nvmrc` and the `<24` engine ceiling. Current Astro loader/tooling behavior must be validated on Node 22, not “fixed” around under Node 24.
- Git on Windows may warn that LF will be replaced by CRLF (or the reverse). Treat it as an end-of-line configuration warning: inspect `git diff --check` and the actual diff, do not rewrite whole files merely to silence it, and preserve UTF-8 content.
- PowerShell/terminal output can display Korean UTF-8 as mojibake under the wrong code page. Do not edit source text based only on garbled terminal rendering; verify with a UTF-8-aware reader/editor.

## 12. Handoff validation snapshot

On 2026-07-15, path/schema/count checks and the credential-like-value scan of the new handoff documents completed without finding a secret value. An isolated Node 22.23.1 environment was used for final validation: `npm run astro check` completed with 0 errors, 0 warnings, and 0 hints; `npm run build` completed successfully and emitted the 34 pages calculated above. `git diff --check` also exited successfully. The machine's default Node remained 24.18.0, outside the supported range, so future checks must continue to select Node 22 explicitly.
