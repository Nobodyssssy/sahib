'use strict';
/* Home dashboard tab state */
window._homeTab = window._homeTab || 0;

/* Home is an editorial daily page, not a feature directory:
   date + next prayer, the daybook, today's reading, a quiet index, and the
   prayer cycle. Daily Practice is the first thing after the prayer anchor. */

async function renderHome(){
  const host = $('home-body');
  if(!host) return;

  if(typeof _quoteLang !== 'undefined' && _quoteLang === null){
    const saved = await store.getMeta('quoteLang');
    _quoteLang = saved === 'en' ? 'en' : 'ar';
  }
  if(typeof _loadCycleLang === 'function'){
    try{ await _loadCycleLang(); }catch(err){ /* defaults are fine */ }
  }

  const date = new Date();
  const hijri = (typeof getHijriParts === 'function') ? getHijriParts(date) : null;
  const weekdayAr = (typeof WEEKDAYS_AR !== 'undefined') ? WEEKDAYS_AR[date.getDay()] : '';
  const weekdayEn = date.toLocaleDateString('en-US', { weekday: 'long' });
  const monthEn = date.toLocaleDateString('en-US', { month: 'long' });
  const greeting = greetingForNow(date);
  const greetingAr = greetingArForNow(date);
  const hijriLine = hijri
    ? `${weekdayAr} ${hijri.day} ${hijri.monthNameAr} ${hijri.year} هـ`
    : '';

  let location = null;
  try{
    if(typeof getToday === 'function'){
      const result = await getToday();
      if(result && result.location) location = result.location;
    }
  }catch(err){ location = null; }

  let eventChip = '';
  try{
    if(typeof getTodaysEvents === 'function'){
      const events = getTodaysEvents();
      if(events && events.length){
        const ev = events[0];
        eventChip = `<button type="button" class="home-chip home-event-chip" onclick="openHijriEvent('${ev.id}')">${icon(EVENT_ICONS[ev.type] || 'calendar', 13)} ${esc(ev.nameAr)}</button>`;
      }
    }
  }catch(err){ eventChip = ''; }

  const locationChip = location && location.lat != null
    ? `<button type="button" class="home-chip" onclick="openLocationPicker()">${icon('map-pin', 13)} ${esc(location.label || `${Number(location.lat).toFixed(2)}, ${Number(location.lng).toFixed(2)}`)}</button>`
    : `<span class="home-chip home-chip--quiet">${icon('map-pin', 13)} Location not set</span>`;

  let recentBooks = [];
  try{
    if(typeof loadReadingProgress === 'function' && typeof getRecentlyReadBooks === 'function'){
      await loadReadingProgress();
      recentBooks = getRecentlyReadBooks(1);
    }
  }catch(err){ recentBooks = []; }

  let readingHTML = '';
  try{ if(typeof renderHomeQuoteHTML === 'function') readingHTML = renderHomeQuoteHTML(); }catch(err){ readingHTML = ''; }

  host.innerHTML = `
    <main class="almanac-desk">
      <header class="desk-mast">
        <h1 class="desk-mast-date">
          <span class="desk-mast-weekday">${esc(weekdayEn)}</span>
          <span class="desk-mast-greg">${date.getDate()} ${esc(monthEn)} ${date.getFullYear()}</span>
          <span class="desk-mast-hijri" lang="ar" dir="rtl">${esc(hijriLine)}</span>
        </h1>
        <div class="desk-mast-side">
          <span class="desk-mast-greeting" dir="rtl"><span lang="ar">${esc(greetingAr)}</span> · <span lang="en" dir="ltr">${esc(greeting)}</span></span>
          ${locationChip}
          ${eventChip}
        </div>
      </header>

      <section class="desk-prayer" aria-label="Next prayer and today’s prayer times">
        <div id="home-prayer-widget" class="desk-prayer-host" aria-live="polite"></div>
      </section>

      <section class="desk-lower" aria-label="Today’s reading and practice">
        <div class="desk-lower-main">
          <div class="desk-section-head">
            <h2 class="desk-section-title">Today’s reading</h2>
            <button type="button" class="desk-link" onclick="openBooksView()">Library ${icon('arrow-left', 12)}</button>
          </div>
          ${readingHTML || `<p class="desk-side-empty"><bdi dir="ltr" lang="en">No reading is set for today.</bdi></p>`}
        </div>
        <aside class="desk-lower-side">
          ${renderHomePracticePanel()}
          ${renderHomeContinue(recentBooks[0])}
        </aside>
      </section>

      <footer class="desk-foot">
        <span class="desk-foot-note">${icon('lock', 12)} Local-first. Your reading and practice history stay in this browser.</span>
        <nav class="desk-foot-nav" aria-label="Quick links">
          <button type="button" class="desk-foot-link" onclick="goToAdkarCategories()">Adhkar</button>
          <button type="button" class="desk-foot-link" onclick="openPrayerView()">Prayer</button>
          <button type="button" class="desk-foot-link" onclick="openHijriView()">Hijri</button>
          <button type="button" class="desk-foot-link" onclick="openAsmaView()">99 Names</button>
          <button type="button" class="desk-foot-link" onclick="openTasbihView()">Tasbih</button>
        </nav>
      </footer>
    </main>
  `;

  if(typeof PrayerWidget !== 'undefined'){
    PrayerWidget.mount('home-prayer-widget', { variant: 'hero', showTimes: true });
  }
  if(typeof injectHeaderIcons === 'function'){
    setTimeout(() => injectHeaderIcons(), 0);
  }
}

