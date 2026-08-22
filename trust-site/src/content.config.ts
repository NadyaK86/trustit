import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

const news = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/news' }),
  schema: z.object({
    title: z.string(),
    date: z.string(),
    tag: z.string(),
    excerpt: z.string(),
    image: z.string().optional(),
  }),
});

const portfolio = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/portfolio' }),
  schema: z.object({
    title: z.string(),
    sector: z.string(),
    desc: z.string(),
    tags: z.array(z.string()),
    image: z.string().optional(),
    date: z.string().optional(),
  }),
});

/** Статические страницы: копирайт и структуры в YAML frontmatter (`src/content/site/*.md`) */
const site = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/site' }),
  schema: z
    .object({
      title: z.string(),
      description: z.string().optional(),
    })
    .passthrough(),
});

export const collections = { news, portfolio, site };
