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
  const gregorianLine = `${weekdayEn} ${date.getDate()} ${monthEn} ${date.getFullYear()}`;

  let location = null;
  let todayData = null;
  let nextDay = null;
  let cycleHTML = '';

  try{
    if(typeof getToday === 'function'){
      const result = await getToday();
      if(result){
        location = result.location;
        todayData = result.today;
      }
    }
    if(todayData && typeof getPrayerDay === 'function'){
      const tomorrow = new Date(date);
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(12, 0, 0, 0);
      try{ nextDay = await getPrayerDay(tomorrow); }catch(err){ /* optional */ }
    }
    if(todayData && nextDay &&
       typeof _computeDailyCycle === 'function' &&
       typeof _renderDailyCycleHTML === 'function'){
      const cycle = _computeDailyCycle(todayData, nextDay);
      if(cycle){
        window._homeCycleData = { today: todayData, nextDay };
        cycleHTML = _renderDailyCycleHTML(cycle, todayData, nextDay);
      }
    }
  }catch(err){
    location = null;
  }

  if (typeof SahibPractice !== 'undefined' && SahibPractice.setTimings && todayData?.timings) {
    SahibPractice.setTimings(todayData.timings);
  }

  let eventChip = '';
  try{
    if(typeof getTodaysEvents === 'function'){
      const events = getTodaysEvents();
      if(events && events.length){
        const ev = events[0];
        eventChip = `<button type="button" class="home-chip home-event-chip" onclick="openHijriEvent('${ev.id}')">
          ${icon(EVENT_ICONS[ev.type] || 'calendar', 14)} ${esc(ev.nameAr)}
        </button>`;
      }
    }
  }catch(err){ eventChip = ''; }

  const locationChip = location && location.lat != null
    ? `<button type="button" class="home-chip" onclick="openLocationPicker()">
        ${icon('map-pin', 14)} ${esc(location.label || `${Number(location.lat).toFixed(2)}, ${Number(location.lng).toFixed(2)}`)}
      </button>`
    : `<span class="home-chip home-chip--quiet">${icon('map-pin', 14)} Location not set</span>`;

  host.innerHTML = `
    <div class="home-container almanac-home">
      <div class="home-hero">
        <section class="home-hero-card">
          <div class="home-hero-topline">
            <span class="home-greeting"><span>${esc(greeting)}</span><span class="home-greeting-ar" lang="ar" dir="rtl">${esc(greetingAr)}</span></span>
            <span class="home-local-mark">${icon('lock', 12)} Local only</span>
          </div>
          <div class="home-hero-copy">
            <div class="home-date-ar" id="home-today-date-ar">${hijriLine || gregorianLine}</div>
            <div class="home-date-en" id="home-today-date-en">${gregorianLine}</div>
          </div>
          <div class="home-hero-rule" aria-hidden="true"></div>
          <div class="home-hero-meta">
            ${locationChip}
            ${eventChip}
          </div>
          <div class="home-hero-colophon">
            <span>A companion for the ordinary day.</span>
            <span>Sahib almanac · ${date.getFullYear()}</span>
          </div>
        </section>

        <div id="home-prayer-widget" class="home-prayer-widget-host" aria-live="polite"></div>
      </div>

      <div class="home-daybook-grid">
        ${renderHomePracticePanel()}

        <section class="home-reading">
          <div class="home-section-head">
            <div>
              <div class="home-section-kicker">From the Qur’an and Sunnah</div>
              <div class="home-section-title">Today’s reading</div>
            </div>
            <button type="button" class="home-section-link" onclick="openBooksView()">Library ${icon('arrow-left', 13)}</button>
          </div>
          ${renderHomeQuoteHTML()}
        </section>
      </div>

      <section class="home-index-section">
        <div class="home-section-head">
          <div>
            <div class="home-section-kicker">The Sahib index</div>
            <div class="home-section-title">Everything else, kept quiet</div>
          </div>
          <button type="button" class="home-section-link" onclick="focusGlobalSearch()">Search all adhkar ${icon('search', 13)}</button>
        </div>
        ${renderHomeFeaturesHTML()}
      </section>

      ${cycleHTML ? `
        <section class="home-cycle-section home-cycle-wide">
          <div class="home-section-head">
            <div>
              <div class="home-section-kicker">The shape of the day</div>
              <div class="home-section-title">Daily prayer cycle</div>
            </div>
            <button type="button" class="home-section-link" onclick="openPrayerView()">Prayer times ${icon('arrow-left', 13)}</button>
          </div>
          ${cycleHTML}
        </section>` : ''}

      <footer class="home-colophon">
        <span>${icon('check-circle', 14)} Local-first · no accounts · no tracking</span>
        <span>Adhkar, favourite reading, prayer settings and practice history stay in this browser.</span>
      </footer>
    </div>
  `;

  if(typeof PrayerWidget !== 'undefined'){
    PrayerWidget.mount('home-prayer-widget', { variant: 'hero', showTimes: true });
  }

  if(typeof injectHeaderIcons === 'function'){
    setTimeout(() => injectHeaderIcons(), 0);
  }
}

