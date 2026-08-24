import express from 'express';
import fs from 'node:fs/promises';
import fsSync from 'node:fs';
import path from 'node:path';
import url from 'node:url';
import { spawn } from 'node:child_process';
import yaml from 'js-yaml';
import matter from 'gray-matter';
import jwt from 'jsonwebtoken';
import multer from 'multer';
import crypto from 'node:crypto';

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));

// minimal dotenv without dep
try {
  const raw = fsSync.readFileSync(path.join(__dirname, '.env'), 'utf8');
  for (const line of raw.split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^"|"$/g, '');
  }
} catch {}

const PORT = Number(process.env.ADMIN_PORT || process.env.PORT || 4322);
const PASSWORD = process.env.ADMIN_PASSWORD || 'admin';
const JWT_SECRET = process.env.ADMIN_JWT_SECRET || 'dev-secret-please-change';
const SITE_PATH = path.resolve(__dirname, process.env.SITE_PATH || '../trust-site');
const IS_PROD = process.env.NODE_ENV === 'production';

// Разрешённый origin сайта для приёма заявок (CORS на /api/lead)
const SITE_ORIGIN = (process.env.SITE_ORIGIN || '').replace(/\/$/, '');
// URL превью сайта (dev-сервер для мгновенного live-превью, иначе прод-домен)
const SITE_PREVIEW_URL = (process.env.SITE_PREVIEW_URL || 'http://localhost:4321').replace(/\/$/, '');
// Проект Cloudflare Pages: если задан — «Опубликовать» деплоит туда после сборки
const CF_PAGES_PROJECT = process.env.CF_PAGES_PROJECT || '';
// Опциональное уведомление о заявке в Telegram
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || '';
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID || '';

const CONTENT_ROOT = path.join(SITE_PATH, 'src', 'content');
const PUBLIC_IMAGES = path.join(SITE_PATH, 'public', 'images');
const DATA_DIR = path.join(__dirname, 'data');
const LEADS_FILE = path.join(DATA_DIR, 'leads.json');
const SETTINGS_FILE = path.join(DATA_DIR, 'settings.json');

// --- Проверка секретов: в проде отказываемся стартовать с дефолтами ---
const WEAK_PASSWORDS = new Set(['admin', 'change-me-please', '']);
const WEAK_SECRETS = new Set(['dev-secret-please-change', 'please-change-this-secret-to-a-random-long-string', '']);
const secretProblems = [];
if (WEAK_PASSWORDS.has(PASSWORD) || PASSWORD.length < 8) {
  secretProblems.push('ADMIN_PASSWORD не задан/слабый (минимум 8 символов, не дефолтный)');
}
if (WEAK_SECRETS.has(JWT_SECRET) || JWT_SECRET.length < 24) {
  secretProblems.push('ADMIN_JWT_SECRET не задан/слабый (минимум 24 случайных символа)');
}
if (secretProblems.length) {
  const msg = '[admin] Небезопасная конфигурация:\n  - ' + secretProblems.join('\n  - ');
  if (IS_PROD) {
    console.error(msg + '\n[admin] Старт прерван. Задайте сильные значения в .env (NODE_ENV=production).');
    process.exit(1);
  } else {
    console.warn(msg + '\n[admin] Это ПРЕДУПРЕЖДЕНИЕ (dev). В проде сервер не запустится с такими значениями.');
  }
}

const COLLECTIONS = {
  site: { label: 'Страницы (site)', body: false },
  news: { label: 'Новости (news)', body: true },
  portfolio: { label: 'Портфолио (portfolio)', body: true },
};

// helpers
function safeJoin(base, target) {
  const resolved = path.resolve(base, target);
  if (!resolved.startsWith(base + path.sep) && resolved !== base) {
    throw new Error('Path escapes base');
  }
  return resolved;
}

// Жёсткая валидация сегмента пути (slug/имя файла) — defense-in-depth поверх safeJoin
function safeSegment(s) {
  if (typeof s !== 'string' || !/^[A-Za-z0-9._-]+$/.test(s) || s.includes('..')) {
    throw new Error('Недопустимое имя');
  }
  return s;
}

function slugify(name) {
  return String(name)
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-+/g, '-');
}

