import { defineCollection } from 'astro:content';
import { z } from 'astro/zod';
import { glob } from 'astro/loaders';

const projects = defineCollection({
  loader: glob({ pattern: '**/*.{md,mdx}', base: './src/content/projects' }),
  schema: z.object({
    title: z.string(),
    // Another name the project has been known by (shown small under the title).
    alias: z.string().optional(),
    // Latest short introduction. `description` keeps the original one-line description.
    summary: z.string().optional(),
    description: z.string().optional(),
    category: z.string().optional(),
    // Omit when the year is not known; do not estimate it.
    year: z.number().optional(),
    technologies: z.array(z.string()).default([]),
    // Progress state; omit while undecided. Labels live in src/utils/projects.ts.
    stage: z.enum(['live', 'operating', 'in-use', 'active', 'inquiry', 'finished', 'paused', 'ended']).optional(),
    // Short qualifier shown with the stage, e.g. 미출시.
    stageNote: z.string().optional(),
    // Source visibility only, independent of the stage. Omit when unknown.
    private: z.boolean().optional(),
    // Position on Home's "다른 프로젝트" list (1 = first). Omit to keep the project off that list.
    home: z.number().int().positive().optional(),
    // Position in Home's large featured area (1 = largest). Featured projects are not repeated in `home` lists.
    featured: z.number().int().positive().optional(),
    // Real screenshots / short clips of the project in use. Paths are under /public. Never use mock-ups here.
    media: z.object({
      poster: z.string(),
      alt: z.string(),
      // Optional short muted loop (mp4/webm). Plays on hover or when in view; never under reduced motion.
      video: z.string().optional(),
      // What the images are and how current they are, e.g. development screens from an earlier build.
      note: z.string().optional(),
      gallery: z.array(z.object({ src: z.string(), alt: z.string() })).default([]),
    }).optional(),
    // Public link to play or use the project (game page, bot invite). Omit until one exists.
    // Screenshots shown at their own aspect ratio, each opening in the image viewer. Captions describe what is
    // visible; they never guess where or when a screen was taken.
    screens: z.array(z.object({ src: z.string(), alt: z.string(), caption: z.string(), width: z.number().int(), height: z.number().int() })).default([]),
    playUrl: z.url().optional(),
    playLabel: z.string().optional(),
    // Introduction page (shown when `tagline` is set): one-line pitch, short highlights for Home,
    // feature list, current status, how to use it and a notice. The Markdown body is the introduction text.
    tagline: z.string().optional(),
    highlights: z.array(z.string()).default([]),
    features: z.array(z.object({ title: z.string(), text: z.string() })).default([]),
    statusTitle: z.string().optional(),
    statusText: z.string().optional(),
    howTo: z.string().optional(),
    notice: z.string().optional(),
    // What has happened so far, in order.
    progress: z.array(z.string()).default([]),
    // Why the project is paused, ended or left unreleased, and the heading to show for it.
    reason: z.string().optional(),
    reasonLabel: z.string().optional(),
    // What a research project found.
    result: z.string().optional(),
    versions: z.array(z.object({ name: z.string(), note: z.string().optional() })).default([]),
    // Ids of connected projects (file names without .md).
    related: z.array(z.string()).default([]),
    // An earlier project this one grew out of. Shown only inside the earlier-record section.
    earlier: z.object({
      name: z.string().optional(),
      year: z.number().optional(),
      technologies: z.array(z.string()).default([]),
      private: z.boolean().optional(),
    }).optional(),
    // Link to a Log / Patch Notes page once one exists.
    changelog: z.string().optional(),
    repository: z.url().optional(),
    cover: z.string().optional(),
    caseStudy: z.object({
      subtitle: z.string(),
      meta: z.string(),
      overview: z.array(z.string()),
      problems: z.array(z.string()),
      pipeline: z.array(z.string()),
      capabilities: z.array(z.string()),
      principles: z.array(z.object({
        title: z.string(),
        description: z.string(),
      })),
      safety: z.array(z.string()),
      status: z.array(z.string()),
      closing: z.string(),
    }).optional(),
  }).refine((data) => data.summary || data.description, { message: 'A project needs a summary or a description.' }),
});

