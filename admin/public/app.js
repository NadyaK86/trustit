import { SCHEMAS, schemaFor } from '/schemas.js';
import yamlLib from '/vendor/js-yaml.mjs';

const TOKEN_KEY = 'trust-admin-token';
const state = {
  token: localStorage.getItem(TOKEN_KEY) || null,
  pages: [],
  page: null,         // { collection, slug, label } current editor target
  fileData: null,
  fileBody: '',
  fileTitle: '',
  view: 'dashboard',  // dashboard | editor | images | leads | build | news-list | portfolio-list
  newsList: [],
  portfolioList: [],
  images: [],
  leads: [],
  build: { running: false, log: '' },
  config: { previewUrl: 'http://localhost:4321', siteOrigin: '' },
  settings: { leadRetentionDays: 0 },
  status: { unpublished: false, recent: [], lastBuild: null, building: false },
  dirty: false,
  previewOn: true,
  collapsed: {},
};

// ---------- low-level ----------
function api(path, opts = {}) {
  const headers = { 'Content-Type': 'application/json', ...(opts.headers || {}) };
  if (state.token) headers['Authorization'] = 'Bearer ' + state.token;
  const init = { ...opts, headers };
  if (opts.body && !(opts.body instanceof FormData)) init.body = JSON.stringify(opts.body);
  if (opts.body instanceof FormData) { delete headers['Content-Type']; init.body = opts.body; }
  return fetch(path, init).then(async (r) => {
    const ct = r.headers.get('content-type') || '';
    const data = ct.includes('json') ? await r.json() : await r.text();
    if (!r.ok) {
      if (r.status === 401) { state.token = null; localStorage.removeItem(TOKEN_KEY); }
      throw new Error((data && data.error) || `HTTP ${r.status}`);
    }
    return data;
  });
}

function notify(msg, kind = 'ok', sticky = false) {
  const n = document.createElement('div');
  n.className = `notif ${kind}`;
  n.innerHTML = `<span>${escapeHtml(msg)}</span>`;
  if (sticky || kind === 'err') {
    const x = document.createElement('button');
    x.className = 'notif-x'; x.textContent = '×';
    x.addEventListener('click', () => n.remove());
    n.appendChild(x);
  }
  document.body.appendChild(n);
  if (!sticky && kind !== 'err') setTimeout(() => n.remove(), 2600);
}

function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
}
function get(obj, key) {
  if (!key.includes('.')) return obj[key];
  return key.split('.').reduce((cur, k) => (cur == null ? undefined : cur[k]), obj);
}
function setDeep(obj, key, val) {
  if (!key.includes('.')) { obj[key] = val; return; }
  const parts = key.split('.');
  let cur = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    if (cur[parts[i]] == null || typeof cur[parts[i]] !== 'object') cur[parts[i]] = {};
    cur = cur[parts[i]];
  }
  cur[parts[parts.length - 1]] = val;
}

// ---------- dirty tracking ----------
function markDirty() {
  if (state.dirty) return;
  state.dirty = true;
  updatePublishUi();
}
function clearDirty() { state.dirty = false; updatePublishUi(); }

// ---------- bootstrap ----------
async function boot() {
  if (state.token) {
    try { await loadBootstrap(); }
    catch { state.token = null; localStorage.removeItem(TOKEN_KEY); }
  }
  render();
}
async function loadBootstrap() {
  state.pages = await api('/api/pages');
  state.config = await api('/api/config').catch(() => state.config);
  state.settings = await api('/api/settings').catch(() => state.settings);
  state.leads = await api('/api/leads').catch(() => []);
  await refreshStatus();
}
async function refreshStatus() {
  try { state.status = await api('/api/status'); } catch {}
  updatePublishUi();
}

function render() {
  if (!state.token) return renderLogin();
  renderShell();
}

// ---------- login ----------
function renderLogin() {
  const root = document.getElementById('app');
  root.innerHTML = `
    <div class="login">
      <div class="login-card">
        <div class="brand"><span class="brand-dot">Т</span> Админ-панель</div>
        <p>Управление сайтом ТрастИнкомТрэйд</p>
        <form id="login-form">
          <div class="row"><input type="password" id="pwd" placeholder="Пароль" autocomplete="current-password" /></div>
          <button class="primary" style="width:100%">Войти</button>
          <div class="err hidden" id="login-err"></div>
        </form>
      </div>
    </div>`;
  document.getElementById('login-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const pwd = document.getElementById('pwd').value;
    try {
      const { token } = await api('/api/login', { method: 'POST', body: { password: pwd } });
      state.token = token; localStorage.setItem(TOKEN_KEY, token);
      await loadBootstrap(); render();
    } catch (err) {
      const el = document.getElementById('login-err');
      el.textContent = err.message; el.classList.remove('hidden');
    }
  });
}

// ---------- shell ----------
function renderShell() {
  const root = document.getElementById('app');
  const showPreview = state.view === 'editor' && state.previewOn;
  root.innerHTML = `
    <div class="layout${showPreview ? ' with-preview' : ''}">
      <aside class="sidebar">
        <div class="brand"><span class="brand-dot">Т</span> Админ-панель</div>
        <a class="open-site" id="open-site" target="_blank">↗ Открыть сайт</a>
        <nav id="nav-body" class="nav"></nav>
        <div class="sidebar-foot">
          <div id="publish-box"></div>
          <button id="logout" class="ghost-btn">Выйти</button>
        </div>
      </aside>
      <main class="main" id="main"></main>
      <section class="preview" id="preview"></section>
    </div>`;

  document.getElementById('open-site').href = state.config.previewUrl;
  document.getElementById('logout').addEventListener('click', () => {
    if (state.dirty && !confirm('Есть несохранённые изменения. Выйти?')) return;
    state.token = null; localStorage.removeItem(TOKEN_KEY); render();
  });

  renderSidebar();
  renderMain();
  if (showPreview) renderPreview();
  updatePublishUi();
}

