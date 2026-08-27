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
   * На хостинге, где сайт и папка /admin делят одну и ту же публичную директорию домена
   * (см. DEPLOY-CPANEL.md), задайте переменную окружения ASTRO_OUT_DIR — абсолютный путь
   * к этой директории — и Astro будет собирать сайт прямо туда.
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
      // КРИТИЧНО: если outDir указывает на папку, где также лежит /admin (или другие
      // файлы, не относящиеся к Astro), emptyOutDir ДОЛЖЕН быть false — иначе Vite перед
      // каждой сборкой будет полностью очищать outDir и снесёт папку admin вместе с ним.
      // Обратная сторона: старые файлы от удалённых страниц не удаляются автоматически
      // при пересборке — это приемлемый компромисс ради безопасности папки admin.
      emptyOutDir: false,
    },
  },
});
