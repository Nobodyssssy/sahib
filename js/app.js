'use strict';

/* ═══════════════════════════════════════════════════════════
   App bootstrap
   • Load state from IndexedDB (async)
   • Migrate from localStorage on first run
   • Then render the UI
   ═══════════════════════════════════════════════════════════ */
(async function boot(){
  try{
    /* 1. Load everything from IndexedDB into memory */
    await initState();

    /* 1b. Load icon sprite into the DOM (so <use> references work) */
    await loadIconSprite();

    /* 2. Daily reset check (now async) */
    await store.checkDailyReset();

    /* 3. Build the fuzzy search index (once data is loaded) */
    rebuildSearchIndex();

    /* 4. Restore theme, accent and font preferences through the theme engine */
    if (typeof SAHIB_THEME !== 'undefined') {
      await SAHIB_THEME.init();
    } else {
      updateThemeColorMeta();
    }

    /* 4.1 Prayer surfaces: shared countdown ticker + reminders */
    if (typeof PrayerWidget !== 'undefined') {
      try { PrayerWidget.init(); } catch (err) { console.warn('[prayer-widget]', err); }
    }
    if (typeof PrayerAlerts !== 'undefined') {
      try { await PrayerAlerts.init(); } catch (err) { console.warn('[prayer-alerts]', err); }
    }

    /* 5. Inject header icons */
    injectHeaderIcons();
    initShell();

    /* 5.1 Render home dashboard */
    renderHome();

    /* 5.2 Scroll-to-top button */
    initScrollTopButton();

    /* 6. Global keyboard shortcuts */
    document.addEventListener('keydown', e => {
      if(e.key === 'Escape'){
        const sess = $('session-overlay');
        if(sess && sess.classList.contains('open')) closeSession();
        
        const settings = document.getElementById('ov-settings');
        if(settings && settings.classList.contains('open')) closeSettings();
      }
    });

    /* 7. Standalone-mode class */
    const isStandalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      window.navigator.standalone === true;
    if(isStandalone) document.documentElement.classList.add('pwa-standalone');

    /* 8. Log */
    console.log(
      '%cصاحب · Sahib' + (isStandalone ? ' (installed)' : ''),
      'color:#c9a84c;font-weight:bold'
    );
  }catch(err){
    console.error('[app] boot failed:', err);
    /* Fallback: still try to render, might work with partial state */
    try{ renderCatsGrid(); }catch(e2){}
  }
})();

    /* 9. Re-check daily reset when the app comes back to the foreground
          (handles the "left open past midnight" case) */
    document.addEventListener('visibilitychange', async () => {
      if(document.visibilityState !== 'visible') return;
      const didReset = await store.checkDailyReset();
      if(didReset){
        if(typeof renderCatsGrid === 'function') renderCatsGrid();
        if(typeof renderAdkarGrid === 'function') renderAdkarGrid();
      }
    });

/* Load sprite.svg into the hidden mount, so <use> can find icons */
async function loadIconSprite(){
  const mount = document.getElementById('svg-sprite-mount');
  if(!mount) return;
  if(mount.dataset.loaded === '1') return;
  try{
    const res = await fetch('assets/icons/sprite.svg');
    if(res.ok){
      mount.innerHTML = await res.text();
      mount.dataset.loaded = '1';
    }
  }catch(err){
    console.warn('[icons] sprite load failed', err);
  }
}