function navGroup(title) {
  const h = document.createElement('div');
  h.className = 'section-title';
  h.textContent = title;
  return h;
}
function navItem(label, active, onClick, badge) {
  const a = document.createElement('div');
  a.className = 'nav-item' + (active ? ' active' : '');
  a.innerHTML = `<span class="nav-label">${escapeHtml(label)}</span>${badge ? `<span class="nav-badge">${badge}</span>` : ''}`;
  a.addEventListener('click', onClick);
  return a;
}

function renderSidebar() {
  const nav = document.getElementById('nav-body');
  nav.innerHTML = '';

  nav.appendChild(navItem('🏠 Дашборд', state.view === 'dashboard', () => go('dashboard')));

  for (const group of state.pages) {
    nav.appendChild(navGroup(group.group));
    for (const p of group.pages) {
      const active = state.view === 'editor' && state.page?.slug === p.slug && state.page?.collection === p.collection;
      nav.appendChild(navItem(p.label, active, () => openPage(p)));
    }
  }

  nav.appendChild(navGroup('Коллекции'));
  nav.appendChild(navItem('Новости', state.view === 'news-list', () => openCollection('news')));
  nav.appendChild(navItem('Портфолио', state.view === 'portfolio-list', () => openCollection('portfolio')));

  nav.appendChild(navGroup('Медиа и заявки'));
  nav.appendChild(navItem('Изображения', state.view === 'images', () => openImages()));
  const unread = state.leads.filter((l) => !l.read).length;
  nav.appendChild(navItem('Заявки', state.view === 'leads', () => openLeads(), unread || ''));

  nav.appendChild(navGroup('Настройки'));
  nav.appendChild(navItem('Хранение данных', state.view === 'settings', () => openSettings()));
}

function go(view) {
  if (!confirmLeave()) return;
  state.view = view; state.page = null; renderShell();
}
function confirmLeave() {
  if (state.dirty) return confirm('Есть несохранённые изменения. Перейти без сохранения?');
  return true;
}

// ---------- publish UI ----------
function updatePublishUi() {
  const box = document.getElementById('publish-box');
  if (!box) return;
  const building = state.status.building || state.build.running;
  box.innerHTML = `
    <button id="publish-btn" class="primary pub-btn" ${building ? 'disabled' : ''}>${building ? 'Сборка…' : 'Опубликовать сайт'}</button>`;
  const btn = document.getElementById('publish-btn');
  if (btn) btn.addEventListener('click', publishAll);
  // editor header mirror
  const eh = document.getElementById('editor-dirty');
  if (eh) eh.textContent = state.dirty ? '● не сохранено' : '';
}

async function publishAll() {
  try {
    if (state.view === 'editor' && state.dirty) { await saveCurrent(true); }
    state.view = 'build';
    renderShell();
    startBuild();
  } catch (e) { notify(e.message, 'err'); }
}

// ---------- main router ----------
function renderMain() {
  const main = document.getElementById('main');
  main.innerHTML = '';
  if (state.view === 'dashboard') return renderDashboard(main);
  if (state.view === 'editor') return renderEditor(main);
  if (state.view === 'news-list' || state.view === 'portfolio-list') return renderCollectionList(main);
  if (state.view === 'images') return renderImages(main);
  if (state.view === 'leads') return renderLeads(main);
  if (state.view === 'build') return renderBuild(main);
  if (state.view === 'settings') return renderSettings(main);
}

// ---------- dashboard ----------
function pageLabel(collection, slug) {
  for (const g of state.pages) for (const p of g.pages) if (p.collection === collection && p.slug === slug) return p.label;
  return slug;
}
function renderDashboard(main) {
  const unread = state.leads.filter((l) => !l.read).length;
  const recent = state.status.recent || [];
  main.innerHTML = `
    <div class="page-head"><h1>Главная</h1><p class="muted">Управление контентом сайта</p></div>
    <div class="dash-grid">
      <div class="dash-card">
        <div class="dash-k">Публикация</div>
        <div class="dash-v">Применить изменения на сайте</div>
        <button class="primary" id="dash-publish">Опубликовать сайт</button>
      </div>
      <div class="dash-card">
        <div class="dash-k">Заявки</div>
        <div class="dash-v">${state.leads.length} всего${unread ? `, ${unread} новых` : ''}</div>
        <button id="dash-leads">Открыть заявки</button>
      </div>
      <div class="dash-card">
        <div class="dash-k">Изображения</div>
        <div class="dash-v">Библиотека медиа</div>
        <button id="dash-images">Открыть библиотеку</button>
      </div>
    </div>
    <div class="dash-section">
      <h3>Недавно изменённые</h3>
      <div class="recent-list" id="recent-list"></div>
    </div>`;
  document.getElementById('dash-publish').addEventListener('click', publishAll);
  document.getElementById('dash-leads').addEventListener('click', () => openLeads());
  document.getElementById('dash-images').addEventListener('click', () => openImages());
  const rl = document.getElementById('recent-list');
  if (!recent.length) rl.innerHTML = '<p class="muted">Нет данных.</p>';
  for (const r of recent) {
    const item = document.createElement('div');
    item.className = 'recent-item';
    const d = new Date(r.mtime);
    item.innerHTML = `<span>${escapeHtml(pageLabel(r.collection, r.slug))}</span><span class="muted">${d.toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</span>`;
    item.addEventListener('click', () => openPage({ collection: r.collection, slug: r.slug, label: pageLabel(r.collection, r.slug) }));
    rl.appendChild(item);
  }
}