async function ensureDir(p) {
  await fs.mkdir(p, { recursive: true });
}

// Безопасное сообщение об ошибке наружу: в проде не раскрываем пути/детали ФС
function pubErr(e) {
  console.error('[admin]', e && e.stack ? e.stack : e);
  return IS_PROD ? 'Внутренняя ошибка сервера' : (e && e.message) || 'Ошибка';
}

// Сравнение строк за постоянное время (защита от timing-атак на пароль)
function safeEqual(a, b) {
  const ba = Buffer.from(String(a));
  const bb = Buffer.from(String(b));
  if (ba.length !== bb.length) {
    // выравниваем длину, чтобы сравнение всё равно заняло время
    crypto.timingSafeEqual(ba, ba);
    return false;
  }
  return crypto.timingSafeEqual(ba, bb);
}

// Простой in-memory rate-limiter по ключу (IP). Без внешних зависимостей.
function createRateLimiter({ windowMs, max }) {
  const hits = new Map(); // key -> { count, resetAt }
  return function check(key) {
    const now = Date.now();
    const rec = hits.get(key);
    if (!rec || now > rec.resetAt) {
      hits.set(key, { count: 1, resetAt: now + windowMs });
      return { allowed: true, retryAfter: 0 };
    }
    rec.count += 1;
    if (rec.count > max) {
      return { allowed: false, retryAfter: Math.ceil((rec.resetAt - now) / 1000) };
    }
    return { allowed: true, retryAfter: 0 };
  };
}

const loginLimiter = createRateLimiter({ windowMs: 15 * 60 * 1000, max: 10 });
const leadLimiter = createRateLimiter({ windowMs: 10 * 60 * 1000, max: 5 });

const app = express();
app.set('trust proxy', 1); // за nginx — корректный req.ip

// Совместимость с окружениями, которые НЕ обрезают базовый префикс сами.
// nginx (см. DEPLOY.md) настроен обрезать /admin перед проксированием — там это no-op.
// Passenger на cPanel (см. DEPLOY-CPANEL.md) префикс НЕ обрезает — тут он и нужен.
app.use((req, res, next) => {
  if (req.url === '/admin' || req.url.startsWith('/admin/')) {
    req.url = req.url.slice('/admin'.length) || '/';
  }
  next();
});

app.use(express.json({ limit: '5mb' }));

// Базовые security-заголовки (без внешних зависимостей)
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('X-XSS-Protection', '0');
  // CSP: всё своё (js-yaml вендорится локально); iframe-превью грузит dev-сервер сайта
  const frameSrc = SITE_PREVIEW_URL || "'self'";
  res.setHeader(
    'Content-Security-Policy',
    `default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; connect-src 'self'; frame-src ${frameSrc}; object-src 'none'; base-uri 'none'; frame-ancestors 'none'`
  );
  if (IS_PROD) res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  next();
});

app.get('/api/health', (req, res) => res.json({ ok: true, ts: Date.now() }));

// auth middleware
function authRequired(req, res, next) {
  const auth = req.headers.authorization;
  if (!auth || !auth.startsWith('Bearer ')) return res.status(401).json({ error: 'No token' });
  try {
    const token = auth.slice(7);
    jwt.verify(token, JWT_SECRET, { algorithms: ['HS256'] });
    next();
  } catch {
    res.status(401).json({ error: 'Invalid token' });
  }
}

// ---- routes ----
app.post('/api/login', (req, res) => {
  const { allowed, retryAfter } = loginLimiter(req.ip);
  if (!allowed) {
    res.setHeader('Retry-After', String(retryAfter));
    return res.status(429).json({ error: `Слишком много попыток. Повторите через ${retryAfter} с.` });
  }
  const { password } = req.body || {};
  if (!password || !safeEqual(password, PASSWORD)) {
    return res.status(401).json({ error: 'Неверный пароль' });
  }
  const token = jwt.sign({ role: 'admin' }, JWT_SECRET, { expiresIn: '12h' });
  res.json({ token });
});

app.get('/api/collections', authRequired, (req, res) => {
  res.json(
    Object.entries(COLLECTIONS).map(([key, c]) => ({ key, label: c.label, body: c.body }))
  );
});

