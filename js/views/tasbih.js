'use strict';

/* Tasbih view - counter, minus, reset, visual growth, completion, settings */

const TASBIH_PRESETS = [
  { label: 'سُبْحَانَ اللَّهِ وَبِحَمْدِهِ',            repeat: 100 },
  { label: 'سُبْحَانَ اللَّهِ الْعَظِيمِ',             repeat: 100 },
  { label: 'لَا إِلَهَ إِلَّا اللَّهُ',                repeat: 100 },
  { label: 'أَسْتَغْفِرُ اللَّهَ',                      repeat: 100 },
  { label: 'لَا حَوْلَ وَلَا قُوَّةَ إِلَّا بِاللَّهِ', repeat: 100 },
  { label: 'سُبْحَانَ اللَّهِ',                          repeat: 33  },
  { label: 'الْحَمْدُ لِلَّهِ',                          repeat: 33  },
  { label: 'اللَّهُ أَكْبَرُ',                           repeat: 33  }
];

function tasbihColors(){
  const accents = typeof SAHIB_THEME !== 'undefined' ? SAHIB_THEME.accentsForTheme(SAHIB_THEME.state.theme) : [];
  return [{key:'theme',label:'Theme',css:''}, ...accents.map(a => ({key:a.id,label:a.label,css:`var(--accent-${a.id})`}))];
}

let tasbihState = null;

/* ── State ── */
async function _loadTasbihState() {
  if (tasbihState) return tasbihState;
  let stored = null;
  try { stored = await store.getMeta('tasbih'); } catch (e) {}
  tasbihState = Object.assign({
    presetIndex: 0,
    selectedDhikrId: null,
    target: 100,
    customTarget: null,
    count: 0,
    color: 'theme'
  }, stored || {});
  return tasbihState;
}

async function _saveTasbihState() {
  if (!tasbihState) return;
  try {
    await store.setMeta('tasbih', {
      presetIndex: tasbihState.presetIndex,
      selectedDhikrId: tasbihState.selectedDhikrId,
      target: tasbihState.target,
      customTarget: tasbihState.customTarget,
      count: tasbihState.count,
      color: tasbihState.color
    });
  } catch (e) {}
}

/* ── Selection helpers ── */
function _getSelectedDhikr() {
  if (tasbihState.selectedDhikrId !== null && typeof data !== 'undefined' && Array.isArray(data)) {
    const d = data.find(x => x.id === tasbihState.selectedDhikrId);
    if (d) return d;
  }
  if (tasbihState.presetIndex !== null) {
    return TASBIH_PRESETS[tasbihState.presetIndex] || null;
  }
  return null;
}

function _getDhikrText() {
  const d = _getSelectedDhikr();
  if (!d) return '';
  return d.arabic || d.label || '';
}

function _getTargetCount() {
  if (tasbihState.customTarget) return tasbihState.customTarget;
  if (tasbihState.target) return tasbihState.target;
  const d = _getSelectedDhikr();
  if (d && d.repeat) return d.repeat;
  return 100;
}

function _applyColor() {
  const wrap = document.querySelector('.tasbih-wrap');
  if (!wrap) return;
  const choices = tasbihColors();
  const c = choices.find(x => x.key === tasbihState.color) || choices[0];
  if (c.css) {
    const dark = document.documentElement.dataset.mode === 'dark';
    const fill = dark ? c.css : `color-mix(in srgb,${c.css} 62%,#15131d)`;
    wrap.style.setProperty('--tb-accent', fill);
    const on = !dark || (SAHIB_THEME.state.theme === 'rose-pine' && c.key === 'blue') ? '#fff' : 'var(--raw-bg)';
    wrap.style.setProperty('--tb-on', on);
    wrap.style.setProperty('--tb-glow', 'color-mix(in srgb, ' + c.css + ' 40%, transparent)');
  } else {
    wrap.style.removeProperty('--tb-accent');
    wrap.style.removeProperty('--tb-on');
    wrap.style.removeProperty('--tb-glow');
  }
}