// Research data lives in src/content/research (real records) unless RESEARCH_SOURCE=fixtures, which points both
// collections at tests/fixtures/ for checks. Fixture builds use their own cache and output folder (see package.json),
// so fixture records never enter the real build.
const env = (globalThis as { process?: { env: Record<string, string | undefined> } }).process?.env ?? {};
const fixtures = env.RESEARCH_SOURCE === 'fixtures';
const researchBase = fixtures ? './tests/fixtures/research' : './src/content/research';
const performanceBase = fixtures ? './tests/fixtures/performance' : './src/content/performance';

// Portfolio write-up of a project: src/content/portfolios/<project id>.md, shown at /projects/<id>/portfolio/.
// Goal, role and current stage come first so a reader gets them at a glance; the body holds the cases.
const portfolios = defineCollection({
  loader: glob({ pattern: '**/*.{md,mdx}', base: './src/content/portfolios' }),
  schema: z.object({
    title: z.string(),
    kind: z.string(),
    recordedAt: z.coerce.date().optional(),
    technologies: z.array(z.string()).default([]),
    goal: z.string(),
    role: z.string(),
    current: z.string(),
  }),
});

// One file per trading day: YYYY-MM-DD.json (written by `npm run research:import`, or by hand).
// `date` is the trading day the recommendation is for. Each model keeps its own premarket and postmarket record.
const pick = z.object({
  // Position in the list as the model published it. Not a rank.
  order: z.number().int().positive(),
  // The model's own stated preference rank (ASK-RESPONSE-V1.2+). Never derived from list position on the site.
  rank: z.number().int().positive().optional(),
  // Rank after the research system's checks dropped picks; finalRank 1 = the final first choice.
  finalRank: z.number().int().positive().optional(),
  ticker: z.string(),
  name: z.string(),
  // The research system's screen score. Shown whatever its value; absence is shown as absence.
  score: z.number().optional(),
  reasons: z.array(z.string()).default([]),
  risks: z.array(z.string()).default([]),
  changeConditions: z.array(z.string()).default([]),
});
const priceResult = z.object({
  ticker: z.string(),
  name: z.string(),
  // confirmed: regular-session open and close were fixed by the research system.
  // provisional: the research system's same-day close, confirmed on the next trading day.
  status: z.enum(['confirmed', 'provisional', 'unconfirmed']),
  closeStatus: z.string().optional(),
  open: z.number().optional(),
  close: z.number().optional(),
  prevClose: z.number().optional(),
  basis: z.string().optional(),
  note: z.string().optional(),
});
// One day of a mock strategy as the research system published it that day (its ledger), never computed here.
// executed = the research system's own record that the mock buy happened (not the rule check on this site).
const strategyDay = z.object({
  executed: z.boolean(),
  category: z.string().optional(),
  detail: z.string().optional(),
  ticker: z.string().optional(),
  name: z.string().optional(),
  dayPct: z.number().optional(),
  cumPct: z.number().optional(),
  asOf: z.string(),
  startDate: z.string().optional(),
  // false: that day's close was provisional when published (confirmed on the next trading day).
  final: z.boolean(),
  tradingDays: z.number().int().nonnegative().optional(),
  trades: z.number().int().nonnegative().optional(),
});
const modelRun = z.object({
  model: z.string(),
  key: z.string().optional(),
  label: z.string().optional(),
  short: z.string().optional(),
  role: z.enum(['operating', 'comparison']).optional(),
  runs: z.array(z.string()).default([]),
  premarket: z.object({
    // pending: not announced yet · published: picks announced · no-picks: ran normally, nothing recommended · failed: run failed
    status: z.enum(['pending', 'published', 'no-picks', 'failed']),
    publishedAt: z.string().optional(),
    detail: z.string().optional(),
    // The research system's rank check, e.g. 모델 순위 확인 / 모델 선호 순위 없음 - 1순위 판단 불가.
    rankStatus: z.string().optional(),
    picks: z.array(pick).default([]),
    // Proposals the research system's checks dropped, with its reason. Not recommendations.
    excluded: z.array(z.object({ ticker: z.string(), name: z.string().optional(), reason: z.string().optional(),
      rank: z.number().int().positive().optional(), score: z.number().optional() })).default([]),
  }),
  postmarket: z.object({
    // pending: not reviewed yet · reviewed: prices added · nothing: no premarket picks to review · failed
    status: z.enum(['pending', 'reviewed', 'nothing', 'failed']),
    publishedAt: z.string().optional(),
    detail: z.string().optional(),
    results: z.array(priceResult).default([]),
  }).default({ status: 'pending', results: [] }),
  strategy: z.object({ base: strategyDay.optional(), filter10: strategyDay.optional() }).optional(),
});
const research = defineCollection({
  loader: glob({ pattern: '**/*.json', base: researchBase }),
  schema: z.object({
    date: z.coerce.date(),
    // closed = 휴장: no recommendation is expected on this day.
    market: z.enum(['open', 'closed']).default('open'),
    models: z.array(modelRun).default([]),
    // When the day was first added to the homepage, distinct from each model's announcement time.
    registeredAt: z.string(),
    updatedAt: z.string().optional(),
    corrections: z.array(z.object({ at: z.string(), note: z.string() })).default([]),
    // origins: where the day's data came from, in order (e.g. the PC copy of the store, then the 158 server export).
    source: z.object({ system: z.string(), runs: z.array(z.string()).default([]), origins: z.array(z.string()).default([]) }),
    draft: z.boolean().default(false),
  }),
});