function renderHomePracticePanel(){
  const loading = `<section class="desk-side-block">
    <div class="desk-section-head"><h2 class="desk-section-title">Daily practice</h2></div>
    <p class="desk-side-empty"><bdi dir="ltr" lang="en">Opening the daybook…</bdi></p>
  </section>`;
  if(typeof SahibPractice === 'undefined' || !SahibPractice.isReady()) return loading;

  let snap;
  try{ snap = SahibPractice.getHomeSummary(); }catch(err){ return loading; }
  if(!snap || !snap.enabled) return loading;

  if(!snap.enabled.length){
    const hour = new Date().getHours();
    const starter = hour >= 15 ? 'evening-adhkar' : hour < 12 ? 'morning-adhkar' : 'quran-reading';
    const label = starter === 'evening-adhkar' ? 'evening adhkar' : starter === 'morning-adhkar' ? 'morning adhkar' : 'Qur’an reading';
    return `<section class="desk-side-block" aria-labelledby="home-practice-title">
      <div class="desk-section-head">
        <h2 class="desk-section-title" id="home-practice-title">Daily practice</h2>
        <button type="button" class="desk-link" onclick="openPracticeView('all')">Browse ${icon('arrow-left', 11)}</button>
      </div>
      <p class="desk-side-empty"><bdi dir="ltr" lang="en">Nothing set for today. Begin with one small practice you already keep.</bdi></p>
      <button type="button" class="desk-primary desk-primary--inline desk-primary--quiet" onclick="homeStartStarter('${starter}')">Add ${label} ${icon('arrow-left', 12)}</button>
    </section>`;
  }

  const due = snap.due.slice().sort((a, b) => _homePracticeRank(a) - _homePracticeRank(b) || a.practice.title.localeCompare(b.practice.title));
  const completed = (snap.completed || []).map(item => ({ ...item, done: true }));
  const items = [
    ...due.map(item => ({ ...item, done: false })),
    ...completed
  ].sort((a, b) => _homePracticeRank(a) - _homePracticeRank(b) || a.practice.title.localeCompare(b.practice.title));

  const rows = items.length ? items.map(item => {
    const p = item.practice;
    const time = p.timeLabel || p.reminderTime || '';
    const done = item.done;
    return `<div class="desk-practice-row${done ? ' is-done' : ''}" data-practice-id="${esc(p.id)}">
      <button type="button" class="desk-practice-copy" onclick="openPracticeDetail('${esc(p.id)}')">
        <span class="desk-practice-title"><span lang="ar" dir="rtl">${esc(p.titleAr || '')}</span><span>${esc(p.title)}</span></span>
        <span class="desk-practice-time">${esc(time || 'Any time')}</span>
      </button>
      <span class="desk-practice-check">
        ${done
          ? `<span class="desk-practice-done is-done" aria-hidden="true">${icon('check', 12)}</span>
             <button type="button" class="desk-practice-undo" onclick="homePracticeUndo('${esc(p.id)}')">Undo</button>`
          : `<button type="button" class="desk-practice-done" onclick="homePracticeDone('${esc(p.id)}')" aria-pressed="false" aria-label="Mark ${esc(p.title)} done today" title="Mark done today">${icon('check', 12)}</button>`}
      </span>
    </div>`;
  }).join('') : `<p class="desk-side-empty"><bdi dir="ltr" lang="en">Nothing else is due today.</bdi></p>`;

  return `<section class="desk-side-block" aria-labelledby="home-practice-title">
    <div class="desk-section-head">
      <h2 class="desk-section-title" id="home-practice-title">Daily practice</h2>
      <button type="button" class="desk-link" onclick="openPracticeView('today')">Open ${icon('arrow-left', 11)}</button>
    </div>
    <div class="desk-practice-list">
      ${items.length ? `<div class="desk-practice-colhead" aria-hidden="true"><span></span><span>Done</span></div>` : ''}
      ${rows}
    </div>
  </section>`;
}