app.get('/api/files/:collection', authRequired, async (req, res) => {
  const { collection } = req.params;
  if (!COLLECTIONS[collection]) return res.status(404).json({ error: 'Нет такой коллекции' });
  try {
    const dir = path.join(CONTENT_ROOT, collection);
    await ensureDir(dir);
    const entries = await fs.readdir(dir, { withFileTypes: true });
    const files = entries
      .filter((e) => e.isFile() && e.name.endsWith('.md'))
      .map((e) => e.name.replace(/\.md$/, ''));
    res.json(files);
  } catch (e) {
    res.status(500).json({ error: pubErr(e) });
  }
});

app.get('/api/file/:collection/:slug', authRequired, async (req, res) => {
  const { collection, slug } = req.params;
  if (!COLLECTIONS[collection]) return res.status(404).json({ error: 'Нет такой коллекции' });
  try {
    const dir = path.join(CONTENT_ROOT, collection);
    const file = safeJoin(dir, `${safeSegment(slug)}.md`);
    const raw = await fs.readFile(file, 'utf8');
    const parsed = matter(raw);
    res.json({
      slug,
      frontmatter: yaml.dump(parsed.data, { lineWidth: 120, noRefs: true }),
      body: parsed.content,
    });
  } catch (e) {
    res.status(500).json({ error: pubErr(e) });
  }
});

app.put('/api/file/:collection/:slug', authRequired, async (req, res) => {
  const { collection, slug } = req.params;
  if (!COLLECTIONS[collection]) return res.status(404).json({ error: 'Нет такой коллекции' });
  try {
    const { frontmatter, body } = req.body || {};
    const fmObj = yaml.load(frontmatter || '') || {};
    if (typeof fmObj !== 'object' || Array.isArray(fmObj)) {
      return res.status(400).json({ error: 'Frontmatter должен быть объектом YAML' });
    }
    const out = matter.stringify(body || '', fmObj);
    const dir = path.join(CONTENT_ROOT, collection);
    await ensureDir(dir);
    const file = safeJoin(dir, `${safeSegment(slug)}.md`);
    await fs.writeFile(file, out, 'utf8');
    res.json({ ok: true });
  } catch (e) {
    res.status(400).json({ error: pubErr(e) });
  }
});

app.post('/api/file/:collection', authRequired, async (req, res) => {
  const { collection } = req.params;
  if (!COLLECTIONS[collection]) return res.status(404).json({ error: 'Нет такой коллекции' });
  try {
    const { slug, title } = req.body || {};
    if (!slug || !title) return res.status(400).json({ error: 'slug и title обязательны' });
    const cleanSlug = slugify(slug);
    if (!cleanSlug) return res.status(400).json({ error: 'Некорректный slug' });
    const dir = path.join(CONTENT_ROOT, collection);
    await ensureDir(dir);
    const file = safeJoin(dir, `${cleanSlug}.md`);
    try {
      await fs.access(file);
      return res.status(409).json({ error: 'Файл с таким slug уже существует' });
    } catch {}
    const fm = collection === 'news'
      ? { title, date: new Date().toISOString().slice(0, 10), tag: 'Новости', excerpt: '' }
      : collection === 'portfolio'
        ? { title, sector: '', desc: '', tags: [] }
        : { title };
    await fs.writeFile(file, matter.stringify('', fm), 'utf8');
    res.json({ ok: true, slug: cleanSlug });
  } catch (e) {
    res.status(500).json({ error: pubErr(e) });
  }
});

app.delete('/api/file/:collection/:slug', authRequired, async (req, res) => {
  const { collection, slug } = req.params;
  if (!COLLECTIONS[collection]) return res.status(404).json({ error: 'Нет такой коллекции' });
  try {
    const dir = path.join(CONTENT_ROOT, collection);
    const file = safeJoin(dir, `${safeSegment(slug)}.md`);
    await fs.unlink(file);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: pubErr(e) });
  }
});

