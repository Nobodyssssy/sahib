'use strict';

/* ==========================================================================
   SAHIB · DAILY PRACTICE CATALOG
   Default practices are invitations, not obligations. Everything ships
   disabled; the user chooses what to track and when.

   `status` is shown in the interface:
     recommended  — a well-known recommended practice
     sunnah       — a reported Sunnah, with school differences noted
     sourced-limit— a sourced maximum interval, not a universal deadline
     seasonal     — tied to a Hijri season or date
     personal     — a user-owned routine with no religious ruling implied

   Sources are references, not verbatim quotations. Wording is deliberately
   cautious where scholars differ. No practice is assigned a frequency that
   its source does not support.
   ========================================================================== */

const PRACTICE_CATEGORIES = [
  { id: 'daily',    label: 'Daily worship',    labelAr: 'الورد اليومي', blurb: 'Anchors that return each day.' },
  { id: 'jumuah',   label: "Jumu'ah",          labelAr: 'الجمعة',      blurb: 'Preparation, reading and salawat.' },
  { id: 'fitrah',   label: 'Fitrah care',      labelAr: 'الفطرة',      blurb: 'Private cleanliness, on your own rhythm.' },
  { id: 'weekly',   label: 'Weekly & monthly', labelAr: 'الأسبوع والشهر', blurb: 'Optional rhythms tied to the calendar.' },
  { id: 'seasonal', label: 'Seasons',          labelAr: 'المواسم',      blurb: 'Ramadan, Dhul-Hijjah and the lunar year.' },
  { id: 'personal', label: 'Personal',         labelAr: 'شخصي',         blurb: 'Your own routines, without a religious label.' }
];

const PRACTICE_STATUS_LABELS = {
  recommended: 'Recommended',
  sunnah: 'Sunnah',
  'sourced-limit': 'Sourced limit',
  seasonal: 'Seasonal',
  personal: 'Personal',
  optional: 'Optional'
};

