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
  /**
   * Куда физически писать собранный сайт.
   * По умолчанию — обычная папка ./dist (локальная разработка, деплой по DEPLOY.md).
   * На хостинге, где под сайт выделена отдельная папка домена (несколько сайтов на
   * одном аккаунте — см. DEPLOY-CPANEL.md), задайте ASTRO_OUT_DIR — абсолютный путь
   * к этой папке — и Astro будет собирать сайт прямо туда, а не в dist рядом с исходниками.
   */
  outDir: process.env.ASTRO_OUT_DIR || './dist',
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
    build: {
      // На shared-хостинге в папке домена могут лежать файлы, которыми управляет не Astro,
      // а сам хостинг/панель (.htaccess, файлы для подтверждения SSL и т.п.) — emptyOutDir:false
      // гарантирует, что сборка их не удалит. Обратная сторона: старые файлы от удалённых
      // страниц сами не подчищаются — это приемлемый компромисс ради безопасности.
      emptyOutDir: false,
    },
  },
});