/* ── Visuals ── */
function _updateVisuals() {
  if (!tasbihState) return;
  const target = _getTargetCount();
  if (!target || target <= 0) return;
  const progress = Math.min(Math.max(tasbihState.count / target, 0), 1);

  let tier;
  if (target <= 33) tier = 1;
  else if (target <= 100) tier = 2;
  else tier = 3;

  const ringMin = 0.8;
  const ringMax = { 1: 1.0, 2: 1.2, 3: 1.4 }[tier];
  const textMin = 0.8;
  const textMax = { 1: 1.2, 2: 1.4, 3: 1.6 }[tier];

  const ringScale = ringMin + (ringMax - ringMin) * progress;
  const textScale = textMin + (textMax - textMin) * progress;

  const svg = document.querySelector('.tasbih-ring');
  if (svg) svg.style.transform = 'scale(' + ringScale + ')';

  const arc = document.querySelector('.tasbih-ring .tasbih-arc');
  if (arc) {
    const C = 2 * Math.PI * 45;
    arc.style.strokeDashoffset = String(C * (1 - progress));
  }

  const wrap = document.querySelector('.tasbih-wrap');
  if (wrap) {
    wrap.classList.toggle('tasbih-done', progress >= 1);
  }

  const countEl = document.querySelector('.tasbih-count');
  if (countEl) countEl.style.transform = 'scale(' + textScale + ')';

  const dhikrEl = document.querySelector('.tasbih-dhikr');
  if (dhikrEl) dhikrEl.style.transform = 'scale(' + textScale + ')';

  const targetEl = document.querySelector('.tasbih-target');
  if (targetEl) targetEl.textContent = '/ ' + target;
}

function _updateCounter() {
  const el = document.querySelector('.tasbih-count');
  if (el) el.textContent = String(tasbihState.count);
}

function _refreshDhikrDisplay() {
  const el = document.querySelector('.tasbih-dhikr');
  if (el) el.textContent = _getDhikrText();
  const tgt = document.querySelector('.tasbih-target');
  if (tgt) tgt.textContent = '/ ' + _getTargetCount();
}

/* ── Handlers ── */
async function tasbihPlus() {
  const target = _getTargetCount();
  if (tasbihState.count >= target) return;
  tasbihState.count++;
  await _saveTasbihState();
  _updateCounter();
  _updateVisuals();
  if (tasbihState.count >= target) _showCompletion();
}

async function tasbihMinus() {
  if (tasbihState.count <= 0) return;
  tasbihState.count--;
  await _saveTasbihState();
  _updateCounter();
  _updateVisuals();
  _hideCompletion();
}

async function tasbihReset() {
  tasbihState.count = 0;
  await _saveTasbihState();
  _updateCounter();
  _updateVisuals();
  _hideCompletion();
}

/* ── Completion ── */
function _showCompletion() {
  _hideCompletion();
  const center = document.querySelector('.tasbih-center');
  if (!center) return;
  const el = document.createElement('div');
  el.className = 'tasbih-completion';
  el.setAttribute('dir', 'rtl');
  el.textContent = 'مكتمل';
  center.appendChild(el);
  void el.offsetWidth;
  el.classList.add('show');
}

function _hideCompletion() {
  const el = document.querySelector('.tasbih-completion');
  if (!el) return;
  el.classList.remove('show');
  setTimeout(() => { if (el.parentNode) el.parentNode.removeChild(el); }, 300);
}