// image upload
const upload = multer({
  storage: multer.diskStorage({
    destination: async (req, file, cb) => {
      try {
        await ensureDir(PUBLIC_IMAGES);
        cb(null, PUBLIC_IMAGES);
      } catch (e) {
        cb(e);
      }
    },
    filename: (req, file, cb) => {
      const ext = path.extname(file.originalname).toLowerCase();
      const base = slugify(path.basename(file.originalname, ext)) || 'image';
      const stamp = Date.now();
      cb(null, `${base}-${stamp}${ext}`);
    },
  }),
  limits: { fileSize: 8 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    // whitelist расширений (mimetype подделывается; SVG/HTML могут нести XSS — запрещаем)
    const ALLOWED = new Set(['.jpg', '.jpeg', '.png', '.webp', '.gif', '.avif']);
    const ext = path.extname(file.originalname).toLowerCase();
    if (!ALLOWED.has(ext)) return cb(new Error('Допустимы только JPG, PNG, WEBP, GIF, AVIF'));
    if (!/^image\//.test(file.mimetype)) return cb(new Error('Только изображения'));
    cb(null, true);
  },
});

app.post('/api/upload', authRequired, upload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Файл не получен' });
  res.json({ ok: true, path: `/images/${req.file.filename}` });
});

app.get('/api/images', authRequired, async (req, res) => {
  try {
    await ensureDir(PUBLIC_IMAGES);
    const entries = await fs.readdir(PUBLIC_IMAGES, { withFileTypes: true });
    res.json(
      entries
        .filter((e) => e.isFile())
        .map((e) => ({ name: e.name, path: `/images/${e.name}` }))
    );
  } catch (e) {
    res.status(500).json({ error: pubErr(e) });
  }
});

app.delete('/api/image/:name', authRequired, async (req, res) => {
  try {
    const file = safeJoin(PUBLIC_IMAGES, safeSegment(req.params.name));
    await fs.unlink(file);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: pubErr(e) });
  }
});

// Proxy /images requests in admin UI to the site's public folder for previews
app.get('/images/:name', async (req, res) => {
  try {
    const file = safeJoin(PUBLIC_IMAGES, safeSegment(req.params.name));
    res.sendFile(file);
  } catch (e) {
    res.status(404).end();
  }
});

// Image keys defined in src/data/images.ts (regex-based extraction, no eval)
const IMAGES_TS = path.join(SITE_PATH, 'src', 'data', 'images.ts');
const IMAGES_CUSTOM_JSON = path.join(SITE_PATH, 'src', 'data', 'images.custom.json');

async function readImageKeys() {
  const keys = new Set();
  const result = [];
  // 1) Parse images.ts for `keyName: unsplash('id', ...)` and `unsplashPlus('slug', ...)`
  try {
    const src = await fs.readFile(IMAGES_TS, 'utf8');
    // Object literal export const images = { ... }
    const m = src.match(/export const images\s*=\s*\{([\s\S]*?)\}\s*as const/);
    if (m) {
      const body = m[1];
      // Match: key: unsplash('id', w, q) OR unsplashPlus('slug', w, q)
      const reA = /(\w+)\s*:\s*unsplash\(\s*'([^']+)'\s*,\s*(\d+)(?:\s*,\s*(\d+))?\s*\)/g;
      const reB = /(\w+)\s*:\s*unsplashPlus\(\s*'([^']+)'\s*,\s*(\d+)(?:\s*,\s*(\d+))?\s*\)/g;
      let r;
      while ((r = reA.exec(body))) {
        const [, key, id, w, q = '75'] = r;
        if (keys.has(key)) continue;
        keys.add(key);
        result.push({ key, url: `https://images.unsplash.com/photo-${id}?auto=format&fit=crop&w=${w}&q=${q}&fm=webp`, source: 'base' });
      }
      while ((r = reB.exec(body))) {
        const [, key, slug, w, q = '60'] = r;
        if (keys.has(key)) continue;
        keys.add(key);
        result.push({ key, url: `https://plus.unsplash.com/${slug}?auto=format&fit=crop&w=${w}&q=${q}&fm=webp`, source: 'base' });
      }
    }
  } catch {}
  // 2) custom JSON overrides
  try {
    const raw = await fs.readFile(IMAGES_CUSTOM_JSON, 'utf8');
    const custom = JSON.parse(raw);
    for (const [key, url] of Object.entries(custom)) {
      const existing = result.find((r) => r.key === key);
      if (existing) {
        existing.url = url;
        existing.source = 'custom';
      } else {
        result.push({ key, url, source: 'custom' });
      }
    }
  } catch {}
  result.sort((a, b) => a.key.localeCompare(b.key));
  return result;
}