// ---------- editor ----------
async function openPage(p) {
  if (!confirmLeave()) return;
  state.view = 'editor';
  state.page = p;
  state.fileData = null; state.fileBody = ''; state.fileTitle = p.label;
  state.dirty = false;
  renderShell();
  try {
    const r = await api(`/api/file/${p.collection}/${p.slug}`);
    state.fileData = yamlLib.load(r.frontmatter) || {};
    state.fileBody = r.body || '';
    state.fileTitle = p.label;
    renderMain();
    if (state.previewOn) renderPreview();
  } catch (e) { notify(e.message, 'err'); }
}

async function saveCurrent(silent) {
  if (!state.page) return;
  const frontmatter = yamlLib.dump(state.fileData ?? {}, { lineWidth: 120, noRefs: true });
  await api(`/api/file/${state.page.collection}/${state.page.slug}`, {
    method: 'PUT', body: { frontmatter, body: state.fileBody },
  });
  clearDirty();
  await refreshStatus();
  reloadPreview();
  if (!silent) notify('Сохранено — превью обновлено');
}

function renderEditor(main) {
  if (!state.fileData) { main.innerHTML = '<p class="muted">Загрузка…</p>'; return; }
  const schema = schemaFor(state.page.collection, state.page.slug);
  main.innerHTML = `
    <div class="ed-head">
      <div class="ed-title">
        <button class="back-btn" id="ed-back">←</button>
        <div>
          <h2>${escapeHtml(state.fileTitle)} <span id="editor-dirty" class="dirty-dot"></span></h2>
          <span class="path-hint">${escapeHtml(state.page.collection)}/${escapeHtml(state.page.slug)}.md</span>
        </div>
      </div>
      <div class="ed-actions">
        <button id="toggle-preview" class="${state.previewOn ? 'active' : ''}">👁 Превью</button>
        <button id="open-page">↗ В новой вкладке</button>
        <button id="save-btn" class="primary">Сохранить</button>
      </div>
    </div>
    <div id="form-body" class="form-body"></div>`;

  document.getElementById('ed-back').addEventListener('click', () => go('dashboard'));
  document.getElementById('save-btn').addEventListener('click', () => saveCurrent().catch((e) => notify(e.message, 'err')));
  document.getElementById('open-page').addEventListener('click', () => window.open(previewUrlFor(state.page), '_blank'));
  document.getElementById('toggle-preview').addEventListener('click', () => { state.previewOn = !state.previewOn; renderShell(); });

  const body = document.getElementById('form-body');
  if (schema && !schema.dynamic) renderSchemaForm(body, schema);
  else renderDynamicForm(body);

  if (schema?.bodyEditor) renderBodyEditor(body);

  // dirty tracking (делегирование)
  body.addEventListener('input', markDirty);
  body.addEventListener('change', markDirty);
  body.addEventListener('click', (e) => {
    if (e.target.closest('.rm, .up, .down, .lo-add, .list-of-objects button, .string-list button')) markDirty();
  });
}

function renderBodyEditor(body) {
  const wrap = document.createElement('div');
  wrap.className = 'form-group';
  wrap.innerHTML = `
    <div class="group-head" style="display:flex;align-items:center;justify-content:space-between;gap:12px">
      <h3>Текст страницы (Markdown)</h3>
      <button type="button" class="insert-img-btn">+ Вставить изображение</button>
    </div>
    <div class="group-inner"><textarea id="body-ta" style="min-height:280px"></textarea></div>`;
  body.appendChild(wrap);
  const ta = wrap.querySelector('#body-ta');
  ta.value = state.fileBody;
  ta.addEventListener('input', () => { state.fileBody = ta.value; markDirty(); });
  wrap.querySelector('.insert-img-btn').addEventListener('click', () => {
    openImagePicker((picked) => {
      const alt = prompt('Подпись (alt) к изображению — для SEO и доступности:', '') || '';
      const md = `\n\n![${alt}](${picked})\n\n`;
      const start = ta.selectionStart ?? ta.value.length;
      const end = ta.selectionEnd ?? ta.value.length;
      ta.value = ta.value.slice(0, start) + md + ta.value.slice(end);
      state.fileBody = ta.value; markDirty(); ta.focus();
      const pos = start + md.length; ta.setSelectionRange(pos, pos);
    });
  });
}

function previewPathFor(p) {
  if (p.collection === 'news') return `/news/${p.slug}`;
  if (p.collection === 'portfolio') return `/portfolio`;
  const map = {
    home: '/', navigation: '/', settings: '/',
    solutions: '/solutions', 'digital-signage': '/solutions/digital-signage',
    'av-systems': '/solutions/av-systems', 'meeting-rooms': '/solutions/meeting-rooms',
    'it-infrastructure': '/solutions/it-infrastructure', services: '/services',
    about: '/about', contacts: '/contacts', catalog: '/catalog',
    'thank-you': '/thank-you', privacy: '/privacy',
  };
  return map[p.slug] ?? `/${p.slug}`;
}
function previewUrlFor(p) { return state.config.previewUrl + previewPathFor(p); }

