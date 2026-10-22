'use strict';
/* Home dashboard tab state */
window._homeTab = window._homeTab || 0;

/* Home: an illustrated daily companion with a live prayer panel,
   collection-backed shortcuts, religious reading and the user's daybook. */

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
  const uiLocale = window.SAHIB_I18N?.language==='ar'?'ar':'en-US';
  const weekdayEn = date.toLocaleDateString(uiLocale, { weekday: 'long' });
  const monthEn = date.toLocaleDateString(uiLocale, { month: 'long' });
  const greeting = greetingForNow(date);
  const greetingAr = greetingArForNow(date);
  const hijriLine = hijri
    ? (uiLocale==='ar'?`${weekdayAr} ${hijri.day} ${hijri.monthNameAr} ${hijri.year} هـ`:new Intl.DateTimeFormat('en-u-ca-islamic-umalqura',{day:'numeric',month:'long',year:'numeric'}).format(date))
    : '';

  const location = await store.getMeta('location');

  let eventChip = '';
  try{
    if(typeof getTodaysEvents === 'function'){
      const events = getTodaysEvents();
      if(events && events.length){
        const ev = events[0];
        eventChip = `<button type="button" class="home-chip home-event-chip" onclick="openHijriEvent('${ev.id}')">${icon(EVENT_ICONS[ev.type] || 'calendar', 13)} ${esc(window.SAHIB_I18N?.language==='ar'?ev.nameAr:ev.nameEn||ev.nameAr)}</button>`;
      }
    }
  }catch(err){ eventChip = ''; }

  let recentBooks = [];
  try{
    if(typeof loadReadingProgress === 'function' && typeof getRecentlyReadBooks === 'function'){
      await loadReadingProgress();
      recentBooks = getRecentlyReadBooks(1);
    }
  }catch(err){ recentBooks = []; }

  let readingHTML = '';
  try{ if(typeof renderHomeQuoteHTML === 'function') readingHTML = renderHomeQuoteHTML(); }catch(err){ readingHTML = ''; }

  const featured = data.find(item => item.id === 115) || data.find(item => item.arabic && item.arabic.length < 200);
  const name = typeof ASMA_NAMES !== 'undefined' ? ASMA_NAMES[0] : null;
  const books = typeof BOOKS !== 'undefined' ? BOOKS.slice(0, 3) : [];
  host.innerHTML = `
    <main class="sahib-home garden-home" dir="ltr">
      <div class="garden-toolbar">
        <div class="garden-date"><strong>${esc(weekdayEn)}, ${date.getDate()} ${esc(monthEn)} ${date.getFullYear()}</strong><span lang="ar" dir="rtl">${esc(hijriLine)}</span></div>
        <button class="garden-search" onclick="focusGlobalSearch()">${icon('search',18)}<span>Search the whole app…</span><span class="garden-search-hint">Search</span></button>
        <button class="garden-location" onclick="openLocationPicker()">${icon('map-pin',19)}<span>${esc(location ? location.label || 'Saved coordinates' : 'Choose location')}</span>${icon('chevron-down',13)}</button>
        <button class="garden-icon" onclick="toggleTheme()" aria-label="Toggle theme">${icon('sun',19)}</button>
        <button class="garden-icon" onclick="openSettings('appearance')" aria-label="Settings">${icon('settings',19)}</button>
      </div>
      <div class="garden-grid">
        <div class="garden-main">
          <section class="garden-welcome" aria-labelledby="garden-greeting">
            <div class="garden-welcome-copy"><h1 id="garden-greeting">${esc(greeting)}</h1><div class="garden-greeting-ar" lang="ar" dir="rtl">${esc(greetingAr)}</div><p>A little time for remembrance.<br>A little space for reflection.</p><div class="garden-flourish" aria-hidden="true"><span></span>◇<span></span></div></div>
          </section>
          <section class="garden-prayer-suite" aria-label="Prayer and day breakdown" data-prayer-face="${window._homePrayerFace || 0}"><div class="home-prayer-switch"><button onclick="turnHomePrayer(-1)" aria-label="Previous prayer card">${icon('chevron-left',17)}</button><div role="tablist" aria-label="Prayer card"><button role="tab" data-prayer-tab="0" onclick="turnHomePrayer(0,0)">Prayer times</button><button role="tab" data-prayer-tab="1" onclick="turnHomePrayer(0,1)">Day rhythm</button></div><button onclick="turnHomePrayer(1)" aria-label="Next prayer card">${icon('chevron-right',17)}</button></div><div class="garden-prayer" aria-label="Prayer times"><div id="home-prayer-widget"></div><div class="garden-timezone">Times use ${esc(Intl.DateTimeFormat().resolvedOptions().timeZone || 'your device timezone')}</div></div><div id="home-day-cycle" class="home-tab-cycle"></div></section>
          <section class="garden-actions" aria-label="Daily shortcuts">
            ${gardenAdhkarCard('sabah', 'Morning adhkar', 'sunrise')}
            ${gardenAdhkarCard('masaa', 'Evening adhkar', 'moon')}
            ${gardenPracticeCard()}
            <article class="garden-action"><span class="garden-action-icon">${icon('calendar',25)}</span><h2>Hijri calendar</h2><p lang="ar" dir="rtl">${hijri ? `${hijri.day} ${esc(window.SAHIB_I18N?.language==='ar'?hijri.monthNameAr:new Intl.DateTimeFormat('en-u-ca-islamic-umalqura',{month:'long'}).format(date))}` : 'Calendar'}</p><button onclick="openHijriView()">View calendar ${icon('arrow-left',14)}</button></article>
            <article class="garden-action"><span class="garden-action-icon">${icon('beads',25)}</span><h2>Tasbih</h2><p>A moment of dhikr</p><button onclick="openTasbihView()">Open counter ${icon('arrow-left',14)}</button></article>
          </section>
          <div class="garden-discover">
            <section class="garden-feature"><div class="garden-section-title"><h2>${icon('book-open',17)}Words of remembrance</h2><button onclick="goToAdkarCategories()">View all</button></div>${featured ? `<button class="garden-feature-body" onclick="openDetail(${featured.id})"><span class="garden-feature-ar" lang="ar" dir="rtl">${esc(featured.arabic)}</span><span class="garden-feature-source" lang="ar" dir="rtl">${esc(featured.hadith || featured.situation || '')}</span><span class="garden-round-arrow" aria-label="Read dhikr">${icon('arrow-left',18)}</span></button>` : '<p>Your collection is empty. Add a dhikr to begin.</p>'}</section>
            <section class="garden-name"><div class="garden-section-title"><h2>${icon('sparkles',17)}From the 99 Names</h2><button onclick="openAsmaView()">View all</button></div>${name ? `<button class="garden-name-body" onclick="openAsmaDetail(${name.id})"><span lang="ar" dir="rtl">${esc(name.ar)}</span><strong>${esc(window.SAHIB_I18N?.language==='ar'?name.ar:name.transliteration)}</strong><small>${esc(window.SAHIB_I18N?.language==='ar'?name.tafsirAr:name.meaningEn)}</small><span class="garden-name-link">Explore this name ${icon('arrow-left',14)}</span></button>` : ''}</section>
            <section class="garden-library"><div class="garden-section-title"><h2>${icon('library',17)}Your library</h2><button onclick="openBooksView()">View all</button></div><div class="garden-books">${books.map((book,i)=>`<button class="garden-book" onclick="openBookDetail('${esc(book.id)}')"><span class="garden-book-cover" data-home-cover="${esc(book.id)}"><span class="home-cover-placeholder">${icon('book-open',23)}</span></span><strong>${esc(window.SAHIB_I18N?.language==='ar'?book.titleAr:book.titleEn || book.titleAr)}</strong></button>`).join('')}</div><div class="garden-continue">${renderHomeContinue(recentBooks[0])}</div></section>
          </div>
          <footer class="garden-footer">${icon('lock',13)} Your practice, your pace. Saved on this device.</footer>
        </div>
        <aside class="garden-rail" aria-label="Reading and daily practice">
          <section class="garden-reading"><div class="garden-section-title"><h2>${icon('book-open',18)}Today's reading</h2><span lang="ar" dir="rtl">تدبّر</span></div>${readingHTML || '<p>No reading available.</p>'}</section>
          <section class="garden-daybook"><div class="garden-section-title"><h2>${icon('practice',18)}Your daily practice</h2><button onclick="openPracticeView('today')">View all</button></div>${renderHomePracticePanel()}</section>
          ${eventChip ? `<section class="garden-calendar-note"><span>In your calendar</span>${eventChip}</section>` : ''}
        </aside>
      </div>
      <nav class="home-mobile-nav" aria-label="Home shortcuts"><button aria-current="page" onclick="goHomeView()">${icon('home',19)}Home</button><button onclick="goToAdkarCategories()">${icon('book-open',19)}Adhkar</button><button onclick="openPrayerView()">${icon('mosque',19)}Prayer</button><button onclick="toggleMainMenu(event)">${icon('menu',19)}More</button></nav>
    </main>`;
  syncHomePrayerFace();
  renderHomeDayCycle();
  host.querySelectorAll('[data-home-cover]').forEach(el => attachBookCover(el.dataset.homeCover,el));
  if(typeof PrayerWidget !== 'undefined') PrayerWidget.mount('home-prayer-widget', { variant:'garden', showTimes:true });
  if(typeof injectHeaderIcons === 'function'){
    setTimeout(() => injectHeaderIcons(), 0);
  }
}