app.get('/api/image-keys', authRequired, async (req, res) => {
  try {
    const list = await readImageKeys();
    res.json(list);
  } catch (e) {
    res.status(500).json({ error: pubErr(e) });
  }
});

app.get('/api/image-keys/custom', authRequired, async (req, res) => {
  try {
    let custom = {};
    try {
      custom = JSON.parse(await fs.readFile(IMAGES_CUSTOM_JSON, 'utf8'));
    } catch {}
    res.json(custom);
  } catch (e) {
    res.status(500).json({ error: pubErr(e) });
  }
});

app.put('/api/image-keys/custom', authRequired, async (req, res) => {
  try {
    const obj = req.body && typeof req.body === 'object' && !Array.isArray(req.body) ? req.body : {};
    for (const [k, v] of Object.entries(obj)) {
      if (typeof k !== 'string' || !/^[A-Za-z_][A-Za-z0-9_]*$/.test(k)) {
        return res.status(400).json({ error: `Некорректный ключ: ${k}` });
      }
      if (typeof v !== 'string') {
        return res.status(400).json({ error: `Значение для ${k} должно быть строкой URL` });
      }
    }
    await fs.writeFile(IMAGES_CUSTOM_JSON, JSON.stringify(obj, null, 2) + '\n', 'utf8');
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: pubErr(e) });
  }
});

// Build: spawn `npm run build` and stream stdout via SSE
let buildState = { running: false, exitCode: null, finishedAt: null, log: [] };
let buildSubscribers = new Set();

function broadcastBuild(chunk) {
  for (const res of buildSubscribers) {
    try {
      res.write(`data: ${JSON.stringify(chunk)}\n\n`);
    } catch {}
  }
}

function logBuild(text) {
  buildState.log.push(text);
  broadcastBuild({ type: 'log', text });
}
function finishBuild(code) {
  buildState.running = false;
  buildState.exitCode = code;
  buildState.finishedAt = Date.now();
  broadcastBuild({ type: 'end', exitCode: code });
}

// Запустить шаг (build / deploy) со стримом логов; cb(code)
function runStep(cmd, args, env, cb) {
  const child = spawn(cmd, args, { cwd: SITE_PATH, env });
  const onData = (d) => logBuild(d.toString());
  child.stdout.on('data', onData);
  child.stderr.on('data', onData);
  child.on('close', (code) => cb(code));
  child.on('error', (err) => { logBuild('\n[ошибка] ' + err.message + '\n'); cb(-1); });
}

app.post('/api/build', authRequired, (req, res) => {
  if (buildState.running) return res.status(409).json({ error: 'Сборка уже идёт' });
  buildState = { running: true, exitCode: null, finishedAt: null, log: [] };

  // env сборки: без секретов админки; PUBLIC_* нужны Astro
  const buildEnv = { PATH: process.env.PATH, HOME: process.env.HOME, NODE_ENV: process.env.NODE_ENV || 'production', FORCE_COLOR: '0' };
  for (const [k, v] of Object.entries(process.env)) if (k.startsWith('PUBLIC_')) buildEnv[k] = v;

  logBuild('▶ Сборка сайта…\n');
  runStep('npm', ['run', 'build'], buildEnv, (code) => {
    if (code !== 0) { logBuild('\n✖ Сборка завершилась с ошибкой.\n'); return finishBuild(code); }
    if (!CF_PAGES_PROJECT) { logBuild('\n✓ Сборка готова (деплой в Pages выключен — задайте CF_PAGES_PROJECT).\n'); return finishBuild(0); }
    // Деплой в Cloudflare Pages (wrangler авторизован на машине, env с CLOUDFLARE_*)
    logBuild(`\n▶ Публикация в Cloudflare Pages (${CF_PAGES_PROJECT})…\n`);
    const deployEnv = { PATH: process.env.PATH, HOME: process.env.HOME, FORCE_COLOR: '0' };
    for (const [k, v] of Object.entries(process.env)) if (k.startsWith('CLOUDFLARE_')) deployEnv[k] = v;
    runStep('npx', ['--yes', 'wrangler', 'pages', 'deploy', 'dist', '--project-name', CF_PAGES_PROJECT, '--commit-dirty=true'], deployEnv, (dcode) => {
      logBuild(dcode === 0 ? '\n✓ Сайт опубликован в Cloudflare Pages.\n' : '\n✖ Ошибка публикации в Pages.\n');
      finishBuild(dcode);
    });
  });

  res.json({ ok: true });
});