// ---------- live preview pane ----------
function renderPreview() {
  const host = document.getElementById('preview');
  if (!host) return;
  if (state.view !== 'editor' || !state.page) { host.innerHTML = ''; return; }
  host.innerHTML = `
    <div class="prev-bar">
      <span class="prev-label">Живое превью</span>
      <span class="path-hint">${escapeHtml(previewPathFor(state.page))}</span>
      <div class="spacer"></div>
      <button id="prev-refresh" title="Обновить">⟳</button>
      <button id="prev-open" title="Открыть в новой вкладке">↗</button>
    </div>
    <div class="prev-frame-wrap"><iframe id="prev-frame" src="${escapeHtml(previewUrlFor(state.page))}"></iframe></div>
    <div class="prev-hint muted">Превью из dev-сервера. После «Сохранить» обновляется автоматически.</div>`;
  document.getElementById('prev-refresh').addEventListener('click', reloadPreview);
  document.getElementById('prev-open').addEventListener('click', () => window.open(previewUrlFor(state.page), '_blank'));
}
function reloadPreview() {
  const f = document.getElementById('prev-frame');
  if (f) { const u = previewUrlFor(state.page); f.src = u; }
}

// ---------- forms ----------
function renderSchemaForm(container, schema) {
  for (const grp of schema.groups) {
    const card = document.createElement('section');
    card.className = 'form-group';
    const gid = 'g-' + Math.random().toString(36).slice(2, 8);
    const collapsed = state.collapsed[grp.label];
    card.innerHTML = `
      <div class="group-head clickable" data-grp="${escapeHtml(grp.label)}">
        <h3>${escapeHtml(grp.label)}</h3>
        ${grp.hint ? `<span class="hint">${escapeHtml(grp.hint)}</span>` : ''}
        <span class="grp-toggle">${collapsed ? '▸' : '▾'}</span>
      </div>
      <div class="group-inner" id="${gid}" ${collapsed ? 'style="display:none"' : ''}></div>`;
    const inner = card.querySelector('#' + gid);
    for (const field of grp.fields) {
      const row = document.createElement('div');
      row.className = 'field-row';
      const label = document.createElement('label');
      label.textContent = field.label + (field.required ? ' *' : '');
      row.appendChild(label);
      const ctl = document.createElement('div');
      ctl.className = 'field-ctl';
      renderField(ctl, field, state.fileData);
      if (field.help) { const h = document.createElement('span'); h.className = 'field-help'; h.textContent = field.help; ctl.appendChild(h); }
      row.appendChild(ctl);
      inner.appendChild(row);
    }
    card.querySelector('.group-head').addEventListener('click', () => {
      state.collapsed[grp.label] = !state.collapsed[grp.label];
      const open = !state.collapsed[grp.label];
      inner.style.display = open ? '' : 'none';
      card.querySelector('.grp-toggle').textContent = open ? '▾' : '▸';
    });
    container.appendChild(card);
  }
}

function renderDynamicForm(container) {
  const wrap = document.createElement('div');
  wrap.className = 'form-group';
  wrap.innerHTML = `
    <div class="group-head"><h3>Поля страницы</h3><span class="hint">Страница без типизированной схемы — общий редактор.</span></div>
    <div class="group-inner" id="dyn-fields"></div>`;
  container.appendChild(wrap);
  renderObjectFields(wrap.querySelector('#dyn-fields'), state.fileData);
}
function renderObjectFields(host, obj) {
  for (const [k, v] of Object.entries(obj)) {
    const row = document.createElement('div');
    row.className = 'field-row';
    row.innerHTML = `<label>${escapeHtml(k)}</label>`;
    const ctl = document.createElement('div');
    ctl.className = 'field-ctl';
    renderInferredEditor(ctl, v, (newVal) => { obj[k] = newVal; });
    row.appendChild(ctl);
    host.appendChild(row);
  }
}
function renderInferredEditor(container, value, onChange) {
  if (Array.isArray(value)) {
    const sample = value[0];
    if (sample && typeof sample === 'object' && !Array.isArray(sample)) {
      renderListOfObjects(container, value, Object.keys(sample).map((k) => ({ key: k, label: k, type: 'text' })), () => onChange(value));
    } else {
      renderStringList(container, value, (arr) => onChange(arr));
    }
    return;
  }
  if (value && typeof value === 'object') {
    const sub = document.createElement('div');
    sub.style.borderLeft = '2px solid var(--line)';
    sub.style.paddingLeft = '10px';
    renderObjectFields(sub, value);
    container.appendChild(sub);
    return;
  }
  if (typeof value === 'string' && value.length > 80) {
    const ta = document.createElement('textarea');
    ta.value = value;
    ta.addEventListener('input', () => onChange(ta.value));
    container.appendChild(ta);
  } else {
    const inp = document.createElement('input');
    inp.type = 'text'; inp.value = value ?? '';
    inp.addEventListener('input', () => onChange(inp.value));
    container.appendChild(inp);
  }
}

