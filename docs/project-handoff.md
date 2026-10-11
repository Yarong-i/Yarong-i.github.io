# Yarong homepage project handoff

This document records the repository state inspected on 2026-07-15 at commit `4a4509915158ae8ff2a87753213f6bf3ed58205a`. It describes checked-in files and executable behavior; it does not assume untracked infrastructure.

## 1. Repository overview

`yarong-digital-archive` is Yarong's personal archive for projects, poetry/prose/fragments, and profile information. The home page describes the site as a place to build systems and record what remains in writing.

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

- `Header.astro`: thin bar with the YARONG logo and a `Menu` button (`aria-expanded`/`aria-controls`) at every width. The button unfolds a full-width panel from the top (`clip-path`), then the large Projects/Writings/Archive/About items rise in one after another; closing reverses it (items leave in reverse order, then the panel folds) and the closed panel is `visibility: hidden`, so its links are out of the tab order. Escape or a click outside closes it and Escape returns focus to the button; `aria-current` marks the current section. Once the page scrolls, the fixed bar gets a translucent dark background. Without JavaScript (no `.js` class on `<html>`) the button is hidden and the links are shown inline in the header.
- `home/HomeHero.astro`: Home scene one. Centered `YARONG` (Inter 800, tight tracking, sized from the content width with `min(100cqi / 4.35, 15rem, 30svh)`), the introduction `개발하고, 주식을 연구하고, 글을 씁니다.`, a white Projects button, an outlined Writings button and an Archive link. The light from below is a compact bright core under the centre (it leans slightly toward the pointer) with a much fainter halo, and a horizontal mask fades both sides to black; a softer light and a highlight inside the title follow the mouse through registered CSS custom properties (`--lx/--ly`, `--tx/--ty`) that the browser eases. Scrolling sets `--p` (0–1), and the title and light recede with it. Entry: the name rises and its tracking settles while the light opens (CSS only).
- `src/scripts/motion.ts` (loaded by `BaseLayout`): event-driven helpers shared by all pages. It moves the pointer light on `.lit` cards and `.writing-item` cards, and reveals `[data-reveal]` elements in `--i` order with an IntersectionObserver. Elements are hidden only after the script adds `.reveal-ready`, so nothing depends on it loading.
- `home/HomeFeature.astro`: Home scene two. A large silver panel that stays narrower than the screen (black margins of `--panel-gap` on both sides, at most 100rem wide, 28px corners), lit from above with a soft highlight, a gentle darkening toward the bottom and a one-pixel bright top edge. Inside it, the projects that set `home` (1 = first) as four equal type-only cards in a 2 × 2 grid (one column at 760px and below), each a step brighter than the panel with a hairline edge. Card titles start at a fixed distance below the top row, so optional lines such as an alias never shift a title; the category sits at the bottom. Each card is one link and shares the pointer light and lift of `.lit`. As the section enters, the script sets `--open` (0–1) and the panel opens from an inset band with larger corners to its resting size; scrolling back up closes it the same way.
- `home/HomeWritings.astro`: Home's recent writings as full-width rows (title / existing excerpt / date · category · 미완성 and an arrow), thin horizontal rules only, no tag chips; the date and its separator are omitted when there is none. Each row is one link; hover and keyboard focus brighten the row slightly, turn on the shared pointer light (`motion.ts` also tracks `.wrow`) and move the arrow 6px. Rows rise in order with `[data-reveal]`. The Writings page keeps `WritingList`.
- `ResearchFlow.astro`: the research flow drawn in HTML/CSS from a case study (pipeline steps, `Guarded progression` checkpoints, `Failure preservation` lane, research scope from `safety[0]`, `Separation from live execution`, and the step named in the `status` line that mentions `shadow`). Boxes grow with their text after the web font loads; a container query (`flow`, 66rem) switches from the vertical layout to a horizontal row only when all steps fit at their narrowest. Used on case-study detail pages.
- `Footer.astro`: `YARONG`, back-to-top link, current year, location, and Astro credit; mobile adjustment at 600px.
- `ProjectList.astro`: numbered project rows linking to `/projects/{id}/`; renders title, alias, summary (or description), category, and stage label, with `data-stage` for the Projects filter.
- `WritingList.astro`: writing cards with date/category, title, extracted excerpt, and tags. When `searchable` is enabled it emits lower-cased title/body/tag and date data attributes used by the Writings page's client-side tools.

### `src/content`