app.get('/api/build/stream', (req, res) => {
  // SSE — token via query (EventSource cannot set headers)
  const token = req.query.token;
  try {
    jwt.verify(String(token || ''), JWT_SECRET, { algorithms: ['HS256'] });
  } catch {
    return res.status(401).end();
  }
  res.set({
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
  });
  res.flushHeaders?.();
  // initial state
  res.write(`data: ${JSON.stringify({ type: 'state', running: buildState.running, exitCode: buildState.exitCode })}\n\n`);
  for (const text of buildState.log) {
    res.write(`data: ${JSON.stringify({ type: 'log', text })}\n\n`);
  }
  buildSubscribers.add(res);
  req.on('close', () => buildSubscribers.delete(res));
});

app.get('/api/build/status', authRequired, (req, res) => {
  res.json({ running: buildState.running, exitCode: buildState.exitCode, finishedAt: buildState.finishedAt });
});

// Page list: structured list of site pages for the admin sidebar
app.get('/api/pages', authRequired, (req, res) => {
  res.json([
    { group: 'Главная и общее', pages: [
      { slug: 'home', label: 'Главная', collection: 'site' },
      { slug: 'navigation', label: 'Меню и контакты', collection: 'site' },
      { slug: 'settings', label: 'Настройки сайта', collection: 'site' },
    ]},
    { group: 'Решения', pages: [
      { slug: 'solutions', label: 'Список решений', collection: 'site' },
      { slug: 'digital-signage', label: 'Digital Signage (SmartPlayer)', collection: 'site' },
      { slug: 'av-systems', label: 'Аудиовизуальные системы', collection: 'site' },
      { slug: 'meeting-rooms', label: 'Переговорные комнаты', collection: 'site' },
      { slug: 'it-infrastructure', label: 'IT-инфраструктура', collection: 'site' },
    ]},
    { group: 'Остальные страницы', pages: [
      { slug: 'services', label: 'Услуги', collection: 'site' },
      { slug: 'about', label: 'О компании', collection: 'site' },
      { slug: 'contacts', label: 'Контакты', collection: 'site' },
      { slug: 'catalog', label: 'Каталог', collection: 'site' },
      { slug: 'thank-you', label: 'Спасибо', collection: 'site' },
      { slug: 'privacy', label: 'Политика обработки ПДн', collection: 'site' },
    ]},
  ]);
});

// ---- Заявки (лиды): приём с сайта + просмотр в админке ----
// Хранятся локально (data/leads.json) — НЕ уходят за рубеж (требование 99-З о ПДн).
const LEAD_FIELDS = ['name', 'email', 'phone', 'company', 'topic', 'message', 'task', 'budget', 'screens', 'form_type'];

async function readLeads() {
  try {
    return JSON.parse(await fs.readFile(LEADS_FILE, 'utf8'));
  } catch {
    return [];
  }
}

const LEADS_MAX = 5000; // защита от неограниченного роста файла
async function writeLeads(list) {
  await ensureDir(DATA_DIR);
  const trimmed = list.length > LEADS_MAX ? list.slice(0, LEADS_MAX) : list;
  await fs.writeFile(LEADS_FILE, JSON.stringify(trimmed, null, 2) + '\n', 'utf8');
}