// ---------- field renderers ----------
function renderField(container, field, obj) {
  const t = field.type;
  if (t === 'text' || t === 'url') return renderTextField(container, field, obj);
  if (t === 'longtext' || t === 'textarea') return renderLongText(container, field, obj);
  if (t === 'number') return renderNumberField(container, field, obj);
  if (t === 'boolean') return renderBooleanField(container, field, obj);
  if (t === 'select') return renderSelect(container, field, obj);
  if (t === 'image') return renderImageField(container, field, obj);
  if (t === 'string-list') {
    if (!Array.isArray(get(obj, field.key))) setDeep(obj, field.key, []);
    renderStringList(container, get(obj, field.key), (a) => setDeep(obj, field.key, a));
    return;
  }
  if (t === 'list') {
    if (!Array.isArray(get(obj, field.key))) setDeep(obj, field.key, []);
    renderListOfObjects(container, get(obj, field.key), field.itemSchema?.fields ?? [], () => {});
    return;
  }
  if (t === 'industry-details') return renderIndustryDetails(container, field, obj);
  renderTextField(container, field, obj);
}
function renderTextField(container, field, obj) {
  const inp = document.createElement('input');
  inp.type = 'text'; inp.value = get(obj, field.key) ?? '';
  inp.addEventListener('input', () => setDeep(obj, field.key, inp.value));
  container.appendChild(inp);
}
function renderLongText(container, field, obj) {
  const ta = document.createElement('textarea');
  ta.value = get(obj, field.key) ?? '';
  ta.addEventListener('input', () => setDeep(obj, field.key, ta.value));
  container.appendChild(ta);
}
function renderNumberField(container, field, obj) {
  const inp = document.createElement('input');
  inp.type = 'number'; inp.value = get(obj, field.key) ?? '';
  inp.addEventListener('input', () => setDeep(obj, field.key, Number(inp.value)));
  container.appendChild(inp);
}
function renderBooleanField(container, field, obj) {
  const wrap = document.createElement('label');
  wrap.style.cssText = 'display:inline-flex;align-items:center;gap:8px';
  const inp = document.createElement('input');
  inp.type = 'checkbox'; inp.style.width = 'auto';
  inp.checked = Boolean(get(obj, field.key));
  inp.addEventListener('change', () => setDeep(obj, field.key, inp.checked));
  wrap.appendChild(inp); wrap.appendChild(document.createTextNode('Да/нет'));
  container.appendChild(wrap);
}
function renderSelect(container, field, obj) {
  const sel = document.createElement('select');
  for (const opt of field.options || []) {
    const o = document.createElement('option'); o.value = opt; o.textContent = opt; sel.appendChild(o);
  }
  sel.value = get(obj, field.key) ?? '';
  sel.addEventListener('change', () => setDeep(obj, field.key, sel.value));
  container.appendChild(sel);
}
function renderImageField(container, field, obj) {
  const url = get(obj, field.key) ?? '';
  const wrap = document.createElement('div');
  wrap.className = 'image-field';
  const previewHtml = (u) => u ? `<img src="${escapeHtml(u)}" alt="" />` : '<span class="muted">Нет изображения</span>';
  wrap.innerHTML = `
    <div class="image-preview">${previewHtml(url)}</div>
    <div class="image-actions">
      <input type="text" class="img-url" value="${escapeHtml(url)}" placeholder="/images/file.jpg" />
      <button type="button" class="pick-btn">Выбрать / загрузить</button>
    </div>`;
  const inp = wrap.querySelector('.img-url');
  inp.addEventListener('input', () => { setDeep(obj, field.key, inp.value); wrap.querySelector('.image-preview').innerHTML = previewHtml(inp.value); });
  wrap.querySelector('.pick-btn').addEventListener('click', () => openImagePicker((picked) => {
    inp.value = picked; setDeep(obj, field.key, picked);
    wrap.querySelector('.image-preview').innerHTML = previewHtml(picked); markDirty();
  }));
  container.appendChild(wrap);
}
function renderStringList(container, arr, onChange) {
  const wrap = document.createElement('div');
  wrap.className = 'string-list';
  function redraw() {
    wrap.innerHTML = '';
    arr.forEach((v, i) => {
      const row = document.createElement('div');
      row.className = 'string-list-row';
      row.innerHTML = `<input type="text" value="${escapeHtml(v)}" /><button type="button" class="up">↑</button><button type="button" class="down">↓</button><button type="button" class="rm danger">×</button>`;
      row.querySelector('input').addEventListener('input', (e) => { arr[i] = e.target.value; onChange(arr); });
      row.querySelector('.up').addEventListener('click', () => { if (i > 0) { [arr[i-1], arr[i]] = [arr[i], arr[i-1]]; onChange(arr); redraw(); } });
      row.querySelector('.down').addEventListener('click', () => { if (i < arr.length-1) { [arr[i+1], arr[i]] = [arr[i], arr[i+1]]; onChange(arr); redraw(); } });
      row.querySelector('.rm').addEventListener('click', () => { arr.splice(i, 1); onChange(arr); redraw(); });
      wrap.appendChild(row);
    });
    const add = document.createElement('button');
    add.type = 'button'; add.textContent = '+ Добавить';
    add.addEventListener('click', () => { arr.push(''); onChange(arr); redraw(); });
    wrap.appendChild(add);
  }
  redraw();
  container.appendChild(wrap);
}
function renderListOfObjects(container, arr, fields, onChange) {
  const wrap = document.createElement('div');
  wrap.className = 'list-of-objects';
  function redraw() {
    wrap.innerHTML = '';
    arr.forEach((item, idx) => {
      const card = document.createElement('div');
      card.className = 'lo-card';
      card.innerHTML = `
        <div class="lo-head">
          <span class="lo-num">${idx + 1}</span>
          <span class="lo-title">${escapeHtml(item.title || item.label || item.name || item.slug || `Элемент ${idx+1}`)}</span>
          <div class="lo-actions">
            <button type="button" class="up">↑</button>
            <button type="button" class="down">↓</button>
            <button type="button" class="rm danger">× удалить</button>
          </div>
        </div>
        <div class="lo-body"></div>`;
      const body = card.querySelector('.lo-body');
      for (const f of fields) {
        const row = document.createElement('div');
        row.className = 'field-row';
        const lab = document.createElement('label'); lab.textContent = f.label; row.appendChild(lab);
        const ctl = document.createElement('div'); ctl.className = 'field-ctl';
        renderField(ctl, f, item); row.appendChild(ctl); body.appendChild(row);
      }
      card.querySelector('.up').addEventListener('click', () => { if (idx > 0) { [arr[idx-1], arr[idx]] = [arr[idx], arr[idx-1]]; onChange(); redraw(); } });
      card.querySelector('.down').addEventListener('click', () => { if (idx < arr.length-1) { [arr[idx+1], arr[idx]] = [arr[idx], arr[idx+1]]; onChange(); redraw(); } });
      card.querySelector('.rm').addEventListener('click', () => { if (!confirm('Удалить элемент?')) return; arr.splice(idx, 1); onChange(); redraw(); });
      wrap.appendChild(card);
    });
    const add = document.createElement('button');
    add.type = 'button'; add.className = 'lo-add'; add.textContent = '+ Добавить элемент';
    add.addEventListener('click', () => {
      arr.push(Object.fromEntries(fields.map((f) => [f.key, f.type === 'string-list' || f.type === 'list' ? [] : ''])));
      onChange(); redraw();
    });
    wrap.appendChild(add);
  }
  redraw();
  container.appendChild(wrap);
}
function renderIndustryDetails(container, field, obj) {
  let details = get(obj, field.key);
  if (!details || typeof details !== 'object') { setDeep(obj, field.key, {}); details = get(obj, field.key); }
  const industries = (obj.industries || []).map((i) => i.slug).filter(Boolean);
  const sub = document.createElement('div');
  for (const slug of industries) {
    let d = details[slug];
    if (!d) { details[slug] = { heroBadge: '', heroTitle: '', heroLead: '', intro: '', benefits: [], cta: '' }; d = details[slug]; }
    const card = document.createElement('div');
    card.className = 'lo-card';
    card.innerHTML = `<div class="lo-head"><span class="lo-title">${escapeHtml(slug)}</span></div><div class="lo-body"></div>`;
    const body = card.querySelector('.lo-body');
    const fields = [
      { key: 'heroBadge', label: 'Бейдж', type: 'text' },
      { key: 'heroTitle', label: 'Заголовок hero', type: 'text' },
      { key: 'heroLead', label: 'Лид', type: 'longtext' },
      { key: 'intro', label: 'Intro', type: 'longtext' },
      { key: 'cta', label: 'CTA', type: 'longtext' },
    ];
    for (const f of fields) {
      const row = document.createElement('div'); row.className = 'field-row';
      const lab = document.createElement('label'); lab.textContent = f.label; row.appendChild(lab);
      const ctl = document.createElement('div'); ctl.className = 'field-ctl';
      renderField(ctl, f, d); row.appendChild(ctl); body.appendChild(row);
    }
    const benRow = document.createElement('div'); benRow.className = 'field-row';
    benRow.innerHTML = `<label>Преимущества</label>`;
    const benCtl = document.createElement('div'); benCtl.className = 'field-ctl';
    if (!Array.isArray(d.benefits)) d.benefits = [];
    renderListOfObjects(benCtl, d.benefits, [
      { key: 'title', label: 'Заголовок', type: 'text' },
      { key: 'desc', label: 'Описание', type: 'longtext' },
    ], () => {});
    benRow.appendChild(benCtl); body.appendChild(benRow);
    sub.appendChild(card);
  }
  container.appendChild(sub);
}