/* ── DOM builder ── */
function _buildTasbih() {
  const wrap = document.createElement('div');
  wrap.className = 'tasbih-wrap';

  const settingsBtn = document.createElement('button');
  settingsBtn.className = 'tasbih-settings-btn';
  settingsBtn.setAttribute('aria-label', 'Settings');
  settingsBtn.innerHTML = icon('settings', 18);
  settingsBtn.onclick = openTasbihSettings;
  wrap.appendChild(settingsBtn);

  const ringWrap = document.createElement('div');
  ringWrap.className = 'tasbih-ring-wrap';

  const svgNS = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(svgNS, 'svg');
  svg.setAttribute('viewBox', '0 0 100 100');
  svg.setAttribute('class', 'tasbih-ring');

  const bg = document.createElementNS(svgNS, 'circle');
  bg.setAttribute('cx', '50');
  bg.setAttribute('cy', '50');
  bg.setAttribute('r', '45');
  bg.setAttribute('fill', 'none');
  bg.setAttribute('stroke', 'var(--border)');
  bg.setAttribute('stroke-width', '10');
  svg.appendChild(bg);

  const arc = document.createElementNS(svgNS, 'circle');
  arc.setAttribute('cx', '50');
  arc.setAttribute('cy', '50');
  arc.setAttribute('r', '45');
  arc.setAttribute('fill', 'none');
  arc.setAttribute('stroke', 'var(--tb-accent, var(--accent))');
  arc.setAttribute('stroke-width', '10');
  arc.setAttribute('stroke-linecap', 'round');
  arc.setAttribute('stroke-dasharray', '283');
  arc.setAttribute('stroke-dashoffset', '283');
  arc.setAttribute('transform', 'rotate(-90 50 50)');
  arc.setAttribute('class', 'tasbih-arc');
  svg.appendChild(arc);

  ringWrap.appendChild(svg);

  const center = document.createElement('div');
  center.className = 'tasbih-center';

  const count = document.createElement('div');
  count.className = 'tasbih-count';
  count.textContent = String(tasbihState.count);
  count.title = 'Tap to set count';
  count.style.cursor = 'pointer';
  count.onclick = function () {
    if (count.dataset.editing === '1') return;
    count.dataset.editing = '1';

    const original = String(tasbihState.count);
    const inp = document.createElement('input');
    inp.type = 'number';
    inp.className = 'tasbih-count-input';
    inp.value = original;
    inp.min = '0';
    inp.max = '100000';
    count.replaceWith(inp);
    inp.focus();
    inp.select();

    let done = false;
    const finish = async function (commit) {
      if (done) return;
      done = true;
      if (commit) {
        const v = parseInt(inp.value, 10);
        if (!isNaN(v) && v >= 0) {
          tasbihState.count = v;
          await _saveTasbihState();
        }
      }
      count.dataset.editing = '0';
      count.textContent = String(tasbihState.count);
      if (inp.parentNode) inp.replaceWith(count);
      _updateCounter();
      _updateVisuals();
      if (tasbihState.count >= _getTargetCount()) _showCompletion();
      else _hideCompletion();
    };

    inp.onblur = function () { finish(true); };
    inp.onkeydown = function (e) {
      if (e.key === 'Enter') { e.preventDefault(); finish(true); }
      else if (e.key === 'Escape') { e.preventDefault(); finish(false); }
    };
  };

  const dhikr = document.createElement('div');
  dhikr.className = 'tasbih-dhikr';
  dhikr.setAttribute('dir', 'rtl');
  dhikr.textContent = _getDhikrText();

  const target = document.createElement('div');
  target.className = 'tasbih-target';
  target.textContent = '/ ' + _getTargetCount();

  center.appendChild(count);
  center.appendChild(dhikr);
  center.appendChild(target);
  ringWrap.appendChild(center);
  wrap.appendChild(ringWrap);

  const tapBtn = document.createElement('button');
  tapBtn.className = 'tasbih-tap-btn';
  tapBtn.setAttribute('aria-label', 'Increment');
  tapBtn.innerHTML = icon('plus', 36);
  tapBtn.onclick = tasbihPlus;
  wrap.appendChild(tapBtn);

  const actions = document.createElement('div');
  actions.className = 'tasbih-actions';

  const minusBtn = document.createElement('button');
  minusBtn.className = 'tasbih-minus-btn';
  minusBtn.setAttribute('aria-label', 'Decrement');
  minusBtn.innerHTML = icon('minus', 22);
  minusBtn.onclick = tasbihMinus;

  const resetBtn = document.createElement('button');
  resetBtn.className = 'tasbih-reset-btn';
  resetBtn.setAttribute('aria-label', 'Reset');
  resetBtn.innerHTML = icon('rotate-ccw', 22);
  resetBtn.onclick = tasbihReset;

  actions.appendChild(minusBtn);
  actions.appendChild(resetBtn);
  wrap.appendChild(actions);

  return wrap;
}

