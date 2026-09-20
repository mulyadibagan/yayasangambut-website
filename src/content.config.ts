import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';

const language = z.enum(['id', 'en']);
const status = z.enum(['draft', 'review', 'published']);

const articles = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/articles' }),
  schema: z.object({
    title: z.string(), slug: z.string(), date: z.coerce.date(), author: z.string(), summary: z.string(), category: z.string(),
    featuredImage: z.string(), imageAlt: z.string(), imageCredit: z.string().optional(), imageSource: z.string().url().optional(),
    gallery: z.array(z.string()).default([]), language, status, featured: z.boolean().default(false),
  }),
});

const programs = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/programs' }),
  schema: z.object({ title: z.string(), slug: z.string(), eyebrow: z.string(), summary: z.string(), language, status, order: z.number(), featured: z.boolean().default(true) }),
});

const publications = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/publications' }),
  schema: z.object({ title: z.string(), slug: z.string(), year: z.number(), category: z.string(), summary: z.string(), cover: z.string().optional(), fileUrl: z.string(), language, status, featured: z.boolean().default(false) }),
});

const locations = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/locations' }),
  schema: z.object({ name: z.string(), slug: z.string(), province: z.string(), summary: z.string(), latitude: z.number(), longitude: z.number(), language, status, order: z.number() }),
});

const team = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/team' }),
  schema: z.object({ name: z.string(), position: z.string(), group: z.enum(['Governance', 'Management & Program Team', 'Technical Advisors']), photo: z.string().optional(), bio: z.string(), language, status, order: z.number() }),
});

const partners = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/partners' }),
  schema: z.object({ name: z.string(), category: z.string(), website: z.string().url().optional(), logo: z.string().optional(), language, status, order: z.number() }),
});

export const collections = { articles, programs, publications, locations, team, partners };
