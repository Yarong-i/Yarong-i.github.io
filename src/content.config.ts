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
    stage: z.enum(['in-use', 'active', 'inquiry', 'finished', 'paused', 'ended']).optional(),
    // Short qualifier shown with the stage, e.g. 미출시.
    stageNote: z.string().optional(),
    // Source visibility only, independent of the stage. Omit when unknown.
    private: z.boolean().optional(),
    // Position on Home (1 = first). Omit to keep the project off Home.
    home: z.number().int().positive().optional(),
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

export const collections = { projects, writings };