/* ── View entry ── */
async function openTasbihView() {
  await _loadTasbihState();
  if (typeof showView === 'function') showView('view-tasbih');

  const container =
    document.getElementById('tasbih-body') ||
    document.querySelector('#view-tasbih .tasbih-body') ||
    document.querySelector('#view-tasbih');

  if (!container) {
    console.error('[tasbih] container not found');
    return;
  }

  container.innerHTML = '';
  container.appendChild(_buildTasbih());
  _applyColor();
  _updateVisuals();
  _updateCounter();
}

function closeTasbihView() {
  if (typeof goHome === 'function') goHome();
}

/* ── Settings ── */
function openTasbihSettings() {
  const old = document.getElementById('ov-tasbih-settings');
  if (old) old.remove();

  const ov = document.createElement('div');
  ov.className = 'ov center';
  ov.id = 'ov-tasbih-settings';
  ov.onclick = function (e) { if (e.target === ov) closeTasbihSettings(); };

  const box = document.createElement('div');
  box.className = 'modal-box';

  const head = document.createElement('div');
  head.className = 'mh';

  const title = document.createElement('h2');
  title.textContent = 'Tasbih Settings';

  const closeBtn = document.createElement('button');
  closeBtn.className = 'btn-close';
  closeBtn.setAttribute('aria-label', 'Close');
  closeBtn.innerHTML = icon('x', 15);
  closeBtn.onclick = closeTasbihSettings;

  head.appendChild(title);
  head.appendChild(closeBtn);
  box.appendChild(head);

  const body = document.createElement('div');
  body.className = 'mb';
  body.appendChild(_buildDhikrSection());
  body.appendChild(_buildTargetSection());
  body.appendChild(_buildColorSection());
  box.appendChild(body);

  const footer = document.createElement('div');
  footer.className = 'mf';
  const okBtn = document.createElement('button');
  okBtn.className = 'btn-save';
  okBtn.textContent = 'OK';
  okBtn.onclick = closeTasbihSettings;
  footer.appendChild(okBtn);
  box.appendChild(footer);

  ov.appendChild(box);
  document.body.appendChild(ov);
  requestAnimationFrame(() => ov.classList.add('open'));
  document.body.classList.add('modal-open');
}

function closeTasbihSettings() {
  const ov = document.getElementById('ov-tasbih-settings');
  if (!ov) return;
  ov.classList.remove('open');
  document.body.classList.remove('modal-open');
  setTimeout(() => ov.remove(), 250);

  _applyColor();
  _refreshDhikrDisplay();
  _updateCounter();
  _updateVisuals();
}

function _rebuildSettingsBody() {
  const ov = document.getElementById('ov-tasbih-settings');
  if (!ov) return;
  const body = ov.querySelector('.mb');
  if (!body) return;
  body.innerHTML = '';
  body.appendChild(_buildDhikrSection());
  body.appendChild(_buildTargetSection());
  body.appendChild(_buildColorSection());
}