function gardenPracticeCard(){
  let snapshot = null;
  try{ if(typeof SahibPractice !== 'undefined' && SahibPractice.isReady()) snapshot = SahibPractice.getHomeSummary(); }catch(err){ /* setup action remains available */ }
  const completed = snapshot && snapshot.completed ? snapshot.completed.length : 0;
  const total = completed + (snapshot && snapshot.due ? snapshot.due.length : 0);
  const selected = snapshot && snapshot.enabled ? snapshot.enabled.length : 0;
  return `<article class="garden-action"><span class="garden-action-icon">${icon('practice',25)}</span><h2>Daily practice</h2><p>${selected ? `${total} ${total === 1 ? 'practice' : 'practices'} today` : 'Choose your routines'}</p>${selected ? `<div class="garden-progress"><progress value="${completed}" max="${total || 1}" aria-label="Daily practices completed"></progress><span>${completed} / ${total}</span></div>` : ''}<button onclick="openPracticeView('today')">${selected ? 'Open practice' : 'Get started'} ${icon('arrow-left',14)}</button></article>`;
}

function gardenAdhkarCard(key, label, glyph){
  const items = data.filter(item => Array.isArray(item.categories) && item.categories.includes(key));
  const done = items.filter(item => (counters[`c_${item.id}`] || 0) >= item.repeat).length;
  return `<article class="garden-action"><span class="garden-action-icon">${icon(glyph,25)}</span><h2>${label}</h2><p>${items.length} adhkar in your collection</p><div class="garden-progress"><progress value="${done}" max="${items.length || 1}" aria-label="${label} completed"></progress><span>${done} / ${items.length}</span></div><button onclick="startSessionFromCategory('${key}',event)" ${items.length ? '' : 'disabled'}>Start session ${icon('arrow-left',14)}</button></article>`;
}