// ---------- image picker ----------
function openImagePicker(onPick) {
  api('/api/images').then((files) => {
    showModal('Изображения', (modalBody, close) => {
      const bar = document.createElement('div');
      bar.style.cssText = 'display:flex;gap:8px;align-items:center;margin-bottom:14px';
      bar.innerHTML = `<input type="file" accept="image/*" style="display:none" /><button type="button" class="primary up-btn">+ Загрузить новое</button><span class="muted up-status"></span>`;
      const fileInput = bar.querySelector('input');
      const status = bar.querySelector('.up-status');
      bar.querySelector('.up-btn').addEventListener('click', () => fileInput.click());
      fileInput.addEventListener('change', async () => {
        const f = fileInput.files && fileInput.files[0]; if (!f) return;
        status.textContent = 'Загрузка…';
        try { const fd = new FormData(); fd.append('file', f); const r = await api('/api/upload', { method: 'POST', body: fd }); onPick(r.path); close(); }
        catch (e) { status.textContent = ''; notify(e.message, 'err'); }
      });
      modalBody.appendChild(bar);
      const grid = document.createElement('div'); grid.className = 'images-grid';
      if (!files.length) grid.innerHTML = '<p class="muted">Пока нет загруженных файлов.</p>';
      for (const img of files) {
        const c = document.createElement('div'); c.className = 'img-card';
        c.innerHTML = `<img src="${escapeHtml(img.path)}" /><div class="img-name">${escapeHtml(img.name)}</div>`;
        c.addEventListener('click', () => { onPick(img.path); close(); });
        grid.appendChild(c);
      }
      modalBody.appendChild(grid);
    });
  }).catch((e) => notify(e.message, 'err'));
}
function showModal(title, build) {
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.innerHTML = `<div class="modal"><div class="modal-head"><h3>${escapeHtml(title)}</h3><button class="close-x">×</button></div><div class="modal-body"></div></div>`;
  const close = () => overlay.remove();
  overlay.querySelector('.close-x').addEventListener('click', close);
  overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });
  document.body.appendChild(overlay);
  build(overlay.querySelector('.modal-body'), close);
}

