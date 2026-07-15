import { defineCollection } from 'astro:content';
import { z } from 'astro/zod';
import { glob } from 'astro/loaders';

const projects = defineCollection({
  loader: glob({ pattern: '**/*.{md,mdx}', base: './src/content/projects' }),
  schema: z.object({
    title: z.string(),
    description: z.string(),
    category: z.string(),
    status: z.string(),
    year: z.number(),
    technologies: z.array(z.string()),
    featured: z.boolean().default(false),
    private: z.boolean().default(false),
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
  }),
});

const writings = defineCollection({
  loader: glob({ pattern: '**/*.{md,mdx}', base: './src/content/writings' }),
  schema: z.object({
    title: z.string(),
    date: z.coerce.date(),
    tags: z.array(z.string()),
    category: z.string(),
    excerpt: z.string().optional(),
    draft: z.boolean().default(false),
  }),
});

export const collections = { projects, writings };
