'use strict';

async function startSession(){
  await store.checkDailyReset();
  let items = data.filter(d =>
    Array.isArray(d.categories) && d.categories.includes(currentCat)
  );
  const activeTag = (typeof _tagFilters !== 'undefined' && _tagFilters[currentCat]) ? _tagFilters[currentCat] : null;
  if(activeTag){
    const prefixed = currentCat + ':' + activeTag;
    items = items.filter(d => Array.isArray(d.tags) && d.tags.indexOf(prefixed) > -1);
  }
  if(!items.length){ toast('No adkar in this selection'); return; }

  sessItems = [...items].sort((a, b) => {
    const ra = a.repeat || 1;
    const rb = b.repeat || 1;
    if(ra !== rb) return ra - rb;
    return (a.id || 0) - (b.id || 0);
  });

  sessIdx = 0;
  sessTapCount = 0;

  /* Resume at the first incomplete dhikr, based on live counters. */
  sessIdx = 0;
  for(let i = 0; i < sessItems.length; i++){
    const d = sessItems[i];
    const k = `c_${d.id}`;
    if((counters[k] || 0) < d.repeat){ sessIdx = i; break; }
    if(i === sessItems.length - 1) sessIdx = i;
  }
  sessTapCount = counters[`c_${sessItems[sessIdx].id}`] || 0;

  const titleBase = getCat(currentCat).ar;
  const titleTag  = activeTag ? ' · ' + ((typeof _tagLabel === 'function') ? _tagLabel(activeTag) : activeTag) : '';
  $('sess-title').textContent = titleBase + titleTag;

  $('session-overlay').classList.add('open');
  $('session-overlay').classList.remove('is-done');
  $('sess-body').style.borderBottom = '';
  $('sess-body').style.borderRadius = '';
  lockBody();
  renderSessionStep();
  pushViewState('session');
}

function renderSessionStep(){
  if(sessIdx >= sessItems.length){ renderSessionDone(); return; }
  const d = sessItems[sessIdx];
  const k = `c_${d.id}`;
  if(!counters[k]) counters[k] = 0;
  sessTapCount = counters[k];
  const remaining = Math.max(0, d.repeat - sessTapCount);
  const pct = Math.min(100, Math.round(sessTapCount / d.repeat * 100));
  const isDone = sessTapCount >= d.repeat;

  $('sess-prog-text').textContent = `${sessIdx + 1} / ${sessItems.length}`;
  $('sess-back-btn').style.opacity = sessIdx === 0 ? '0.3' : '1';
  $('sess-back-btn').style.pointerEvents = sessIdx === 0 ? 'none' : 'auto';

  const relBadge = d.reliability
    ? `<span class="badge badge-${d.reliability}" style="font-size:12px;padding:3px 10px">${icon(REL_ICON[d.reliability], 12)} ${REL_LABEL[d.reliability]}</span>`
    : '';

  const hasTranslit = !!d.transliteration;
  const toggleRow = hasTranslit
    ? `<div class="detail-lang-toggle">
         <button type="button" class="detail-lang-btn on" data-lang="ar" onclick="sessSetLang('ar')">عربي</button>
         <button type="button" class="detail-lang-btn" data-lang="en" onclick="sessSetLang('en')">Transliteration</button>
       </div>`
    : '';
  const translitBlock = hasTranslit
    ? `<div class="session-arabic translit-swap" id="sess-translit" style="display:none">${esc(d.transliteration)}</div>`
    : '';

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

  $('sess-body').innerHTML = `
    <div class="session-reading">
    ${d.situation ? `<div class="session-situation">${d.situation}</div>` : ''}
    <div class="session-arabic" id="sess-arabic">${d.arabic}</div>
    ${translitBlock}
    ${toggleRow}
    <div class="session-badges">
      <span class="badge badge-repeat" style="font-size:12px;padding:3px 10px">× ${d.repeat}</span>
      ${relBadge}
    </div>
    ${refBlock}
    </div><aside class="session-counter-area" aria-label="Repetitions">
      <button class="session-tap-btn ${isDone?'done':''}" id="sess-tap" onclick="sessionTap(${d.id},${d.repeat})">
        <span id="sess-tap-num">${sessTapCount}</span>
        <span class="session-tap-label">TAP</span>
      </button>
      <div class="session-count-display" id="sess-count-disp">${isDone ? 'Done' : remaining + ' left'}</div>
      <div class="session-prog-bar">
        <div class="session-prog-fill ${isDone?'done-fill':''}" id="sess-pfill" style="width:${pct}%"></div>
      </div>
    </aside>`;

  setTimeout(() => {
    document.querySelectorAll('#sess-body details').forEach(el => el.removeAttribute('open'));
  }, 0);

  $('sess-next-btn').textContent = sessIdx < sessItems.length - 1 ? 'Next' : 'Finish';
  $('sess-next-btn').classList.toggle('done', isDone);
  $('sess-footer').style.display = 'flex';

  var body = $('sess-body');
  body.style.borderBottom = '';
  body.style.borderRadius = '';
}

function sessSetLang(lang){
  const ar = document.getElementById('sess-arabic');
  const tr = document.getElementById('sess-translit');
  if(!ar) return;
  const btns = document.querySelectorAll('#sess-body .detail-lang-btn');
  btns.forEach(b => b.classList.toggle('on', b.getAttribute('data-lang') === lang));
  if(lang === 'en' && tr){
    ar.style.display = 'none';
    tr.style.display = '';
  } else {
    ar.style.display = '';
    if(tr) tr.style.display = 'none';
  }
}

