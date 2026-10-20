'use strict';

function openDetail(id){
  const d = data.find(x => x.id === id);
  if(!d) return;
  detailId = id;

  /* Save scroll position BEFORE locking body */
  window._adkarSavedScroll = window.scrollY || window.pageYOffset || 0;

  const catKey = Array.isArray(d.categories) ? d.categories[0] : null;
  const cat = getCat(catKey);
  const k = `c_${id}`;
  if(!counters[k]) counters[k] = 0;

  const isFav = favs.includes(id);
  $('d-cat-lbl').textContent = cat.ar;
  const favBtn = $('d-fav-btn');
  favBtn.innerHTML = icon(isFav ? 'favorite-filled' : 'favorite-empty', 20);
  favBtn.style.color = isFav ? 'var(--accent2)' : 'var(--text3)';
  favBtn.setAttribute('aria-label', isFav ? 'Remove from favorites' : 'Add to favorites');

  /* Close button glyph - injected directly so it renders even if
     injectHeaderIcons() is delayed or misses this node. */
  const closeBtn = document.querySelector('#ov-detail .sheet-head .btn-close[aria-label="Close"]');
  if(closeBtn){
    closeBtn.innerHTML = `<span class="btn-icon">${icon('x', 16)}</span>`;
  }

  const relBadge = d.reliability
    ? `<div style="display:flex;justify-content:center">
         <span class="badge badge-${d.reliability}" style="font-size:12px;padding:3px 10px">${icon(REL_ICON[d.reliability], 12)} ${REL_LABEL[d.reliability]}</span>
       </div>`
    : '';

  /* Arabic and English live in the same shell box.
     Toggle swaps which one is visible. Height stays constant. */
  const hasTranslit = !!d.transliteration;
  const toggleRow = hasTranslit
    ? `<div class="detail-lang-toggle">
         <button type="button" class="detail-lang-btn on" data-lang="ar" onclick="detailSetLang('ar')">عربي</button>
         <button type="button" class="detail-lang-btn" data-lang="en" onclick="detailSetLang('en')">English</button>
       </div>`
    : '';
  const translitBlock = hasTranslit
    ? `<div class="arabic-big translit-swap" id="d-translit" style="display:none">${esc(d.transliteration)}</div>`
    : '';

  /* Single collapsible for Source and Virtue. */
  const hasRef = !!(d.hadith || d.virtue);
  let refBody = '';
  if(d.hadith){
    refBody += `<div class="detail-sub-label">Source</div><div class="detail-sub-body">${d.hadith}</div>`;
  }
  if(d.virtue){
    refBody += `<div class="detail-sub-label">Virtue</div><div class="detail-sub-body">${d.virtue}</div>`;
  }
  const refBlock = hasRef
    ? `<details class="detail-fold" autocomplete="off">
         <summary><span class="detail-fold-icon">${icon('book-open', 14)}</span><span class="detail-fold-label">Source &amp; Virtue</span>${icon('chevron-down', 14)}</summary>
         <div class="detail-fold-body">${refBody}</div>
       </details>`
    : '';

  /* Show all categories */
  const catChips = renderCatChips(d.categories);
  const chipsRow = catChips
    ? `<div style="display:flex;justify-content:center;gap:6px;flex-wrap:wrap">${catChips}</div>`
    : '';

  $('d-body').innerHTML = `
    ${d.situation ? `<div><span class="situation-pill">${d.situation}</span></div>` : ''}
    <div class="arabic-big" id="d-arabic">${d.arabic}</div>
    ${translitBlock}
    ${toggleRow}
    ${relBadge}
    ${chipsRow}
    ${refBlock}
    <div class="counter-wrap">
      <div class="info-label" style="text-align:center;margin-bottom:12px;direction:ltr">Counter</div>
      <div class="counter-row">
        <button class="cbtn" onclick="dec(${id})">${icon('minus', 20)}</button>
        <div>
          <div class="cval" id="cv-${id}">${counters[k]}</div>
          <div class="ctgt">Target: ${d.repeat}×</div>
        </div>
        <button class="cbtn" onclick="inc(${id})">${icon('plus', 20)}</button>
      </div>
      <div class="pbar"><div class="pfill" id="cp-${id}" style="width:${Math.min(100, Math.round(counters[k]/d.repeat*100))}%"></div></div>
      <button class="reset-btn" onclick="resetCtr(${id})" data-icon="rotate-ccw">
        <span class="btn-icon"></span>
        <span>Reset</span>
      </button>
    </div>`;
  $('ov-detail').classList.add('open');
  lockBody();

  /* Force all folds collapsed, regardless of browser form-state restore.
     Same Chromium session-state caveat as session.js. */
  setTimeout(() => {
    document.querySelectorAll('#d-body details').forEach(el => el.removeAttribute('open'));
  }, 0);

  if(typeof injectHeaderIcons === 'function'){
    setTimeout(() => injectHeaderIcons(), 0);
  }
    pushViewState('detail');
}

/* AR/EN toggle for the Arabic / transliteration block in the detail modal. */
function detailSetLang(lang){
  const ar = document.getElementById('d-arabic');
  const tr = document.getElementById('d-translit');
  if(!ar) return;
  const btns = document.querySelectorAll('#d-body .detail-lang-btn');
  btns.forEach(b => b.classList.toggle('on', b.getAttribute('data-lang') === lang));
  if(lang === 'en' && tr){
    ar.style.display = 'none';
    tr.style.display = '';
  } else {
    ar.style.display = '';
    if(tr) tr.style.display = 'none';
  }
}

function closeDetail(){
  $('ov-detail').classList.remove('open');
  detailId = null;
  unlockBody();

  if(currentCat) renderAdkarGrid();
  renderCatsGrid();

  requestAnimationFrame(() => {
    const y = window._adkarSavedScroll || 0;
    window.scrollTo(0, y);
  });
}

function inc(id){
  const k = `c_${id}`;
  const d = data.find(x => x.id === id);
  counters[k] = (counters[k] || 0) + 1;
  persistCounters();
  $(`cv-${id}`).textContent = counters[k];
  $(`cp-${id}`).style.width = Math.min(100, Math.round(counters[k]/d.repeat*100)) + '%';
  if(counters[k] === d.repeat) toast('Completed', 'check-circle');
}

function dec(id){
  const k = `c_${id}`;
  const d = data.find(x => x.id === id);
  if((counters[k] || 0) > 0) counters[k]--;
  persistCounters();
  $(`cv-${id}`).textContent = counters[k];
  $(`cp-${id}`).style.width = Math.min(100, Math.round(counters[k]/d.repeat*100)) + '%';
}

function resetCtr(id){
  counters[`c_${id}`] = 0;
  store.setCounter(id, 0);
  $(`cv-${id}`).textContent = 0;
  $(`cp-${id}`).style.width = '0%';
}

/* History-driven close. Does the actual close, no push. */
function _closeDetailFromHistory(){
  $('ov-detail').classList.remove('open');
  detailId = null;
  unlockBody();
  if(currentCat) renderAdkarGrid();
  renderCatsGrid();
  requestAnimationFrame(() => {
    const y = window._adkarSavedScroll || 0;
    window.scrollTo(0, y);
  });
}

/* UI-driven close. Pops the history entry. */
function closeDetail(){
  const ov = $('ov-detail');
  if(!ov || !ov.classList.contains('open')) return;
  if(window.history && window.history.length > 1){
    history.back();
    return;
  }
  _closeDetailFromHistory();
}