// ---- Настройки админки (срок хранения заявок и т.п.) ----
const DEFAULT_SETTINGS = { leadRetentionDays: 0 }; // 0 = хранить бессрочно
async function readSettings() {
  try {
    const s = JSON.parse(await fs.readFile(SETTINGS_FILE, 'utf8'));
    return { ...DEFAULT_SETTINGS, ...s };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}
async function writeSettings(s) {
  await ensureDir(DATA_DIR);
  await fs.writeFile(SETTINGS_FILE, JSON.stringify(s, null, 2) + '\n', 'utf8');
}

// Удаление заявок старше N дней (по leadRetentionDays). Возвращает число удалённых.
async function pruneLeads() {
  const { leadRetentionDays } = await readSettings();
  const days = Number(leadRetentionDays) || 0;
  if (days <= 0) return 0;
  const cutoff = Date.now() - days * 86400000;
  const list = await readLeads();
  const kept = list.filter((l) => {
    const t = Date.parse(l.createdAt);
    return Number.isNaN(t) ? true : t >= cutoff;
  });
  if (kept.length !== list.length) { await writeLeads(kept); return list.length - kept.length; }
  return 0;
}

async function notifyTelegram(lead) {
  if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) return;
  const lines = [
    `🆕 Заявка с сайта (${lead.form_type || '—'})`,
    lead.name && `Имя: ${lead.name}`,
    lead.phone && `Тел: ${lead.phone}`,
    lead.email && `Email: ${lead.email}`,
    lead.company && `Компания: ${lead.company}`,
    lead.topic && `Тема: ${lead.topic}`,
    (lead.message || lead.task) && `Сообщение: ${lead.message || lead.task}`,
    lead.budget && `Бюджет: ${lead.budget}`,
    lead.screens && `Экранов: ${lead.screens}`,
  ].filter(Boolean);
  try {
    await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: TELEGRAM_CHAT_ID, text: lines.join('\n') }),
    });
  } catch (e) {
    console.error('[admin] Telegram notify failed:', e.message);
  }
}

// CORS только для публичного приёма заявок
function leadCors(req, res, next) {
  const origin = req.headers.origin;
  if (SITE_ORIGIN && origin === SITE_ORIGIN) {
    res.setHeader('Access-Control-Allow-Origin', SITE_ORIGIN);
    res.setHeader('Vary', 'Origin');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  }
  if (req.method === 'OPTIONS') return res.status(204).end();
  next();
}

app.options('/api/lead', leadCors, (req, res) => res.status(204).end());

app.post('/api/lead', leadCors, async (req, res) => {
  const { allowed, retryAfter } = leadLimiter(req.ip);
  if (!allowed) {
    res.setHeader('Retry-After', String(retryAfter));
    return res.status(429).json({ error: 'Слишком много заявок. Попробуйте позже.' });
  }
  const body = req.body || {};
  // honeypot: скрытое поле, которое заполняют только боты
  if (body.website || body._gotcha) return res.json({ ok: true });

  const name = String(body.name || '').trim();
  const phone = String(body.phone || '').trim();
  const email = String(body.email || '').trim();
  if (!name || (!phone && !email)) {
    return res.status(400).json({ error: 'Укажите имя и телефон или email' });
  }
  // согласие на обработку ПДн обязательно (99-З)
  if (body.consent !== true && body.consent !== 'true' && body.consent !== 'on') {
    return res.status(400).json({ error: 'Требуется согласие на обработку персональных данных' });
  }

  const lead = { id: crypto.randomUUID(), createdAt: new Date().toISOString(), read: false, ip: req.ip };
  for (const f of LEAD_FIELDS) {
    if (body[f] != null && body[f] !== '') lead[f] = String(body[f]).slice(0, 5000);
  }

  try {
    const list = await readLeads();
    list.unshift(lead);
    await writeLeads(list);
  } catch (e) {
    return res.status(500).json({ error: 'Не удалось сохранить заявку' });
  }
  notifyTelegram(lead); // не блокируем ответ
  res.json({ ok: true });
});

app.get('/api/leads', authRequired, async (req, res) => {
  await pruneLeads(); // авто-удаление старых по сроку хранения
  res.json(await readLeads());
});

// Настройки админки
app.get('/api/settings', authRequired, async (req, res) => {
  res.json(await readSettings());
});
app.put('/api/settings', authRequired, async (req, res) => {
  const cur = await readSettings();
  const body = req.body || {};
  if (body.leadRetentionDays != null) {
    const d = Number(body.leadRetentionDays);
    if (!Number.isInteger(d) || d < 0 || d > 3650) {
      return res.status(400).json({ error: 'Срок хранения: целое число дней 0–3650 (0 = бессрочно)' });
    }
    cur.leadRetentionDays = d;
  }
  await writeSettings(cur);
  const removed = await pruneLeads();
  res.json({ ok: true, settings: cur, removed });
});

