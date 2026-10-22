'use strict';

/* Hijri calendar view - month grid, event markers, day tap, event modal */

let _hijriYear  = null;
let _hijriMonth = null;
let _calendarLang = 'ar';

async function openHijriView(){
  const today = getTodayHijri();
  if(today){
    _hijriYear  = today.year;
    _hijriMonth = today.month;
  } else {
    _hijriYear  = 1448;
    _hijriMonth = 1;
  }
  showView('view-hijri');
  renderHijriCalendar();
}

function closeHijriView(){
  goHome();
}

function hijriPrevMonth(){
  _hijriMonth--;
  if(_hijriMonth < 1){ _hijriMonth = 12; _hijriYear--; }
  renderHijriCalendar();
}

function hijriNextMonth(){
  _hijriMonth++;
  if(_hijriMonth > 12){ _hijriMonth = 1; _hijriYear++; }
  renderHijriCalendar();
}

function hijriGoToday(){
  const today = getTodayHijri();
  if(today){
    _hijriYear  = today.year;
    _hijriMonth = today.month;
  }
  renderHijriCalendar();
}

function _attachHijriSwipe(){
  const grid = document.querySelector('.hijri-grid');
  if(!grid || grid.dataset.swipeAttached === '1') return;

  let startX = 0, startY = 0, startTime = 0;

  grid.addEventListener('touchstart', (e) => {
    if(e.touches.length !== 1) return;
    startX = e.touches[0].clientX;
    startY = e.touches[0].clientY;
    startTime = Date.now();
  }, { passive: true });

  grid.addEventListener('touchend', (e) => {
    if(!e.changedTouches.length) return;
    const dx = e.changedTouches[0].clientX - startX;
    const dy = e.changedTouches[0].clientY - startY;
    const dt = Date.now() - startTime;

    if(dt > 600) return;
    if(Math.abs(dx) < 50) return;
    if(Math.abs(dx) < Math.abs(dy) * 1.2) return;

    if(dx > 0) hijriPrevMonth();
    else hijriNextMonth();
  }, { passive: true });

  grid.dataset.swipeAttached = '1';
}

function toggleCalendarLang(){
  _calendarLang = (_calendarLang === 'ar') ? 'en' : 'ar';
  renderHijriCalendar();
}