function renderHomePrayerTimes(today, prefs){
  const timings = today && today.timings;
  if(!timings){
    return `<div class="sh-home-times-empty"><span>No local timetable yet. Set a location above to calculate today’s times.</span></div>`;
  }

  const order = ['Fajr', 'Sunrise', 'Dhuhr', 'Asr', 'Maghrib', 'Isha'];
  let nextName = '';
  try{
    const next = typeof findNextPrayer === 'function' ? findNextPrayer(timings) : null;
    if(next && !next.tomorrow) nextName = next.name;
  }catch(err){ nextName = ''; }

  return `<div class="sh-home-times" role="list" aria-label="Today's prayer and sunrise times">${order.map(name => {
    const arabic = (typeof PRAYER_NAMES_AR !== 'undefined' && PRAYER_NAMES_AR[name]) || (name === 'Sunrise' ? 'الشروق' : '');
    const formatted = typeof formatPrayerTime === 'function'
      ? formatPrayerTime(timings[name], prefs && prefs.timeFormat)
      : timings[name];
    return `<div class="sh-home-time${name === nextName ? ' is-next' : ''}" role="listitem"${name === nextName ? ' aria-current="time"' : ''}>
      <span class="sh-home-time-name">${esc(name)}</span>
      <span class="sh-home-time-ar" lang="ar" dir="rtl">${esc(arabic)}</span>
      <strong dir="ltr">${esc(formatted || '—')}</strong>
    </div>`;
  }).join('')}</div>`;
}