/* Inject SVG icons into the header after sprite is loaded */
function injectHeaderIcons(){
  /* Header buttons */
  const btnMenu = $('btn-menu');
  if(btnMenu) btnMenu.innerHTML = icon('menu', 18);

  if(typeof updateFavsButton === 'function') updateFavsButton();

  const btnAdd = document.querySelector('.btn-add-icon');
  if(btnAdd) btnAdd.innerHTML = icon('plus', 18);

  updateThemeToggleIcon();

  /* Search icon */
  const searchIcon = document.querySelector('.search-icon');
  if(searchIcon) searchIcon.innerHTML = icon('search', 14);

  /* Menu items */
  document.querySelectorAll('.menu-item[data-icon]').forEach(btn => {
    const name = btn.getAttribute('data-icon');
    const slot = btn.querySelector('.menu-icon');
    if(name && slot) slot.innerHTML = icon(name, 18);
  });

  /* Desktop sidebar icons */
  document.querySelectorAll('.side-nav-item[data-nav]').forEach(btn => {
    const slot = btn.querySelector('.side-icon');
    const name = slot && slot.dataset.icon;
    if(name && slot && !slot.dataset.injected){
      slot.innerHTML = icon(name, 18);
      slot.dataset.injected = '1';
    }
  });

  /* Any element with data-icon that contains a .btn-icon span (global, any view) */
  document.querySelectorAll('[data-icon] > .btn-icon').forEach(span => {
    const parent = span.parentElement;
    const name = parent.getAttribute('data-icon');
    if(name && !span.dataset.injected) {
      span.innerHTML = icon(name, 15);
      span.dataset.injected = '1';
    }
  });

  /* Standalone .btn-icon[data-icon] — icon name carried by the span itself */
  document.querySelectorAll('.btn-icon[data-icon]').forEach(span => {
    const name = span.getAttribute('data-icon');
    if(name && !span.dataset.injected) {
      span.innerHTML = icon(name, 15);
      span.dataset.injected = '1';
    }
  });

  /* Standalone .search-clear with data-icon (no wrapper) */
  const clearBtn = document.querySelector('.search-clear');
  if(clearBtn && clearBtn.children.length === 0){
    clearBtn.innerHTML = icon('x', 16);
  }
}

/* Sync the theme toggle icon with current state */
function updateThemeToggleIcon(){
  const btn = $('theme-toggle-btn');
  if(!btn) return;
  /* In light mode, show moon (to switch to dark); in dark mode, show sun */
  btn.innerHTML = isLight ? icon('moon', 18) : icon('sun', 18);
}

/* Sync the theme-color meta tag with the current theme */
function updateThemeColorMeta(){
  const meta = document.querySelector('meta[name="theme-color"]');
  if(!meta) return;
  const root = document.documentElement;
  const bg = getComputedStyle(root).getPropertyValue('--color-background').trim()
          || getComputedStyle(document.body).getPropertyValue('--bg').trim();
  meta.setAttribute('content', bg || (root.classList.contains('light') ? '#eff1f5' : '#1e1e2e'));
}

/* ═══════════════════════════════════════════════════════════
   App shell — sidebar navigation, page titles, online status
   ═══════════════════════════════════════════════════════════ */
const SHELL_VIEW_MAP = {
  'view-home':    { nav: 'home',    title: 'Home',    sub: 'Your daily companion' },
  'view-cats':    { nav: 'cats',    title: 'Adkar',   sub: 'Fortress of the Muslim' },
  'view-adkar':   { nav: 'cats',    title: 'Adkar',   sub: 'Category collection' },
  'view-favs':    { nav: 'cats',    title: 'Favorites', sub: 'Saved adhkar' },
  'view-fav-books': { nav: 'books', title: 'Favorite books', sub: 'Saved library items' },
  'view-search':  { nav: 'search',  title: 'Search',  sub: 'All adhkar' },
  'view-prayer':  { nav: 'prayer',  title: 'Prayer',  sub: 'Times, countdown and daily cycle' },
  'view-hijri':   { nav: 'hijri',   title: 'Hijri Calendar', sub: 'Islamic dates and events' },
  'view-asma':    { nav: 'asma',    title: '99 Names of Allah', sub: 'Asma al-Husna' },
  'view-books':   { nav: 'books',   title: 'Library', sub: 'Books and reading' },
  'view-tasbih':  { nav: 'tasbih',  title: 'Tasbih',  sub: 'Digital counter' }
};

