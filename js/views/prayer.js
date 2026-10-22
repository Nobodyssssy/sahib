'use strict';

/* Prayer times view: list, countdown, daily cycle, forbidden times */

let _prayerData = null;
let _countdownTimer = null;
let _forbiddenLang = 'en';
let _cycleLang = 'ar';
let _cycleHelpLang = 'en';

/* Human-friendly "X ago" for cached-at timestamps. */
function _formatAgo(ts){
  if(!ts) return '';
  const mins = Math.max(0, Math.round((Date.now() - ts) / 60000));
  if(mins < 1)   return 'just now';
  if(mins < 60)  return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if(hrs < 24)   return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

/* Absolute local time, short form, for the offline hint. */
function _formatStamp(ts){
  if(!ts) return '';
  const d = new Date(ts);
  const hh = String(d.getHours()).padStart(2,'0');
  const mm = String(d.getMinutes()).padStart(2,'0');
  const day = String(d.getDate()).padStart(2,'0');
  const mo  = String(d.getMonth()+1).padStart(2,'0');
  return `${day}/${mo} ${hh}:${mm}`;
}

let _prayerTab = 'today';

async function openPrayerView(){
  showView('view-prayer');
  _prayerTab = 'today';
  renderPrayerLoading();

  try{
    const loc = await getLocation();
    const prefs = await getPrayerPrefs();
    const today = new Date();
    const year  = today.getFullYear();
    const month = today.getMonth() + 1;

    const monthResult = await getMonth(year, month);
    const monthData = monthResult.data;
    const cachedAt = monthResult.ts || Date.now();
    const stale = !!monthResult.stale;

    _prayerData = {
      location:    loc,
      prefs,
      cachedAt,
      stale,
      monthData,
      monthYear:   year,
      monthMonth:  month,
      selectedDate: today,
      selectedDay: _findDayInMonth(monthData, today),
      nextDay:     null,
    };

    if(!_prayerData.selectedDay){
      throw new Error('No data for today');
    }

    await _loadForbiddenLang();
    await _loadCycleLang();

    renderPrayerView();
    _attachPrayerSwipe();
  }catch(err){
    console.error('[prayer-view]', err);
    renderPrayerError(err);
  }
}

function setPrayerTab(tab){
  _prayerTab = tab === 'month' ? 'month' : 'today';
  renderPrayerView();
}

function openPrayerMonthView(){
  if(document.querySelector('#view-prayer.active')){
    setPrayerTab('month');
  } else {
    _prayerTab = 'month';
    openPrayerView().then(() => setPrayerTab('month'));
  }
}

function closePrayerView(){
  if(_countdownTimer){ clearInterval(_countdownTimer); _countdownTimer = null; }
  goHome();
}

function _findDayInMonth(monthData, date){
  const target = _dateKeyOf(date);
  return monthData.find(d => d.date === target) || null;
}

function _dateKeyOf(date){
  return String(date.getDate()).padStart(2,'0') + '-' +
    String(date.getMonth()+1).padStart(2,'0') + '-' +
    date.getFullYear();
}

/* Maghrib-to-Maghrib cycle needs the following day. Mid-month that day is
   already in the loaded month; on the last day of a month it lives in the
   next month, so fetch it on demand and re-render once it arrives. */
async function _prayerEnsureNextDay(nextDate){
  const key = _dateKeyOf(nextDate);
  if(!_prayerData || _prayerData.nextDayKey === key) return;
  _prayerData.nextDayKey = key;
  const selectedKey = _dateKeyOf(_prayerData.selectedDate);
  try{
    const result = await getMonth(nextDate.getFullYear(), nextDate.getMonth() + 1);
    const day = _findDayInMonth(result.data, nextDate);
    if(!_prayerData || _dateKeyOf(_prayerData.selectedDate) !== selectedKey) return;
    _prayerData.nextDay = day || null;
    if(_prayerTab === 'today') renderPrayerView();
  }catch(err){
    _prayerData.nextDayKey = null;
    console.warn('[prayer-view] next day unavailable', err && err.message);
  }
}

function _formatGregorianDate(day){
  const parts = day.date.split('-');
  const d = parseInt(parts[0], 10);
  const m = parseInt(parts[1], 10) - 1;
  const y = parseInt(parts[2], 10);
  const dt = new Date(y, m, d);
  const months = ['January','February','March','April','May','June',
                  'July','August','September','October','November','December'];
  return `${day.weekday}, ${d} ${months[dt.getMonth()]} ${y}`;
}

function _formatHijriDate(hijri){
  if(!hijri) return '';
  const ar=window.SAHIB_I18N?.language==='ar';
  const m=ar?(hijri.monthAr||hijri.month):(hijri.month||hijri.monthAr);
  return `${hijri.day} ${m} ${hijri.year} ${ar?'هـ':'AH'}`;
}

function _parseHM(str){
  if(!str) return 0;
  const clean = String(str).trim().split(/\s+/)[0];
  const parts = clean.split(':');
  const h = parseInt(parts[0], 10);
  const m = parseInt(parts[1], 10);
  return (Number.isFinite(h) ? h : 0) * 60 + (Number.isFinite(m) ? m : 0);
}

function _formatHM(minutes){
  if(minutes == null) return '-';
  const m = ((Math.round(minutes) % 1440) + 1440) % 1440;
  const h = Math.floor(m / 60);
  const mm = m % 60;
  return String(h).padStart(2,'0') + ':' + String(mm).padStart(2,'0');
}

function _formatDuration(minutes){
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  if(h === 0) return `${m}m`;
  if(m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

function _computeForbiddenWindows(day){
  if(!day) return [];
  const fajr    = _parseHM(day.timings.Fajr);
  const sunrise = _parseHM(day.timings.Sunrise);
  const dhuhr   = _parseHM(day.timings.Dhuhr);
  const asr     = _parseHM(day.timings.Asr);
  const maghrib = _parseHM(day.timings.Maghrib);

  return [
    { key:'dawn',   labelEn:'After Fajr until sunrise', labelAr:'من الفجر حتى طلوع الشمس', startMin:fajr,       endMin:sunrise + 15 },
    { key:'zenith', labelEn:'At solar zenith',          labelAr:'عند استواء الشمس',        startMin:dhuhr - 5,  endMin:dhuhr },
    { key:'asr',    labelEn:'After Asr until Maghrib',  labelAr:'من العصر حتى غروب الشمس', startMin:asr,        endMin:maghrib },
  ];
}

function _computeForbiddenOnBar(cycle, day, nextDay){
  if(!cycle || !day || !nextDay) return [];

  const start = cycle.nightStart;
  const total = cycle.total || 1;
  const toPct = (min) => ((min - start) / total) * 100;

  const fajr    = _parseHM(nextDay.timings.Fajr)    + 1440;
  const sunrise = _parseHM(nextDay.timings.Sunrise) + 1440;
  const dhuhr   = _parseHM(nextDay.timings.Dhuhr)   + 1440;
  const asr     = _parseHM(nextDay.timings.Asr)     + 1440;
  const maghrib = _parseHM(nextDay.timings.Maghrib) + 1440;

  return [
    {
      key:'dawn',
      left:  toPct(fajr),
      width: toPct(sunrise + 15) - toPct(fajr),
      nameEn: 'Fajr to Ishraq (approx.)',
      nameAr: 'من الفجر إلى الإشراق (تقريبي)',
      rangeEn: `${_formatHM(fajr)} - ${_formatHM(sunrise + 15)}`,
      noteEn: 'General restriction on voluntary prayer after Fajr. The overlay ends 15 minutes after sunrise as a practical estimate; exceptions depend on the prayer and school.',
      noteAr: 'نهي عام عن النوافل بعد الفجر. ينتهي التظليل بعد الشروق بـ١٥ دقيقة كتقدير عملي؛ وتختلف الاستثناءات بحسب الصلاة والمذهب.',
      ref: 'Sahih Muslim 831 / 832',
      refUrl: 'https://sunnah.com/muslim:832',
    },
    {
      key:'zenith',
      left:  toPct(dhuhr - 5),
      width: toPct(dhuhr) - toPct(dhuhr - 5),
      isZenith: true,
      nameEn: 'Around solar noon (approx.)',
      nameAr: 'حول الاستواء (تقريبي)',
      rangeEn: `${_formatHM(dhuhr - 5)} - ${_formatHM(dhuhr)}`,
      noteEn: 'A 5-minute buffer before the timetable’s Dhuhr, used as an approximate guide around solar noon. It is not an independently calculated solar transit.',
      noteAr: 'هامش خمس دقائق قبل ظهر الجدول، دليل تقريبي حول الاستواء وليس حسابًا مستقلًا لعبور الشمس.',
      ref: 'Sahih Muslim 831 / 832',
      refUrl: 'https://sunnah.com/muslim:832',
    },
    {
      key:'asr',
      left:  toPct(asr),
      width: toPct(maghrib) - toPct(asr),
      nameEn: 'After Asr until Maghrib',
      nameAr: 'من العصر حتى غروب الشمس',
      rangeEn: `${_formatHM(asr)} - ${_formatHM(maghrib)}`,
      noteEn: 'General restriction on voluntary prayer after Asr until sunset, with exceptions differing by prayer and school. The Asr prayer itself is not the restricted voluntary prayer.',
      noteAr: 'نهي عام عن النوافل بعد العصر حتى الغروب، مع استثناءات تختلف بحسب الصلاة والمذهب. وصلاة العصر نفسها ليست النافلة المنهي عنها.',
      ref: 'Sahih Muslim 831 / 832',
      refUrl: 'https://sunnah.com/muslim:832',
    },
  ];
}

function _computeDailyCycle(day, nextDay){
  if(!day || !nextDay) return null;

  const mg  = _parseHM(day.timings.Maghrib);
  const rawIsha = _parseHM(day.timings.Isha);
  const ish = rawIsha < mg ? rawIsha + 1440 : rawIsha;
  const faj = _parseHM(nextDay.timings.Fajr) + 1440;
  const sr  = _parseHM(nextDay.timings.Sunrise) + 1440;
  const dh  = _parseHM(nextDay.timings.Dhuhr) + 1440;
  const asr = _parseHM(nextDay.timings.Asr) + 1440;
  const mgN = _parseHM(nextDay.timings.Maghrib) + 1440;

  const nightTotal = faj - mg;
  const third = nightTotal / 3;
  const t1_3 = mg + third;
  const t2_3 = mg + 2 * third;
  const mid  = mg + nightTotal / 2;
  const aww  = mg + 20;
  const total = mgN - mg;

  const boundaries = [
    { key:'maghrib',  label:'Maghrib',  labelAr:'المغرب',       time: mg  },
    { key:'awwabin',  label:'Awwabin',  labelAr:'الأوّابين',     time: aww },
    { key:'isha',     label:'Isha',     labelAr:'العشاء',       time: ish },
    { key:'t1_3',     label:'First third ends', labelAr:'الثلث الأول',  time: t1_3 },
    { key:'midnight', label:'Midnight', labelAr:'منتصف الليل',  time: mid },
    { key:'t2_3',     label:'Second third ends', labelAr:'الثلث الثاني', time: t2_3 },
    { key:'fajr',     label:'Fajr',     labelAr:'الفجر',        time: faj },
    { key:'sunrise',  label:'Sunrise',  labelAr:'الشروق',       time: sr  },
    { key:'dhuhr',    label:'Dhuhr',    labelAr:'الظهر',        time: dh  },
    { key:'asr',      label:'Asr',      labelAr:'العصر',        time: asr },
    { key:'maghribN', label:'Maghrib (next day)', labelAr:'المغرب', time: mgN },
  ];

  const segments = [
    {
      start: mg, end: t1_3, kind:'night',
      shortEn:'First ⅓', shortAr:'الثلث الأول',
      label:'First third of night', labelAr:'الثلث الأول من الليل',
      inlineTimes: [
        { labelEn:'Maghrib', labelAr:'المغرب', time: mg },
        { labelEn:'Isha',    labelAr:'العشاء', time: ish },
      ],
      noteEn: 'The night begins at Maghrib. Isha is marked within the night; its position does not change the equal night thirds.',
      noteAr: 'يبدأ الليل من المغرب. وتظهر العشاء ضمن الليل، ولا يغيّر موضعها تقسيمه إلى أثلاث متساوية.',
      sourceLabel: 'IslamQA 2626',
      sourceUrl: 'https://islamqa.info/en/answers/2626/what-is-salat-al-awwabin',
    },
    {
      start: t1_3, end: t2_3, kind:'night',
      shortEn:'Second ⅓', shortAr:'الثلث الثاني',
      label:'Second third of night', labelAr:'الثلث الثاني من الليل',
      inlineTimes: [
        { labelEn:'Midnight', labelAr:'منتصف الليل', time: mid },
      ],
      noteEn: 'Islamic midnight is the midpoint between Maghrib and Fajr - the latest time for Isha per some scholars.',
      noteAr: 'منتصف الليل هو النقطة الوسطى بين المغرب والفجر؛ وهو علامة زمنية وليس فترة.',
    },
    {
      start: t2_3, end: faj, kind:'last-third',
      shortEn:'Last ⅓', shortAr:'الثلث الأخير',
      label:'Last third - Tahajjud', labelAr:'الثلث الأخير - التهجد',
      noteEn: 'Best time for tahajjud and dua - our Lord descends to the lowest heaven and answers those who call upon Him.',
      noteAr: 'وقت للتهجد والدعاء والاستغفار في الثلث الأخير من الليل؛ انظر صحيح البخاري ١١٤٥.',
      sourceLabel: 'Sahih al-Bukhari 1145',
      sourceUrl: 'https://sunnah.com/bukhari:1145',
    },
    {
      start: faj, end: sr, kind:'day',
      shortEn:'Fajr', shortAr:'الفجر',
      label:'Fajr to Sunrise', labelAr:'الفجر إلى الشروق',
      noteEn: 'Dawn runs from Fajr to sunrise. The hatched guide extends 15 minutes beyond sunrise; voluntary-prayer exceptions depend on the prayer and school.',
      noteAr: 'يمتد الفجر إلى الشروق. ويضيف دليل التظليل ١٥ دقيقة بعد الشروق؛ وتختلف استثناءات النوافل بحسب الصلاة والمذهب.',
      sourceLabel: 'Sahih Muslim 832',
      sourceUrl: 'https://sunnah.com/muslim:832',
    },
    {
      start: sr, end: dh, kind:'day',
      shortEn:'Forenoon', shortAr:'الضحى',
      label:'Forenoon - Duha', labelAr:'الضحى',
      noteEn: 'The illustrated optional Duha window begins about 15 minutes after sunrise and ends 5 minutes before Dhuhr. These buffers are approximate.',
      noteAr: 'تبدأ نافذة الضحى المرسومة بعد الشروق بنحو ١٥ دقيقة وتنتهي قبل الظهر بخمس دقائق. هذه الهوامش تقريبية.',
    },
    {
      start: dh, end: asr, kind:'day',
      shortEn:'Dhuhr', shortAr:'الظهر',
      label:'Afternoon', labelAr:'الظهيرة والعصر',
      noteEn: 'Voluntary prayer is forbidden for a few minutes just before Dhuhr, while the sun is at its zenith.',
      noteAr: 'يمتد هذا الجزء من الظهر إلى العصر. ويظهر هامش الاستواء التقريبي قبل الظهر بشكل منفصل.',
    },
    {
      start: asr, end: mgN, kind:'day',
      shortEn:'Asr', shortAr:'العصر',
      label:'Asr to Maghrib', labelAr:'العصر إلى المغرب',
      noteEn: 'Voluntary prayers are forbidden after Asr until Maghrib.',
      noteAr: 'نهي عام عن النوافل بعد العصر إلى المغرب، مع استثناءات تختلف بحسب الصلاة والمذهب.',
      sourceLabel: 'Sahih Muslim 832',
      sourceUrl: 'https://sunnah.com/muslim:832',
    },
  ];

  return {
    boundaries,
    segments,
    nightStart: mg,
    nightEnd: faj,
    dayStart: faj,
    dayEnd: mgN,
    markers: {
      awwabin:  { time: aww, label:'Awwabin',  labelAr:'الأوّابين' },
      midnight: { time: mid, label:'Midnight', labelAr:'منتصف الليل' },
    },
    total,
  };
}

async function _loadCycleLang(){
  const saved = await store.getMeta('cycleLang');
  _cycleLang = (saved === 'ar' || saved === 'en') ? saved : window.SAHIB_I18N?.language || 'en';
}

function setCycleLang(lang){
  _cycleLang = (lang === 'ar') ? 'ar' : 'en';
  store.setMeta('cycleLang', _cycleLang);
  const active = document.querySelector('.view.active');
  if(active && active.id === 'view-home'){
    const cycleHost = active.querySelector('.home-tab-cycle');
    if(cycleHost && window._homeCycleData &&
       typeof _computeDailyCycle === 'function' &&
       typeof _renderDailyCycleHTML === 'function'){
      const cycle = _computeDailyCycle(window._homeCycleData.today, window._homeCycleData.nextDay);
      if(cycle){
        cycleHost.innerHTML = _renderDailyCycleHTML(cycle, window._homeCycleData.today, window._homeCycleData.nextDay);
        return;
      }
    }
    renderHome();
  } else {
    renderPrayerView();
  }
}

function _computeNightThirds(day, nextDay){
  if(!day || !nextDay) return null;
  const maghrib = _parseHM(day.timings.Maghrib);
  const fajrNext = _parseHM(nextDay.timings.Fajr) + 1440;
  const total = fajrNext - maghrib;
  if(total <= 0) return null;
  const third = total / 3;
  return {
    maghrib,
    awwabin:        maghrib + 20,
    firstThirdEnd:  maghrib + third,
    midnight:       maghrib + total / 2,
    secondThirdEnd: maghrib + 2 * third,
    fajr:           fajrNext,
    total,
  };
}

function _cycleIdlePanelHTML(){
  return `<p class="day-cycle-hint">${_cycleLang==='ar'?'اختر فترة لعرض تفاصيلها ومراجعها.':'Choose a period to see its details and references.'}</p>`;
}

function _cycleDuration(minutes){
  const n=Math.round(minutes),h=Math.floor(n/60),m=n%60;
  return _cycleLang==='ar'?`${h?h+' س ':''}${m?m+' د':''}`.trim():`${h?h+'h ':''}${m?m+'m':''}`.trim();
}

function _renderRhythmTimeline(cycle,day,nextDay){
  const ar=_cycleLang==='ar',t=(en,arabic)=>ar?arabic:en;
  const pct=min=>Math.max(0,Math.min(100,(min-cycle.nightStart)/cycle.total*100));
  const range=(start,end)=>`left:${pct(start)}%;width:${pct(end)-pct(start)}%`;
  const night=pct(cycle.nightEnd),last=cycle.segments[2];
  const sr=_parseHM(nextDay.timings.Sunrise)+1440,dh=_parseHM(nextDay.timings.Dhuhr)+1440;
  const ish=_parseHM(day.timings.Isha)+( _parseHM(day.timings.Isha)<cycle.nightStart?1440:0);
  const markers=cycle.boundaries.filter(b=>['maghrib','fajr','sunrise','dhuhr','asr','maghribN'].includes(b.key));
  const asr=_parseHM(nextDay.timings.Asr)+1440;
  const scenes=[['evening',cycle.nightStart,Math.min(ish,cycle.nightEnd)],['night',Math.min(ish,last.start),last.start],['last-night',last.start,cycle.nightEnd],['dawn',cycle.nightEnd,sr],['day',sr,asr],['sunset',asr,cycle.dayEnd]].filter(([,start,end])=>end>start);
  return `<div class="rhythm-scroll-hint">${icon('arrow-left',12)} ${t('Explore the full day →','استعرض اليوم كاملًا ←')}</div>
    <div class="rhythm-scroll" tabindex="0" role="region" aria-label="${t('Daily timeline. Scroll horizontally to explore.','خط اليوم الزمني. مرّر أفقيًا للاستعراض.')}"><div class="rhythm-chart" dir="ltr">
      <div class="rhythm-events">${markers.map(m=>`<div class="rhythm-event rhythm-event-${m.key}" style="left:${pct(m.time)}%"><span>${icon(['maghrib','maghribN','sunrise'].includes(m.key)?'sunrise':m.key==='isha'?'moon':'sun',17)}</span><strong>${esc(ar?m.labelAr:m.key==='maghribN'?'Maghrib':m.label)}</strong><time>${_formatHM(m.time)}</time></div>`).join('')}</div>
      <div class="rhythm-landscape" style="--night-edge:${night}%;--last-start:${pct(last.start)}%;--last-end:${night}%">
        <div class="rhythm-scenes" aria-hidden="true">${scenes.map(([kind,start,end])=>`<div class="rhythm-scene rhythm-scene-${kind}" data-scene="${kind}" data-start="${start}" data-end="${end}" style="${range(start,end)}"></div>`).join('')}</div>
        <span class="rhythm-moon" style="left:${pct((Math.min(ish,last.start)+last.start)/2)}%" aria-hidden="true">☾</span><span class="rhythm-sun" style="left:${pct(dh)}%" aria-hidden="true"></span>
        ${cycle.segments.map((seg,i)=>`<button class="rhythm-zone rhythm-zone-${seg.kind}" style="${range(seg.start,seg.end)}" onclick="onCycleSegTap(${i})" aria-label="${esc(ar?seg.labelAr:seg.label)} ${_formatHM(seg.start)} – ${_formatHM(seg.end)}">${seg.kind==='last-third'?`<span>✧</span><strong>${t('Last third','الثلث الأخير')}</strong>`:''}</button>`).join('')}
        <div class="rhythm-evening" style="${range(cycle.nightStart,Math.min(ish,cycle.nightEnd))}">${t('Evening','المساء')}</div>
        ${_computeForbiddenOnBar(cycle,day,nextDay).map((f,i)=>`<button class="rhythm-restricted rhythm-restricted-${f.key}" style="left:${f.left}%;width:${f.width}%" onclick="onCycleForbiddenTap(${i})" aria-label="${esc(ar?f.nameAr:f.nameEn)} ${f.rangeEn}">${f.key!=='zenith'?'<span aria-hidden="true">⊘</span>':''}</button>`).join('')}
        <button class="rhythm-sunrise-buffer" style="${range(sr,Math.min(sr+15,dh))}" onclick="onCycleForbiddenTap(0)" aria-label="${t('Sunrise to Ishraq · approximately 15 minutes','من الشروق إلى الإشراق · نحو ١٥ دقيقة')}"></button>
        <button class="rhythm-midpoint" style="left:${pct(cycle.markers.midnight.time)}%" onclick="onCycleMarkerTap('midnight')" aria-label="${t('Islamic midnight','منتصف الليل الإسلامي')} ${_formatHM(cycle.markers.midnight.time)}"><time>${_formatHM(cycle.markers.midnight.time)}</time><span>◆</span></button>
      </div>
      <div class="rhythm-lower-events"><div class="rhythm-isha-label" style="left:${pct(ish)}%"><span>${icon('moon',17)}</span><strong>${t('Isha','العشاء')}</strong><time>${_formatHM(ish)}</time></div></div>
      <div class="rhythm-brackets"><span style="${range(cycle.nightStart,cycle.nightEnd)}">${t('Night · Maghrib to Fajr','الليل · من المغرب إلى الفجر')}</span><span style="${range(cycle.dayStart,cycle.dayEnd)}">${t('Day · Fajr to Maghrib','النهار · من الفجر إلى المغرب')}</span></div>
      <div class="rhythm-third-labels">${cycle.segments.slice(0,3).map((seg,i)=>`<button class="${i===2?'rhythm-third-emphasis':''}" style="${range(seg.start,seg.end)}" onclick="onCycleSegTap(${i})">${esc(ar?seg.shortAr:seg.shortEn)}</button>`).join('')}<button class="rhythm-duha" style="${range(Math.min(sr+15,dh-5),dh-5)}" onclick="onCycleSegTap(4)">${t('Ishraq / Duha · optional worship','الإشراق / الضحى · نافلة')}</button></div>
    </div></div>`;
}

function _renderDailyCycleHTML(cycle, day, nextDay){
  if(!cycle) return '';
  const ar=_cycleLang==='ar',t=(en,arabic)=>ar?arabic:en,last=cycle.segments[2];
  return `<section class="prayer-daily-cycle-card day-repartition rhythm-dashboard" dir="${ar?'rtl':'ltr'}">
    <div class="day-repartition-head"><div><span class="day-repartition-eyebrow">${t('Maghrib to Maghrib','من المغرب إلى المغرب')}</span><h2>${t('The rhythm of your day','إيقاع يومك')}</h2></div><div class="day-cycle-controls"><button class="cycle-lang-btn ${!ar?'on':''}" onclick="setCycleLang('en')">EN</button><button class="cycle-lang-btn ${ar?'on':''}" onclick="setCycleLang('ar')">عربي</button><button class="cycle-help-btn" onclick="openDailyCycleHelp()" aria-label="${t('About the day breakdown','حول توزيع اليوم')}">?</button></div></div>
    ${_renderRhythmTimeline(cycle,day,nextDay)}
    <div class="rhythm-restriction-key"><span class="rhythm-hatch-key"></span>${t('Hatched areas: restricted voluntary-prayer windows','المناطق المخططة: أوقات النهي عن النوافل')} <span aria-hidden="true">⊘</span></div>
    <div class="rhythm-insights">
      <button class="rhythm-last-third" onclick="onCycleSegTap(2)"><span class="rhythm-last-symbol" aria-hidden="true">☾<i>✧</i></span><span class="rhythm-last-copy"><small>${t('A quiet time for prayer & dua','وقت للصلاة والدعاء')}</small><strong>${t('Last third of the night','الثلث الأخير من الليل')}</strong><span dir="ltr">${_formatHM(last.start)} <b>—</b> ${_formatHM(last.end)}</span></span><span class="rhythm-last-duration">${_cycleDuration(last.end-last.start)} ${icon('arrow-left',16)}</span></button>
      <div class="rhythm-facts"><span>${icon('moon',16)} ${t('Night','الليل')}<strong>${_cycleDuration(cycle.nightEnd-cycle.nightStart)}</strong></span><span>${icon('sun',16)} ${t('Day','النهار')}<strong>${_cycleDuration(cycle.dayEnd-cycle.dayStart)}</strong></span><button onclick="onCycleMarkerTap('midnight')"><i>◆</i> ${t('Islamic midnight','منتصف الليل الإسلامي')}<strong dir="ltr">${_formatHM(cycle.markers.midnight.time)}</strong><small>${t('A midpoint, not a duration','نقطة منتصف، وليست مدة')}</small></button></div>
    </div>
    <div class="day-repartition-grid">${cycle.segments.map((seg,i)=>`<button class="cycle-seg day-period day-period-${seg.kind}" data-idx="${i}" onclick="onCycleSegTap(${i})"><span class="day-period-icon">${icon(seg.kind==='day'?'sun':'moon',16)}</span><strong>${esc(ar?seg.shortAr:seg.shortEn)}</strong><span class="day-period-range" dir="ltr">${_formatHM(seg.start)} – ${_formatHM(seg.end)}</span><small>${_cycleDuration(seg.end-seg.start)}</small></button>`).join('')}</div>
    <details class="rhythm-guidance"><summary><span class="rhythm-hatch-key"></span>${t('Restricted voluntary-prayer windows · timing guide','أوقات النهي عن النوافل · دليل التوقيت')}</summary><p>${t('Hatching marks Fajr until 15 minutes after sunrise, the 5 minutes before Dhuhr, and Asr until Maghrib. These are approximate timing buffers, not a complete fiqh profile. Exceptions differ by prayer and school; your Asr setting changes its start time.','يشير التظليل إلى ما بعد الفجر حتى ١٥ دقيقة بعد الشروق، والخمس دقائق قبل الظهر، وما بعد العصر حتى المغرب. هذه هوامش توقيت تقريبية وليست ملف أحكام فقهيًا كاملًا. تختلف الاستثناءات باختلاف الصلاة والمذهب، ويغيّر إعداد العصر وقت بدايته.')}</p><div class="day-cycle-notes">${_computeForbiddenOnBar(cycle,day,nextDay).map((f,i)=>`<button class="cycle-forbidden" onclick="onCycleForbiddenTap(${i})">${esc(ar?f.nameAr:f.nameEn)} <span dir="ltr">${f.rangeEn}</span></button>`).join('')}</div></details>
    <div class="cycle-panel" id="cycle-panel" aria-live="polite">${_cycleIdlePanelHTML()}</div>
  </section>`;
}

function onCycleSegTap(idx){
  let day, nextDay;
  if(document.getElementById('view-home')?.classList.contains('active') && window._homeCycleData){
    day=window._homeCycleData.today;nextDay=window._homeCycleData.nextDay;
  } else if(_prayerData && _prayerData.selectedDay){
    day = _prayerData.selectedDay;
    const nd = new Date(_prayerData.selectedDate);
    nd.setDate(nd.getDate() + 1);
    nextDay = (nd.getFullYear() === _prayerData.monthYear &&
               (nd.getMonth() + 1) === _prayerData.monthMonth)
      ? _findDayInMonth(_prayerData.monthData, nd)
      : _prayerData.nextDay;
  } else if(window._homeCycleData){
    day = window._homeCycleData.today;
    nextDay = window._homeCycleData.nextDay;
  } else {
    return;
  }
  if(!day || !nextDay) return;

  const activeView = document.querySelector('.view.active');
  if(!activeView) return;
  const panel = activeView.querySelector('#cycle-panel');
  if(!panel) return;

  const currentSel = activeView.querySelector('.cycle-seg.selected');
  if(currentSel && Number(currentSel.dataset.idx) === idx){
    currentSel.classList.remove('selected');
    activeView.querySelectorAll('.cycle-forbidden').forEach(el => el.classList.remove('selected'));
    panel.innerHTML = _cycleIdlePanelHTML();
    return;
  }

  const cycle = _computeDailyCycle(day, nextDay);
  if(!cycle) return;

  const s = cycle.segments[idx];
  if(!s) return;

  activeView.querySelectorAll('.cycle-seg').forEach(el => el.classList.remove('selected'));
  activeView.querySelectorAll('.cycle-forbidden').forEach(el => el.classList.remove('selected'));
  const segEl = activeView.querySelector(`.cycle-seg[data-idx="${idx}"]`);
  if(segEl) segEl.classList.add('selected');

  const isAr = _cycleLang === 'ar';
  const name = isAr ? (s.shortAr || s.labelAr) : (s.shortEn || s.label);
  const note = isAr ? (s.noteAr || '') : (s.noteEn || '');
  const sourceLabel = s.sourceLabel || '';
  const sourceUrl = s.sourceUrl || '';

  let inlineTimesHTML = '';
  if(Array.isArray(s.inlineTimes) && s.inlineTimes.length){
    inlineTimesHTML = `<div class="cycle-panel-inline-list">
      ${s.inlineTimes.map(it => `
        <div class="cycle-panel-inline">
          <span class="cycle-panel-inline-name">${isAr ? it.labelAr : it.labelEn}</span>
          <span class="cycle-panel-inline-time">${_formatHM(it.time)}</span>
        </div>
      `).join('')}
    </div>`;
  }

  panel.innerHTML = `
    <div class="cycle-panel-inner">
      <div class="cycle-panel-row-1">
        <span class="cycle-panel-swatch cycle-legend-${s.kind}"></span>
        <span class="cycle-panel-en">${name}</span>
        <span class="cycle-panel-dur">${_cycleDuration(s.end - s.start)}</span>
      </div>
      <div class="cycle-panel-row-2">
        ${_formatHM(s.start)} \u2192 ${_formatHM(s.end)}
      </div>
      ${inlineTimesHTML}
      ${note ? `<div class="cycle-panel-note">${note}</div>` : ''}
      ${sourceUrl ? `<a class="cycle-panel-source" href="${sourceUrl}" target="_blank" rel="noopener">${sourceLabel} \u2192</a>` : ''}
    </div>`;
}

function onCycleMarkerTap(key){
  const activeView = document.querySelector('.view.active');
  if(!activeView) return;
  const panel = activeView.querySelector('#cycle-panel');
  if(!panel) return;

  const day = document.getElementById('view-home')?.classList.contains('active') && window._homeCycleData ? window._homeCycleData.today : (_prayerData && _prayerData.selectedDay)
    ? _prayerData.selectedDay
    : (window._homeCycleData && window._homeCycleData.today);
  if(!day) return;

  const isAr = _cycleLang === 'ar';
  const infos = {
    awwabin: {
      name: isAr ? 'الأوّابين' : 'Awwabin',
      time: _formatHM(_parseHM(day.timings.Maghrib) + 20),
      note: isAr ? 'Awwabin is a voluntary prayer performed after Maghrib.' : 'Awwabin is a voluntary prayer performed after Maghrib, recommended between Maghrib and Isha.',
      sourceLabel: 'IslamQA 2626',
      sourceUrl: 'https://islamqa.info/en/answers/2626/what-is-salat-al-awwabin',
    },
    midnight: {
      name: isAr ? 'منتصف الليل' : 'Islamic midnight',
      time: null,
      note: isAr
        ? 'منتصف الليل الإسلامي هو النقطة الوسطى بين المغرب والفجر، وليس بالضرورة الساعة ١٢ ليلًا.'
        : 'The midpoint between Maghrib and Fajr - not 12:00 AM. Some scholars hold that it is the latest time to pray Isha.',
    },
  };

  const info = infos[key];
  if(!info) return;

  panel.innerHTML = `<div class="cycle-panel-inner"> <div class="cycle-panel-row-1"> <span class="cycle-panel-swatch cycle-legend-marker"></span> <span class="cycle-panel-en">${info.name}</span> </div> ${info.time ? `<div class="cycle-panel-row-2">${info.time}</div>`: ''} <div class="cycle-panel-row-3"><div class="cycle-panel-note">${info.note}</div></div> ${info.sourceUrl ? `<a class="cycle-panel-source" href="${info.sourceUrl}" target="_blank" rel="noopener">${info.sourceLabel} \u2192</a>` : ''} </div>`;
}

function onCycleForbiddenTap(idx){
  let day, nextDay;
  if(document.getElementById('view-home')?.classList.contains('active') && window._homeCycleData){
    day=window._homeCycleData.today;nextDay=window._homeCycleData.nextDay;
  } else if(_prayerData && _prayerData.selectedDay){
    day = _prayerData.selectedDay;
    const nd = new Date(_prayerData.selectedDate);
    nd.setDate(nd.getDate() + 1);
    nextDay = (nd.getFullYear() === _prayerData.monthYear &&
               (nd.getMonth() + 1) === _prayerData.monthMonth)
      ? _findDayInMonth(_prayerData.monthData, nd)
      : _prayerData.nextDay;
  } else if(window._homeCycleData){
    day = window._homeCycleData.today;
    nextDay = window._homeCycleData.nextDay;
  } else {
    return;
  }
  if(!day || !nextDay) return;

  const activeView = document.querySelector('.view.active');
  if(!activeView) return;
  const panel = activeView.querySelector('#cycle-panel');
  if(!panel) return;

  activeView.querySelectorAll('.cycle-seg').forEach(el => el.classList.remove('selected'));
  activeView.querySelectorAll('.cycle-forbidden').forEach(el => el.classList.remove('selected'));

  const forbiddenEls = activeView.querySelectorAll('.cycle-forbidden');
  if(forbiddenEls[idx]) forbiddenEls[idx].classList.add('selected');

  const cycle = _computeDailyCycle(day, nextDay);
  if(!cycle) return;

  const list = _computeForbiddenOnBar(cycle, day, nextDay);
  const f = list[idx];
  if(!f) return;

  const isAr = _cycleLang === 'ar';
  const name = isAr ? f.nameAr : f.nameEn;
  const note = isAr ? f.noteAr : f.noteEn;

  panel.innerHTML = `<div class="cycle-panel-inner"> <div class="cycle-panel-row-1"> <span class="cycle-panel-swatch cycle-legend-forbidden"></span> <span class="cycle-panel-en">${name}</span> </div> <div class="cycle-panel-row-2">${f.rangeEn}</div> <div class="cycle-panel-row-3"> <div class="cycle-panel-note">${note}</div> ${f.refUrl ? `<a class="cycle-panel-source" href="${f.refUrl}" target="_blank" rel="noopener">${f.ref} \u2192</a>` : `<div class="cycle-panel-ref">${f.ref}</div>`} </div> </div>`;
}

async function _loadForbiddenLang(){
  const saved = await store.getMeta('forbiddenLang');
  _forbiddenLang = (saved === 'ar' || saved === 'en') ? saved : 'en';
}

function setForbiddenLang(lang){
  _forbiddenLang = (lang === 'ar') ? 'ar' : 'en';
  store.setMeta('forbiddenLang', _forbiddenLang);

  const card = document.querySelector('.prayer-forbidden-card');
  if(card && _prayerData && _prayerData.selectedDay){
    const forbidden = _computeForbiddenWindows(_prayerData.selectedDay);
    const isAr = _forbiddenLang === 'ar';

    card.querySelectorAll('.forbidden-lang-btn').forEach(btn => {
      const isOn = (isAr && btn.textContent.trim() === 'عربي') ||
                   (!isAr && btn.textContent.trim() === 'EN');
      btn.classList.toggle('on', isOn);
    });

    card.querySelectorAll('.forbidden-row').forEach((row, i) => {
      const w = forbidden[i];
      if(w){
        const labelEl = row.querySelector('.forbidden-label');
        if(labelEl) labelEl.textContent = isAr ? w.labelAr : w.labelEn;
      }
    });
  }

  const modalBody = document.getElementById('forbidden-note-body');
  if(modalBody){
    modalBody.innerHTML = _forbiddenModalBodyHTML();
  }
}

function _forbiddenModalBodyHTML(){
  const isAr = _forbiddenLang === 'ar';
  return `
    <div class="forbidden-hadith-label">${icon('book-open', 14)} Hadith \u00B7 الحديث</div>
    <div class="forbidden-hadith-body ${isAr?'ar':'en'}">${isAr ? FORBIDDEN_TIMES_HADITH.ar : FORBIDDEN_TIMES_HADITH.en}</div>
    <div class="forbidden-sources-label">${icon('library', 14)} Sources \u00B7 المصادر</div>
    <div class="forbidden-sources-list">
      <a href="https://sunnah.com/bukhari:5819" target="_blank" rel="noopener">Sahih al-Bukhari 5819</a>
      <a href="https://sunnah.com/bukhari:547" target="_blank" rel="noopener">Sahih al-Bukhari 547</a>
      <a href="https://sunnah.com/bukhari:548" target="_blank" rel="noopener">Sahih al-Bukhari 548</a>
      <a href="https://sunnah.com/bukhari:551" target="_blank" rel="noopener">Sahih al-Bukhari 551</a>
    </div>
    <div class="forbidden-note-label">${icon('info', 14)} Note \u00B7 ملاحظة</div>
    <div class="forbidden-note-body ${isAr?'ar':'en'}">${isAr ? FORBIDDEN_TIMES_HADITH.noteAr : FORBIDDEN_TIMES_HADITH.noteEn}</div>
  `;
}

function openForbiddenNote(){
  let modal = document.getElementById('ov-forbidden-note');
  if(!modal){
    modal = document.createElement('div');
    modal.className = 'ov center';
    modal.id = 'ov-forbidden-note';
    modal.setAttribute('onclick', 'if(event.target===this)closeForbiddenNote()');
    modal.innerHTML = `
      <div class="modal-box" style="max-width:520px">
        <div class="mh">
          <h2>Forbidden times \u00B7 أوقات النهي</h2>
          <button class="btn-close" onclick="closeForbiddenNote()" aria-label="Close">${icon('x', 16)}</button>
        </div>
        <div class="mb" id="forbidden-note-body"></div>
      </div>`;
    document.body.appendChild(modal);
  }
  document.getElementById('forbidden-note-body').innerHTML = _forbiddenModalBodyHTML();
  modal.classList.add('open');
  lockBody();
  if(typeof injectHeaderIcons === 'function'){
    setTimeout(() => injectHeaderIcons(), 0);
  }
}

function closeForbiddenNote(){
  const modal = document.getElementById('ov-forbidden-note');
  if(modal) modal.classList.remove('open');
  unlockBody();
}

function openDailyCycleHelp(){
  _cycleHelpLang = _cycleLang;
  let modal = document.getElementById('ov-cycle-help');
  if(!modal){
    modal = document.createElement('div');
    modal.className = 'ov center';
    modal.id = 'ov-cycle-help';
    modal.setAttribute('onclick', 'if(event.target===this)closeDailyCycleHelp()');
    modal.innerHTML = `
      <div class="modal-box" style="max-width:560px">
        <div class="mh">
          <h2>Daily Cycle \u00B7 الدورة اليومية</h2>
          <button class="btn-close" onclick="closeDailyCycleHelp()" aria-label="Close">${icon('x', 16)}</button>
        </div>
        <div class="mb" id="cycle-help-body"></div>
      </div>`;
    document.body.appendChild(modal);
  }
  document.getElementById('cycle-help-body').innerHTML = _cycleHelpHTML();
  modal.setAttribute('dir', _cycleHelpLang === 'ar' ? 'rtl' : 'ltr');
  modal.classList.add('open');
  lockBody();
}

function closeDailyCycleHelp(){
  const modal = document.getElementById('ov-cycle-help');
  if(modal) modal.classList.remove('open');
  unlockBody();
}

function setCycleHelpLang(lang){
  _cycleHelpLang = (lang === 'ar') ? 'ar' : 'en';
  const body = document.getElementById('cycle-help-body');
  const modal = document.getElementById('ov-cycle-help');
  if(body) body.innerHTML = _cycleHelpHTML();
  if(modal) modal.setAttribute('dir', _cycleHelpLang === 'ar' ? 'rtl' : 'ltr');
}

function _cycleHelpHTML(){
  const isAr = _cycleHelpLang === 'ar';
  const t = {
    introLabel: isAr ? 'ما هي الدورة اليومية؟' : 'What is the daily cycle?',
    intro: isAr
      ? 'يبدأ اليوم من المغرب وينتهي بالمغرب التالي. يوضح الخط الليل وأثلاثه والنهار ومواقيت الصلاة.'
      : 'The Islamic day starts at Maghrib and ends at the next Maghrib. The bar shows the full cycle from Maghrib to Maghrib, split at each prayer time.',
    lastLabel: isAr ? 'الثلث الأخير' : 'The last third',
    lastBody: isAr
      ? 'الثلث الأخير من الليل وقت للتهجد والدعاء والاستغفار؛ انظر صحيح البخاري ١١٤٥.'
      : 'The best time for tahajjud. The Prophet said: "Our Lord descends to the lowest heaven in the last third of every night and says: Who is calling upon Me that I may answer him? Who is asking of Me that I may give him? Who is seeking My forgiveness that I may forgive him?" (Sahih al-Bukhari 1145, Sahih Muslim 758)',
    midnightLabel: isAr ? 'منتصف الليل الإسلامي' : 'Islamic midnight',
    midnightBody: isAr
      ? 'منتصف الليل الإسلامي هو النقطة الوسطى بين المغرب والفجر، وليس بالضرورة الساعة ١٢ ليلًا.'
      : 'The midpoint between Maghrib and Fajr - not 12:00 AM. Some scholars hold that it is the latest time to pray Isha.',
    awwabinLabel: isAr ? 'الإشراق والضحى' : 'Ishraq / Duha',
    awwabinBody: isAr
      ? 'نافلة بعد ارتفاع الشمس وقبل الاستواء. يستخدم الرسم هامش ١٥ دقيقة بعد الشروق وخمس دقائق قبل الظهر كتقدير عملي.'
      : 'An optional prayer window after the sun has risen and before solar noon. The chart uses approximate buffers of 15 minutes after sunrise and 5 minutes before Dhuhr.',
    sourceLabel: isAr ? 'المصادر' : 'Sources',
  };

  return `
    <div class="cycle-help-content">
      <div class="cycle-help-toggle">
        <button class="cycle-help-lang-btn ${!isAr ? 'on' : ''}" onclick="setCycleHelpLang('en')">EN</button>
        <button class="cycle-help-lang-btn ${isAr ? 'on' : ''}" onclick="setCycleHelpLang('ar')">عربي</button>
      </div>
      <div class="cycle-help-section">
        <div class="cycle-help-label">${t.introLabel}</div>
        <div class="cycle-help-body ${isAr?'ar':'en'}">${t.intro}</div>
      </div>
      <div class="cycle-help-section">
        <div class="cycle-help-label">${t.lastLabel}</div>
        <div class="cycle-help-body ${isAr?'ar':'en'}">${t.lastBody}</div>
      </div>
      <div class="cycle-help-section">
        <div class="cycle-help-label">${t.midnightLabel}</div>
        <div class="cycle-help-body ${isAr?'ar':'en'}">${t.midnightBody}</div>
      </div>
      <div class="cycle-help-section">
        <div class="cycle-help-label">${t.awwabinLabel}</div>
        <div class="cycle-help-body ${isAr?'ar':'en'}">${t.awwabinBody}</div>
      </div>
      <div class="cycle-help-sources">
        <div class="cycle-help-label">${t.sourceLabel}</div>
        <a href="https://sunnah.com/bukhari:1145" target="_blank" rel="noopener">Sahih al-Bukhari 1145</a>
        <a href="https://sunnah.com/muslim:758" target="_blank" rel="noopener">Sahih Muslim 758</a>
      </div>
    </div>`;
}

function renderPrayerLoading(){
  $('prayer-body').innerHTML = `
    <div class="prayer-loading">
      <div class="prayer-spinner"></div>
      <div>Loading prayer times...</div>
    </div>`;
}

function renderPrayerError(errOrMsg){
  const message = errOrMsg && errOrMsg.message ? errOrMsg.message : String(errOrMsg || '');
  const code = errOrMsg && errOrMsg.code ? errOrMsg.code : '';
  const noLocation = code === 'NO_LOCATION' || message === 'No location set' || !message;
  const noCsv = code === 'NO_CSV' || code === 'NO_CSV_MONTH';

  const title = noLocation ? 'Choose your location' : (noCsv ? 'CSV schedule needed' : 'Could not load prayer times');
  const text = noLocation
    ? 'Pick your city manually, or use GPS for the most accurate times.'
    : noCsv
      ? message
      : esc(message);

  const iconName = noLocation ? 'map-pin' : (noCsv ? 'upload' : 'alert');
  const actions = noLocation
    ? `<button class="btn-save" onclick="openLocationPicker()">${icon('map-pin', 14)} Pick a city</button>
       <button class="btn-cancel" onclick="useGPSLocation()">${icon('compass', 14)} Use GPS</button>`
    : noCsv
      ? `<button class="btn-save" onclick="openSettings('prayer')">${icon('upload', 14)} Import a schedule</button>
         <button class="btn-cancel" onclick="onSettingProviderChange('aladhan')">${icon('layers', 14)} Use AlAdhan</button>`
      : `<button class="btn-save" onclick="openPrayerView()">${icon('rotate-ccw', 14)} Try again</button>
         <button class="btn-cancel" onclick="openSettings('prayer')">${icon('settings', 14)} Prayer settings</button>`;

  $('prayer-body').innerHTML = `
    <div class="prayer-error surface-card">
      <div class="prayer-error-icon">${icon(iconName, 40)}</div>
      <div class="prayer-error-title">${title}</div>
      <div class="prayer-error-text">${text}</div>
      <div class="prayer-error-actions">${actions}</div>
      <div class="prayer-error-tip">
        Tip: GPS only works over HTTPS. Picking a city manually works everywhere, offline, on any device.
      </div>
    </div>`;
}

function _isTodaySelected(){
  if(!_prayerData || !_prayerData.selectedDate) return false;
  const d = _prayerData.selectedDate;
  const now = new Date();
  return d.getFullYear() === now.getFullYear() &&
         d.getMonth() === now.getMonth() &&
         d.getDate() === now.getDate();
}

function _prayerSourceLabel(status){
  if(!status) return 'Sahib';
  const map = {
    'aladhan': 'AlAdhan API',
    'aladhan-cache': 'AlAdhan cache',
    'local': 'Offline calculation',
    'local-cache': 'Offline calculation',
    'last-good': 'Offline snapshot',
    'csv': 'CSV schedule'
  };
  return map[status.source] || status.providerLabel || 'Sahib';
}

function _prayerToolbarHTML(){
  const prefs = (_prayerData && _prayerData.prefs) || (typeof PRAYER_DEFAULT_PREFS !== 'undefined' ? PRAYER_DEFAULT_PREFS : { timeFormat: '24h' });
  const status = (typeof getPrayerStatus === 'function') ? getPrayerStatus() : null;
  const adjusted = typeof hasPrayerAdjustments === 'function' && hasPrayerAdjustments(prefs);
  const stale = _prayerData && _prayerData.stale;
  const source = _prayerSourceLabel(status);
  const freshness = stale
    ? `Offline · ${_formatAgo(_prayerData.cachedAt)}`
    : `Updated ${_formatAgo(_prayerData.cachedAt)}`;

  return `
    <div class="prayer-toolbar">
      <div class="prayer-toolbar-group">
        <button type="button" class="filter-chip ${_prayerTab === 'today' ? 'on' : ''}" onclick="setPrayerTab('today')">Today</button>
        <button type="button" class="filter-chip ${_prayerTab === 'month' ? 'on' : ''}" onclick="setPrayerTab('month')">Monthly</button>
        <button type="button" class="filter-chip" onclick="openSettings('prayer')">${icon('settings', 13)} Settings</button>
      </div>
      <div class="prayer-toolbar-group">
        <span class="prayer-provider-badge">${icon('layers', 13)} <strong>${esc(source)}</strong> · ${esc(freshness)}</span>
        ${adjusted ? `<span class="prayer-provider-badge">${icon('sliders', 13)} Adjustments on</span>` : ''}
      </div>
    </div>`;
}

function _renderTodayHTML(today, nextDay, cycleHTML){
  const location = _prayerData.location;
  const prefs = _prayerData.prefs || PRAYER_DEFAULT_PREFS;
  const t = today.timings;
  const isToday = _isTodaySelected();
  const next = findNextPrayer(t, new Date());
  const stale = !!_prayerData.stale;

  const prayers = [
    { name:'Fajr',    ar:'الفجر',   time: t.Fajr },
    { name:'Sunrise', ar:'الشروق',  time: t.Sunrise, isSunrise: true },
    { name:'Dhuhr',   ar:'الظهر',   time: t.Dhuhr },
    { name:'Asr',     ar:'العصر',   time: t.Asr },
    { name:'Maghrib', ar:'المغرب',  time: t.Maghrib },
    { name:'Isha',    ar:'العشاء',  time: t.Isha },
  ];

  const list = prayers.map(p => {
    const isNext = isToday && p.name === next.name && !p.isSunrise;
    const iconName = p.isSunrise ? 'sunrise' : 'circle-dot';
    return `<div class="prayer-row ${isNext ? 'next' : ''} ${p.isSunrise ? 'sunrise' : ''}">
      <span class="prayer-icon">${icon(iconName, 14)}</span>
      <span class="prayer-name">${p.name}</span>
      <span class="prayer-arabic">${p.ar}</span>
      <span class="prayer-time">${formatPrayerTime(p.time, prefs.timeFormat)}</span>
    </div>`;
  }).join('');

  const todayButton = !isToday
    ? `<button type="button" class="filter-chip" onclick="prayerGoToday()">${icon('calendar', 13)} Back to today</button>`
    : '';

  return `
    <div class="prayer-layout">
      <div class="prayer-card">
        <div class="prayer-nav-row">
          <button class="prayer-nav-btn" onclick="prayerGoPrevDay()" aria-label="Previous day">${icon('chevron-right', 18)}</button>
          <div class="prayer-date-block">
            <div class="prayer-date">${_formatGregorianDate(today)}</div>
            ${today.hijri ? `<div class="prayer-hijri">${_formatHijriDate(today.hijri)}</div>` : ''}
          </div>
          <button class="prayer-nav-btn" onclick="prayerGoNextDay()" aria-label="Next day">${icon('chevron-left', 18)}</button>
        </div>

        <div class="prayer-loc">
          ${icon('map-pin', 12)}
          ${location.label ? esc(location.label) + ' \u00B7 ' : ''}${Number(location.lat).toFixed(3)}, ${Number(location.lng).toFixed(3)}
          \u00B7 <a href="#" onclick="event.preventDefault();openLocationPicker()">Change</a>
        </div>

        <div class="prayer-updated ${stale ? 'stale' : ''}">
          ${icon(stale ? 'alert' : 'check-circle', 12)}
          ${stale ? 'Offline snapshot' : 'Updated'} \u00B7 ${_formatAgo(_prayerData.cachedAt)}
        </div>

        <div class="prayer-list-card">${list}</div>

        <div class="prayer-day-actions">
          ${todayButton}
          <button type="button" class="filter-chip" onclick="setPrayerTab('month')">${icon('calendar', 13)} Monthly overview</button>
        </div>
      </div>

      <div class="prayer-layout-side">
        <div id="prayer-view-widget" aria-label="Live next prayer"></div>

        <div class="surface-card prayer-quick-card">
          <div class="settings-section-title">Timetable tools</div>
          <div class="settings-inline-actions">
            <button type="button" class="io-btn" onclick="setPrayerTab('month')">${icon('calendar', 14)} Monthly</button>
            <button type="button" class="io-btn" onclick="printPrayerTimetable()">${icon('list', 14)} Print</button>
            <button type="button" class="io-btn" onclick="exportPrayerMonthCsv()">${icon('download', 14)} Export CSV</button>
            <button type="button" class="io-btn" onclick="openSettings('prayer')">${icon('settings', 14)} Prayer settings</button>
          </div>
          ${hasPrayerAdjustments(prefs) ? `<div class="settings-note">Times include your per-prayer minute adjustments.</div>` : ''}
        </div>
      </div>
    </div>

    ${cycleHTML}`;
}

const PRAYER_MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

function _renderMonthHTML(){
  const data = _prayerData.monthData || [];
  const prefs = _prayerData.prefs || PRAYER_DEFAULT_PREFS;
  const now = new Date();
  const label = `${PRAYER_MONTH_NAMES[_prayerData.monthMonth - 1]} ${_prayerData.monthYear}`;

  const rows = data.map(day => {
    const [d, m, y] = day.date.split('-').map(Number);
    const dt = new Date(y, m - 1, d);
    const isToday = dt.getFullYear() === now.getFullYear() &&
                    dt.getMonth() === now.getMonth() &&
                    dt.getDate() === now.getDate();
    return `<tr class="${isToday ? 'today' : ''}">
      <td class="month-day">${d} <span>${esc(day.weekday ? day.weekday.slice(0, 3) : '')}</span></td>
      <td>${formatPrayerTime(day.timings.Fajr, prefs.timeFormat)}</td>
      <td>${formatPrayerTime(day.timings.Sunrise, prefs.timeFormat)}</td>
      <td>${formatPrayerTime(day.timings.Dhuhr, prefs.timeFormat)}</td>
      <td>${formatPrayerTime(day.timings.Asr, prefs.timeFormat)}</td>
      <td>${formatPrayerTime(day.timings.Maghrib, prefs.timeFormat)}</td>
      <td>${formatPrayerTime(day.timings.Isha, prefs.timeFormat)}</td>
    </tr>`;
  }).join('');

  return `
    <div class="prayer-month-card">
      <div class="prayer-month-head">
        <button class="prayer-nav-btn" onclick="prayerMonthOffset(-1)" aria-label="Previous month">${icon('chevron-right', 18)}</button>
        <div>
          <div class="prayer-month-title">${label}</div>
          <div class="settings-file-name" style="text-align:center">${data.length} days · ${_prayerSourceLabel(getPrayerStatus())}</div>
        </div>
        <button class="prayer-nav-btn" onclick="prayerMonthOffset(1)" aria-label="Next month">${icon('chevron-left', 18)}</button>
      </div>

      <div class="month-table-wrap">
        <table class="month-table">
          <thead>
            <tr><th>Date</th><th>Fajr</th><th>Sunrise</th><th>Dhuhr</th><th>Asr</th><th>Maghrib</th><th>Isha</th></tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>

      <div class="month-legend">
        ${_prayerData.stale ? 'Offline snapshot · ' : ''}Adjusted times are shown. Location: ${esc(_prayerData.location.label || (_prayerData.location.lat.toFixed(3) + ', ' + _prayerData.location.lng.toFixed(3)))}.
      </div>

      <div class="prayer-day-actions" style="justify-content:flex-start;margin-top:14px">
        <button type="button" class="filter-chip" onclick="prayerMonthToday()">${icon('calendar', 13)} Current month</button>
        <button type="button" class="filter-chip" onclick="printPrayerTimetable()">${icon('list', 13)} Print</button>
        <button type="button" class="filter-chip" onclick="exportPrayerMonthCsv()">${icon('download', 13)} Export</button>
        <button type="button" class="filter-chip" onclick="openSettings('prayer')">${icon('settings', 13)} Settings</button>
      </div>
    </div>`;
}

function renderPrayerView(){
  if(!_prayerData || !_prayerData.selectedDay){
    renderPrayerError('No data for this day');
    return;
  }

  const today = _prayerData.selectedDay;

  if(_prayerTab === 'month'){
    $('prayer-body').innerHTML = `
      ${_prayerToolbarHTML()}
      ${_renderMonthHTML()}`;
    if(typeof PrayerWidget !== 'undefined') PrayerWidget.unmount('prayer-view-widget');
  } else {
    const nextDate = new Date(_prayerData.selectedDate);
    nextDate.setDate(nextDate.getDate() + 1);
    let nextDay =
      (nextDate.getFullYear() === _prayerData.monthYear &&
       (nextDate.getMonth() + 1) === _prayerData.monthMonth)
        ? _findDayInMonth(_prayerData.monthData, nextDate)
        : null;
    if(!nextDay && _prayerData.nextDay && _prayerData.nextDay.date === _dateKeyOf(nextDate)){
      nextDay = _prayerData.nextDay;
    }
    if(!nextDay){
      _prayerEnsureNextDay(nextDate);
    }

    const cycle = _computeDailyCycle(today, nextDay);
    const cycleHTML = cycle ? _renderDailyCycleHTML(cycle, today, nextDay) : '';
    window._homeCycleData = cycle ? { today, nextDay } : null;

    $('prayer-body').innerHTML = `
      ${_prayerToolbarHTML()}
      ${_renderTodayHTML(today, nextDay, cycleHTML)}`;

    _mountPrayerWidget();
  }

  if(typeof injectHeaderIcons === 'function'){
    setTimeout(() => injectHeaderIcons(), 0);
  }
  _attachPrayerSwipe();
}

function _mountPrayerWidget(){
  if(_prayerTab !== 'today' || typeof PrayerWidget === 'undefined') return;
  PrayerWidget.mount('prayer-view-widget', { variant: 'garden', showTimes: false, showLink: false });
}

function startCountdown(){
  /* The shared PrayerWidget ticker handles the live countdown. */
  _mountPrayerWidget();
}

async function prayerGoToday(){
  const now = new Date();
  if(now.getFullYear() !== _prayerData.monthYear || (now.getMonth() + 1) !== _prayerData.monthMonth){
    await _prayerLoadMonth(now.getFullYear(), now.getMonth() + 1, true);
    return;
  }
  _prayerData.selectedDate = now;
  _prayerData.selectedDay = _findDayInMonth(_prayerData.monthData, now);
  _prayerData.nextDay     = null;
  _prayerData.nextDayKey  = null;
  if(_prayerData.selectedDay){
    _prayerTab = 'today';
    renderPrayerView();
  }
}

async function prayerMonthOffset(delta){
  const d = new Date(_prayerData.monthYear, _prayerData.monthMonth - 1 + delta, 1);
  await _prayerLoadMonth(d.getFullYear(), d.getMonth() + 1, false);
}

async function prayerMonthToday(){
  const now = new Date();
  await _prayerLoadMonth(now.getFullYear(), now.getMonth() + 1, true);
}

async function _prayerLoadMonth(year, month, selectToday){
  try{
    const result = await getMonth(year, month);
    const now = new Date();
    const isCurrent = year === now.getFullYear() && month === now.getMonth() + 1;
    const target = (selectToday && isCurrent) ? now : new Date(year, month - 1, 1);
    const day = _findDayInMonth(result.data, target) || result.data[0];
    if(!day) throw new Error('No data for that month');

    _prayerData.monthData  = result.data;
    _prayerData.monthYear  = year;
    _prayerData.monthMonth = month;
    _prayerData.cachedAt   = result.ts || _prayerData.cachedAt;
    _prayerData.stale      = !!result.stale;
    _prayerData.selectedDate = target;
    _prayerData.selectedDay  = day;
    _prayerData.nextDay      = null;
    _prayerData.nextDayKey   = null;
    _prayerData.prefs = await getPrayerPrefs();
    renderPrayerView();
  }catch(err){
    toast(err.message || 'Could not load that month', 'alert');
    console.error('[prayer-view]', err);
  }
}

async function exportPrayerMonthCsv(){
  try{
    let data, year, month;
    if(_prayerData && _prayerData.monthData && _prayerData.monthData.length){
      data = _prayerData.monthData;
      year = _prayerData.monthYear;
      month = _prayerData.monthMonth;
    } else {
      const now = new Date();
      year = now.getFullYear();
      month = now.getMonth() + 1;
      const result = await getMonth(year, month);
      data = result.data;
    }

    const lines = ['Fajr,Shuruq,Dhuhr,Asr,Maghrib,Isha,Date,Day,Month'];
    data.forEach(day => {
      const [d, m] = day.date.split('-');
      const t = day.timings;
      lines.push([
        cleanTime(t.Fajr), cleanTime(t.Sunrise), cleanTime(t.Dhuhr),
        cleanTime(t.Asr), cleanTime(t.Maghrib), cleanTime(t.Isha),
        day.date, String(Number(d)), String(Number(m))
      ].join(','));
    });

    const blob = new Blob(['\uFEFF' + lines.join('\n') + '\n'], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `sahib-prayer-${year}-${String(month).padStart(2, '0')}.csv`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    toast('Prayer CSV exported', 'download');
  }catch(err){
    toast(err.message || 'Could not export prayer times', 'alert');
  }
}

async function printPrayerTimetable(){
  const prayerView = document.querySelector('#view-prayer.active');
  if(!prayerView){
    await openPrayerView();
  }
  setPrayerTab('month');
  setTimeout(() => window.print(), 250);
}

async function prayerGoPrevDay(){ await _prayerGoToOffset(-1); }
async function prayerGoNextDay(){ await _prayerGoToOffset(+1); }

async function _prayerGoToOffset(days){
  if(!_prayerData || !_prayerData.selectedDate) return;
  const target = new Date(_prayerData.selectedDate);
  target.setDate(target.getDate() + days);
  await _prayerLoadDay(target);
}

async function _prayerLoadDay(targetDate){
  const year  = targetDate.getFullYear();
  const month = targetDate.getMonth() + 1;

  let monthData = _prayerData.monthData;
  if(year !== _prayerData.monthYear || month !== _prayerData.monthMonth){
    try{
      const monthResult = await getMonth(year, month);
      monthData = monthResult.data;
      _prayerData.monthData   = monthData;
      _prayerData.monthYear   = year;
      _prayerData.monthMonth  = month;
      _prayerData.cachedAt    = monthResult.ts || _prayerData.cachedAt;
      _prayerData.stale       = !!monthResult.stale;
    }catch(err){
      toast('Could not load that month', 'alert');
      console.error('[prayer-view]', err);
      return;
    }
  }

  const day = _findDayInMonth(monthData, targetDate);
  if(!day){
    toast('No data for that day', 'alert');
    return;
  }

  _prayerData.selectedDate = targetDate;
  _prayerData.selectedDay  = day;
  _prayerData.nextDay      = null;
  _prayerData.nextDayKey   = null;
  _prayerData.prefs = await getPrayerPrefs();
  renderPrayerView();
}

function _attachPrayerSwipe(){
  const card = document.querySelector('.prayer-card');
  if(!card || card.dataset.swipeAttached === '1') return;

  let startX = 0, startY = 0, startTime = 0;

  card.addEventListener('touchstart', (e) => {
    if(e.touches.length !== 1) return;
    startX = e.touches[0].clientX;
    startY = e.touches[0].clientY;
    startTime = Date.now();
  }, { passive: true });

  card.addEventListener('touchend', (e) => {
    if(!e.changedTouches.length) return;
    const dx = e.changedTouches[0].clientX - startX;
    const dy = e.changedTouches[0].clientY - startY;
    const dt = Date.now() - startTime;

    if(dt > 600) return;
    if(Math.abs(dx) < 50) return;
    if(Math.abs(dx) < Math.abs(dy) * 1.2) return;

    if(dx > 0) prayerGoPrevDay();
    else prayerGoNextDay();
  }, { passive: true });

  card.dataset.swipeAttached = '1';
}

async function refreshLocation(){
  toast('Updating location...', 'compass');
  try{
    const loc = await requestGPSLocation();
    await store.setMeta('location', loc);
    await ensureCache();
    toast('Location updated', 'map-pin');
    openPrayerView();
  }catch(err){
    toast(err.message, 'alert');
  }
}