function renderHomePracticePanel(){
  if(typeof SahibPractice === 'undefined' || !SahibPractice.isReady()){
    return `<section class="home-practice-panel"><div class="home-practice-loading">Opening the daybook…</div></section>`;
  }
  const snap = SahibPractice.getHomeSummary();
  const due = snap.due.slice(0, 3);
  const done = snap.completed.length;
  const waiting = snap.due.length;
  const next = snap.next;
  const tracker = snap.trackers.find(item => ['soon','due','overdue'].includes(item.state));

  if(!snap.enabled.length){
    return `<section class="home-practice-panel home-practice-panel--empty">
      <div class="home-practice-head">
        <div><span class="home-section-kicker">Daily practice · الورد</span><h2>The daybook is yours to set.</h2></div>
        <span class="home-practice-mark">${icon('practice', 20)}</span>
      </div>
      <p class="home-practice-intro">Choose a few routines you already intend to keep. Nothing is enabled for you, and nothing is turned into a score.</p>
      <div class="home-practice-empty-actions">
        <button class="home-practice-primary" onclick="openPracticeView('all')">Choose a few practices ${icon('arrow-left', 14)}</button>
        <button class="home-text-action" onclick="openPracticeForm()">Make a personal reminder</button>
      </div>
    </section>`;
  }

  const rows = due.length ? due.map(item => {
    const p = item.practice;
    const time = p.timeLabel || p.reminderTime || (p.relativeTo ? p.relativeTo : '');
    return `<div class="home-practice-row">
      <button class="home-practice-copy" onclick="openPracticeDetail('${esc(p.id)}')">
        <span class="home-practice-row-top"><span class="home-practice-time">${esc(time)}</span><span class="home-practice-status">${esc(item.status === 'overdue' ? 'Past its rhythm' : item.status === 'approaching' ? 'Approaching' : 'Waiting')}</span></span>
        <span class="home-practice-title"><span lang="ar" dir="rtl">${esc(p.titleAr || '')}</span><span>${esc(p.title)}</span></span>
        <span class="home-practice-meta">${p.schedule?.type === 'interval' ? 'A private time limit' : esc(p.summary || '')}</span>
      </button>
      <span class="home-practice-arrow">${icon('arrow-left', 14)}</span>
    </div>`;
  }).join('') : `<div class="home-practice-quiet">${icon('check', 15)}<p><strong>Nothing else is due today.</strong><span>The rest of the day is yours.</span></p></div>`;

  const completedRows = snap.completed.slice(0, 2).map(row => {
    const p = row.practice;
    return `<div class="home-practice-done-row">
      <span class="home-practice-done-check">${icon('check', 12)}</span>
      <button class="home-practice-done-copy" onclick="openPracticeDetail('${esc(p.id)}')">
        <strong>${esc(p.title)}</strong><span>Completed today</span>
      </button>
      <button class="home-text-action" onclick="practiceUndo('${esc(p.id)}')">Undo</button>
    </div>`;
  }).join('');

  return `<section class="home-practice-panel">
    <div class="home-practice-head">
      <div><span class="home-section-kicker">Daily practice · الورد</span><h2>Today’s few things</h2></div>
      <button class="home-section-link" onclick="openPracticeView('today')">Open daybook ${icon('arrow-left', 13)}</button>
    </div>
    <div class="home-practice-summary"><span>${waiting ? `${waiting} waiting` : 'A clear day'}</span><span>${done ? `${done} completed` : 'Nothing completed yet'}</span><span class="home-practice-summary-local">${icon('lock', 11)} on this device</span></div>
    <div class="home-practice-list">${rows}${completedRows}</div>
    <div class="home-practice-foot">
      <span>${tracker ? `${esc(tracker.practice.title)} · ${tracker.state === 'overdue' ? `${Math.abs(tracker.daysLeft)} days beyond your limit` : tracker.state === 'due' ? 'at your chosen limit' : `${tracker.daysLeft} days left`}` : next ? `Next · ${esc(_homeDate(next.key))} · ${esc(next.practice.title)}` : 'A quiet fortnight ahead.'}</span>
      <button class="home-text-action" onclick="showPracticeAll()">All practices</button>
    </div>
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

  return `
    <div class="quote-card home-quote-card ${isExpanded ? 'expanded' : ''}" id="quote-card" onclick="toggleHomeQuote(event)">
      <div class="quote-header">
        <div class="quote-badge">
          <span class="quote-badge-icon">${icon(badgeIconName, 14)}</span>
          <span>${badgeLabel} · ${q.time}</span>
        </div>
        <span class="quote-expand-hint">${icon(isExpanded ? 'chevron-up' : 'chevron-down', 14)}</span>
      </div>

      <div class="quote-text">${q.ar}</div>
      <div class="quote-ref">${q.ref}</div>
      ${tafsirText ? `<div class="home-reading-preview ${tafsirClass}" ${lang === 'ar' ? 'dir="rtl"' : 'dir="ltr"'}><span>Reflection</span>${esc(tafsirText.length > 170 ? `${tafsirText.slice(0, 167).trim()}…` : tafsirText)}</div>` : ''}

      <div class="quote-teaser">Open today’s tafsir ${icon('arrow-left', 13)}</div>

      <div class="quote-tafsir-wrap">
        <div class="quote-tafsir-header">
          <span class="quote-tafsir-label">${icon('book-open', 14)} Tafsir</span>
          <div class="quote-lang-toggle">
            <button class="quote-lang-btn ${lang==='ar'?'on':''}" onclick="event.stopPropagation();setQuoteLang('ar')">عربي</button>
            <button class="quote-lang-btn ${lang==='en'?'on':''}" onclick="event.stopPropagation();setQuoteLang('en')">EN</button>
          </div>
        </div>
        <div class="quote-tafsir-body ${tafsirClass}">${tafsirText}</div>
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
    renderHome();
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