// ---------- collections ----------
async function openCollection(coll) {
  if (!confirmLeave()) return;
  state.view = coll === 'news' ? 'news-list' : 'portfolio-list';
  state.page = null;
  renderShell();
  try {
    const files = await api(`/api/files/${coll}`);
    if (coll === 'news') state.newsList = files; else state.portfolioList = files;
    renderMain();
  } catch (e) { notify(e.message, 'err'); }
}
function renderCollectionList(main) {
  const coll = state.view === 'news-list' ? 'news' : 'portfolio';
  const list = coll === 'news' ? state.newsList : state.portfolioList;
  main.innerHTML = `
    <div class="page-head row-head">
      <h1>${coll === 'news' ? 'Новости' : 'Портфолио'}</h1>
      <button class="primary" id="add-item">+ Добавить</button>
    </div>
    <div class="files" id="files"></div>`;
  document.getElementById('add-item').addEventListener('click', async () => {
    const title = prompt('Заголовок:'); if (!title) return;
    const slug = prompt('Slug (латиницей, напр. my-news):'); if (!slug) return;
    try { const r = await api(`/api/file/${coll}`, { method: 'POST', body: { slug, title } }); await openCollection(coll); openPage({ collection: coll, slug: r.slug, label: title }); }
    catch (e) { notify(e.message, 'err'); }
  });
  const host = document.getElementById('files');
  if (!list.length) host.innerHTML = '<p class="muted">Пусто. Нажмите «Добавить».</p>';
  for (const slug of list) {
    const card = document.createElement('div');
    card.className = 'file-card';
    card.innerHTML = `<div class="name">${escapeHtml(slug)}</div><div class="meta">${coll}/${escapeHtml(slug)}.md</div>
      <div class="file-actions"><button class="open">Редактировать</button><button class="del danger">Удалить</button></div>`;
    card.querySelector('.open').addEventListener('click', () => openPage({ collection: coll, slug, label: slug }));
    card.querySelector('.del').addEventListener('click', async (e) => {
      e.stopPropagation();
      if (!confirm(`Удалить ${slug}?`)) return;
      try { await api(`/api/file/${coll}/${slug}`, { method: 'DELETE' }); await openCollection(coll); notify('Удалено'); }
      catch (err) { notify(err.message, 'err'); }
    });
    host.appendChild(card);
  }
}

// ---------- images ----------
async function openImages() {
  if (!confirmLeave()) return;
  state.view = 'images'; state.page = null; renderShell();
  try { state.images = await api('/api/images'); renderMain(); } catch (e) { notify(e.message, 'err'); }
}
function renderImages(main) {
  main.innerHTML = `
    <div class="page-head row-head">
      <h1>Изображения</h1>
      <input type="file" id="upload-input" accept="image/*" style="display:none" multiple />
      <button class="primary" id="upload-btn">+ Загрузить</button>
    </div>
    <p class="muted">Свои файлы для сайта. Используйте их в полях «Изображение» и при вставке в текст.</p>
    <div id="drop-zone" class="drop-zone">Перетащите файлы сюда</div>
    <div class="images-grid" id="imgs"></div>`;
  const grid = document.getElementById('imgs');
  if (!state.images.length) grid.innerHTML = '<p class="muted">Пусто.</p>';
  for (const img of state.images) {
    const c = document.createElement('div');
    c.className = 'img-card';
    c.innerHTML = `<img src="${escapeHtml(img.path)}" /><div class="img-name" title="${escapeHtml(img.name)}">${escapeHtml(img.name)}</div><div class="img-sub copy">${escapeHtml(img.path)}</div><button class="rm-img danger">Удалить</button>`;
    c.querySelector('.copy').addEventListener('click', () => { navigator.clipboard.writeText(img.path); notify('Путь скопирован'); });
    c.querySelector('.rm-img').addEventListener('click', async () => {
      if (!confirm(`Удалить ${img.name}?`)) return;
      try { await api(`/api/image/${encodeURIComponent(img.name)}`, { method: 'DELETE' }); notify('Удалено'); await openImages(); }
      catch (e) { notify(e.message, 'err'); }
    });
    grid.appendChild(c);
  }
  document.getElementById('upload-btn').addEventListener('click', () => document.getElementById('upload-input').click());
  document.getElementById('upload-input').addEventListener('change', (e) => uploadMany([...e.target.files]));
  const dz = document.getElementById('drop-zone');
  ['dragenter', 'dragover'].forEach((ev) => dz.addEventListener(ev, (e) => { e.preventDefault(); dz.classList.add('drag'); }));
  ['dragleave', 'drop'].forEach((ev) => dz.addEventListener(ev, (e) => { e.preventDefault(); dz.classList.remove('drag'); }));
  dz.addEventListener('drop', (e) => uploadMany([...e.dataTransfer.files]));
}
async function uploadMany(files) {
  for (const f of files) {
    const fd = new FormData(); fd.append('file', f);
    try { await api('/api/upload', { method: 'POST', body: fd }); } catch (e) { notify(`${f.name}: ${e.message}`, 'err'); }
  }
  notify('Загружено'); await openImages();
}

