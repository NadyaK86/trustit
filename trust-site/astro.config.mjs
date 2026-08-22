// @ts-check
import { defineConfig } from 'astro/config';
import { loadEnv } from 'vite';
import tailwindcss from '@tailwindcss/vite';
import sitemap from '@astrojs/sitemap';

/** Продакшен-домен: читаем PUBLIC_SITE_URL из .env (loadEnv), иначе дефолт */
const { PUBLIC_SITE_URL } = loadEnv(process.env.NODE_ENV || 'production', process.cwd(), 'PUBLIC_');
const site =
  (PUBLIC_SITE_URL || process.env.PUBLIC_SITE_URL)?.replace(/\/$/, '') || 'https://trustit.by';

// https://astro.build/config
export default defineConfig({
  site,
  trailingSlash: 'never',
  compressHTML: true,
  /** CDN для статики (_astro/*): задайте PUBLIC_ASSETS_PREFIX на хостинге (п. 3.3 ТЗ) */
  build: {
    assetsPrefix: process.env.PUBLIC_ASSETS_PREFIX || undefined,
  },
  integrations: [sitemap()],
  redirects: {
    '/products': '/solutions',
    '/products/smartplayer': '/solutions/digital-signage',
    '/products/av-systems': '/solutions/av-systems',
    '/products/meeting-rooms': '/solutions/meeting-rooms',
    '/products/it-infrastructure': '/solutions/it-infrastructure',
  },
  vite: {
    plugins: [tailwindcss()],
    server: { allowedHosts: true },
    preview: { allowedHosts: true },
  },
});
