'use strict';

/* =================================================================
   Adkar list view
   Uses `categories: []` (array) and `tags: []`.
   `currentCat` filtering is done via categories.includes().
   ================================================================= */

/* Per-category subcategory (tag) filter */
let _tagFilters = {};

function _catItems(catKey){
return data.filter(d =>
Array.isArray(d.categories) && d.categories.includes(catKey)
);
}

function _tagLabel(tag){
if(!tag) return '';
if(typeof HISN_TAGS !== 'undefined' && HISN_TAGS[tag]){
return HISN_TAGS[tag].ar + ' · ' + HISN_TAGS[tag].en;
}
return tag;
}

function setTagFilter(tag){
_tagFilters[currentCat] = tag || null;
renderAdkarGrid();
}

function _subcatsFor(catKey){
const table = (typeof ADHKAR_SUBCATS !== 'undefined' && ADHKAR_SUBCATS) ? ADHKAR_SUBCATS[catKey] : null;
return Array.isArray(table) ? table : [];
}

function _subcatCount(catKey, subKey){
const tag = catKey + ':' + subKey;
return _catItems(catKey).filter(d => Array.isArray(d.tags) && d.tags.indexOf(tag) > -1).length;
}

function _subcatLabel(catKey, subKey){
if(typeof ADHKAR_SUBCAT_LABEL === 'function'){
const l = ADHKAR_SUBCAT_LABEL(catKey, subKey);
if(l) return l.ar + ' · ' + l.en;
}
return subKey;
}

function renderTagFilterRow(catKey){
const subs = _subcatsFor(catKey);
if(!subs.length) return '';
const active = _tagFilters[catKey] || null;
const total = _catItems(catKey).length;
const chips = [];

const allOn = !active;
chips.push(`<button class="filter-chip tag ${allOn ? 'on' : ''}" onclick="setTagFilter('')">الكل · All <span class="chip-count">${total}</span></button>`);

subs.forEach(s => {
const n = _subcatCount(catKey, s.key);
if(n === 0) return;
const on = active === s.key;
const label = s.ar + ' · ' + s.en;
chips.push(`<button class="filter-chip tag ${on ? 'on' : ''}" onclick="setTagFilter('${s.key}')">${label} <span class="chip-count">${n}</span></button>`);
});

return `<div class="adkar-tagbar">${chips.join('')}</div>`;
}

function renderAdkarGrid(){
const catKey = currentCat;
let items = _catItems(catKey);
const active = _tagFilters[catKey] || null;
if(active){
const subtag = catKey + ':' + active;
items = items.filter(d => Array.isArray(d.tags) && d.tags.indexOf(subtag) > -1);
}
const g = $('adkar-grid');
if(!items.length){
g.innerHTML = `<div class="adkar-empty"> <div class="adkar-empty-icon">${icon('beads', 40)}</div> <div>No adkar here yet.</div> </div>`;
return;
}
/* Group by the entry's subtag inside this bucket (falls back to "Other"). */
function _entrySubtag(d, ck){
if(!Array.isArray(d.tags)) return '';
const prefix = ck + ':';
for(let i = 0; i < d.tags.length; i++){
const t = d.tags[i];
if(typeof t === 'string' && t.indexOf(prefix) === 0) return t.slice(prefix.length);
}
return '';
}
const groups = new Map();
items.forEach(d => {
const key = _entrySubtag(d, catKey) || '';
if(!groups.has(key)) groups.set(key, []);
groups.get(key).push(d);
});
let html = renderTagFilterRow(catKey);
groups.forEach((list, key) => {
if(groups.size > 1){
const label = key ? _subcatLabel(catKey, key) : 'أخرى · Other';
html += `<div class="adkar-group-head"><span>${label}</span><span class="adkar-group-count">${list.length}</span></div>`;
}
html += list.map(d => adkarCardHTML(d, getCat(catKey))).join('');
});
g.innerHTML = html;
}

function adkarCardHTML(d, catObj){
  const catKey = catObj ? catObj.key
                        : (Array.isArray(d.categories) ? d.categories[0] : null);
  const cat = catObj || getCat(catKey);

  const k = `c_${d.id}`;
  const cur = counters[k] || 0;
  const pct = Math.min(100, Math.round(cur / d.repeat * 100));
  const isDone = cur >= d.repeat;
  const isFav = favs.includes(d.id);

  const relBadge = d.reliability
    ? `<span class="badge badge-${d.reliability}">${icon(REL_ICON[d.reliability], 12)} ${REL_LABEL[d.reliability]}</span>`
    : '';

  /* Transliteration intentionally not shown on cards.
     It is available in the detail modal behind the AR/EN toggle. */

  const catChips = catObj ? '' : renderCatChips(d.categories);

  const html = `<div class="adkar-card ${isFav?'fav-glow':''}" style="--cc:${cat.color}" onclick="openDetail(${d.id})">
    <div class="adkar-left">
      ${d.situation ? `<div class="adkar-situation">${d.situation}</div>` : ''}
      <div class="adkar-text">${d.arabic.length > 110 ? d.arabic.slice(0,110)+'...' : d.arabic}</div>
      <div class="adkar-badges">
        ${catChips}
        <span class="badge badge-repeat">× ${d.repeat}</span>
        ${relBadge}
      </div>
    </div>
    <div class="adkar-meta">${progressRing(pct, cat.color, isDone)}</div>

    <div class="adkar-actions" onclick="event.stopPropagation()">
      <button class="adkar-btn fav ${isFav?'on':''}" onclick="toggleFav(${d.id})" title="Favorite" aria-label="${isFav?'Remove from favorites':'Add to favorites'}">${icon(isFav ? 'favorite-filled' : 'favorite-empty', 14)}</button>
      <button class="adkar-btn edit" onclick="openForm(${d.id})" title="Edit" aria-label="Edit">${icon('pencil', 14)}</button>
      <button class="adkar-btn del" onclick="askDelDhikr(${d.id})" title="Delete" aria-label="Delete">${icon('trash', 14)}</button>
    </div>
  </div>`;

  if(typeof injectHeaderIcons === 'function'){
    setTimeout(() => injectHeaderIcons(), 0);
  }

  return html;
}

/* Small helpers for chips - used in favorites + detail views */
function renderCatChips(catKeys){
  if(!Array.isArray(catKeys) || !catKeys.length) return '';
  return catKeys.map(key => {
    const c = getCat(key);
    return `<span class="badge badge-cat" style="background:${c.color}22;border-color:${c.color}">${c.ar}</span>`;
  }).join('');
}

function renderTagChips(tags){
  if(!Array.isArray(tags) || !tags.length) return '';
  return tags.map(t =>
    `<span class="badge badge-tag">#${esc(t)}</span>`
  ).join('');
}