/* The daybook is chronological: prayer-relative practices first, then clock
   reminders, then "anytime" items. Keep this independent of the prayer
   widget's cache, which may not be hydrated when Home renders. */
function _homePracticeRank(item){
  const p = item && item.practice ? item.practice : item;
  if(!p) return 1440;
  const due = Number(item.dueMinutes);
  if(item.dueMinutes != null && Number.isFinite(due)) return due;
  const rel = String(p.relativeTo || '').toLowerCase();
  const prayer = { fajr: 310, sunrise: 360, dhuhr: 730, asr: 930, maghrib: 1085, isha: 1170 };
  if(prayer[rel] != null) return prayer[rel] + Number(p.offsetMinutes || 0);
  const clock = String(p.reminderTime || '').match(/^(\d{1,2}):(\d{2})/);
  if(clock) return Number(clock[1]) * 60 + Number(clock[2]);
  const label = String(p.timeLabel || '').toLowerCase();
  if(/fajr|dawn|morning/.test(label)) return 310;
  if(/dhuhr|noon/.test(label)) return 730;
  if(/asr|afternoon/.test(label)) return 930;
  if(/maghrib|sunset|evening/.test(label)) return 1085;
  if(/isha|night/.test(label)) return 1170;
  return 1440;
}

/* SahibPractice refreshes Home itself after saving. Wait for that render, then
   put focus back on the row's new action so keyboard users are not dropped at
   the top of the document. The extra render this used to schedule raced the
   first one and reset focus. */
function _focusHomePracticeWhenReady(id, done, tries = 0){
  if(!document.getElementById('view-home')?.classList.contains('active')) return;
  const row = Array.from(document.querySelectorAll('.desk-practice-row'))
    .find(r => r.dataset.practiceId === id);
  if(row && row.classList.contains('is-done') === done){
    const target = row.querySelector(done ? '.desk-practice-undo' : '.desk-practice-done');
    if(target){ target.focus({ preventScroll: true }); return; }
  }
  if(tries < 30){
    requestAnimationFrame(() => _focusHomePracticeWhenReady(id, done, tries + 1));
  }
}

async function homePracticeDone(id){
  if(typeof SahibPractice === 'undefined') return;
  await SahibPractice.complete(id);
  _focusHomePracticeWhenReady(id, true);
}

async function homePracticeUndo(id){
  if(typeof SahibPractice === 'undefined') return;
  await SahibPractice.undo(id);
  _focusHomePracticeWhenReady(id, false);
}

async function homeStartStarter(id){
  if(typeof SahibPractice === 'undefined') return;
  await SahibPractice.enableStarter(id);
  if(document.getElementById('view-home')?.classList.contains('active')) renderHome();
}

