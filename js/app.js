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

    /* 1a. Daily Practice lives in the existing meta store. Loading it here
       keeps Home and the practice view on the same local snapshot. */
    if (typeof SahibPractice !== 'undefined' && SahibPractice.init) {
      await SahibPractice.init();
    }

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

    await SAHIB_I18N.init();

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

        const confirm = document.getElementById('ov-confirm');
        if(confirm && confirm.classList.contains('open') && typeof closeConfirm === 'function') closeConfirm();

        const editCat = document.getElementById('ov-editcat');
        if(editCat && editCat.classList.contains('open') && typeof closeEditCat === 'function') closeEditCat();

        const cats = document.getElementById('ov-cats');
        if(cats && cats.classList.contains('open') && typeof closeCatMgr === 'function') closeCatMgr();

        const form = document.getElementById('ov-form');
        if(form && form.classList.contains('open') && typeof closeForm === 'function') closeForm();

        const detail = document.getElementById('ov-detail');
        if(detail && detail.classList.contains('open') && typeof closeDetail === 'function') closeDetail();

        /* Practice overlays are created dynamically; close the topmost one. */
        const practiceOverlays = ['ov-practice-reminders','ov-practice-settings','ov-practice-form','ov-practice-detail'];
        for (const id of practiceOverlays) {
          const el = document.getElementById(id);
          if(el && el.classList.contains('open')){
            if(id === 'ov-practice-detail' && typeof closePracticeDetail === 'function') closePracticeDetail();
            else if(id === 'ov-practice-form' && typeof closePracticeForm === 'function') closePracticeForm();
            else if(id === 'ov-practice-settings' && typeof closePracticeSettings === 'function') closePracticeSettings();
            else if(id === 'ov-practice-reminders' && typeof closePracticeReminders === 'function') closePracticeReminders();
            break;
          }
        }
      }

      if(e.key === 'Tab'){
        const openOverlays = [...document.querySelectorAll('.ov.open')];
        const modal = openOverlays.length
          ? openOverlays[openOverlays.length - 1]
          : document.querySelector('.session-overlay.open');
        if(!modal) return;
        const focusables = [...modal.querySelectorAll('a[href], button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex="-1"])')]
          .filter(el => !el.hidden && el.getClientRects().length > 0);
        if(!focusables.length) return;
        const first = focusables[0];
        const last = focusables[focusables.length - 1];
        const active = document.activeElement;
        if(!modal.contains(active)){
          e.preventDefault();
          first.focus();
        } else if(e.shiftKey && active === first){
          e.preventDefault();
          last.focus();
        } else if(!e.shiftKey && active === last){
          e.preventDefault();
          first.focus();
        }
      }
    });

    /* 7. Standalone-mode class */
    const isStandalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      window.navigator.standalone === true;
    if(isStandalone) document.documentElement.classList.add('pwa-standalone');

    /* Apply installed shortcuts only after IndexedDB, language and shell are ready. */
    const shortcut = new URLSearchParams(location.search);
    if(shortcut.get('cat')) openCat(shortcut.get('cat'));
    else if(shortcut.get('favs')) toggleFavsView();
    window.dispatchEvent(new Event('sahib:ready'));

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

  /* Standalone data-icon slots (sidebar collapse, page actions, etc.) */
  document.querySelectorAll('[data-icon]').forEach(el => {
    if(el.dataset.injected === '1' || el.children.length > 0) return;
    const name = el.getAttribute('data-icon');
    if(name){
      el.innerHTML = icon(name, 18);
      el.dataset.injected = '1';
    }
  });
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
  'view-practice': { nav: 'practice', title: 'Daily Practice', sub: 'A local daybook of chosen routines' },
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

  document.querySelectorAll('[data-mobile-nav]').forEach(btn => {
    const active = btn.dataset.mobileNav === navKey;
    if(active) btn.setAttribute('aria-current','page');
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

function focusGlobalSearch(){ openAppSearch(); }

function updateSidebarStatus(){
  const dot = document.getElementById('sidebar-status-dot');
  const txt = document.getElementById('sidebar-status-text');
  if(!dot || !txt) return;
  const online = navigator.onLine;
  dot.classList.toggle('offline', !online);
  txt.textContent = online ? 'Local-first · offline ready' : 'Offline · cached content';
}

function initShell(){
  initAccessibleActions();
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
/* Legacy clickable cards receive the same keyboard behavior as their buttons.
   Keep religious content and click handlers intact. */
function initAccessibleActions(){
  if(window._sahibAccessibleActions) return;
  window._sahibAccessibleActions = true;
  function enhance(root){
    const targets = [];
    if(root.matches && root.matches('[onclick],.tasbih-count')) targets.push(root);
    if(root.querySelectorAll) targets.push(...root.querySelectorAll('[onclick],.tasbih-count'));
    targets.forEach(el => {
      if(el.matches('button,a,input,textarea,select,label,svg,path,body,.ov,.menu-overlay,.session-overlay') || el.closest('button')) return;
      if(/^event\.stopPropagation\(\);?$/.test((el.getAttribute('onclick')||'').trim())) return;
      if(!el.hasAttribute('tabindex')) el.tabIndex = 0;
      if(!el.hasAttribute('role')) el.setAttribute('role','button');
      el.dataset.keyboardAction = 'true';
    });
  }
  enhance(document.body);
  const focusOrigins = new WeakMap();
  function modalChanged(el){
    if(!el.matches('.ov,.session-overlay,.reader-overlay,.flash-overlay')) return;
    if(el.classList.contains('open')){
      if(focusOrigins.has(el)) return;
      const origin = document.activeElement;
      focusOrigins.set(el,{node:origin,id:origin.id,action:origin.getAttribute('onclick')});
      requestAnimationFrame(() => {
        if(!el.classList.contains('open')) return;
        const target = el.querySelector('[data-autofocus],[autofocus]') || [...el.querySelectorAll('button:not(:disabled),input:not(:disabled)')]
          .find(node => node.getClientRects().length && getComputedStyle(node).visibility !== 'hidden');
        if(target) target.focus({preventScroll:true});
      });
    }else{
      const saved = focusOrigins.get(el);
      focusOrigins.delete(el);
      if(!saved || !(el.contains(document.activeElement) || document.activeElement===document.body)) return;
      const origin = saved.node.isConnected ? saved.node : saved.id ? document.getElementById(saved.id)
        : [...document.querySelectorAll('[onclick]')].find(node => node.getAttribute('onclick')===saved.action);
      if(origin) requestAnimationFrame(() => origin.isConnected && origin.focus({preventScroll:true}));
    }
  }
  new MutationObserver(records => {
    records.forEach(record => {
      if(record.type==='attributes') modalChanged(record.target);
      else record.addedNodes.forEach(node => {if(node.nodeType===1){enhance(node);modalChanged(node);}});
    });
  }).observe(document.body,{childList:true,subtree:true,attributes:true,attributeFilter:['class']});
  document.addEventListener('keydown',event=>{
    const el=event.target;
    if(el.dataset && el.dataset.keyboardAction==='true' && (event.key==='Enter'||event.key===' ')){
      event.preventDefault();el.click();
    }
  });
}
