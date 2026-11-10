'use strict';

/* ═══════════════════════════════════════════════════════════
   Categories grid
   Counts items by checking categories.includes(key)
   ═══════════════════════════════════════════════════════════ */
   
/* Display order for category cards. Buckets not listed here fall to the end
   in their natural order. */
var CAT_DISPLAY_ORDER = [
  'sabah',
  'masaa',
  'nawm',
  'salah',
  'salah_after',
  'wudu',
  'masjid',
  'food',
  'travel',
  'hajj',
  'sickness',
  'janazah',
  'clothing',
  'home',
  'duaa',
  'dhikr',
  'aam'
];
function _catOrderIndex(key){
  var i = CAT_DISPLAY_ORDER.indexOf(key);
  return i === -1 ? 9999 : i;
}

/* Adhkar home: the phase of the day decides the featured set, the rest is a grouped contents list.
   Layout after the approved mockup (editorial: Arabic title as the visual lead, hairlines, no cards). */
const ADK_GROUPS = [
  ['time',   'أوقات اليوم',        'Times of day',          ['sabah', 'masaa', 'nawm']],
  ['prayer', 'الصلاة والطهارة',    'Prayer & purification', ['salah', 'salah_after', 'wudu', 'masjid']],
  ['daily',  'الحياة اليومية',     'Daily life',            ['food', 'travel', 'clothing', 'home', 'manners']],
  ['needs',  'الأحوال والحاجات',   'Needs & circumstances', ['sickness', 'fear', 'protection', 'weather', 'family']],
  ['praise', 'الذكر والدعاء',      "Praise & du'a",         ['duaa', 'dhikr', 'salawat', 'rizq']],
  ['rites',  'الحج والجنازة',      'Hajj & funeral',        ['hajj', 'janazah']]
];
const ADK_MINE = ['mine', 'أقسامي', 'My categories'];
const ADK_PHASE = {
  fajr:    { key: 'sabah',  start: 'Fajr',    en: 'Fajr',    ar: 'الفجر' },
  sunrise: { key: 'sabah',  start: 'Sunrise', en: 'Sunrise', ar: 'الشروق' },
  doha:    { key: 'sabah',  start: 'Sunrise', en: 'Duha',    ar: 'الضحى' },
  dhuhr:   { key: 'dhikr',  start: 'Dhuhr',   en: 'Dhuhr',   ar: 'الظهر' },
  asr:     { key: 'masaa',  start: 'Asr',     en: 'Asr',     ar: 'العصر' },
  maghrib: { key: 'masaa',  start: 'Maghrib', en: 'Maghrib', ar: 'المغرب' },
  isha:    { key: 'nawm',   start: 'Isha',    en: 'Isha',    ar: 'العشاء' }
};
let _adkGroup = 'time';

function _adkAr(){ return window.SAHIB_I18N && window.SAHIB_I18N.language === 'ar'; }
function _adkGroupOf(key){
  const g = ADK_GROUPS.find(group => group[3].includes(key));
  return g ? g[0] : 'mine';
}
function _adkStats(c){
  const items = data.filter(d => Array.isArray(d.categories) && d.categories.includes(c.key));
  const done = items.filter(d => (counters[`c_${d.id}`] || 0) >= d.repeat).length;
  return { items, total: items.length, done };
}
function _adkExcerpt(items){
  const text = ((items[0] && items[0].arabic) || '').trim();
  if(!text) return '';
  const cut = text.length > 96 ? text.slice(0, 96).replace(/\s+\S*$/, '') + '…' : text;
  return cut;
}
function _adkFeaturedInfo(){
  const timings = window._homeSceneTimings || null;
  const phase = typeof homeScenePhase === 'function' ? homeScenePhase(timings) : 'isha';
  const meta = ADK_PHASE[phase] || ADK_PHASE.isha;
  const at = timings && timings[meta.start] ? String(timings[meta.start]).slice(0, 5) : '';
  const now = new Date();
  const clock = String(now.getHours()).padStart(2, '0') + ':' + String(now.getMinutes()).padStart(2, '0');
  return { phase, meta, at, clock };
}