function _buildDhikrSection() {
  const sec = document.createElement('div');
  sec.className = 'tasbih-section';

  const lbl = document.createElement('div');
  lbl.className = 'tasbih-section-label';
  lbl.textContent = 'Dhikr';
  sec.appendChild(lbl);

  const chips = document.createElement('div');
  chips.className = 'tasbih-chips';

  TASBIH_PRESETS.forEach((p, i) => {
    const chip = document.createElement('button');
    chip.type = 'button';
    chip.className = 'tasbih-chip';
    chip.textContent = p.label;
    if (tasbihState.presetIndex === i && tasbihState.selectedDhikrId === null) chip.classList.add('on');
    chip.onclick = async () => {
      tasbihState.presetIndex = i;
      tasbihState.selectedDhikrId = null;
      tasbihState.customTarget = null;
      tasbihState.target = p.repeat || 100;
      tasbihState.count = 0;
      await _saveTasbihState();
      _refreshDhikrDisplay();
      _updateCounter();
      _updateVisuals();
      _rebuildSettingsBody();
    };
    chips.appendChild(chip);
  });

  sec.appendChild(chips);
  return sec;
}

function _buildTargetSection() {
  const sec = document.createElement('div');
  sec.className = 'tasbih-section';

  const lbl = document.createElement('div');
  lbl.className = 'tasbih-section-label';
  lbl.textContent = 'Target';
  sec.appendChild(lbl);

  const chips = document.createElement('div');
  chips.className = 'tasbih-chips';

  const current = _getTargetCount();
  [33, 99, 100].forEach(n => {
    const chip = document.createElement('button');
    chip.type = 'button';
    chip.className = 'tasbih-chip';
    chip.textContent = String(n);
    if (current === n && !tasbihState.customTarget) chip.classList.add('on');
    chip.onclick = async () => {
      tasbihState.customTarget = null;
      tasbihState.target = n;
      tasbihState.count = 0;
      await _saveTasbihState();
      _refreshDhikrDisplay();
      _updateCounter();
      _updateVisuals();
      _rebuildSettingsBody();
    };
    chips.appendChild(chip);
  });

  sec.appendChild(chips);

  const input = document.createElement('input');
  input.type = 'number';
  input.className = 'tasbih-custom-input';
  input.placeholder = 'Custom';
  input.min = '1';
  input.max = '10000';
  if (tasbihState.customTarget) input.value = tasbihState.customTarget;
  input.onchange = async () => {
    const v = parseInt(input.value, 10);
    if (v > 0) {
      tasbihState.customTarget = v;
      tasbihState.count = 0;
      await _saveTasbihState();
      _refreshDhikrDisplay();
      _updateCounter();
      _updateVisuals();
      _rebuildSettingsBody();
    }
  };
  sec.appendChild(input);

  return sec;
}

function _buildColorSection() {
  const sec = document.createElement('div');
  sec.className = 'tasbih-section';

  const lbl = document.createElement('div');
  lbl.className = 'tasbih-section-label';
  lbl.textContent = 'Color';
  sec.appendChild(lbl);

  const colors = document.createElement('div');
  colors.className = 'tasbih-colors';

  tasbihColors().forEach(c => {
    const chip = document.createElement('button');
    chip.type = 'button';
    chip.className = 'tasbih-color tasbih-color-' + c.key;
    chip.setAttribute('aria-label', c.label);
    chip.style.background = c.css || 'var(--color-accent)';
    if (tasbihState.color === c.key) chip.classList.add('on');
    chip.onclick = async () => {
      tasbihState.color = c.key;
      await _saveTasbihState();
      _applyColor();
      _rebuildSettingsBody();
    };
    colors.appendChild(chip);
  });

  sec.appendChild(colors);
  return sec;
}

window.openTasbihView = openTasbihView;
window.closeTasbihView = closeTasbihView;
window.openTasbihSettings = openTasbihSettings;
window.closeTasbihSettings = closeTasbihSettings;
window.tasbihPlus = tasbihPlus;
window.tasbihMinus = tasbihMinus;
window.tasbihReset = tasbihReset;
window.addEventListener('sahib:themechange', () => {
  if(tasbihState) _applyColor();
});