function renderHijriCalendar(){
  const host = $('hijri-body');
  if(!host) return;

  const grid = buildHijriMonthGrid(_hijriYear, _hijriMonth);
  const monthName = _calendarLang === 'ar' ? grid.monthNameAr : grid.monthNameEn;
  const weekdayHeaders = _calendarLang === 'ar' ? grid.weekdayHeadersAr : grid.weekdayHeadersEn;
  const yearDisplay = _calendarLang === 'ar' ? `${grid.year} هـ` : `${grid.year} AH`;

  const weekRow = weekdayHeaders.map(w =>
    `<div class="hijri-weekday">${w}</div>`
  ).join('');

  const dayCells = grid.days.map((d, idx) => {
    if(d.isEmpty) return `<div class="hijri-cell empty"></div>`;

    const hasEvents = d.events && d.events.length > 0;
    const classes = [
      'hijri-cell',
      d.isToday ? 'today' : '',
      d.isFriday ? 'friday' : '',
      hasEvents ? 'has-event' : '',
    ].filter(Boolean).join(' ');

    let dotHTML = '';
    if(hasEvents){
      const primary = d.events[0];
      const colorVar = eventColor(primary.type);
      dotHTML = `<span class="hijri-event-dot" style="background:${colorVar}"></span>`;
    }

    return `<button type="button" class="${classes}" onclick="onHijriDayClick(${idx})" aria-label="${d.day} ${esc(monthName)} ${grid.year}">
      <div class="hijri-day-num">${d.day}</div>
      <div class="hijri-day-greg">${d.gregorianDay}</div>
      ${dotHTML}
    </button>`;
  }).join('');

  const upcoming = _getUpcomingListForView(grid);

  host.innerHTML = `
    <div class="hijri-header">
      <button class="hijri-nav-btn" onclick="hijriPrevMonth()" aria-label="Previous month">${icon('chevron-right', 18)}</button>
      <div class="hijri-title-wrap" onclick="toggleCalendarLang()">
        <div class="hijri-month-title">${monthName}</div>
        <div class="hijri-year-sub">
          ${yearDisplay}
          <span class="hijri-lang-badge">${_calendarLang === 'ar' ? 'EN' : 'عربي'}</span>
        </div>
      </div>
      <button class="hijri-nav-btn" onclick="hijriNextMonth()" aria-label="Next month">${icon('chevron-left', 18)}</button>
    </div>

    <div class="hijri-grid">
      ${weekRow}
      ${dayCells}
    </div>

    <div class="hijri-today-btn-wrap">
      <button class="btn-cancel" onclick="hijriGoToday()">
        ${icon('rotate-ccw', 14)}
        <span>${_calendarLang === 'ar' ? 'اليوم' : 'Today'}</span>
      </button>
    </div>

    ${upcoming.length ? `
      <div class="hijri-upcoming">
        <div class="hijri-upcoming-title">${_calendarLang === 'ar' ? 'أحداث الشهر' : 'Events this month'}</div>
        ${upcoming.map(e => {
          return `
          <div class="hijri-upcoming-row" onclick="openHijriEvent('${e.event.id}')">
            <span class="hijri-upcoming-icon">${icon(EVENT_ICONS[e.event.type] || 'calendar', 14)}</span>
            <span class="hijri-upcoming-name">${_calendarLang === 'ar' ? e.event.nameAr : e.event.nameEn}</span>
            <span class="hijri-upcoming-day">${e.dayLabel}</span>
          </div>
        `;}).join('')}
      </div>
    ` : ''}
  `;

  window._hijriGrid = grid;

  if(typeof injectHeaderIcons === 'function'){
    setTimeout(() => injectHeaderIcons(), 0);
  }

  _attachHijriSwipe();
}

function _getUpcomingListForView(grid){
  const seen = new Set();
  const list = [];
  grid.days.forEach(d => {
    if(d.isEmpty || !d.events) return;
    d.events.forEach(ev => {
      if(seen.has(ev.id)) return;
      seen.add(ev.id);

      let dayLabel;
      if(Array.isArray(ev.hijriDate.weekdays)){
        const names = _calendarLang === 'ar'
          ? ['أحد', 'إثنين', 'ثلاثاء', 'أربعاء', 'خميس', 'جمعة', 'سبت']
          : ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        dayLabel = ev.hijriDate.weekdays.map(w => names[w]).join(' \u00B7 ');
      } else {
        dayLabel = d.day;
      }

      list.push({ event: ev, day: d.day, dayLabel });
    });
  });
  return list;
}

function eventColor(type){
  switch(type){
    case 'major':       return 'var(--red)';
    case 'recommended': return 'var(--accent)';
    case 'sacred':      return 'var(--accent2)';
    case 'weekly':      return 'var(--blue)';
    case 'reflection':  return 'var(--text3)';
    default:            return 'var(--accent)';
  }
}

function onHijriDayClick(idx){
  const grid = window._hijriGrid;
  if(!grid) return;
  const cell = grid.days[idx];
  if(!cell || cell.isEmpty) return;

  if(!cell.events || !cell.events.length){
    toast(`${cell.day} ${grid.monthNameEn} \u00B7 ${cell.gregorianDay}/${cell.gregorian.getMonth()+1}`);
    return;
  }

  openHijriEvent(cell.events[0].id);
}

function openHijriEvent(eventId){
  const ev = HIJRI_EVENTS.find(e => e.id === eventId);
  if(!ev){ toast('Event not found'); return; }

  let modal = $('ov-hijri-event');
  if(!modal){
    modal = document.createElement('div');
    modal.className = 'ov center';
    modal.id = 'ov-hijri-event';
    modal.setAttribute('onclick', 'if(event.target===this)closeHijriEvent()');
    modal.innerHTML = `
      <div class="modal-box" style="max-width:520px">
        <div class="mh">
          <h2 id="he-title"></h2>
          <button class="btn-close" onclick="closeHijriEvent()" aria-label="Close">${icon('x', 16)}</button>
        </div>
        <div class="mb" id="he-body"></div>
      </div>`;
    document.body.appendChild(modal);
  }

  $('he-title').innerHTML = `${icon(EVENT_ICONS[ev.type] || 'calendar', 16)} ${_calendarLang === 'ar' ? ev.nameAr : ev.nameEn}`;
  $('he-body').innerHTML = _renderEventDetail(ev);

  modal.classList.add('open');
  lockBody();
}