// Confirmed cumulative mock-strategy results per model, as reported by the research system.
// base = buy the model's first-ranked pick; filter10 = the same pick only when its score is 10 or more.
const performance = defineCollection({
  loader: glob({ pattern: '**/*.json', base: performanceBase }),
  schema: z.object({
    model: z.string(),
    label: z.string().optional(),
    short: z.string().optional(),
    strategy: z.enum(['base', 'filter10']),
    asOf: z.coerce.date(),
    startDate: z.coerce.date().optional(),
    cumulativePct: z.number(),
    dayPct: z.number().optional(),
    tradingDays: z.number().int().nonnegative().optional(),
    trades: z.number().int().nonnegative().optional(),
    // Days whose provisional close is inside the cumulative figure, and corrected closes not yet KRX-confirmed.
    includesProvisional: z.array(z.string()).default([]),
    unverifiedCorrections: z.array(z.string()).default([]),
    basis: z.string(),
    source: z.string(),
  }),
});

// Dated updates: game patches, bot updates, site changes. New research days and new writings are added
// to Home's feed automatically, so they do not need a news file.
const news = defineCollection({
  loader: glob({ pattern: '**/*.{md,mdx}', base: './src/content/news' }),
  schema: z.object({
    date: z.coerce.date(),
    kind: z.enum(['game', 'bot', 'research', 'site']),
    title: z.string(),
    href: z.string().optional(),
    draft: z.boolean().default(false),
  }),
});

const writings = defineCollection({
  loader: glob({ pattern: '**/*.{md,mdx}', base: './src/content/writings' }),
  schema: z.object({
    title: z.string(),
    writtenAt: z.coerce.date().optional(),
    // Omit dates that were not given; never fill them with today or a file date.
    publishedAt: z.coerce.date().optional(),
    updatedAt: z.coerce.date().optional(),
    tags: z.array(z.string()),
    category: z.string(),
    excerpt: z.string().optional(),
    draft: z.boolean().default(false),
    // Shown as 미완성 for pieces that are not finished.
    unfinished: z.boolean().default(false),
  }),
});

export const collections = { projects, portfolios, writings, research, performance, news };