app.patch('/api/lead/:id', authRequired, async (req, res) => {
  const list = await readLeads();
  const item = list.find((l) => l.id === req.params.id);
  if (!item) return res.status(404).json({ error: 'Заявка не найдена' });
  if (typeof req.body?.read === 'boolean') item.read = req.body.read;
  await writeLeads(list);
  res.json({ ok: true });
});

app.delete('/api/lead/:id', authRequired, async (req, res) => {
  const list = await readLeads();
  const next = list.filter((l) => l.id !== req.params.id);
  if (next.length === list.length) return res.status(404).json({ error: 'Заявка не найдена' });
  await writeLeads(next);
  res.json({ ok: true });
});

// Конфиг для фронта админки
app.get('/api/config', authRequired, (req, res) => {
  res.json({ previewUrl: SITE_PREVIEW_URL, siteOrigin: SITE_ORIGIN });
});

// Самая свежая дата изменения контента/картинок
async function newestContentMtime() {
  let newest = 0;
  const roots = [CONTENT_ROOT, PUBLIC_IMAGES];
  for (const root of roots) {
    let stack = [root];
    while (stack.length) {
      const dir = stack.pop();
      let entries;
      try { entries = await fs.readdir(dir, { withFileTypes: true }); } catch { continue; }
      for (const e of entries) {
        const full = path.join(dir, e.name);
        if (e.isDirectory()) { stack.push(full); continue; }
        try { const st = await fs.stat(full); if (st.mtimeMs > newest) newest = st.mtimeMs; } catch {}
      }
    }
  }
  return newest;
}

// Список недавно изменённых страниц/записей контента
async function recentEdits(limit = 8) {
  const out = [];
  for (const col of Object.keys(COLLECTIONS)) {
    const dir = path.join(CONTENT_ROOT, col);
    let entries;
    try { entries = await fs.readdir(dir, { withFileTypes: true }); } catch { continue; }
    for (const e of entries) {
      if (!e.isFile() || !e.name.endsWith('.md')) continue;
      try {
        const st = await fs.stat(path.join(dir, e.name));
        out.push({ collection: col, slug: e.name.replace(/\.md$/, ''), mtime: st.mtimeMs });
      } catch {}
    }
  }
  out.sort((a, b) => b.mtime - a.mtime);
  return out.slice(0, limit);
}

// Страницы/записи, изменённые после последней публикации
async function changedSince(ts) {
  const out = [];
  for (const col of Object.keys(COLLECTIONS)) {
    const dir = path.join(CONTENT_ROOT, col);
    let entries;
    try { entries = await fs.readdir(dir, { withFileTypes: true }); } catch { continue; }
    for (const e of entries) {
      if (!e.isFile() || !e.name.endsWith('.md')) continue;
      try {
        const st = await fs.stat(path.join(dir, e.name));
        if (!ts || st.mtimeMs > ts) out.push({ collection: col, slug: e.name.replace(/\.md$/, '') });
      } catch {}
    }
  }
  return out;
}

app.get('/api/status', authRequired, async (req, res) => {
  const lastBuild = buildState.finishedAt || 0;
  const newest = await newestContentMtime();
  res.json({
    lastBuild: lastBuild || null,
    contentChanged: newest,
    unpublished: !lastBuild || newest > lastBuild,
    building: buildState.running,
    recent: await recentEdits(8),
    changed: await changedSince(lastBuild),
  });
});

// static admin UI
app.use(express.static(path.join(__dirname, 'public')));

// SPA fallback
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Периодическая чистка старых заявок (срок хранения, 99-З)
async function scheduledPrune() {
  try { const n = await pruneLeads(); if (n) console.log(`[admin] Авто-удалено заявок по сроку хранения: ${n}`); }
  catch (e) { console.error('[admin] prune error:', e.message); }
}
setInterval(scheduledPrune, 6 * 60 * 60 * 1000);
scheduledPrune();

app.listen(PORT, () => {
  console.log(`[admin] Site: ${SITE_PATH}`);
  console.log(`[admin] Admin UI: http://localhost:${PORT}`);
});
