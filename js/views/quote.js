'use strict';

/* Daily quote card - render + expand + language toggle */

let _quoteExpanded = false;
let _quoteLang = 'ar';

async function renderQuoteCard(){
  const host = $('quote-card');
  if(!host) return;
  if(typeof getTodayQuote !== 'function'){
    host.style.display = 'none';
    return;
  }

  if(_quoteLang === null){
    const saved = await store.getMeta('quoteLang');
    _quoteLang = saved === 'en' ? 'en' : 'ar';
  }

  const q = getTodayQuote();
  if(!q){ host.style.display = 'none'; return; }

  const tafsirText = _quoteLang === 'ar' ? (q.tafsirAr || '') : (q.tafsirEn || '');
  const tafsirClass = _quoteLang === 'ar' ? 'ar' : 'en';

  const badgeIconName = q.type === 'quran' ? 'book-open' : 'mosque';
  const badgeLabel = q.type === 'quran' ? 'Verse' : 'Hadith';

  host.classList.toggle('expanded', _quoteExpanded);

  const dateLine = (typeof formatHeaderDate === 'function') ? formatHeaderDate() : '';

  host.innerHTML = `
    ${dateLine ? `<div class="quote-dateline">${dateLine}</div>` : ''}
    <div class="quote-header">
      <div class="quote-badge">
        <span class="quote-badge-icon">${icon(badgeIconName, 14)}</span>
        <span>${badgeLabel} \u00B7 ${q.time}</span>
      </div>
      <span class="quote-expand-hint">${icon(_quoteExpanded ? 'chevron-up' : 'chevron-down', 14)}</span>
    </div>

    <div class="quote-text">${q.ar}</div>
    <div class="quote-ref">${q.ref}</div>

    <div class="quote-teaser">Tap to read tafsir</div>

    <div class="quote-tafsir-wrap">
      <div class="quote-tafsir-header">
        <span class="quote-tafsir-label">${icon('book-open', 14)} Tafsir</span>
        <div class="quote-lang-toggle">
          <button class="quote-lang-btn ${_quoteLang==='ar'?'on':''}" onclick="event.stopPropagation();setQuoteLang('ar')">عربي</button>
          <button class="quote-lang-btn ${_quoteLang==='en'?'on':''}" onclick="event.stopPropagation();setQuoteLang('en')">EN</button>
        </div>
      </div>
      <div class="quote-tafsir-body ${tafsirClass}">${tafsirText}</div>
      ${q.link ? `<a class="quote-link" href="${q.link}" target="_blank" rel="noopener" onclick="event.stopPropagation()">${icon('external-link', 12)} Read full source</a>` : ''}
    </div>
  `;

  host.onclick = (e) => {
    if(e.target.closest('.quote-lang-toggle')) return;
    if(e.target.closest('.quote-link')) return;
    _quoteExpanded = !_quoteExpanded;
    renderQuoteCard();
  };
}

/* Language switch on Home must stay inside the folio reading card. The shared
   legacy renderer replaces that card with the old rounded markup, so re-render
   only the Home card and return focus to the language button. */
function _renderHomeQuoteInPlace(lang){
  const host = document.getElementById('quote-card');
  if(!host || !host.classList.contains('home-quote-card')) return false;
  if(typeof renderHomeQuoteHTML !== 'function') return false;
  const html = renderHomeQuoteHTML();
  if(!html) return false;
  host.outerHTML = html;
  const next = document.getElementById('quote-card');
  if(!next) return true;
  const target = next.querySelector(`.quote-lang-btn[data-lang="${lang}"]`);
  if(target) target.focus();
  return true;
}

async function setQuoteLang(lang){
  if(lang !== 'ar' && lang !== 'en') return;
  _quoteLang = lang;
  const renderedInPlace = _renderHomeQuoteInPlace(lang);
  if(!renderedInPlace) renderQuoteCard();
  await store.setMeta('quoteLang', lang);
}

let _lastSlot = null;
function checkQuoteSlotChange(){
  if(typeof getCurrentTimeSlot !== 'function') return;
  const slot = getCurrentTimeSlot();
  if(slot !== _lastSlot){
    _lastSlot = slot;
    const homeCard = document.querySelector('#view-home.active .home-quote-card');
    if(homeCard && typeof renderHomeQuoteHTML === 'function') homeCard.outerHTML = renderHomeQuoteHTML();
    else renderQuoteCard();
  }
}

(function initQuoteWatcher(){
  _quoteLang = null;
  setInterval(checkQuoteSlotChange, 60 * 1000);
})();