function closeHijriEvent(){
  const modal = $('ov-hijri-event');
  if(modal) modal.classList.remove('open');
  unlockBody();
}

function _renderEventDetail(ev){
  const lang = _calendarLang;
  const desc   = lang === 'ar' ? ev.descAr : ev.descEn;
  const virtue = lang === 'ar' ? ev.virtueAr : ev.virtueEn;
  const acts   = lang === 'ar' ? ev.actsAr : ev.actsEn;
  const prep   = lang === 'ar' ? ev.prepAr : ev.prepEn;
  const dhikr  = ev.specialDhikr;

  const sections = [];

  if(desc){
    sections.push(`
      <div class="hijri-sec">
        <div class="hijri-sec-label">${icon('book-open', 14)} ${lang === 'ar' ? 'ما هو' : 'What it is'}</div>
        <div class="hijri-sec-body ${lang === 'ar' ? 'ar' : 'en'}">${desc}</div>
      </div>`);
  }

  if(virtue){
    sections.push(`
      <div class="hijri-sec">
        <div class="hijri-sec-label">${icon('sparkles', 14)} ${lang === 'ar' ? 'الفضل' : 'Virtue'}</div>
        <div class="hijri-sec-body ${lang === 'ar' ? 'ar' : 'en'}">${virtue}</div>
      </div>`);
  }

  if(acts && acts.length){
    sections.push(`
      <div class="hijri-sec">
        <div class="hijri-sec-label">${icon('mosque', 14)} ${lang === 'ar' ? 'ما يُستحب فعله' : 'Recommended acts'}</div>
        <ul class="hijri-sec-list ${lang === 'ar' ? 'ar' : 'en'}">
          ${acts.map(a => `<li>${a}</li>`).join('')}
        </ul>
      </div>`);
  }

  if(prep){
    sections.push(`
      <div class="hijri-sec">
        <div class="hijri-sec-label">${icon('list', 14)} ${lang === 'ar' ? 'الاستعداد' : 'Preparation'}</div>
        <div class="hijri-sec-body ${lang === 'ar' ? 'ar' : 'en'}">${prep}</div>
      </div>`);
  }

  if(dhikr && dhikr.ar){
    sections.push(`
      <div class="hijri-sec hijri-dhikr-sec">
        <div class="hijri-sec-label">${icon('hand-heart', 14)} ${lang === 'ar' ? 'ذكر خاص بهذا اليوم' : 'Special dhikr'}</div>
        <div class="hijri-dhikr-ar">${dhikr.ar}</div>
        <div class="hijri-dhikr-en">${dhikr.en}</div>
        <div class="hijri-dhikr-count">${dhikr.count}</div>
        ${dhikr.source && dhikr.source.url ? `<a class="hijri-source-link" href="${dhikr.source.url}" target="_blank" rel="noopener">${icon('external-link', 12)} ${dhikr.source.ref}</a>` : (dhikr.source && dhikr.source.ref ? `<div class="hijri-dhikr-source">${dhikr.source.ref}</div>` : '')}
      </div>`);
  }

  if(ev.sources && ev.sources.length){
    sections.push(`
      <div class="hijri-sec">
        <div class="hijri-sec-label">${icon('library', 14)} ${lang === 'ar' ? 'المصادر' : 'Sources'}</div>
        <ul class="hijri-sources-list">
          ${ev.sources.map(s => s.url
            ? `<li><a href="${s.url}" target="_blank" rel="noopener">${s.ref}</a></li>`
            : `<li>${s.ref}</li>`
          ).join('')}
        </ul>
      </div>`);
  }

  return sections.join('');
}