function renderHomeContinue(book){
  if(!book){
    return `<section class="desk-side-block desk-side-block--quiet">
      <h2 class="desk-micro-head">Continue</h2>
      <p class="desk-side-empty desk-continue-none"><bdi dir="ltr" lang="en">No open book.</bdi> <button type="button" class="desk-text-action" onclick="openBooksView()">Browse the library</button></p>
    </section>`;
  }
  let progress = null;
  try{ progress = (typeof getBookProgress === 'function') ? getBookProgress(book.id) : null; }catch(err){ progress = null; }
  const detail = progress
    ? (progress.totalPages ? `Page ${progress.page} of ${progress.totalPages}` : `Stopped at page ${progress.page}`)
    : 'Open book';
  const title = book.titleEn || book.titleAr || 'Continue reading';
  const titleLang = book.titleEn ? 'en' : 'ar';
  const titleDir = book.titleEn ? 'ltr' : 'rtl';
  return `<section class="desk-side-block">
    <h2 class="desk-micro-head">Continue</h2>
    <button type="button" class="desk-continue" onclick="openBookDetail('${esc(book.id)}')">
      <span class="desk-continue-icon">${icon('book-open', 15)}</span>
      <span class="desk-continue-copy">
        <strong><bdi dir="${titleDir}" lang="${titleLang}">${esc(title)}</bdi></strong>
        <span>${esc(detail)}</span>
      </span>
      <span class="desk-continue-arrow">${icon('arrow-left', 12)}</span>
    </button>
  </section>`;
}

function _homeDate(key){
  if(!key) return '';
  const parts = String(key).split('-').map(Number);
  if(parts.length !== 3) return key;
  return new Date(parts[0], parts[1] - 1, parts[2]).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
}

function greetingForNow(date){
  const h = date.getHours();
  if(h < 5)  return 'Peaceful night';
  if(h < 12) return 'Good morning';
  if(h < 17) return 'Good afternoon';
  if(h < 20) return 'Good evening';
  return 'Peaceful evening';
}

function greetingArForNow(date){
  const h = date.getHours();
  if(h < 5)  return 'سلامٌ في الليل';
  if(h < 12) return 'صباح الخير';
  if(h < 17) return 'طاب نهارك';
  if(h < 20) return 'مساء الخير';
  return 'سلامٌ في المساء';
}

/* Kept for older callers: a compact today card. The home page renders its
   own editorial hero, but other modules still use this helper. */
async function renderTodayCardHTML(){
  const date = new Date();
  const hijri = (typeof getHijriParts === 'function') ? getHijriParts(date) : null;
  const weekdayAr = (typeof WEEKDAYS_AR !== 'undefined') ? WEEKDAYS_AR[date.getDay()] : '';
  const weekdayEn = date.toLocaleDateString('en-US', { weekday: 'long' });

  let prayerLine = '';
  try{
    const result = await getToday();
    if(result && result.today){
      const next = findNextPrayer(result.today.timings);
      prayerLine = `
        <div class="home-today-prayer" onclick="openPrayerView()">
          <span class="home-prayer-icon">${icon('mosque', 16)}</span>
          <span class="home-prayer-label">${next.name}${next.tomorrow ? ' (tomorrow)' : ''}</span>
          <span class="home-prayer-time">${next.time}</span>
          <span class="home-prayer-countdown">in ${formatCountdown(next.minutesLeft)}</span>
        </div>`;
    }
  }catch(err){
    prayerLine = `
      <div class="home-today-prayer" onclick="openLocationPicker()">
        <span class="home-prayer-icon">${icon('map-pin', 16)}</span>
        <span class="home-prayer-label">Set your location</span>
        <span class="home-prayer-countdown">for prayer times</span>
      </div>`;
  }

  return `
    <div class="home-today-card">
      <div class="home-today-date-ar">${hijri ? `${weekdayAr} ${hijri.day} ${hijri.monthNameAr} ${hijri.year}` : ''}</div>
      <div class="home-today-date-en">${weekdayEn} ${date.getDate()} ${date.toLocaleDateString('en-US', { month: 'short' })} ${date.getFullYear()}</div>
      ${prayerLine}
    </div>`;
}

function setHomeTab(idx){
  window._homeTab = idx;
  const tabs = document.getElementById('home-tabs');
  const dots = document.querySelectorAll('.home-tab-dot');
  const arrows = document.querySelectorAll('.home-tab-arrow');
  if(tabs) tabs.dataset.tab = String(idx);
  dots.forEach((d, i) => d.classList.toggle('on', i === idx));
  if(arrows[0]) arrows[0].disabled = (idx === 0);
  if(arrows[1]) arrows[1].disabled = (idx === 1);
}