const PRACTICE_CATALOG = [
  {
    id: 'morning-adhkar',
    title: 'Morning adhkar',
    titleAr: 'أذكار الصباح',
    category: 'daily',
    status: 'recommended',
    summary: 'Begin the day with the morning remembrances already collected in Sahib.',
    schedule: { type: 'daily' },
    relativeTo: 'Fajr',
    offsetMinutes: 30,
    timeLabel: 'After Fajr',
    advanceMinutes: 0,
    link: { label: 'Open morning adhkar', action: 'openCat', arg: 'sabah' },
    source: 'Qur’an 33:41–42; Hisn al-Muslim 75–76',
    sourceUrl: 'https://quran.com/33/41-42',
    sourceNote: 'The Qur’an commands remembrance morning and evening. Sahib links to its existing adhkar collection rather than prescribing a new count.'
  },
  {
    id: 'evening-adhkar',
    title: 'Evening adhkar',
    titleAr: 'أذكار المساء',
    category: 'daily',
    status: 'recommended',
    summary: 'Close the day with the evening remembrances from the Sahib collection.',
    schedule: { type: 'daily' },
    relativeTo: 'Maghrib',
    offsetMinutes: 30,
    timeLabel: 'After Maghrib',
    advanceMinutes: 0,
    link: { label: 'Open evening adhkar', action: 'openCat', arg: 'masaa' },
    source: 'Qur’an 33:41–42; Hisn al-Muslim 75–76',
    sourceUrl: 'https://quran.com/33/41-42',
    sourceNote: 'A single daily prompt; the linked collection holds the full morning and evening texts and their existing source notes.'
  },
  {
    id: 'after-salah-adhkar',
    title: 'Adhkar after salah',
    titleAr: 'أذكار بعد الصلاة',
    category: 'daily',
    status: 'recommended',
    summary: 'A daily nudge to the remembrances said after the prescribed prayers.',
    schedule: { type: 'daily' },
    relativeTo: 'Dhuhr',
    offsetMinutes: 10,
    timeLabel: 'After Dhuhr',
    advanceMinutes: 0,
    link: { label: 'Open adhkar after prayer', action: 'openCat', arg: 'salah_after' },
    source: 'Sahih Muslim 597; Hisn al-Muslim 65',
    sourceUrl: 'https://sunnah.com/muslim:597',
    sourceNote: 'Sahib provides one daily prompt and links to the after-prayer collection; this is not a claim that one reminder replaces each prayer’s adhkar.'
  },
  {
    id: 'quran-reading',
    title: 'Qur’an reading',
    titleAr: 'تلاوة القرآن',
    category: 'daily',
    status: 'personal',
    summary: 'Keep a personal reading appointment. No amount or streak is assumed.',
    schedule: { type: 'daily' },
    reminderTime: '21:00',
    timeLabel: 'Evening',
    advanceMinutes: 10,
    source: 'Personal goal; Qur’an 73:4 encourages measured recitation',
    sourceUrl: 'https://quran.com/73/4',
    sourceNote: 'Sahib does not set a daily page or minute target. Choose a realistic personal goal and adjust it without guilt.'
  },
  {
    id: 'friday-ghusl',
    title: "Ghusl for Jumu'ah",
    titleAr: 'غسل الجمعة',
    category: 'jumuah',
    status: 'sunnah',
    summary: 'Make Friday preparation unhurried and clean.',
    schedule: { type: 'weekly', days: [5] },
    relativeTo: 'Dhuhr',
    offsetMinutes: -90,
    timeLabel: 'Before Jumu’ah',
    advanceMinutes: 30,
    source: 'Sahih al-Bukhari 877; Sahih Muslim 846',
    sourceUrl: 'https://sunnah.com/bukhari:877',
    sourceNote: 'The reports establish Friday bathing as a strongly emphasized practice. Schools differ on its legal status in different circumstances; this reminder does not label it obligatory.'
  },
  {
    id: 'friday-kahf',
    title: 'Surah al-Kahf',
    titleAr: 'سورة الكهف',
    category: 'jumuah',
    status: 'recommended',
    summary: 'Set aside time for the Friday recitation.',
    schedule: { type: 'weekly', days: [5] },
    reminderTime: '08:00',
    timeLabel: 'Friday',
    advanceMinutes: 15,
    source: 'Reported in al-Hakim 2/368 and al-Bayhaqi; graded hasan by some scholars',
    sourceUrl: 'https://sunnah.com/search?q=al-Kahf',
    sourceNote: 'The Friday virtue is reported through chains that scholars have discussed. Sahib presents it as a recommended practice, not an established obligation.'
  },
  {
    id: 'friday-salawat',
    title: 'Salawat on Friday',
    titleAr: 'الصلاة على النبي ﷺ',
    category: 'jumuah',
    status: 'recommended',
    summary: 'A quiet Friday habit of sending salawat upon the Prophet ﷺ.',
    schedule: { type: 'weekly', days: [5] },
    reminderTime: '09:00',
    timeLabel: 'Friday',
    advanceMinutes: 0,
    source: 'Qur’an 33:56; Abu Dawud 1047 (graded hasan by some scholars)',
    sourceUrl: 'https://quran.com/33/56',
    sourceNote: 'The command to send salawat is clear in the Qur’an. The Friday-specific reports are graded differently; treat this as a recommended habit, not a measured obligation.'
  },
  {
    id: 'monday-thursday-fast',
    title: 'Monday & Thursday fast',
    titleAr: 'صيام الاثنين والخميس',
    category: 'weekly',
    status: 'recommended',
    summary: 'An optional weekly fast, with suhoor timing drawn from your local Fajr.',
    schedule: { type: 'weekly', days: [1, 4] },
    relativeTo: 'Fajr',
    offsetMinutes: -60,
    timeLabel: 'Suhoor',
    advanceMinutes: 0,
    exclude: [
      { hijriMonth: 10, hijriDays: [1] },
      { hijriMonth: 12, hijriDays: [10, 11, 12, 13] }
    ],
    source: 'Sahih Muslim 1162; Jami‘ al-Tirmidhi 747',
    sourceUrl: 'https://sunnah.com/muslim:1162',
    sourceNote: 'Sahib skips dates that fall on Eid or the days of Tashriq. Voluntary fasting is optional and may not suit every person; consult a qualified scholar or clinician where needed.'
  },
  {
    id: 'white-days-fast',
    title: 'The white days',
    titleAr: 'الأيام البيض',
    category: 'weekly',
    status: 'recommended',
    summary: 'Optional fasting on the 13th, 14th and 15th of the Hijri month.',
    schedule: { type: 'hijri-monthly', days: [13, 14, 15] },
    relativeTo: 'Fajr',
    offsetMinutes: -60,
    timeLabel: 'Suhoor',
    advanceMinutes: 0,
    exclude: [
      { hijriMonth: 10, hijriDays: [1] },
      { hijriMonth: 12, hijriDays: [10, 11, 12, 13] }
    ],
    source: 'Sunan Abi Dawud 2449; Sunan al-Nasa’i 2422',
    sourceUrl: 'https://sunnah.com/abudawud:2449',
    sourceNote: 'Sahib uses the browser’s Umm al-Qura Hijri calendar. Moon-sighting conventions can differ by a day; the reminder is a prompt, not a ruling.'
  },
  {
    id: 'arafah-fast',
    title: 'Fast of Arafah',
    titleAr: 'صيام يوم عرفة',
    category: 'seasonal',
    status: 'recommended',
    summary: 'A seasonal reminder for those not performing Hajj.',
    schedule: { type: 'hijri-yearly', month: 12, days: [9] },
    relativeTo: 'Fajr',
    offsetMinutes: -60,
    timeLabel: 'Suhoor',
    advanceMinutes: 60,
    source: 'Sahih Muslim 1162',
    sourceUrl: 'https://sunnah.com/muslim:1162',
    sourceNote: 'The report concerns non-pilgrims; pilgrims at Arafah do not fast. Date and applicability can depend on local moon-sighting and personal circumstances.'
  },
  {
    id: 'dhul-hijjah-ten',
    title: 'First ten of Dhul-Hijjah',
    titleAr: 'عشر ذي الحجة',
    category: 'seasonal',
    status: 'seasonal',
    summary: 'A seasonal prompt for good deeds in the first ten days.',
    schedule: { type: 'hijri-range', month: 12, start: 1, end: 10 },
    reminderTime: '08:00',
    timeLabel: 'Season',
    advanceMinutes: 0,
    source: 'Qur’an 89:2; Sahih al-Bukhari 969',
    sourceUrl: 'https://sunnah.com/bukhari:969',
    sourceNote: 'A season for extra good deeds, not a single prescribed action. Fasting on the 10th is not part of this reminder, and the days of Tashriq are excluded from voluntary fasting.'
  },
  {
    id: 'ramadan-prep',
    title: 'Prepare for Ramadan',
    titleAr: 'الاستعداد لرمضان',
    category: 'seasonal',
    status: 'seasonal',
    summary: 'A personal planning checkpoint before Ramadan.',
    schedule: { type: 'hijri-yearly', month: 8, days: [15] },
    reminderTime: '19:00',
    timeLabel: 'Mid-Sha‘ban',
    advanceMinutes: 30,
    source: 'Qur’an 2:185',
    sourceUrl: 'https://quran.com/2/185',
    sourceNote: 'This is a planning prompt, not a claim that 15 Sha‘ban is a required ritual. Set your own goals for reading, charity and preparation; adjust the date to your community’s calendar.'
  },
  {
    id: 'zakat-review',
    title: 'Zakat review',
    titleAr: 'مراجعة الزكاة',
    category: 'personal',
    status: 'personal',
    summary: 'Choose your own date to review zakat records and questions.',
    schedule: { type: 'manual' },
    timeLabel: 'Set a date',
    source: 'Qur’an 9:60 (categories of zakat)',
    sourceUrl: 'https://quran.com/9/60',
    sourceNote: 'Sahib does not calculate zakat or know when your wealth reaches the nisab. This is a personal planning reminder only; consult a qualified scholar or trusted local service for your situation.',
    templateOnly: true
  },
  {
    id: 'fitrah-nails',
    title: 'Trim nails',
    titleAr: 'تقليم الأظفار',
    category: 'fitrah',
    status: 'sourced-limit',
    summary: 'A private cleanliness tracker. Set your own last-completed date.',
    schedule: { type: 'interval', everyDays: 40 },
    warningDays: 7,
    timeLabel: 'Your chosen rhythm',
    source: 'Sahih Muslim 258 (the report of the forty-night limit)',
    sourceUrl: 'https://sunnah.com/muslim:258',
    sourceNote: 'The hadith sets a maximum interval of forty nights for several fitrah practices. Scholars differ on how to apply it; Sahib presents it as sourced guidance and a personal tracker, never as a universal deadline or a claim about your history.'
  },
  {
    id: 'fitrah-pubic',
    title: 'Remove pubic hair',
    titleAr: 'حلق العانة',
    category: 'fitrah',
    status: 'sourced-limit',
    summary: 'Private, local-only tracking of your chosen interval.',
    schedule: { type: 'interval', everyDays: 40 },
    warningDays: 7,
    timeLabel: 'Your chosen rhythm',
    source: 'Sahih Muslim 258 (the report of the forty-night limit)',
    sourceUrl: 'https://sunnah.com/muslim:258',
    sourceNote: 'The report describes a maximum interval; it does not require every Friday. How the limit is applied is discussed by scholars. Set a realistic rhythm and use this only if tracking is helpful to you.'
  },
  {
    id: 'fitrah-underarm',
    title: 'Remove underarm hair',
    titleAr: 'نتف الإبط',
    category: 'fitrah',
    status: 'sourced-limit',
    summary: 'Private, local-only tracking of your chosen interval.',
    schedule: { type: 'interval', everyDays: 40 },
    warningDays: 7,
    timeLabel: 'Your chosen rhythm',
    source: 'Sahih Muslim 258 (the report of the forty-night limit)',
    sourceUrl: 'https://sunnah.com/muslim:258',
    sourceNote: 'The report describes a maximum interval; it does not require every Friday. How the limit is applied is discussed by scholars. Set a realistic rhythm and use this only if tracking is helpful to you.'
  },
  {
    id: 'fitrah-moustache',
    title: 'Trim the moustache',
    titleAr: 'قص الشارب',
    category: 'fitrah',
    status: 'sourced-limit',
    summary: 'Private, local-only tracking of your chosen interval.',
    schedule: { type: 'interval', everyDays: 40 },
    warningDays: 7,
    timeLabel: 'Your chosen rhythm',
    source: 'Sahih Muslim 258 (the report of the forty-night limit)',
    sourceUrl: 'https://sunnah.com/muslim:258',
    sourceNote: 'The report describes a maximum interval; it does not require every Friday. How the limit is applied is discussed by scholars. Set a realistic rhythm and use this only if tracking is helpful to you.'
  }
];

/* Starter suggestions shown during first-run setup. They are not enabled
   until the user chooses them. */
const PRACTICE_STARTER_IDS = [
  'morning-adhkar',
  'evening-adhkar',
  'quran-reading',
  'friday-ghusl',
  'monday-thursday-fast'
];