- `projects/`: twelve Markdown project records. Frontmatter drives lists and details; Markdown bodies render in the detail page's "기존 기록" section.
- `writings/`: 24 Markdown writing records. 23 poems have `writtenAt` and `publishedAt`; `geubun.md` (그분, 세계관·소설, unfinished) has no dates because none were given. Its body was converted from the author's DOCX (SHA-256 f8cfe013…bbf0) with one rendered `<p>` per non-empty DOCX paragraph, text unchanged: 102 paragraphs and 2,312 characters by python-docx `paragraph.text`, matched in the content file and in the browser. Empty DOCX paragraphs are the gap between paragraphs; the three paragraphs followed directly by another are `<p class="joined">` (no gap); line breaks inside a paragraph are `&#10;` and leading/trailing spaces `&#32;`. Non-poetry writings use a narrower reading column (36rem, line-height 1.95, `white-space: pre-wrap`) and paragraphs are not individually animated.
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
| Home | `src/pages/index.astro` | Renders `HomeHero`, `HomeFeature` with the projects that set `home` (ordered by it; its header links to `/projects`), `HomeWritings` with the four newest public writings via `sortWritings`, and the About summary. |
| Projects | `src/pages/projects/index.astro` | All projects ordered by stage (사용 중, 진행 중, 문의 중, 제작 마침, 보류, 종료), then year and title; stage filter buttons built from the stages present (`aria-pressed`, visible only with JavaScript); uses `BaseLayout` and `ProjectList`. |
| Project detail | `src/pages/projects/[id].astro` | Static path for every project. Uses `BaseLayout`; renders either the generic facts/Markdown body or structured case-study sections based on presence of `data.caseStudy`. |
| Writings | `src/pages/writings/index.astro` | Non-draft writings sorted newest-first by `writtenAt`; builds tag options; uses `BaseLayout` and searchable `WritingList`. Client script handles search, tag, order, count, empty state, and random navigation. |
| Writing detail | `src/pages/writings/[id].astro` | Static paths only for non-drafts. Uses `render`, `getWritingExcerpt`, `formatWritingDate`, and `BaseLayout`; poetry gets specialized header/body layout. |
| Archive | `src/pages/archive.astro` | Combines all projects and non-draft writings, groups them by project year or writing `writtenAt` year, and places entries without a year in a final group without a heading. |
| About | `src/pages/about.astro` | Static copy and GitHub profile link in `BaseLayout`; no collection data. |
| 404 | `src/pages/404.astro` | Static not-found page in `BaseLayout`. |

`BaseLayout.astro` imports global CSS and shared header/footer, builds canonical URLs from `Astro.site`, and provides description, theme color, favicon, Open Graph basics, skip link, the Google Fonts `<link>`, and an inline script that adds the `js` class to `<html>`.

## 4. Design system

The theme is **black and light**: a deep black base, white type, grey secondary text, and a white light with a faint blue tint that appears only as glow and highlight. There is no lime or other accent colour; primary buttons are white with black text. Large type, light, and layout carry the design; Home has no decorative 3D object. Home runs as dark first screen → bright silver project scene → dark records; other pages inherit the shared tokens, buttons, links, cards and menu.

