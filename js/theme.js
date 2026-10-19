'use strict';
/* ==========================================================================
   SAHIB THEME ENGINE
   Applies data-theme / data-mode / data-accent / data-font on <html> and
   keeps the legacy .light class in sync for component CSS that has not yet
   been migrated. Preferences are persisted through the existing store.
   ========================================================================== */
(function () {
  const THEMES = [
    { id: 'catppuccin', label: 'Catppuccin', hint: 'Mocha / Latte' },
    { id: 'aura',       label: 'Aura',       hint: 'Soft neon' },
    { id: 'dracula',    label: 'Dracula',    hint: 'Classic' },
    { id: 'tokyo-night',label: 'Tokyo Night',hint: 'Blue hour' },
    { id: 'rose-pine',  label: 'Rosé Pine',  hint: 'Warm dusk' }
  ];
  const MODES = ['dark', 'light'];
  const ACCENTS = [
    { id: 'gold', label: 'Gold' },
    { id: 'peach', label: 'Peach' },
    { id: 'red', label: 'Red' },
    { id: 'mauve', label: 'Mauve' },
    { id: 'blue', label: 'Blue' },
    { id: 'teal', label: 'Teal' },
    { id: 'green', label: 'Green' },
    { id: 'pink', label: 'Pink' },
    { id: 'sky', label: 'Sky' }
  ];
  const FONTS = [
    { id: 'tajawal', label: 'Tajawal', hint: 'Sahib default' },
    { id: 'cairo',   label: 'Cairo',   hint: 'Modern Arabic' },
    { id: 'inter',   label: 'Inter',   hint: 'Compact Latin' },
    { id: 'system',  label: 'System',  hint: 'Your device' }
  ];

  const THEME_IDS = THEMES.map(t => t.id);
  const ACCENT_IDS = ACCENTS.map(a => a.id);
  const FONT_IDS = FONTS.map(f => f.id);

  const state = {
    theme: 'catppuccin',
    mode: 'dark',
    accent: 'gold',
    font: 'tajawal'
  };

  function normalizeTheme(value) {
    if (value === 'mocha' || value === 'latte') return 'catppuccin';
    if (value === 'tokyo') return 'tokyo-night';
    if (value === 'rosepine') return 'rose-pine';
    return THEME_IDS.includes(value) ? value : 'catppuccin';
  }
  function normalizeMode(value) {
    if (value === 'light' || value === 'latte') return 'light';
    return 'dark';
  }
  function normalizeAccent(value) {
    const legacy = { yellow: 'gold', orange: 'peach', lavender: 'mauve' };
    const id = legacy[value] || value;
    return ACCENT_IDS.includes(id) ? id : 'gold';
  }
  function normalizeFont(value) {
    return FONT_IDS.includes(value) ? value : 'tajawal';
  }

  function apply(next) {
    if (!next) next = {};
    state.theme = normalizeTheme(next.theme || state.theme);
    state.mode = normalizeMode(next.mode || state.mode);
    state.accent = normalizeAccent(next.accent || state.accent);
    state.font = normalizeFont(next.font || state.font);

    const root = document.documentElement;
    root.dataset.theme = state.theme;
    root.dataset.mode = state.mode;
    root.dataset.accent = state.accent;
    root.dataset.font = state.font;
    root.classList.toggle('light', state.mode === 'light');

    /* Legacy CSS and a few inline scripts still read these from <body>. */
    document.body.dataset.accent = state.accent;
    document.body.dataset.theme = state.theme;
    document.body.dataset.mode = state.mode;
    document.body.dataset.font = state.font;
    document.body.classList.toggle('light', state.mode === 'light');

    if (typeof isLight !== 'undefined') isLight = state.mode === 'light';

    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) {
      const bg = getComputedStyle(root).getPropertyValue('--color-background').trim()
              || getComputedStyle(document.body).getPropertyValue('--bg').trim();
      if (bg) meta.setAttribute('content', bg);
    }

    if (typeof updateThemeToggleIcon === 'function') updateThemeToggleIcon();
    if (typeof updateMenuState === 'function') updateMenuState();
    if (typeof updateSettingsUI === 'function') updateSettingsUI();

    window.dispatchEvent(new CustomEvent('sahib:themechange', { detail: { ...state } }));
  }

  async function init() {
    let theme = 'catppuccin';
    let mode = 'dark';
    let accent = 'gold';
    let font = 'tajawal';
    try {
      const [family, savedTheme, savedAccent, savedFont] = await Promise.all([
        store.getMeta('themeFamily'),
        store.getMeta('theme'),
        store.getMeta('accent'),
        store.getMeta('font')
      ]);
      theme = normalizeTheme(family || 'catppuccin');
      mode = normalizeMode(savedTheme || 'dark');
      accent = normalizeAccent(savedAccent || 'gold');
      font = normalizeFont(savedFont || 'tajawal');

      /* One-time migration from the old five-accent names. */
      if (savedAccent && !ACCENT_IDS.includes(savedAccent) && normalizeAccent(savedAccent) !== savedAccent) {
        await store.setMeta('accent', normalizeAccent(savedAccent));
      }
    } catch (err) {
      console.warn('[theme] could not load preferences', err);
    }
    apply({ theme, mode, accent, font });
    return { ...state };
  }

  async function setTheme(theme) {
    state.theme = normalizeTheme(theme);
    apply(state);
    await store.setMeta('themeFamily', state.theme);
  }
  async function setMode(mode) {
    state.mode = normalizeMode(mode);
    apply(state);
    await store.setMeta('theme', state.mode);
  }
  async function setAccent(accent) {
    state.accent = normalizeAccent(accent);
    apply(state);
    await store.setMeta('accent', state.accent);
  }
  async function setFont(font) {
    state.font = normalizeFont(font);
    apply(state);
    await store.setMeta('font', state.font);
  }
  async function toggleMode() {
    await setMode(state.mode === 'light' ? 'dark' : 'light');
  }

  window.SAHIB_THEME = {
    THEMES, MODES, ACCENTS, FONTS,
    state, init, apply,
    setTheme, setMode, setAccent, setFont, toggleMode,
    normalizeTheme, normalizeMode, normalizeAccent, normalizeFont
  };
})();