async function _saveSessProgress(){
  if(!currentCat || sessIdx >= sessItems.length) return;
  try{
    await store.setMeta('sessProgress', {
      cat: currentCat,
      idx: sessIdx,
      tap: sessTapCount,
    });
  }catch(e){ console.warn('[sess] save progress failed', e); }
}

async function _clearSessProgress(){
  try{ await store.setMeta('sessProgress', null); }catch(e){}
}

async function sessionTap(id, target){
  await store.checkDailyReset();
  const k = `c_${id}`;
  counters[k] = (counters[k] || 0) + 1;
  persistCounters();
  sessTapCount = counters[k];
  _saveSessProgress();

  const pct = Math.min(100, Math.round(sessTapCount / target * 100));
  const isDone = sessTapCount >= target;

  $('sess-tap-num').textContent = sessTapCount;
  $('sess-count-disp').textContent = isDone ? 'Done' : Math.max(0, target - sessTapCount) + ' left';
  $('sess-pfill').style.width = pct + '%';

  const tapBtn = $('sess-tap');
  const nextBtn = $('sess-next-btn');
  if(isDone){
    tapBtn.classList.add('done');
    nextBtn.classList.add('done');
    $('sess-pfill').classList.add('done-fill');
    /* No toast here: session mode already has strong visual completion
       feedback (green tap, green Next, filled progress bar), and the
       toast overlaps the Next / Skip footer. */
  } else {
    tapBtn.classList.remove('done');
    nextBtn.classList.remove('done');
    $('sess-pfill').classList.remove('done-fill');
  }
}

function sessionNext(){
  sessIdx++; sessTapCount = 0;
  if(sessIdx >= sessItems.length){ _clearSessProgress(); renderSessionDone(); }
  else { renderSessionStep(); _saveSessProgress(); }
}

function sessionSkip(){
  sessIdx++; sessTapCount = 0;
  if(sessIdx >= sessItems.length){ _clearSessProgress(); renderSessionDone(); }
  else { renderSessionStep(); _saveSessProgress(); }
}

function sessionPrev(){
  if(sessIdx === 0) return;
  sessIdx--; sessTapCount = 0;
  renderSessionStep();
  _saveSessProgress();
}

function renderSessionDone(){
  $('sess-body').innerHTML = `
    <div class="session-done">
      <div class="session-done-icon">${icon('check-circle', 64)}</div>
      <div class="session-done-title">Session complete!</div>
      <div class="session-done-title" style="font-size:18px">جزاك الله خيراً</div>
      <div class="session-done-sub">You completed all ${sessItems.length} adkar in this session.</div>
      <button class="btn-session-next" onclick="closeSession()" style="margin-top:8px">Back</button>
    </div>`;
  $('sess-footer').style.display = 'none';
  $('session-overlay').classList.add('is-done');

  if(window.innerWidth >= 768){
    var body = $('sess-body');
    body.style.borderBottom = '1px solid var(--border)';
    body.style.borderRadius = '0 0 20px 20px';
  }
  $('sess-back-btn').style.opacity = '0.3';
  $('sess-back-btn').style.pointerEvents = 'none';
}

/* Does the actual DOM close. No history side effects. */
function _closeSessionHard(){
  $('session-overlay').classList.remove('open');
  $('session-overlay').classList.remove('is-done');
  var body = $('sess-body');
  body.style.borderBottom = '';
  body.style.borderRadius = '';
  unlockBody();
  renderAdkarGrid();
  renderCatsGrid();
}

/* Explicit close. Called by the X button and the Done-Back button.
   Pops the in-memory history entry, replaces the browser entry, and
   closes hard. Does NOT go through history.back(), so it cannot be
   misinterpreted as a system back press. */
function closeSession(){
  if(typeof _viewStack !== 'undefined' && _viewStack.length && _viewStack[_viewStack.length - 1] === 'session'){
    _viewStack.pop();
    try{
      history.replaceState({ sahibView: _viewStack[_viewStack.length - 1] || null }, '');
    }catch(e){}
  }
  _closeSessionHard();
}

/* System back press. If there is a previous dhikr in this session,
   go there and re-push so back can be pressed again. Only close when
   we are already on the first dhikr. */
function _closeSessionFromHistory(){
  const ov = $('session-overlay');
  if(!ov || !ov.classList.contains('open')) return;
  if(sessIdx > 0){
    sessionPrev();
    pushViewState('session');
    return;
  }
  _closeSessionHard();
}


document.addEventListener('keydown', event => {
  if(!matchMedia('(min-width: 1024px)').matches || !$('session-overlay')?.classList.contains('open')) return;
  if(event.altKey || event.ctrlKey || event.metaKey || event.repeat || event.target.closest?.('input,textarea,select,[contenteditable]')) return;
  if(event.key === ' ' && event.target.closest?.('button')) return;
  if(event.key === ' ' && sessIdx < sessItems.length){
    event.preventDefault();
    const item = sessItems[sessIdx];
    sessionTap(item.id, item.repeat);
  } else if(event.key === 'PageDown'){
    event.preventDefault(); sessionNext();
  } else if(event.key === 'PageUp'){
    event.preventDefault(); sessionPrev();
  }
});
