'use strict';

const $ = id => document.getElementById(id);

/* Arabic normalization (diacritic + alef-insensitive) */
const AR_DIACRITICS = /[\u064B-\u065F\u0670\u06D6-\u06ED]/g;
const AR_TATWEEL = /\u0640/g;
function normalizeAr(s){
  if(!s) return '';
  return String(s)
    .replace(AR_DIACRITICS, '')
    .replace(AR_TATWEEL, '')
    .replace(/[أإآٱ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ؤ/g, 'و')
    .replace(/ئ/g, 'ي')
    .replace(/ة/g, 'ه')
    .toLowerCase();
}
function normalizeEn(s){
  if(!s) return '';
  return String(s)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}
/** Fuzzy-ish match: query tokens must all appear as substrings */
function fuzzyMatch(haystack, query){
  if(!query) return true;
  const h = haystack;
  const tokens = query.trim().split(/\s+/).filter(Boolean);
  return tokens.every(t => h.includes(t));
}

/* Escape HTML for safe injection */
function esc(s){
  if(s == null) return '';
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/* Toast. Optional second arg: sprite icon name (e.g. 'check'). */
let _toastTimer;
function toast(msg, iconName){
  const t = document.getElementById('toast');
  if(!t) return;
  const ico = (iconName && typeof icon === 'function')
    ? icon(iconName, 14) + ' '
    : '';
  t.innerHTML = ico + esc(msg);
  t.dataset.kind = iconName === 'alert'
    ? 'danger'
    : (iconName === 'check' || iconName === 'check-circle' ? 'success' : 'neutral');
  t.classList.add('show');
  clearTimeout(_toastTimer);
  _toastTimer = setTimeout(() => t.classList.remove('show'), 2800);
}

/* Debounce */
function debounce(fn, wait){
  let t;
  return function(...args){
    clearTimeout(t);
    t = setTimeout(() => fn.apply(this, args), wait);
  };
}

/* SVG progress ring (3-arg form; only caller is js/views/adkar.js) */
function progressRing(pct, color, isDone){
  const r = 14, C = 2 * Math.PI * r;
  const dash = Math.round(C * pct / 100);
  const stroke = isDone ? 'var(--ctp-green)' : color;
  const label = (!isDone && pct > 0) ? pct + '%' : '';
  return `<svg style="transform:rotate(-90deg)" width="36" height="36" viewBox="0 0 36 36">
    <circle cx="18" cy="18" r="${r}" fill="none" stroke="var(--border)" stroke-width="2.5"/>
    ${pct>0 ? `<circle cx="18" cy="18" r="${r}" fill="none" stroke="${stroke}"
      stroke-width="2.5" stroke-dasharray="${dash} ${Math.round(C)}"
      stroke-linecap="round"/>` : ''}
    <text x="18" y="22" text-anchor="middle" fill="${stroke}"
      font-size="8" font-family="Tajawal,sans-serif">${label}</text>
  </svg>`;
}