function _attachHomeTabsSwipe(){
  const body = document.getElementById('home-tabs-body');
  if(!body || body.dataset.swipeAttached === '1') return;
  let startX = 0;
  body.addEventListener('touchstart', e => {
    if(e.touches.length !== 1) return;
    startX = e.touches[0].clientX;
  }, { passive: true });
  body.addEventListener('touchend', e => {
    if(!e.changedTouches.length) return;
    const dx = e.changedTouches[0].clientX - startX;
    if(Math.abs(dx) < 50) return;
    const cur = window._homeTab || 0;
    if(dx > 0 && cur > 0) setHomeTab(cur - 1);
    else if(dx < 0 && cur < 1) setHomeTab(cur + 1);
  }, { passive: true });
  body.dataset.swipeAttached = '1';
}

function renderHomeQuotePreviewHTML(){
  if(typeof getTodayQuote !== 'function') return '';
  const q = getTodayQuote();
  if(!q) return '';
  const lang = (typeof _quoteLang !== 'undefined' && _quoteLang) ? _quoteLang : 'ar';
  const tafsirText = lang === 'ar' ? (q.tafsirAr || '') : (q.tafsirEn || '');
  if(!tafsirText) return '';
  const tafsirClass = lang === 'ar' ? 'ar' : 'en';
  return `<div class="home-reading-preview ${tafsirClass}" lang="${lang}" ${lang === 'ar' ? 'dir="rtl"' : 'dir="ltr"'}><span>Reflection</span>${esc(tafsirText.length > 170 ? `${tafsirText.slice(0, 167).trim()}…` : tafsirText)}</div>`;
}

function renderHomeQuoteHTML(){
  if(typeof getTodayQuote !== 'function') return '';

  const q = getTodayQuote();
  if(!q) return '';

  const lang = (typeof _quoteLang !== 'undefined' && _quoteLang) ? _quoteLang : 'ar';
  const tafsirText = lang === 'ar' ? (q.tafsirAr || '') : (q.tafsirEn || '');
  const tafsirClass = lang === 'ar' ? 'ar' : 'en';
  const badgeIconName = q.type === 'quran' ? 'book-open' : 'mosque';
  const badgeLabel = q.type === 'quran' ? 'Verse' : 'Hadith';
  const isExpanded = (typeof _quoteExpanded !== 'undefined') ? _quoteExpanded : false;
  const slotLabel = (q.time && q.time !== 'any') ? ` · ${q.time}` : '';

  return `
    <div class="quote-card home-quote-card ${isExpanded ? 'expanded' : ''}" id="quote-card">
      <button type="button" class="quote-header" aria-expanded="${isExpanded}" aria-controls="quote-tafsir" aria-label="${isExpanded ? 'Close tafsir' : 'Open tafsir'}" onclick="event.stopPropagation();toggleHomeQuote(event)">
        <span class="quote-badge">
          <span class="quote-badge-icon" aria-hidden="true">${icon(badgeIconName, 14)}</span>
          <span>${badgeLabel}${slotLabel}</span>
        </span>
        <span class="quote-expand-hint" aria-hidden="true">${icon('chevron-down', 14)}</span>
      </button>

      <div class="quote-page">
        <div class="quote-text" lang="ar" dir="rtl">${q.ar}</div>
        <aside class="quote-margin" aria-label="Reference and reflection">
          <div class="quote-ref" lang="ar" dir="rtl">${q.ref}</div>
          ${isExpanded ? '' : renderHomeQuotePreviewHTML()}
        </aside>
      </div>

      <button type="button" class="quote-teaser" aria-expanded="${isExpanded}" aria-controls="quote-tafsir" onclick="event.stopPropagation();toggleHomeQuote(event)">
        ${isExpanded ? 'Close tafsir' : 'Open today’s tafsir'} ${icon(isExpanded ? 'chevron-up' : 'arrow-left', 13)}
      </button>

      <div class="quote-tafsir-wrap" id="quote-tafsir">
        <div class="quote-tafsir-header">
          <span class="quote-tafsir-label">${icon('book-open', 14)} Tafsir</span>
          <div class="quote-lang-toggle">
            <button type="button" class="quote-lang-btn ${lang==='ar'?'on':''}" data-lang="ar" aria-pressed="${lang==='ar'}" onclick="event.stopPropagation();setQuoteLang('ar')">عربي</button>
            <button type="button" class="quote-lang-btn ${lang==='en'?'on':''}" data-lang="en" aria-pressed="${lang==='en'}" onclick="event.stopPropagation();setQuoteLang('en')">EN</button>
          </div>
        </div>
        <div class="quote-tafsir-body ${tafsirClass}" lang="${tafsirClass}" dir="${lang === 'ar' ? 'rtl' : 'ltr'}">${tafsirText}</div>
        ${q.link ? `<a class="quote-link" href="${q.link}" target="_blank" rel="noopener" onclick="event.stopPropagation()">${icon('external-link', 12)} Read full source</a>` : ''}
      </div>
    </div>
  `;
}