function renderHomeExploreHTML(){
  const features = [
    { id:'prayer', icon:'mosque', ar:'الصلاة', en:'Prayer', note:'Your local timetable', action:'openPrayerView()' },
    { id:'adhkar', icon:'book-open', ar:'الأذكار', en:'Adhkar', note:'Words to return to', action:'goToAdkarCategories()' },
    { id:'practice', icon:'practice', ar:'الورد اليومي', en:'Daily practice', note:'Routines you choose', action:"openPracticeView('today')" },
    { id:'hijri', icon:'calendar', ar:'التقويم الهجري', en:'Hijri calendar', note:'Dates and observances', action:'openHijriView()' },
    { id:'asma', icon:'sparkles', ar:'الأسماء الحسنى', en:'99 Names', note:'Meaning and reflection', action:'openAsmaView()' },
    { id:'tasbih', icon:'beads', ar:'المسبحة', en:'Tasbih', note:'A quiet counter', action:'openTasbihView()' }
  ];

  return `<div class="sh-home-explore-grid">${features.map(item => `
    <button type="button" class="sh-home-explore-item" onclick="${item.action}">
      <span class="sh-home-explore-icon" aria-hidden="true">${icon(item.icon, 18)}</span>
      <span class="sh-home-explore-copy">
        <span class="sh-home-explore-ar" lang="ar" dir="rtl">${item.ar}</span>
        <span class="sh-home-explore-en">${item.en}</span>
        <span class="sh-home-explore-note">${item.note}</span>
      </span>
      <span class="sh-home-explore-arrow" aria-hidden="true">${icon('arrow-left', 14)}</span>
    </button>`).join('')}</div>`;
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
    return `<section class="desk-side-block" aria-label="Chosen practices">
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

  return `<section class="desk-side-block" aria-label="Chosen practices">
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
  const uiLocale = window.SAHIB_I18N?.language==='ar'?'ar':'en-US';
  const weekdayEn = date.toLocaleDateString(uiLocale, { weekday: 'long' });

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

let _homeCycleRequest = 0;
async function renderHomeDayCycle(){
  const host = document.getElementById('home-day-cycle');
  if(!host) return;
  const request = ++_homeCycleRequest;
  try{
    const result = await getToday();
    const tomorrow = new Date();tomorrow.setDate(tomorrow.getDate()+1);
    const nextDay = await getPrayerDay(tomorrow);
    if(!host.isConnected || request!==_homeCycleRequest || !result.today || !nextDay) return;
    window._homeCycleData = {today:result.today,nextDay};
    host.innerHTML = _renderDailyCycleHTML(_computeDailyCycle(result.today,nextDay),result.today,nextDay);
  }catch(err){
    if(host.isConnected && request===_homeCycleRequest) host.innerHTML = '<div class="day-cycle-empty">Your day breakdown appears here once a location is set.</div>';
  }
}

for(const event of ['sahib:prayerchange','sahib:prayerprefs']){
  window.addEventListener(event,()=>{
    if(document.getElementById('view-home')?.classList.contains('active')) renderHomeDayCycle();
  });
}

function syncHomePrayerFace(){
  const suite=document.querySelector('.garden-prayer-suite');if(!suite)return;
  const face=window._homePrayerFace||0;suite.dataset.prayerFace=face;
  suite.querySelectorAll('[data-prayer-tab]').forEach(b=>{const active=Number(b.dataset.prayerTab)===face;b.setAttribute('aria-selected',String(active));b.tabIndex=active?0:-1;});
  suite.querySelector('.garden-prayer').hidden=face!==0;
  suite.querySelector('#home-day-cycle').hidden=face!==1;
  if(!suite.dataset.swipeBound){
    suite.dataset.swipeBound='1';let start=null;
    suite.addEventListener('touchstart',e=>{start=[e.touches[0].clientX,e.touches[0].clientY]}, {passive:true});
    suite.addEventListener('touchend',e=>{if(!start)return;const dx=e.changedTouches[0].clientX-start[0],dy=e.changedTouches[0].clientY-start[1];if(Math.abs(dx)>65&&Math.abs(dx)>Math.abs(dy)*1.5)turnHomePrayer(dx<0?1:-1);start=null;},{passive:true});
    suite.querySelector('[role="tablist"]').addEventListener('keydown',e=>{if(['ArrowLeft','ArrowRight'].includes(e.key)){e.preventDefault();turnHomePrayer(e.key==='ArrowRight'?1:-1);suite.querySelector('[aria-selected="true"]').focus();}});
  }
}
function turnHomePrayer(delta,target){
  window._homePrayerFace=target==null?((window._homePrayerFace||0)+delta+2)%2:target;
  syncHomePrayerFace();
}