// ---------- leads ----------
const LEAD_TYPE_LABEL = { full: 'Сообщение (контакты)', estimate: 'Расчёт проекта', demo: 'Демо SmartPlayer', callback: 'Обратный звонок' };
const LEAD_FIELD_LABEL = { name: 'Имя', email: 'Email', phone: 'Телефон', company: 'Компания', topic: 'Тема', message: 'Сообщение', task: 'Задача', budget: 'Бюджет', screens: 'Экранов' };
async function openLeads() {
  if (!confirmLeave()) return;
  state.view = 'leads'; state.page = null; renderShell();
  try { state.leads = await api('/api/leads'); renderShell(); } catch (e) { notify(e.message, 'err'); }
}
function fmtDate(iso) {
  try { return new Date(iso).toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }); }
  catch { return iso; }
}
function renderLeads(main) {
  main.innerHTML = `
    <div class="page-head row-head"><h1>Заявки с сайта</h1><button id="leads-refresh">Обновить</button></div>
    <p class="muted">Хранятся локально, не передаются за рубеж.</p>
    <div id="leads-list"></div>`;
  document.getElementById('leads-refresh').addEventListener('click', () => openLeads());
  const list = document.getElementById('leads-list');
  if (!state.leads.length) { list.innerHTML = '<p class="muted">Заявок пока нет.</p>'; return; }
  for (const lead of state.leads) {
    const card = document.createElement('div');
    card.className = 'lead-card' + (lead.read ? ' read' : ' unread');
    const rows = Object.keys(LEAD_FIELD_LABEL).filter((k) => lead[k])
      .map((k) => `<div class="lead-row"><span class="lead-k">${LEAD_FIELD_LABEL[k]}</span><span class="lead-v">${escapeHtml(lead[k])}</span></div>`).join('');
    card.innerHTML = `
      <div class="lead-head"><span class="lead-type">${escapeHtml(LEAD_TYPE_LABEL[lead.form_type] || lead.form_type || 'Заявка')}</span><span class="lead-date muted">${escapeHtml(fmtDate(lead.createdAt))}</span></div>
      <div class="lead-body">${rows || '<span class="muted">Нет данных</span>'}</div>
      <div class="lead-actions"><button class="lead-read">${lead.read ? 'Непрочитанной' : 'Прочитано'}</button><button class="lead-del danger">Удалить</button></div>`;
    card.querySelector('.lead-read').addEventListener('click', async () => {
      try { await api(`/api/lead/${lead.id}`, { method: 'PATCH', body: { read: !lead.read } }); await openLeads(); } catch (e) { notify(e.message, 'err'); }
    });
    card.querySelector('.lead-del').addEventListener('click', async () => {
      if (!confirm('Удалить заявку?')) return;
      try { await api(`/api/lead/${lead.id}`, { method: 'DELETE' }); notify('Удалено'); await openLeads(); } catch (e) { notify(e.message, 'err'); }
    });
    list.appendChild(card);
  }
}

// ---------- settings (хранение данных) ----------
async function openSettings() {
  if (!confirmLeave()) return;
  state.view = 'settings'; state.page = null; renderShell();
  try { state.settings = await api('/api/settings'); renderMain(); } catch (e) { notify(e.message, 'err'); }
}
function renderSettings(main) {
  const days = state.settings.leadRetentionDays || 0;
  main.innerHTML = `
    <div class="page-head"><h1>Хранение данных</h1><p class="muted">Авто-удаление заявок по сроку — требование минимизации ПДн (99-З)</p></div>
    <div class="form-body">
      <section class="form-group">
        <div class="group-head"><h3>Срок хранения заявок</h3></div>
        <div class="group-inner">
          <div class="field-row">
            <label>Удалять заявки старше</label>
            <div class="field-ctl">
              <div style="display:flex;align-items:center;gap:10px;max-width:260px">
                <input type="number" id="retention" min="0" max="3650" value="${days}" />
                <span class="muted">дней</span>
              </div>
              <span class="field-help">0 = хранить бессрочно. Например 90 — удалять заявки старше 90 дней. Чистка идёт автоматически.</span>
            </div>
          </div>
          <div class="field-row">
            <label></label>
            <div class="field-ctl"><button class="primary" id="save-settings" style="align-self:flex-start">Сохранить</button></div>
          </div>
        </div>
      </section>
    </div>`;
  document.getElementById('save-settings').addEventListener('click', async () => {
    const v = Number(document.getElementById('retention').value);
    try {
      const r = await api('/api/settings', { method: 'PUT', body: { leadRetentionDays: v } });
      state.settings = r.settings;
      notify(`Сохранено${r.removed ? ` — удалено старых заявок: ${r.removed}` : ''}`);
      state.leads = await api('/api/leads').catch(() => state.leads);
      renderSidebar();
    } catch (e) { notify(e.message, 'err'); }
  });
}

// ---------- build / publish ----------
function renderBuild(main) {
  main.innerHTML = `
    <div class="page-head row-head"><h1>Публикация сайта</h1><button class="primary" id="build-btn" ${state.build.running ? 'disabled' : ''}>${state.build.running ? 'Идёт сборка…' : 'Собрать заново'}</button></div>
    <p class="muted">Сборка применяет все изменения на боевом сайте.</p>
    <div class="build-log" id="build-log">${escapeHtml(state.build.log) || 'Лог появится здесь…'}</div>`;
  document.getElementById('build-btn').addEventListener('click', startBuild);
}
function startBuild() {
  if (state.build.running) return;
  state.build = { running: true, log: '' };
  updatePublishUi();
  if (state.view === 'build') renderMain();
  api('/api/build', { method: 'POST' }).catch((e) => notify(e.message, 'err'));
  const es = new EventSource(`/api/build/stream?token=${encodeURIComponent(state.token)}`);
  es.onmessage = (ev) => {
    const msg = JSON.parse(ev.data);
    if (msg.type === 'log') { state.build.log += msg.text; const el = document.getElementById('build-log'); if (el) { el.textContent = state.build.log; el.scrollTop = el.scrollHeight; } }
    else if (msg.type === 'end' || msg.type === 'error') {
      state.build.running = false; es.close();
      refreshStatus();
      if (state.view === 'build') renderMain();
      notify(msg.exitCode === 0 ? 'Сайт опубликован' : 'Сборка завершилась с ошибкой', msg.exitCode === 0 ? 'ok' : 'err', msg.exitCode !== 0);
      reloadPreview();
    }
  };
  es.onerror = () => { es.close(); state.build.running = false; updatePublishUi(); };
}

// ---------- global handlers ----------
window.addEventListener('beforeunload', (e) => {
  if (state.dirty) { e.preventDefault(); e.returnValue = ''; }
});
document.addEventListener('keydown', (e) => {
  if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 's') {
    if (state.view === 'editor' && state.page) { e.preventDefault(); saveCurrent().catch((err) => notify(err.message, 'err')); }
  }
});

boot();
