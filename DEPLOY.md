# Деплой trustit.by на hoster.by (VPS, SSH, PM2 + nginx)

Архитектура:
- `trust-site` — статический Astro-сайт (`npm run build` → `dist/`), раздаётся nginx напрямую как статика на `trustit.by`.
- `admin` — постоянно работающий Node/Express-процесс (порт 4322 по умолчанию), под управлением PM2. Обслуживает админку по адресу `trustit.by/admin`, приём заявок (`/api/lead`) и пересборку сайта.

Один домен, без поддомена:
- `trustit.by/*` — статика сайта из `dist/`.
- `trustit.by/admin` — проксируется в admin-приложение (со снятием префикса `/admin`, backend его не видит и не должен знать о нём).
- `trustit.by/api/lead` — форма заявок с публичного сайта, тоже проксируется в admin-приложение (тот же порт 4322), но без снятия префикса — маршрут в backend называется именно `/api/lead`.

> Важно: в репозитории уже внесены правки под `/admin` (файлы `admin/public/index.html` и `admin/public/app.js` — ссылки на свои же ассеты и API теперь абсолютные, с префиксом `/admin`). Если вы ещё не подтянули эти изменения в свой GitHub-репозиторий — заберите патч `admin-path-fix.patch`, который я подготовил, и накатите его (`git apply admin-path-fix.patch`), либо перенесите изменения вручную из этих двух файлов, потом закоммитьте и запушьте — сервер должен клонировать/тянуть уже обновлённую версию.

---

## 1. Подготовка сервера

```bash
ssh user@your-vps

# Node.js (нужна версия >= 22.12 — это требование trust-site/package.json)
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt-get install -y nodejs

node -v   # должно быть 22.x
npm -v

# PM2 — менеджер процессов для admin-приложения
sudo npm install -g pm2

# nginx + certbot (если ещё не стоят)
sudo apt-get install -y nginx certbot python3-certbot-nginx
```

## 2. Разворачиваем код

```bash
sudo mkdir -p /var/www/trustit
sudo chown $USER:$USER /var/www/trustit
cd /var/www/trustit
git clone https://github.com/NadyaK86/trustit.git .
```

## 3. Настройка и сборка сайта (`trust-site`)

```bash
cd /var/www/trustit/trust-site
npm install
cp .env.example .env
nano .env
```

Заполните `.env`:
```ini
PUBLIC_SITE_URL=https://trustit.by
PUBLIC_LEAD_ENDPOINT=/api/lead
```
(endpoint теперь можно указывать относительным путём — сайт и API на одном домене, кросс-доменных запросов больше нет)
(`PUBLIC_FORMSPREE_URL`, `PUBLIC_RECAPTCHA_SITE_KEY`, `PUBLIC_YANDEX_METRIKA_ID` — по желанию, можно оставить пустыми)

Собираем:
```bash
npm run build
```
Проверьте, что появилась папка `dist/` с файлами. Именно её будет отдавать nginx.

## 4. Настройка и запуск admin-приложения

```bash
cd /var/www/trustit/admin
npm install
cp .env.example .env
nano .env
```

Сгенерируйте секреты (выполните на сервере, не переиспользуйте пример ниже):
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Заполните `admin/.env`:
```ini
ADMIN_PASSWORD=ваш-надёжный-пароль-минимум-8-символов
ADMIN_JWT_SECRET=вставьте-сюда-строку-из-команды-выше

ADMIN_PORT=4322
SITE_PATH=../trust-site
NODE_ENV=production

SITE_ORIGIN=https://trustit.by
SITE_PREVIEW_URL=https://trustit.by
# ADMIN_BASE_PATH здесь не нужен — префикс /admin обрезает nginx, backend его не видит

TELEGRAM_BOT_TOKEN=токен-вашего-бота
TELEGRAM_CHAT_ID=id-чата-или-канала
```

> Как получить `TELEGRAM_BOT_TOKEN` и `TELEGRAM_CHAT_ID`, если ещё не создавали бота — скажите, распишу отдельно.

Запуск через PM2:
```bash
cd /var/www/trustit/admin
mkdir -p logs
pm2 start ecosystem.config.cjs --env production
pm2 save
pm2 startup   # выполните команду, которую покажет pm2, чтобы он поднимался после перезагрузки сервера
```

Проверка, что процесс жив:
```bash
pm2 status
pm2 logs trust-admin --lines 50
curl http://127.0.0.1:4322/api/health
```

## 5. Настройка nginx

`/etc/nginx/sites-available/trustit.by`:
```nginx
server {
    listen 80;
    server_name trustit.by www.trustit.by;

    root /var/www/trustit/trust-site/dist;
    index index.html;

    # Статика сайта
    location / {
        try_files $uri $uri/ $uri.html =404;
    }

    # Приём заявок с публичной формы — маршрут в backend называется именно /api/lead,
    # префикс НЕ обрезаем (proxy_pass без завершающего URI = сохраняем путь как есть).
    location = /api/lead {
        proxy_pass http://127.0.0.1:4322;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Админка. Обратите внимание на завершающий "/" в location и в proxy_pass —
    # это заставляет nginx СНИМАТЬ префикс /admin при проксировании, поэтому backend
    # продолжает работать со своими обычными путями (/, /app.js, /api/..., и т.д.),
    # ничего не зная о том, что снаружи он доступен как /admin/*.
    location /admin/ {
        proxy_pass http://127.0.0.1:4322/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        # для стриминга логов сборки (SSE) — без буферизации
        proxy_buffering off;
        proxy_read_timeout 3600s;
    }

    # /admin без слэша на конце — редирект на /admin/
    location = /admin {
        return 301 /admin/;
    }

    location = /404.html {
        internal;
    }
}
```

Включаем сайт и получаем SSL:
```bash
sudo ln -s /etc/nginx/sites-available/trustit.by /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx

sudo certbot --nginx -d trustit.by -d www.trustit.by
```

## 6. Как теперь публиковать изменения контента

1. Заходите на `https://trustit.by/admin`, логинитесь.
2. Редактируете новости/портфолио/страницы, загружаете картинки.
3. Жмёте «Собрать сайт» — admin-сервер выполнит `npm run build` в `trust-site` и обновит `dist/`.
4. Так как nginx отдаёт `dist/` напрямую как статику — обновления появляются сразу после успешной сборки, без перезапуска nginx или admin-процесса.

`CF_PAGES_PROJECT` в `.env` можно не задавать — деплой в Cloudflare Pages просто не будет выполняться, соберётся только `dist/` локально на сервере, что и нужно.

## 7. Обновление кода в будущем (когда поменяется сам код проекта)

```bash
cd /var/www/trustit
git pull
cd trust-site && npm install && npm run build
cd ../admin && npm install
pm2 restart trust-admin
```