function toggleHomeQuote(event){
  if(event){
    if(event.target.closest('.quote-lang-toggle')) return;
    if(event.target.closest('.quote-link')) return;
  }
  if(typeof _quoteExpanded !== 'undefined'){
    _quoteExpanded = !_quoteExpanded;
    const card = document.getElementById('quote-card');
    if(!card){ renderHome(); return; }
    card.classList.toggle('expanded', _quoteExpanded);
    const margin = card.querySelector('.quote-margin');
    if(margin){
      const preview = margin.querySelector('.home-reading-preview');
      if(_quoteExpanded && preview) preview.remove();
      if(!_quoteExpanded && !preview && typeof renderHomeQuotePreviewHTML === 'function'){
        margin.insertAdjacentHTML('beforeend', renderHomeQuotePreviewHTML());
      }
    }
    const header = card.querySelector('.quote-header');
    if(header){
      header.setAttribute('aria-expanded', String(_quoteExpanded));
      header.setAttribute('aria-label', _quoteExpanded ? 'Close tafsir' : 'Open tafsir');
    }
    const teaser = card.querySelector('.quote-teaser');
    if(teaser){
      teaser.setAttribute('aria-expanded', String(_quoteExpanded));
      teaser.innerHTML = `${_quoteExpanded ? 'Close tafsir' : 'Open today’s tafsir'} ${icon(_quoteExpanded ? 'chevron-up' : 'arrow-left', 13)}`;
    }
  }
}

function renderHomeFeaturesHTML(){
  const features = [
    { id:'practice', icon:'practice', ar:'الورد', en:'Daily practice', note:'What you chose to keep', action:"openPracticeView('today')" },
    { id:'adkar', icon:'book-open', ar:'الأذكار', en:'Adkar', note:'Morning, evening and the daily fortress', action:'goToAdkarCategories()' },
    { id:'prayer', icon:'mosque', ar:'الصلاة', en:'Prayer times', note:'The day’s five anchors', action:'openPrayerView()' },
    { id:'hijri', icon:'calendar', ar:'التقويم الهجري', en:'Hijri calendar', note:'Lunar dates and events', action:'openHijriView()' },
    { id:'asma', icon:'sparkles', ar:'الأسماء الحسنى', en:'99 Names', note:'A slow reading of the names', action:'openAsmaView()' },
    { id:'books', icon:'library', ar:'المكتبة', en:'Library', note:'Books and local reading', action:'openBooksView()' },
    { id:'tasbih', icon:'beads', ar:'المسبحة', en:'Tasbih', note:'A quiet counter', action:'openTasbihView()' },
    { id:'search', icon:'search', ar:'البحث', en:'Search', note:'Find any dhikr or book', action:'goToAdkarCategories();focusGlobalSearch()' }
  ];

  return `
    <div class="home-index-list">
      ${features.map((f, i) => `
        <button type="button" class="home-index-item ${f.id === 'practice' ? 'home-index-item--practice' : ''}" onclick="${f.action}">
          <span class="home-index-num">${String(i + 1).padStart(2, '0')}</span>
          <span class="home-index-glyph">${icon(f.icon, 17)}</span>
          <span class="home-index-copy">
            <span class="home-index-ar" lang="ar" dir="rtl">${f.ar}</span>
            <span class="home-index-en">${f.en}</span>
            <span class="home-index-note">${f.note}</span>
          </span>
          <span class="home-index-arrow">${icon('arrow-left', 14)}</span>
        </button>
      `).join('')}
    </div>
  `;
}

function goToAdkar(){
  goToAdkarCategories();
}

function goHomeView(){
  showView('view-home');
  renderHome();
  window.scrollTo(0, 0);
}