function renderCatsGrid(){
  if(typeof renderQuoteCard === 'function') renderQuoteCard();
  const host = $('cats-grid');
  if(!host) return;
  const ar = _adkAr();
  const L = (en, arabic) => ar ? arabic : en;
  const sorted = cats.slice().sort((a, b) => _catOrderIndex(a.key) - _catOrderIndex(b.key));
  const rows = sorted.map(c => Object.assign({ c, group: _adkGroupOf(c.key) }, _adkStats(c)));

  const groups = ADK_GROUPS.map(g => ({ id: g[0], ar: g[1], en: g[2] }));
  if(rows.some(r => r.group === 'mine')) groups.push({ id: ADK_MINE[0], ar: ADK_MINE[1], en: ADK_MINE[2] });
  if(!groups.some(g => g.id === _adkGroup)) _adkGroup = groups[0].id;

  /* Featured: the set that belongs to this part of the day. */
  const info = _adkFeaturedInfo();
  const featured = rows.find(r => r.c.key === info.meta.key && r.total > 0);
  let nowHTML = '';
  if(featured){
    const f = featured, complete = f.done >= f.total;
    const phaseName = L(info.meta.en, info.meta.ar);
    const entered = info.at ? L(`${info.meta.start === 'Sunrise' ? 'Sunrise' : info.meta.en} at ${info.at}`, `${info.meta.ar} ${info.at}`) : '';
    const excerpt = _adkExcerpt(f.items);
    nowHTML = `<article class="adk-feature" aria-labelledby="adk-feature-title">
      <div class="adk-context"><strong>${L('Now', 'الآن')} · ${esc(phaseName)}</strong><span class="adk-num">${info.clock}</span>${entered ? `<span>${esc(entered)}</span>` : ''}</div>
      <h2 class="adk-feature-ar" id="adk-feature-title" lang="ar" data-no-i18n>${esc(f.c.ar)}</h2>
      <p class="adk-feature-en" lang="en" dir="ltr">${esc(f.c.en)} · ${f.total} adhkar${complete ? ' · ' + L('completed today', 'اكتملت اليوم') : ''}</p>
      ${excerpt ? `<p class="adk-excerpt" lang="ar" data-no-i18n>${esc(excerpt)}</p>` : ''}
      <div class="adk-actions">
        <button type="button" class="adk-primary" onclick="startSessionFromCategory('${f.c.key}', event)">${complete ? L('Read again', 'اقرأ مرة أخرى') : L('Start session', 'ابدأ الجلسة')}</button>
        <button type="button" class="adk-link" onclick="openCat('${f.c.key}')">${L('Browse adhkar', 'تصفّح الأذكار')}</button>
      </div>
    </article>`;
  }
  const started = rows.filter(r => r.done > 0).sort((a, b) => b.done / b.total - a.done / a.total).slice(0, 4);
  const todayHTML = `<aside class="adk-today" aria-labelledby="adk-today-title">
    <h2 id="adk-today-title">${L('Today', 'اليوم')}</h2>
    ${started.length ? started.map(r => `<div class="adk-prog">
        <div class="adk-prog-line"><button type="button" onclick="openCat('${r.c.key}')">${esc(ar ? r.c.ar : r.c.en)}</button><bdi class="adk-num${r.done >= r.total ? ' is-done' : ''}">${r.done} / ${r.total}</bdi></div>
        <div class="adk-track${r.done >= r.total ? ' is-done' : ''}" aria-hidden="true"><span style="width:${Math.round(r.done / r.total * 100)}%"></span></div>
      </div>`).join('') : `<p class="adk-note">${L('Nothing started yet today.', 'لم تبدأ شيئًا بعد اليوم.')}</p>`}
  </aside>`;

  const current = groups.find(g => g.id === _adkGroup);
  const inGroup = rows.filter(r => r.group === current.id);
  const contents = groups.map(g => `<button type="button" class="adk-group" aria-pressed="${g.id === _adkGroup}" onclick="adkSelectGroup('${g.id}')">
      <span><span class="adk-group-ar" lang="ar" data-no-i18n>${esc(g.ar)}</span><span class="adk-group-en" lang="en" dir="ltr">${esc(g.en)}</span></span>
      <span class="adk-num adk-group-count">${rows.filter(r => r.group === g.id).length}</span>
    </button>`).join('');
  const list = inGroup.map(r => `<article class="adk-cat">
      <button type="button" class="adk-cat-open" onclick="openCat('${r.c.key}')" aria-label="${esc(L('Browse ', 'تصفّح ') + (ar ? r.c.ar : r.c.en))}">
        <span class="adk-cat-ar" lang="ar" data-no-i18n>${esc(r.c.ar)}</span>
        <span class="adk-cat-meta"><span lang="en" dir="ltr">${esc(r.c.en)}</span>${r.done ? `<span class="${r.done >= r.total ? 'is-done' : ''}"><bdi class="adk-num">${r.done} / ${r.total}</bdi> ${L('today', 'اليوم')}</span>` : `<span><bdi class="adk-num">${r.total}</bdi> ${L('adhkar', 'ذكرًا')}</span>`}</span>
      </button>
      <button type="button" class="adk-start" onclick="startSessionFromCategory('${r.c.key}', event)" aria-label="${esc(L('Start ', 'ابدأ ') + (ar ? r.c.ar : r.c.en))}">${L('Start', 'ابدأ')}</button>
      <details class="adk-more"><summary aria-label="${esc(L('Manage ', 'إدارة ') + (ar ? r.c.ar : r.c.en))}">⋯</summary>
        <div class="adk-menu"><button type="button" onclick="openEditCat('${r.c.key}')">${L('Edit', 'تعديل')}</button><button type="button" onclick="askDelCat('${r.c.key}')">${L('Delete', 'حذف')}</button></div>
      </details>
    </article>`).join('') || `<p class="adk-note">${L('No categories in this group.', 'لا توجد أقسام في هذه المجموعة.')}</p>`;

  host.innerHTML = `<div class="adk-page">
    <section class="adk-now">${nowHTML}${todayHTML}</section>
    <section aria-labelledby="adk-lib-title">
      <div class="adk-lib-head">
        <h2 id="adk-lib-title">${L('The collection', 'مجموعات الأذكار')}</h2>
        <span class="adk-count">${rows.length} ${L('categories', 'قسمًا')}</span>
        <button type="button" class="adk-link" onclick="openForm()">${L('Add dhikr', 'إضافة ذكر')}</button>
        <button type="button" class="adk-link" onclick="openCatMgr()">+ ${L('New category', 'قسم جديد')}</button>
      </div>
      <div class="adk-lib">
        <nav class="adk-contents" aria-label="${L('Category groups', 'مجموعات الأقسام')}">${contents}</nav>
        <section class="adk-panel" aria-labelledby="adk-group-title">
          <div class="adk-panel-head"><h3 id="adk-group-title">${esc(ar ? current.ar : current.en)}</h3><span>${L('Read or start a session', 'للقراءة أو بدء جلسة')}</span></div>
          ${list}
        </section>
      </div>
    </section>
  </div>`;
  if(!window._adkMenusBound){
    window._adkMenusBound = true;
    document.addEventListener('click', e => document.querySelectorAll('.adk-more[open]').forEach(m => { if(!m.contains(e.target)) m.open = false; }));
    document.addEventListener('keydown', e => { if(e.key === 'Escape') document.querySelectorAll('.adk-more[open]').forEach(m => { m.open = false; m.querySelector('summary').focus(); }); });
  }
}

