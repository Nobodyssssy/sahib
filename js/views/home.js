'use strict';
/* Home dashboard tab state */
window._homeTab = window._homeTab || 0;   /* 0 = today card, 1 = daily cycle */

/* Home dashboard:
   Hero (Hijri + Gregorian date, location, event)
   Live next-prayer widget
   Feature cards (Adkar, Prayer, Hijri, Names, Library, Tasbih)
   Daily prayer cycle
   Quote of the day + privacy note */

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

  const adhkarCount = (typeof data !== 'undefined' && Array.isArray(data)) ? data.length : 0;
  const favCount = (typeof favs !== 'undefined' && Array.isArray(favs)) ? favs.length : 0;
  const bookCount = (typeof BOOKS !== 'undefined' && Array.isArray(BOOKS)) ? BOOKS.length : 0;

  const locationChip = location && location.lat != null
    ? `<button type="button" class="home-chip" onclick="openLocationPicker()">
        ${icon('map-pin', 14)} ${esc(location.label || `${Number(location.lat).toFixed(2)}, ${Number(location.lng).toFixed(2)}`)}
      </button>`
    : `<button type="button" class="home-chip" onclick="openLocationPicker()">
        ${icon('map-pin', 14)} Set location
      </button>`;

  host.innerHTML = `
    <div class="home-container">
      <div class="home-hero">
        <section class="home-hero-card">
          <div class="home-hero-copy">
            <div class="home-greeting">${greeting}</div>
            <div class="home-date-ar" id="home-today-date-ar">${hijriLine || gregorianLine}</div>
            <div class="home-date-en" id="home-today-date-en">${gregorianLine}</div>
          </div>
          <div class="home-hero-stats">
            <div class="home-stat">
              <span class="home-stat-icon">${icon('book-open', 16)}</span>
              <div class="home-stat-copy">
                <div class="home-stat-num">${adhkarCount}</div>
                <div class="home-stat-label">Adhkar</div>
              </div>
            </div>
            <div class="home-stat">
              <span class="home-stat-icon">${icon('star', 16)}</span>
              <div class="home-stat-copy">
                <div class="home-stat-num">${favCount}</div>
                <div class="home-stat-label">Favorites</div>
              </div>
            </div>
            <div class="home-stat">
              <span class="home-stat-icon">${icon('library', 16)}</span>
              <div class="home-stat-copy">
                <div class="home-stat-num">${bookCount}</div>
                <div class="home-stat-label">Library items</div>
              </div>
            </div>
          </div>
          <div class="home-hero-meta">
            ${locationChip}
            ${eventChip}
            <button type="button" class="home-chip" onclick="openSettings('appearance')">
              ${icon('sliders', 14)} Appearance
            </button>
          </div>
        </section>

        <div id="home-prayer-widget" class="home-prayer-widget-host" aria-live="polite"></div>
      </div>

      <div class="home-dashboard">
        <div class="home-main-col">
          <section>
            <div class="home-section-head">
              <div class="home-section-title">Explore Sahib</div>
              <button type="button" class="home-section-link" onclick="focusGlobalSearch()">Search all adhkar</button>
            </div>
            ${renderHomeFeaturesHTML()}
          </section>
        </div>

        <aside class="home-side-col">
          ${renderHomeQuoteHTML()}
          <div class="surface-card home-privacy-card">
            <div class="home-privacy-icon">${icon('check-circle', 20)}</div>
            <div>
              <div class="home-privacy-title">Your data stays on this device</div>
              <div class="home-privacy-text">No account, no analytics, no cloud sync. Adhkar, favorites, counters and prayer settings live in your browser's IndexedDB.</div>
            </div>
          </div>
        </aside>
      </div>

      ${cycleHTML ? `
        <section class="home-cycle-section home-cycle-wide">
          <div class="home-section-head">
            <div class="home-section-title">Daily prayer cycle</div>
            <button type="button" class="home-section-link" onclick="openPrayerView()">Prayer times</button>
          </div>
          ${cycleHTML}
        </section>` : ''}
    </div>
  `;

  if(typeof PrayerWidget !== 'undefined'){
    PrayerWidget.mount('home-prayer-widget', { variant: 'hero', showTimes: true });
  }

  if(typeof injectHeaderIcons === 'function'){
    setTimeout(() => injectHeaderIcons(), 0);
  }
}

function greetingForNow(date){
  const h = date.getHours();
  if(h < 5)  return 'Peaceful night · السلام عليكم';
  if(h < 12) return 'Good morning · صباح الخير';
  if(h < 17) return 'Good afternoon · طاب يومك';
  if(h < 20) return 'Good evening · مساء الخير';
  return 'Peaceful evening · مساء الخير';
}

/* Kept for older callers: today card only. The new dashboard renders the
   hero directly, but this helper remains useful for other modules. */
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
      ${(() => {
        const date = new Date();
        const hijri = (typeof getHijriParts === 'function') ? getHijriParts(date) : null;
        const weekdayAr = (typeof WEEKDAYS_AR !== 'undefined') ? WEEKDAYS_AR[date.getDay()] : '';
        if(hijri){
          return `<div class="quote-dateline">${weekdayAr} ${hijri.day} ${hijri.monthNameAr} ${hijri.year}</div>`;
        }
        return '';
      })()}
      <div class="quote-header">
        <div class="quote-badge">
          <span class="quote-badge-icon">${icon(badgeIconName, 14)}</span>
          <span>${badgeLabel} \u00B7 ${q.time}</span>
        </div>
        <span class="quote-expand-hint">${icon(isExpanded ? 'chevron-up' : 'chevron-down', 14)}</span>
      </div>

      <div class="quote-text">${q.ar}</div>
      <div class="quote-ref">${q.ref}</div>

      <div class="quote-teaser">Tap to read tafsir</div>

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
    { id:'adkar',  icon:'book-open', labelAr:'الأذكار',      labelEn:'Adkar',            subAr:'حصن المسلم',        action:'goToAdkarCategories' },
    { id:'prayer', icon:'mosque',    labelAr:'الصلاة',       labelEn:'Prayer times',     subAr:'مواقيت الصلاة',     action:'openPrayerView' },
    { id:'hijri',  icon:'calendar',  labelAr:'التقويم',      labelEn:'Hijri calendar',   subAr:'الأحداث الإسلامية', action:'openHijriView' },
    { id:'asma',   icon:'sparkles',  labelAr:'أسماء الله',   labelEn:'99 Names',         subAr:'الأسماء الحسنى',    action:'openAsmaView' },
    { id:'books',  icon:'library',   labelAr:'المكتبة',      labelEn:'Library',          subAr:'الكتب الإسلامية',   action:'openBooksView' },
    { id:'tasbih', icon:'beads',     labelAr:'التسبيح',      labelEn:'Tasbih',           subAr:'مسبحة إلكترونية',   action:'openTasbihView' }
  ];

  return `
    <div class="home-features-grid">
      ${features.map(f => `
        <button type="button" class="home-feature-card feature-${f.id}" onclick="${f.action}()">
          <span class="home-feature-icon">${icon(f.icon, 23)}</span>
          <span class="home-feature-text">
            <span class="home-feature-label-ar">${f.labelAr}</span>
            <span class="home-feature-label-en">${f.labelEn}</span>
            <span class="home-feature-sub">${f.subAr}</span>
          </span>
          <span class="home-feature-arrow">${icon('chevron-left', 15)}</span>
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
