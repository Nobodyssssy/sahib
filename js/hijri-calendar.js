'use strict';

/* ═══════════════════════════════════════════════════════════
   Hijri calendar — month grid generator
   • Uses Intl.DateTimeFormat with islamic-umalqura calendar
   • Converts a Hijri (year, month) to a 7-column grid
   • Detects events + builds upcoming-event lists
   ═══════════════════════════════════════════════════════════ */

const HIJRI_MONTHS_NAMES_AR = [
  'محرم', 'صفر', 'ربيع الأول', 'ربيع الثاني',
  'جمادى الأولى', 'جمادى الآخرة', 'رجب', 'شعبان',
  'رمضان', 'شوال', 'ذو القعدة', 'ذو الحجة'
];

const HIJRI_MONTHS_NAMES_EN = [
  'Muharram', 'Safar', "Rabi' al-Awwal", "Rabi' al-Thani",
  'Jumada al-Ula', 'Jumada al-Akhirah', 'Rajab', "Sha'ban",
  'Ramadan', 'Shawwal', "Dhul-Qa'dah", 'Dhul-Hijjah'
];

const WEEKDAY_HEADERS_AR = ['أحد', 'إثنين', 'ثلاثاء', 'أربعاء', 'خميس', 'جمعة', 'سبت'];
const WEEKDAY_HEADERS_EN = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/* ═══════════════════════════════════════════════════════════
   Get the Hijri parts of a Gregorian date — same as dates.js
   ═══════════════════════════════════════════════════════════ */
function getHijriFromGregorian(date){
  try{
    const fmt = new Intl.DateTimeFormat('en-u-ca-islamic-umalqura', {
      day:   'numeric',
      month: 'numeric',
      year:  'numeric',
    });
    const parts = fmt.formatToParts(date);
    const out = { day: 1, month: 0, year: 1447 };
    for(const p of parts){
      if(p.type === 'day')   out.day   = parseInt(p.value, 10);
      if(p.type === 'month') out.month = parseInt(p.value, 10);  /* 1-indexed */
      if(p.type === 'year')  out.year  = parseInt(p.value.replace(/[^0-9]/g, ''), 10);
    }
    return out;
  }catch(err){
    console.warn('[hijri-calendar]', err);
    return null;
  }
}

/* ═══════════════════════════════════════════════════════════
   Find the Gregorian date corresponding to a Hijri date
   Brute-force scan: from a guess, walk day by day until it matches.
   Bounded so it never loops forever.
   ═══════════════════════════════════════════════════════════ */
function gregorianFromHijri(hijriYear, hijriMonth, hijriDay){
  /* Anchor: 1 Muharram 1448 AH = 26 June 2026 (verified) */
  const anchor = new Date(2026, 5, 26);
  const anchorHijriYear = 1448;

  /* Days per Hijri year ≈ 354.36 */
  const yearsDiff = hijriYear - anchorHijriYear;
  const yearOffsetDays = Math.round(yearsDiff * 354.367);

  /* Cumulative days from Muharram 1 to start of each month (1-indexed: [null, 0, 30, 59, ...]) */
  const monthOffsets = [null, 0, 30, 59, 89, 118, 148, 177, 207, 236, 266, 295, 325];
  const monthOffsetDays = monthOffsets[hijriMonth] || 0;
  const dayOffsetDays = (hijriDay - 1);

  const guess = new Date(anchor);
  guess.setDate(anchor.getDate() + yearOffsetDays + monthOffsetDays + dayOffsetDays);

  /* Scan ±35 days for the exact match (handles 29 vs 30 day month variation) */
  const target = { y: hijriYear, m: hijriMonth, d: hijriDay };

  for(let offset = -35; offset <= 35; offset++){
    const candidate = new Date(guess);
    candidate.setDate(guess.getDate() + offset);
    const h = getHijriFromGregorian(candidate);
    if(!h) continue;
    if(h.year === target.y && h.month === target.m && h.day === target.d){
      return candidate;
    }
  }
  return null;
}

/* ═══════════════════════════════════════════════════════════
   Build the month grid
   Returns:
     {
       year, month,                       // Hijri
       monthNameAr, monthNameEn,
       weekdayHeadersAr, weekdayHeadersEn,
       days: [
         { day, gregorian, isToday, isFriday, events: [], isCurrentMonth: true/false }
       ]
     }
   ═══════════════════════════════════════════════════════════ */
function buildHijriMonthGrid(hijriYear, hijriMonth){
  const todayHijri = getHijriFromGregorian(new Date());
  const todayStr = new Date().toDateString();

  /* Find the Gregorian date of day 1 of this Hijri month */
  const firstGregorian = gregorianFromHijri(hijriYear, hijriMonth, 1);
  if(!firstGregorian){
    /* Fallback: show empty grid */
    return {
      year: hijriYear, month: hijriMonth,
      monthNameAr: HIJRI_MONTHS_NAMES_AR[hijriMonth - 1],
      monthNameEn: HIJRI_MONTHS_NAMES_EN[hijriMonth - 1],
      weekdayHeadersAr: WEEKDAY_HEADERS_AR,
      weekdayHeadersEn: WEEKDAY_HEADERS_EN,
      days: [],
    };
  }

  /* Pad start so the first cell aligns with the correct weekday */
  const startWeekday = firstGregorian.getDay();   /* 0 = Sunday */
  const days = [];

  /* Add empty cells for alignment */
  for(let i = 0; i < startWeekday; i++){
    days.push({ isEmpty: true });
  }

  /* Walk day by day until the Hijri month changes */
  let cursor = new Date(firstGregorian);
  let safety = 40;   /* Hijri months are 29-30 days; 40 is safe */

  while(safety-- > 0){
    const h = getHijriFromGregorian(cursor);
    if(!h) break;
    if(h.year !== hijriYear || h.month !== hijriMonth) break;

    const gregorianCopy = new Date(cursor);
    const isToday = gregorianCopy.toDateString() === todayStr;
    const isFriday = gregorianCopy.getDay() === 5;

    /* Match events for this Hijri day */
    const dayEvents = getEventsForHijriDate(hijriMonth, h.day, gregorianCopy);

    days.push({
      isEmpty: false,
      day: h.day,
      gregorian: gregorianCopy,
      gregorianDay: gregorianCopy.getDate(),
      isToday,
      isFriday,
      events: dayEvents,
    });

    cursor.setDate(cursor.getDate() + 1);
  }

  return {
    year: hijriYear,
    month: hijriMonth,
    monthNameAr: HIJRI_MONTHS_NAMES_AR[hijriMonth - 1],
    monthNameEn: HIJRI_MONTHS_NAMES_EN[hijriMonth - 1],
    weekdayHeadersAr: WEEKDAY_HEADERS_AR,
    weekdayHeadersEn: WEEKDAY_HEADERS_EN,
    days,
  };
}

/* ═══════════════════════════════════════════════════════════
   Today's Hijri date — for convenience
   ═══════════════════════════════════════════════════════════ */
function getTodayHijri(){
  return getHijriFromGregorian(new Date());
}

/* ═══════════════════════════════════════════════════════════
   Get today's events if any (for header banner)
   ═══════════════════════════════════════════════════════════ */
function getTodaysEvents(){
  const today = getTodayHijri();
  if(!today) return [];
  return getEventsForHijriDate(today.month, today.day, new Date());
}