- Colors (`src/styles/global.css`): `--bg #090A0D`, `--surface #15191F`, `--line #2C3038`, `--line-strong #444A56`, `--text #F4F5F7`, `--muted #ACB1BD`, `--faint #8A909D` (>= 4.5:1 on `--bg` and `--surface`), `--light 214, 224, 255` (used with alpha for glows), `--focus` = `--text`. `--accent`/`--accent-ink` remain as aliases of white/black for older selectors. Status-only `--alert #FF5A4E` / `--progress #6E8BFF` are defined but unused. The Home silver section defines local ink/paper colours (`--ink #0B0C10`, `--ink-muted #4A505C`, `--paper #E4E7ED`).
- Typography: one Google Fonts `<link>` in `BaseLayout` requests Inter (variable 400–800) and IBM Plex Sans KR 400/500/700. `--body`, `--display`, `--label` (and the old `--sans`/`--mono` aliases) are Inter with IBM Plex Sans KR → Apple SD Gothic Neo → Malgun Gothic for Hangul. Large titles are 700–800 with -0.045 to -0.065em tracking; body is 400 with 1.7 line-height; `body` keeps `word-break: keep-all` with `overflow-wrap: break-word`. Measured with cache disabled at 1440px, font transfer is 385.3KB on Home (26 files), 234.6KB on a poem page and 304.0KB on the case study; this is higher than the previous font set.
- Width/spacing: `--max: 1320px`; `--gutter: clamp(1.25rem, 4vw, 4rem)`. `.shell` centers this width. Page and section spacing use responsive `clamp()` values. Lists use ruled rows and grids rather than isolated cards.
- Grids: project rows are four columns on desktop; writings are two columns; case-study sections use split, seven-step pipeline, and two-column capability layouts.
- Breakpoints actually present: global 800px; header 640px; Home hero 900px; Home feature 900px; Home cards 640px; footer/home sections 600px; archive/about/project facts 650px; case study 720px and 1024px; Writings tools 900px and 420px.
- Shared interaction styles in `global.css`: `.btn` (`.btn-primary` white, `.btn-ghost` outlined) with a fill that sweeps in on hover/focus and an `.arrow` that moves; `.arrow-link`/`.text-link` underline drawing in from the left; `.lit` cards and `.writing-item` with pointer light, brighter edge and (cards only) a 4px lift; `:focus-visible` is a 2px white outline (ink on the silver section).
- Home sections use tighter padding than the global `.section` so the space links scenes instead of separating them. Section headings, then their content, rise in with `[data-reveal]`.
- Scroll: the hero's `--p` and the silver section's `--open` are set from scroll position inside `requestAnimationFrame`, only while the element is near the viewport (IntersectionObserver). Both are pure functions of position, so scrolling back up retraces them. No scroll is intercepted and nothing runs while the page is idle.
- Motion: shared `--ease: cubic-bezier(.22, 1, .36, 1)` with `--fast 220ms`, `--base 480ms`, `--slow 900ms`. Hero entry about 1.1s (title) and 1.6s (light); menu open about 0.6s plus 70ms per item; reveals 900ms with 90ms steps.
- Reduced motion: global `prefers-reduced-motion: reduce` disables smooth scrolling and collapses animation/transition durations and delays; the hero shows its final state, pointer and scroll effects are not applied, the silver section is fully open, and `[data-reveal]` content is never hidden.
- The global `overflow-x: hidden`, the fixed noise overlay, and the global image grayscale filter were removed. The previous Home hero overflowed by 10px at 320px (hidden by `overflow-x: hidden`); the new hero does not.

Required design constraints for future work: no accent colours beyond the black-and-light palette, no glow halos around UI, purple, excessive gradients, repeated rounded cards, particles, heavy shadows, continuously moving backgrounds, decorative 3D objects on Home, fake live data, or global custom cursors. Light is expressed with soft radial gradients only. There are no box shadows, and form controls keep `border-radius: 0` (buttons are pill-shaped).

## 5. Content Collections

`src/content.config.ts` defines both collections with `glob({ pattern: '**/*.{md,mdx}' })`.

### Projects schema

Required: `title`, plus a `summary` or a `description`. Optional: `alias` (another name), `summary` (latest short introduction), `description` (original one-line description, kept), `category`, `year` (omit when unknown), `technologies` (default `[]`), `stage` (`in-use` 사용 중, `active` 진행 중, `inquiry` 문의 중, `finished` 제작 마침, `paused` 보류, `ended` 종료; omit while undecided), `stageNote` (shown after the stage, e.g. 미출시), `private` (source visibility only; omit when unknown), `home` (position on Home; omit to keep a project off Home), `progress` (string list), `reason` and `reasonLabel` (why paused, ended or unreleased, and its heading), `result` (research result), `versions` (`{ name, note? }` list), `related` (project ids), `earlier` (`{ name?, year?, technologies, private? }` of a predecessor project, shown only inside the "이전 기록" section with a note that it is not the current state), `changelog` (link to a Log / Patch Notes page once one exists), `repository` (validated URL), `cover` (string), and `caseStudy`. Stage labels and ordering live in `src/utils/projects.ts`.

`caseStudy`, when present, requires `subtitle`, `meta`, string arrays for `overview`, `problems`, `pipeline`, `capabilities`, `safety`, and `status`; a `principles` array of `{ title, description }`; and `closing`. Presence of this object—not title, ID, `private`, or another flag—selects the specialized case-study page.

### Writings schema and dates

Required: `title`, `tags` (string array, may be empty), and `category` (free text; `writing:new` offers poetry, prose, fragment and 세계관·소설). Optional: `writtenAt`, `publishedAt` and `updatedAt` (coerced dates; omit any date that was not given, never substitute today or a file date), `excerpt`, `draft` (default false) and `unfinished` (default false; shown as 미완성 on the card and detail page). Markdown is rendered with `smartypants: false` (`astro.config.mjs`) so quotes and dashes stay exactly as written; no existing writing or project body contained straight quotes, `--` or `...`, so their output did not change.