function adkSelectGroup(id){
  _adkGroup = id;
  renderCatsGrid();
  const button = document.querySelector('.adk-group[aria-pressed="true"]');
  if(button) button.focus();
}

/* Category-card CTA: set the active category and enter the session without
   requiring a second tap on the Adkar list. Other card controls remain
   separate buttons, so they can never trigger this action. */
function startSessionFromCategory(key, event){
  if(event){
    event.preventDefault();
    event.stopPropagation();
  }
  currentCat = key;
  const cat = (typeof getCat === 'function') ? getCat(key) : null;
  const title = document.getElementById('adkar-view-title');
  if(title && cat) title.textContent = cat.ar;
  if(typeof startSession === 'function') startSession();
}

function openCat(key){
  window._catsSavedScroll = window.scrollY || window.pageYOffset || 0;
  currentCat = key;
  $('adkar-view-title').textContent = getCat(key).ar;
  renderAdkarGrid();
  window.scrollTo(0, 0);
  showView('view-adkar');
  pushViewState('adkar');
}

/* Called by the popstate handler. Does the close without pushing another entry. */
function _closeCatFromHistory(){
  currentCat = null;
  if(typeof clearSearch === 'function') clearSearch();
  $('btn-favs').classList.remove('active');
  showView('view-cats');
  renderCatsGrid();
  requestAnimationFrame(() => {
    window.scrollTo(0, window._catsSavedScroll || 0);
  });
}

/* UI-initiated close of the adhkar view. Pops the history entry. */
function closeAdkarView(){
  if(window.history && window.history.length > 1){
    history.back();
  } else {
    _closeCatFromHistory();
  }
}

function showView(id){
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  $(id).classList.add('active');

  if(typeof updateShellNav === 'function') updateShellNav(id);

  /* Search bar visibility — only on Adkar and Library views */
  const searchBar = document.getElementById('search-bar');
  if(searchBar){
const showSearch = (id === 'view-cats' || id === 'view-books' || id === 'view-search');
    searchBar.style.display = showSearch ? '' : 'none';

    /* Update placeholder + behavior based on context */
    const input = document.getElementById('search-input');
    if(input){
      if(id === 'view-books'){
        input.placeholder = 'Search books & authors...';
        input.oninput = function(){ if(typeof onBooksSearch === 'function') onBooksSearch(this.value); };
      } else {
        input.placeholder = 'Search all adkar...';
        input.oninput = function(){ if(typeof handleSearch === 'function') handleSearch(); };
      }
if(id !== 'view-search'){ input.value = ''; }    }
  }

  /* Inject any SVG icons in the newly-shown view */
  if(typeof injectHeaderIcons === 'function') {
    setTimeout(() => injectHeaderIcons(), 0);
  }
}

/* Navigate to adkar categories grid */
function goToAdkarCategories(){
  showView('view-cats');
  currentCat = null;
  clearSearch();
  $('btn-favs').classList.remove('active');
  renderCatsGrid();
  requestAnimationFrame(() => {
    window.scrollTo(0, window._catsSavedScroll || 0);
  });
}

/* Navigate to the main dashboard (home) */
function goHome(){
  goHomeView();
}

function toggleTheme(){
  if(typeof SAHIB_THEME !== 'undefined' && SAHIB_THEME.toggleMode){
    SAHIB_THEME.toggleMode();
    return;
  }
  isLight = !isLight;
  document.body.classList.toggle('light', isLight);
  if(typeof updateThemeToggleIcon === 'function') updateThemeToggleIcon();
  if(typeof updateThemeColorMeta === 'function') updateThemeColorMeta();
  store.setMeta('theme', isLight ? 'light' : 'dark');
  if(typeof updateMenuState === 'function') updateMenuState();
}