function updateShellNav(viewId){
  const meta = SHELL_VIEW_MAP[viewId];
  const navKey = meta ? meta.nav : 'home';

  document.querySelectorAll('.side-nav-item[data-nav]').forEach(btn => {
    const on = btn.getAttribute('data-nav') === navKey;
    btn.classList.toggle('active', on);
    if(on) btn.setAttribute('aria-current', 'page');
    else btn.removeAttribute('aria-current');
  });

  const title = document.getElementById('topbar-title');
  const sub   = document.getElementById('topbar-sub');
  if(title) title.textContent = meta ? meta.title : 'Sahib';
  if(sub)   sub.textContent   = meta ? meta.sub   : '';

  document.title = meta && meta.title !== 'Home'
    ? `صاحب · ${meta.title}`
    : 'صاحب · Sahib';
}

function focusGlobalSearch(){
  if(typeof goToAdkarCategories === 'function') goToAdkarCategories();
  setTimeout(() => {
    const input = document.getElementById('search-input');
    if(input){
      input.focus();
      input.select();
    }
  }, 80);
}

function updateSidebarStatus(){
  const dot = document.getElementById('sidebar-status-dot');
  const txt = document.getElementById('sidebar-status-text');
  if(!dot || !txt) return;
  const online = navigator.onLine;
  dot.classList.toggle('offline', !online);
  txt.textContent = online ? 'Local-first · offline ready' : 'Offline · cached content';
}

function initShell(){
  updateShellNav((document.querySelector('.view.active') || {}).id || 'view-home');
  updateSidebarStatus();
  window.addEventListener('online', updateSidebarStatus);
  window.addEventListener('offline', updateSidebarStatus);
}


/* =================================================================
   Floating scroll-to-top button
   - Appears after 300px of scroll
   - Hidden when the session overlay or reader overlay is open
   ================================================================= */
function initScrollTopButton(){
  if(document.getElementById('scroll-top-btn')) return;

  const btn = document.createElement('button');
  btn.id = 'scroll-top-btn';
  btn.className = 'scroll-top-btn';
  btn.setAttribute('aria-label', 'Scroll to top');
  btn.innerHTML = icon('chevron-up', 20);
  document.body.appendChild(btn);

  btn.addEventListener('click', () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });

  let raf = 0;
  function update(){
    raf = 0;
    const y = window.scrollY || window.pageYOffset || 0;
    const sessOpen = document.getElementById('session-overlay')?.classList.contains('open');
    const readOpen = document.querySelector('.reader-overlay.open');
    const show = y > 300 && !sessOpen && !readOpen;
    btn.classList.toggle('show', !!show);
  }
  window.addEventListener('scroll', () => {
    if(!raf) raf = requestAnimationFrame(update);
  }, { passive: true });
  update();
}


/* =================================================================
   History integration
   - pushViewState(name) pushes a state so the OS back button pops it
   - popstate handler invokes the close handler registered for the top state
   - No URL change (uses history.pushState with null url)
   ================================================================= */
var _viewStack = [];

function pushViewState(name){
  _viewStack.push(name);
  try{ history.pushState({ sahibView: name }, ''); }catch(e){}
}

function popViewStateSilently(){
  if(_viewStack.length) _viewStack.pop();
}

window.addEventListener('popstate', function(){
  var name = _viewStack.pop();
  if(!name) return;
  if(name === 'detail' && typeof _closeDetailFromHistory === 'function') _closeDetailFromHistory();
  else if(name === 'session' && typeof _closeSessionFromHistory === 'function') _closeSessionFromHistory();
  else if(name === 'reader' && typeof _closeReaderFromHistory === 'function') _closeReaderFromHistory();
  else if(name === 'adkar' && typeof _closeCatFromHistory === 'function') _closeCatFromHistory();
  else if(name === 'favs' && typeof _closeFavsFromHistory === 'function') _closeFavsFromHistory();
});