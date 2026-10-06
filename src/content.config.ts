import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';

const language = z.enum(['id', 'en']);
const status = z.enum(['draft', 'review', 'published']);

const articles = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/articles' }),
  schema: z.object({
    title: z.string(), translationKey: z.string().optional(), slug: z.string(), date: z.coerce.date(), modified: z.coerce.date().optional(), author: z.string(), summary: z.string(), category: z.string(),
    featuredImage: z.string().optional(), imageAlt: z.string().optional(), imageCredit: z.string().optional(), imageSource: z.string().url().optional(),
    gallery: z.array(z.string()).default([]), categories: z.array(z.string()).default([]), tags: z.array(z.string()).default([]), contentType: z.string().optional(),
    language, status, featured: z.boolean().default(false), originalId: z.number().optional(), sourceUrl: z.string().url().optional(), legacy: z.boolean().default(false),
  }),
});

const programs = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/programs' }),
  schema: z.object({
    title: z.string(),
    slug: z.string(),
    translationKey: z.string(),
    eyebrow: z.string(),
    summary: z.string(),
    reviewedAt: z.coerce.date(),
    language,
    status,
    order: z.number(),
    featured: z.boolean().default(true),
  }),
});

const publications = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/publications' }),
  schema: z.object({ title: z.string(), slug: z.string(), year: z.number(), category: z.string(), summary: z.string(), cover: z.string().optional(), fileUrl: z.string(), documentLanguage: language.optional(), language, status, featured: z.boolean().default(false), sourceUrl: z.string().url().optional(), legacy: z.boolean().default(false) }),
});

const locations = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/locations' }),
  schema: z.object({ name: z.string(), slug: z.string(), province: z.string(), summary: z.string(), latitude: z.number().optional(), longitude: z.number().optional(), type: z.string().optional(), parentSlug: z.string().optional(), regency: z.string().optional(), district: z.string().optional(), legacyCategorySlug: z.string().optional(), language, status, order: z.number() }),
});

const team = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/team' }),
  schema: z.object({ name: z.string(), position: z.string(), positionEn: z.string().optional(), group: z.enum(['Governance', 'Management & Program Team', 'Technical Advisors']), photo: z.string().optional(), bio: z.string().optional(), language, status, order: z.number() }),
});

const partners = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/partners' }),
  schema: z.object({ name: z.string(), category: z.string(), website: z.string().url().optional(), logo: z.string().optional(), language, status, order: z.number() }),
});

const gallery = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/gallery' }),
  schema: z.object({ title: z.string(), slug: z.string(), summary: z.string().optional(), images: z.array(z.string()), language, status, order: z.number(), sourceUrl: z.string().url().optional() }),
});

export const collections = { articles, programs, publications, locations, team, partners, gallery };