- `writtenAt`: actual creation date. It controls normal list ordering and Archive year. Do not invent it; omission is supported.
- `publishedAt`: date the writing was added/published on the site. It is a secondary ordering tie-breaker and is always displayed on detail pages.
- `updatedAt`: optional date of a later content revision; shown on the detail page only when present.

Draft filtering is explicit at each writing consumer: Home, Writings, Archive, and writing `getStaticPaths` call `getCollection('writings', ({ data }) => !data.draft)`. Therefore drafts have no generated writing detail page and do not appear in those lists. A draft committed to this public repository is still publicly readable as source.

All projects get a static detail route regardless of `private`. All non-draft writings get a static detail route. Static top-level routes are always built.

## 6. Writings system

- Canonical initial order: `sortWritings(..., 'newest')`. Entries with `writtenAt` sort newest-first; missing `writtenAt` entries follow dated entries. Ties use newer `publishedAt`, then Korean-locale title. Oldest mode reverses only the `writtenAt` comparison; missing dates still stay last and tie-breakers remain published-newest/title.
- Archive: project entries group by numeric `year`; writings group by `writtenAt` year. Numeric groups descend. Entries without a year (projects without `year`, writings without `writtenAt`) form a final group with no heading; inside it they are ordered by `publishedAt` (when present), then title.
- Writings display: when a writing has no date, the date and its ` · ` separator are omitted everywhere (cards on Home and Writings, the detail meta line, Archive); no substitute text is shown. Unfinished pieces add ` · 미완성` on cards and a 미완성 label on the detail page.
- Search: client-side substring match over lower-cased `data-title`, full raw Markdown `data-body`, and joined tags. It does not use an index, tokenizer, fuzzy search, or server call.
- Tag filter: `WritingList` stores each item's tags as a JSON array in `data-tags` (lower-cased), and the Writings script parses it and checks exact membership of the selected `<option>` value, so tags containing spaces such as `짧은 글` match as one value. (Earlier the tags were space-joined and split on spaces, which broke such tags.)
- Random: chooses uniformly from currently visible DOM items and clicks its detail link. With zero visible items it does nothing.
- Excerpt: a non-empty manual `excerpt` wins. Otherwise the first two non-empty Markdown lines are cleaned of heading/list/quote markers, images, link destinations, and basic emphasis/code/strike markers, then joined with one space.
- `npm run writing:new`: prompts for title; validates a lowercase alphanumeric/hyphen slug and refuses overwrite; accepts optional real `YYYY-MM-DD` `writtenAt`; restricts category to `poetry`, `prose`, or `fragment`; parses comma-separated tags; defaults draft to yes; writes `publishedAt` as the local current date; and creates `src/content/writings/{slug}.md` with `flag: 'wx'`.

To add a writing: use Node 22, run `npm run writing:new`, fill the generated file's body, verify dates/tags/category/draft, remember that committed drafts are public source, run the required checks, review the diff, and stage only that explicit file path if a commit is later requested. Do not alter another writing's original prose as collateral cleanup.

## 7. Projects system

Generic project details show the title and alias, facts that are present (Category, Status, Year, Source), the summary as the lead, technology tags, a record list (경과, 결과, the reason with its label, 버전, 연결된 프로젝트, Patch Notes), and a "기존 기록" section with the original description (when a summary replaced it as the lead) and the Markdown body.

`local-alpha-agent.md` (title "Local / Autonomous Alpha Agent") contains the only current `caseStudy` object. `[id].astro` detects that object and renders the stage, the summary as the lead, a Now/Status section (결과, 보류한 이유, 경과), and then the earlier research record: the original description and `caseStudy.meta`, overview, problems, the research flow (`ResearchFlow`), capabilities, validation principles, safety boundary, technology, `caseStudy.status` as "Status at the time", and closing.

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
- Projects: 12 (5 existing ids kept; added `val-index`, `yarongwild`, `unity-2d-game`, `yatc`, `24-7-coinbot`, `game-news-bot`, `yarong-homepage`).
- Case-study projects: 1, `local-alpha-agent.md` / route `/projects/local-alpha-agent/`.
- Expected static HTML pages from route logic: 42 = 6 top-level pages (Home, Projects, Writings, Archive, About, 404) + 12 project details + 24 public writing details. Confirm this against `dist/**/*.html` after a successful Node 22 build.

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
