'use strict';
/* ==========================================================================
   SAHIB THEME ENGINE
   Applies data-theme / data-mode / data-accent / data-font on <html> and
   keeps the legacy .light class in sync for component CSS that has not yet
   been migrated. Preferences are persisted through the existing store.
   ========================================================================== */
(function () {
  const THEMES = [
    { id: 'sahib',      label: 'Sahib',      hint: 'Courtyard & sage' },
    { id: 'catppuccin', label: 'Catppuccin', hint: 'Mocha / Latte' },
    { id: 'aura',       label: 'Aura',       hint: 'Soft neon' },
    { id: 'dracula',    label: 'Dracula',    hint: 'Classic' },
    { id: 'tokyo-night',label: 'Tokyo Night',hint: 'Blue hour' },
    { id: 'rose-pine',  label: 'Rosé Pine',  hint: 'Warm dusk' }
  ];
  const MODES = ['dark', 'light'];

  /* Accent IDs stay stable so saved preferences survive theme changes. The
     labels and colours are owned by each family — there is no global accent
     palette beyond this fallback list. */
  const ACCENTS = [
    { id: 'gold', label: 'Brass' },
    { id: 'peach', label: 'Peach' },
    { id: 'red', label: 'Rose' },
    { id: 'mauve', label: 'Mauve' },
    { id: 'blue', label: 'Blue' },
    { id: 'teal', label: 'Teal' },
    { id: 'green', label: 'Sage' },
    { id: 'pink', label: 'Pink' },
    { id: 'sky', label: 'Sky' }
  ];
  const ACCENT_SETS = {
    sahib: { green:'Sage', gold:'Brass', peach:'Clay', red:'Madder', mauve:'Plum', blue:'Indigo', teal:'Verdigris', pink:'Rosewood', sky:'Faience' },
    catppuccin: { gold:'Yellow', peach:'Peach', red:'Red', mauve:'Mauve', blue:'Blue', teal:'Teal', green:'Green', pink:'Pink', sky:'Sky' },
    aura: { mauve:'Purple', teal:'Green', gold:'Orange', red:'Red', pink:'Pink', sky:'Blue' },
    dracula: { mauve:'Purple', pink:'Pink', teal:'Cyan', green:'Green', gold:'Yellow', peach:'Orange', red:'Red' },
    'tokyo-night': { blue:'Blue', mauve:'Magenta', sky:'Cyan', teal:'Teal', green:'Green', gold:'Yellow', peach:'Orange', red:'Red' },
    'rose-pine': { pink:'Rose', mauve:'Iris', teal:'Foam', blue:'Pine', gold:'Gold', red:'Love' }
  };
  const DEFAULT_ACCENTS = { sahib:'green', catppuccin:'mauve', aura:'mauve', dracula:'mauve', 'tokyo-night':'blue', 'rose-pine':'pink' };
  let familyAccents = {};

  const THEME_FONTS = {sahib:'tajawal',aura:'dm-sans',dracula:'inter',catppuccin:'manrope','rose-pine':'amiri','tokyo-night':'cairo'};
  const FONTS = [
    {id:'tajawal',label:'Tajawal',hint:'Sahib'},
    {id:'dm-sans',label:'DM Sans',hint:'Aura'},
    {id:'inter',label:'Inter',hint:'Dracula'},
    {id:'manrope',label:'Manrope',hint:'Catppuccin'},
    {id:'amiri',label:'Amiri',hint:'Rosé Pine'},
    {id:'cairo',label:'Cairo',hint:'Tokyo Night'}
  ];
  let fontFollowsTheme = true;

  const THEME_IDS = THEMES.map(t => t.id);
  const ACCENT_IDS = ACCENTS.map(a => a.id);
  const FONT_IDS = FONTS.map(f => f.id);
  const SIDEBAR_POSITIONS = ['left', 'right'];

  const state = {
    theme: 'sahib',
    mode: 'light',
    accent: 'green',
    font: 'tajawal',
    sidebarPosition: 'left',
    sidebarCollapsed: false
  };

  function normalizeTheme(value) {
    if (value === 'mocha' || value === 'latte') return 'catppuccin';
    if (value === 'tokyo') return 'tokyo-night';
    if (value === 'rosepine') return 'rose-pine';
    return THEME_IDS.includes(value) ? value : 'sahib';
  }
  function normalizeMode(value) {
    if (value === 'light' || value === 'latte') return 'light';
    if (value === 'dark' || value === 'mocha') return 'dark';
    return 'light';
  }
  function normalizeAccent(value) {
    const legacy = { yellow: 'gold', orange: 'peach', lavender: 'mauve' };
    const id = legacy[value] || value;
    return ACCENT_IDS.includes(id) ? id : 'gold';
  }
  function normalizeFont(value) {
    return FONT_IDS.includes(value) ? value : 'tajawal';
  }
  function normalizeSidebarPosition(value) {
    return SIDEBAR_POSITIONS.includes(value) ? value : 'right';
  }

  function accentsForTheme(theme) {
    const family = normalizeTheme(theme || state.theme);
    const labels = ACCENT_SETS[family] || {};
    return Object.entries(labels).map(([id,label]) => ({id,label}));
  }

  function _syncShellControls() {
    const btn = document.getElementById('sidebar-collapse-btn');
    if (btn) {
      const collapsed = !!state.sidebarCollapsed;
      btn.setAttribute('aria-expanded', collapsed ? 'false' : 'true');
      btn.setAttribute('aria-label', collapsed ? 'Expand sidebar' : 'Collapse sidebar');
      btn.setAttribute('title', collapsed ? 'Expand sidebar' : 'Collapse sidebar');
      btn.classList.toggle('is-collapsed', collapsed);
    }
    const menuBtn = document.getElementById('btn-menu');
    if (menuBtn) {
      menuBtn.setAttribute('aria-label', 'Open navigation menu');
    }
  }

  function apply(next) {
    if (!next) next = {};
    state.theme = normalizeTheme(next.theme || state.theme);
    state.mode = normalizeMode(next.mode || state.mode);
    state.accent = normalizeAccent(next.accent || state.accent);
    if(!ACCENT_SETS[state.theme][state.accent]) state.accent = DEFAULT_ACCENTS[state.theme];
    state.font = normalizeFont(next.font || state.font);
    if (next.sidebarPosition) state.sidebarPosition = normalizeSidebarPosition(next.sidebarPosition);
    if (typeof next.sidebarCollapsed === 'boolean') state.sidebarCollapsed = next.sidebarCollapsed;

    const root = document.documentElement;
    root.dataset.theme = state.theme;
    root.dataset.mode = state.mode;
    root.dataset.accent = state.accent;
    root.dataset.font = state.font;
    root.dataset.fontSource = fontFollowsTheme ? 'theme' : 'custom';
    root.dataset.sidebarPosition = state.sidebarPosition;
    root.dataset.sidebarCollapsed = state.sidebarCollapsed ? 'true' : 'false';
    root.classList.toggle('light', state.mode === 'light');

    /* Legacy CSS and a few inline scripts still read these from <body>. */
    document.body.dataset.accent = state.accent;
    document.body.dataset.theme = state.theme;
    document.body.dataset.mode = state.mode;
    document.body.dataset.font = state.font;
    document.body.dataset.sidebarPosition = state.sidebarPosition;
    document.body.dataset.sidebarCollapsed = state.sidebarCollapsed ? 'true' : 'false';
    document.body.classList.toggle('light', state.mode === 'light');

    if (typeof isLight !== 'undefined') isLight = state.mode === 'light';

    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) {
      const bg = getComputedStyle(root).getPropertyValue('--color-background').trim()
              || getComputedStyle(document.body).getPropertyValue('--bg').trim();
      if (bg) meta.setAttribute('content', bg);
    }

    _syncShellControls();
    if (typeof updateThemeToggleIcon === 'function') updateThemeToggleIcon();
    if (typeof updateMenuState === 'function') updateMenuState();
    if (typeof updateSettingsUI === 'function') updateSettingsUI();

    window.dispatchEvent(new CustomEvent('sahib:themechange', { detail: { ...state } }));
  }

  async function init() {
    let theme = 'sahib';
    let mode = 'light';
    let accent = 'green';
    let font = 'tajawal';
    let sidebarPosition = 'left';
    let sidebarCollapsed = false;
    try {
      const [family, savedTheme, savedAccent, savedFont, savedPosition, savedCollapsed] = await Promise.all([
        store.getMeta('themeFamily'),
        store.getMeta('theme'),
        store.getMeta('accent'),
        store.getMeta('font'),
        store.getMeta('sidebarPosition'),
        store.getMeta('sidebarCollapsed')
      ]);
      theme = normalizeTheme(family || 'sahib');
      mode = normalizeMode(savedTheme || 'light');
      accent = normalizeAccent(savedAccent || DEFAULT_ACCENTS[theme]);
      familyAccents = await store.getMeta('themeAccents') || {};
      const follows = await store.getMeta('fontFollowsTheme');
      fontFollowsTheme = follows == null ? !savedFont || savedFont==='tajawal' : follows !== false;
      font = fontFollowsTheme ? THEME_FONTS[theme] : normalizeFont(savedFont);
      sidebarPosition = normalizeSidebarPosition(savedPosition || 'left');
      sidebarCollapsed = savedCollapsed === true;

      /* One-time migration from the old five-accent names. */
      if (savedAccent && !ACCENT_IDS.includes(savedAccent) && normalizeAccent(savedAccent) !== savedAccent) {
        await store.setMeta('accent', normalizeAccent(savedAccent));
      }
    } catch (err) {
      console.warn('[theme] could not load preferences', err);
    }
    apply({ theme, mode, accent, font, sidebarPosition, sidebarCollapsed });
    return { ...state };
  }

  async function setTheme(theme) {
    familyAccents[state.theme] = state.accent;
    state.theme = normalizeTheme(theme);
    if(fontFollowsTheme) state.font = THEME_FONTS[state.theme];
    state.accent = familyAccents[state.theme] || DEFAULT_ACCENTS[state.theme];
    apply(state);
    await Promise.all([store.setMeta('themeFamily', state.theme), store.setMeta('accent', state.accent), store.setMeta('themeAccents', {...familyAccents})]);
  }
  async function setMode(mode) {
    state.mode = normalizeMode(mode);
    apply(state);
    await store.setMeta('theme', state.mode);
  }
  async function setAccent(accent) {
    state.accent = normalizeAccent(accent);
    apply(state);
    familyAccents[state.theme] = state.accent;
    await Promise.all([store.setMeta('accent', state.accent), store.setMeta('themeAccents', {...familyAccents})]);
  }
  async function setFont(font) {
    fontFollowsTheme = font === 'theme';
    state.font = fontFollowsTheme ? THEME_FONTS[state.theme] : normalizeFont(font);
    apply(state);
    await Promise.all([store.setMeta('font', state.font),store.setMeta('fontFollowsTheme',fontFollowsTheme)]);
  }
  async function setSidebarPosition(position) {
    state.sidebarPosition = normalizeSidebarPosition(position);
    apply(state);
    await store.setMeta('sidebarPosition', state.sidebarPosition);
  }
  async function setSidebarCollapsed(collapsed) {
    state.sidebarCollapsed = !!collapsed;
    apply(state);
    await store.setMeta('sidebarCollapsed', state.sidebarCollapsed);
  }
  async function toggleSidebarCollapsed(force) {
    const next = typeof force === 'boolean' ? force : !state.sidebarCollapsed;
    await setSidebarCollapsed(next);
    return state.sidebarCollapsed;
  }
  async function toggleMode() {
    await setMode(state.mode === 'light' ? 'dark' : 'light');
  }

  window.SAHIB_THEME = {
    THEMES, MODES, ACCENTS, ACCENT_SETS, FONTS, THEME_FONTS,
    state, init, apply, accentsForTheme,
    setTheme, setMode, setAccent, setFont, setSidebarPosition, setSidebarCollapsed,
    toggleSidebarCollapsed, toggleMode,
    normalizeTheme, normalizeMode, normalizeAccent, normalizeFont, normalizeSidebarPosition
  };

  window.toggleSidebarCollapse = function () {
    if (window.SAHIB_THEME && typeof window.SAHIB_THEME.toggleSidebarCollapsed === 'function') {
      return window.SAHIB_THEME.toggleSidebarCollapsed();
    }
  };
})();
