'use strict';

/* ═══════════════════════════════════════════════════════════
   Forbidden prayer times — hadith reference
   Sahih Muslim 1373 — 'Uqbah ibn 'Amir al-Juhani
   ═══════════════════════════════════════════════════════════ */
const FORBIDDEN_TIMES_HADITH = {
  ar: 'عَنْ عُقْبَةَ بْنِ عَامِرٍ الْجُهَنِيِّ قَالَ: «ثَلَاثُ سَاعَاتٍ كَانَ رَسُولُ اللَّهِ ﷺ يَنْهَانَا أَنْ نُصَلِّيَ فِيهِنَّ أَوْ أَنْ نَقْبُرَ فِيهِنَّ مَوْتَانَا: حِينَ تَطْلُعُ الشَّمْسُ بَازِغَةً حَتَّى تَرْتَفِعَ، وَحِينَ يَقُومُ قَائِمُ الظَّهِيرَةِ حَتَّى تَزُولَ الشَّمْسُ، وَحِينَ تَضَيَّفُ الشَّمْسُ لِلْغُرُوبِ حَتَّى تَغْرُبَ».',
  en: '‘Uqbah ibn ‘Amir al-Juhani said: "There are three times at which the Messenger of Allah ﷺ forbade us to pray or to bury our dead: when the sun has clearly started to rise until it is fully risen, when it is directly overhead at midday until it has passed its zenith, and when the sun starts to set until it has fully set."',
  source: 'Sahih Muslim 1373',
  sourceUrl: 'https://sunnah.com/muslim:1373',
  noteEn: 'Voluntary prayers are forbidden in these windows. Fard prayers and the 2 sunnah rak\'ahs before Fajr are exempt (per the more correct view).',
  noteAr: 'تُنهى الصلوات التطوعية في هذه الأوقات. أما الفرائض وسنة الفجر القبلية فمستثناة (على القول الراجح).',
};

/* ═══════════════════════════════════════════════════════════
   Prayer times — providers, cache and preferences
   • AlAdhan API (default) with offline fallback
   • Local calculation through Adhan.js (MIT, Batoul Apps)
   • Validated local-only CSV schedules
   • Method 19 = Algeria (Fajr 18°, Isha 17°)
   • Fetches/prepares full months and keeps a last-good snapshot
   ═══════════════════════════════════════════════════════════ */

const PRAYER_METHOD      = 19;
const PRAYER_SCHOOL      = 0;
const PRAYER_CACHE_DAYS  = 90;
const PRAYER_CACHE_PREFIX = 'prayer-';
const PRAYER_LAST_GOOD_KEY = 'prayer-last-good';
const PRAYER_CSV_KEY = 'prayer-csv-schedule';
const PRAYER_PREFS_KEY = 'prayerPrefs';

const PRAYER_METHODS = [
  { id: 19, label: 'Algeria — Ministry of Religious Affairs', short: 'Algeria' },
  { id: 3,  label: 'Muslim World League', short: 'MWL' },
  { id: 1,  label: 'University of Islamic Sciences, Karachi', short: 'Karachi' },
  { id: 2,  label: 'Islamic Society of North America (ISNA)', short: 'ISNA' },
  { id: 4,  label: 'Umm al-Qura, Makkah', short: 'Umm al-Qura' },
  { id: 5,  label: 'Egyptian General Authority of Survey', short: 'Egypt' },
  { id: 8,  label: 'Gulf Region', short: 'Gulf' },
  { id: 9,  label: 'Kuwait', short: 'Kuwait' },
  { id: 10, label: 'Qatar', short: 'Qatar' },
  { id: 11, label: 'Singapore — MUIS', short: 'Singapore' },
  { id: 12, label: 'France — UOIF', short: 'France' },
  { id: 13, label: 'Turkey — Diyanet', short: 'Turkey' },
  { id: 14, label: 'Russia — Spiritual Administration', short: 'Russia' },
  { id: 15, label: 'Moonsighting Committee', short: 'Moonsighting' },
  { id: 16, label: 'Dubai', short: 'Dubai' },
  { id: 17, label: 'Malaysia — JAKIM', short: 'JAKIM' },
  { id: 18, label: 'Tunisia', short: 'Tunisia' },
  { id: 20, label: 'Indonesia — KEMENAG', short: 'KEMENAG' },
  { id: 21, label: 'Morocco', short: 'Morocco' },
  { id: 22, label: 'Portugal', short: 'Portugal' },
  { id: 23, label: 'Jordan', short: 'Jordan' },
  { id: 0,  label: 'Shia Ithna-Ashari', short: 'Shia' }
];

const PRAYER_PROVIDERS = [
  { id: 'aladhan', label: 'AlAdhan API', hint: 'Online-first, cached for offline use' },
  { id: 'auto',    label: 'Automatic',    hint: 'Try AlAdhan, then offline calculation' },
  { id: 'local',   label: 'Offline calculation', hint: 'Adhan.js — no network required' },
  { id: 'csv',     label: 'CSV schedule', hint: 'Your imported local timetable' }
];

const PRAYER_PROVIDER_LABELS = {
  aladhan: 'AlAdhan',
  auto: 'Automatic',
  local: 'Offline calculation',
  csv: 'CSV schedule'
};

const PRAYER_DEFAULT_PREFS = {
  provider: 'aladhan',
  method: PRAYER_METHOD,
  school: PRAYER_SCHOOL,
  timeFormat: '24h',
  adjustments: {
    Fajr: 0, Sunrise: 0, Dhuhr: 0, Asr: 0, Maghrib: 0, Isha: 0
  },
  alerts: {
    enabled: false,
    leadMinutes: 10,
    atTime: true,
    notify: false,
    sound: false,
    volume: 0.55,
    perPrayer: {
      Fajr:    { alert: true, sound: true },
      Dhuhr:   { alert: true, sound: true },
      Asr:     { alert: true, sound: true },
      Maghrib: { alert: true, sound: true },
      Isha:    { alert: true, sound: true }
    }
  }
};

const PRAYER_ADJUSTABLE = ['Fajr', 'Sunrise', 'Dhuhr', 'Asr', 'Maghrib', 'Isha'];
const PRAYER_ALERTABLE = ['Fajr', 'Dhuhr', 'Asr', 'Maghrib', 'Isha'];

/* Adhan.js calibration, matching AlAdhan calculation method parameters. */
const ADHAN_METHOD_ANGLES = {
  0:  { fajr: 16,   isha: 14,   interval: 0 },
  1:  { fajr: 18,   isha: 18,   interval: 0 },
  2:  { fajr: 15,   isha: 15,   interval: 0 },
  3:  { fajr: 18,   isha: 17,   interval: 0 },
  4:  { fajr: 18.5, isha: 0,    interval: 90 },
  5:  { fajr: 19.5, isha: 17.5, interval: 0 },
  7:  { fajr: 17.7, isha: 14,   interval: 0 },
  8:  { fajr: 19.5, isha: 0,    interval: 90 },
  9:  { fajr: 18,   isha: 17.5, interval: 0 },
  10: { fajr: 18,   isha: 0,    interval: 90 },
  11: { fajr: 20,   isha: 18,   interval: 0 },
  12: { fajr: 12,   isha: 12,   interval: 0 },
  13: { fajr: 18,   isha: 17,   interval: 0 },
  14: { fajr: 16,   isha: 15,   interval: 0 },
  15: { fajr: 18,   isha: 18,   interval: 0 },
  16: { fajr: 18.2, isha: 18.2, interval: 0 },
  17: { fajr: 20,   isha: 18,   interval: 0 },
  18: { fajr: 18,   isha: 18,   interval: 0 },
  19: { fajr: 18,   isha: 17,   interval: 0 },
  20: { fajr: 20,   isha: 18,   interval: 0 },
  21: { fajr: 19,   isha: 17,   interval: 0 },
  22: { fajr: 18,   isha: 17,   interval: 0 },
  23: { fajr: 18,   isha: 18,   interval: 0 }
};

let _prayerPrefsCache = null;
let _prayerRuntime = null;
const _prayerInflight = new Map();

/* ═══════════════════════════════════════════════════════════
   LOCATION — cached for 30 days, refreshed on demand
   ═══════════════════════════════════════════════════════════ */
async function getLocation(forceRefresh = false){
  const cached = await store.getMeta('location');
  if(cached && cached.lat && cached.lng && cached.ts){
    const ageDays = (Date.now() - cached.ts) / (1000 * 60 * 60 * 24);
    if(!forceRefresh || ageDays < 3650) return cached;
  }

  /* No cached location. Do NOT call GPS here — that's an explicit user action. */
  const err = new Error('No location set');
  err.code = 'NO_LOCATION';
  throw err;
}

/* ── Explicit GPS request — ONLY called from a user gesture ── */
async function requestGPSLocation(){
  if(!navigator.geolocation){
    throw new Error('Geolocation not supported by this browser');
  }
  return new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const loc = {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          ts: Date.now(),
          manual: false,
        };
        await store.setMeta('location', loc);
        resolve(loc);
      },
      (err) => {
        let msg = 'Could not get location';
        if(err.code === 1){
          msg = 'Location blocked. Enable it in your browser settings, then try again.';
        } else if(err.code === 2){
          msg = 'Location unavailable. Try again outdoors.';
        } else if(err.code === 3){
          msg = 'Location timed out. Try again.';
        } else {
          msg = 'Location error: ' + err.message;
        }
        reject(new Error(msg));
      },
      { enableHighAccuracy: false, timeout: 15000, maximumAge: 3600000 }
    );
  });
}

/* Strip "(CEST)" or any suffix from a time string: "05:22 (CEST)" → "05:22" */
function cleanTime(t){
  if(!t) return '00:00';
  return String(t).trim().split(/\s+/)[0];
}

/* ═══════════════════════════════════════════════════════════
   PREFERENCES
   ═══════════════════════════════════════════════════════════ */
function _clone(value){
  return JSON.parse(JSON.stringify(value));
}

function _normalizePrayerPrefs(raw){
  const out = _clone(PRAYER_DEFAULT_PREFS);
  if(!raw || typeof raw !== 'object') return out;

  if(PRAYER_PROVIDERS.some(p => p.id === raw.provider)) out.provider = raw.provider;
  const method = Number(raw.method);
  if(Number.isFinite(method) && PRAYER_METHODS.some(m => m.id === method)) out.method = method;
  out.school = Number(raw.school) === 1 ? 1 : 0;
  out.timeFormat = raw.timeFormat === '12h' ? '12h' : '24h';

  if(raw.adjustments && typeof raw.adjustments === 'object'){
    PRAYER_ADJUSTABLE.forEach(name => {
      const n = Number(raw.adjustments[name]);
      if(Number.isFinite(n)) out.adjustments[name] = Math.max(-60, Math.min(60, Math.round(n)));
    });
  }

  const alerts = raw.alerts && typeof raw.alerts === 'object' ? raw.alerts : {};
  out.alerts.enabled = !!alerts.enabled;
  out.alerts.atTime = alerts.atTime !== false;
  out.alerts.notify = !!alerts.notify;
  out.alerts.sound = !!alerts.sound;
  const lead = Number(alerts.leadMinutes);
  if(Number.isFinite(lead)) out.alerts.leadMinutes = Math.max(1, Math.min(120, Math.round(lead)));
  const vol = Number(alerts.volume);
  if(Number.isFinite(vol)) out.alerts.volume = Math.max(0, Math.min(1, vol));

  if(alerts.perPrayer && typeof alerts.perPrayer === 'object'){
    PRAYER_ALERTABLE.forEach(name => {
      const src = alerts.perPrayer[name];
      if(src && typeof src === 'object'){
        out.alerts.perPrayer[name].alert = src.alert !== false;
        out.alerts.perPrayer[name].sound = src.sound !== false;
      }
    });
  }

  return out;
}

async function getPrayerPrefs(force = false){
  if(_prayerPrefsCache && !force) return _clone(_prayerPrefsCache);
  let raw = null;
  try{ raw = await store.getMeta(PRAYER_PREFS_KEY); }catch(err){ console.warn('[prayer] prefs read failed', err); }
  _prayerPrefsCache = _normalizePrayerPrefs(raw);
  return _clone(_prayerPrefsCache);
}

async function savePrayerPrefs(patch){
  const current = await getPrayerPrefs();
  const next = _normalizePrayerPrefs({ ...current, ...(patch || {}) });
  if(patch && patch.adjustments) next.adjustments = { ...current.adjustments, ...patch.adjustments };
  if(patch && patch.alerts){
    next.alerts = { ...current.alerts, ...patch.alerts };
    if(patch.alerts.perPrayer){
      next.alerts.perPrayer = _clone(current.alerts.perPrayer);
      Object.keys(patch.alerts.perPrayer).forEach(name => {
        if(next.alerts.perPrayer[name]){
          next.alerts.perPrayer[name] = { ...next.alerts.perPrayer[name], ...patch.alerts.perPrayer[name] };
        }
      });
    }
  }
  _prayerPrefsCache = _normalizePrayerPrefs(next);
  await store.setMeta(PRAYER_PREFS_KEY, _clone(_prayerPrefsCache));
  window.dispatchEvent(new CustomEvent('sahib:prayerprefs', { detail: _clone(_prayerPrefsCache) }));
  return _clone(_prayerPrefsCache);
}

async function resetPrayerAdjustments(){
  return savePrayerPrefs({ adjustments: { ...PRAYER_DEFAULT_PREFS.adjustments } });
}

/* ═══════════════════════════════════════════════════════════
   TIME HELPERS
   ═══════════════════════════════════════════════════════════ */
function parseHM(value){
  if(value == null || value === '') return null;
  let str = String(value).trim();
  if(!str) return null;

  /* "05:22 (CEST)" → "05:22" */
  str = str.split(/\s+/)[0];
  const ampm = /^(\d{1,2}):(\d{2})\s*([ap]\.?m\.?)$/i.exec(String(value).trim());
  if(ampm){
    let h = parseInt(ampm[1], 10) % 12;
    if(/p/i.test(ampm[3])) h += 12;
    return h * 60 + parseInt(ampm[2], 10);
  }

  const m = /^(\d{1,2}):(\d{2})(?::\d{2})?$/.exec(str);
  if(!m) return null;
  const h = parseInt(m[1], 10);
  const min = parseInt(m[2], 10);
  if(h < 0 || h > 23 || min < 0 || min > 59) return null;
  return h * 60 + min;
}

function _normalizeMinutes(total){
  return ((Math.round(total) % 1440) + 1440) % 1440;
}

function formatMinutes(total, format = '24h'){
  if(total == null || !Number.isFinite(Number(total))) return '—';
  const mins = _normalizeMinutes(Number(total));
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if(format === '12h'){
    const suffix = h >= 12 ? 'PM' : 'AM';
    const h12 = h % 12 === 0 ? 12 : h % 12;
    return `${h12}:${String(m).padStart(2, '0')} ${suffix}`;
  }
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

function formatPrayerTime(value, format = '24h'){
  const mins = parseHM(value);
  if(mins == null) return '—';
  return formatMinutes(mins, format);
}

function _dateKey(date){
  return String(date.getDate()).padStart(2, '0') + '-' +
         String(date.getMonth() + 1).padStart(2, '0') + '-' +
         date.getFullYear();
}

function _timeFromDate(date){
  return String(date.getHours()).padStart(2, '0') + ':' + String(date.getMinutes()).padStart(2, '0');
}

function hasPrayerAdjustments(prefs){
  const p = prefs || _prayerPrefsCache || PRAYER_DEFAULT_PREFS;
  return PRAYER_ADJUSTABLE.some(name => Number(p.adjustments[name]) !== 0);
}

function _applyAdjustmentsToDay(day, prefs){
  if(!day) return day;
  const timings = { ...day.timings };
  PRAYER_ADJUSTABLE.forEach(name => {
    const delta = Number(prefs.adjustments[name]) || 0;
    if(!delta) return;
    const mins = parseHM(timings[name]);
    if(mins == null) return;
    timings[name] = formatMinutes(mins + delta, '24h');
  });
  return { ...day, timings };
}

function _applyAdjustmentsToMonth(data, prefs){
  return (data || []).map(day => _applyAdjustmentsToDay(day, prefs));
}

/* ═══════════════════════════════════════════════════════════
   HIJRI METADATA (offline calculation / CSV import)
   ═══════════════════════════════════════════════════════════ */
function _hijriMeta(date){
  try{
    const h = (typeof getHijriFromGregorian === 'function')
      ? getHijriFromGregorian(date)
      : null;
    if(!h) return null;
    const monthEn = (typeof HIJRI_MONTHS_NAMES_EN !== 'undefined' && HIJRI_MONTHS_NAMES_EN[h.month - 1]) || '';
    const monthAr = (typeof HIJRI_MONTHS_AR !== 'undefined' && HIJRI_MONTHS_AR[h.month - 1])
      || (typeof HIJRI_MONTHS_NAMES_AR !== 'undefined' && HIJRI_MONTHS_NAMES_AR[h.month - 1])
      || '';
    return { day: h.day, month: monthEn || String(h.month), monthAr: monthAr || monthEn || String(h.month), year: h.year };
  }catch(err){
    return null;
  }
}

/* ═══════════════════════════════════════════════════════════
   CACHE KEYS + LAST-GOOD SNAPSHOT
   ═══════════════════════════════════════════════════════════ */
function _cacheProvider(prefs){
  return prefs.provider === 'auto' ? 'aladhan' : prefs.provider;
}

function monthKey(lat, lng, year, month, prefs){
  const p = prefs || _prayerPrefsCache || PRAYER_DEFAULT_PREFS;
  const provider = _cacheProvider(p);
  const mm = String(month).padStart(2, '0');
  return `${PRAYER_CACHE_PREFIX}${provider}-${p.method}-${p.school}-${Number(lat).toFixed(3)}-${Number(lng).toFixed(3)}-${year}-${mm}`;
}

function _legacyMonthKey(lat, lng, year, month){
  return `${PRAYER_CACHE_PREFIX}${Number(lat).toFixed(3)}-${Number(lng).toFixed(3)}-${year}-${String(month).padStart(2, '0')}`;
}

async function _readCachedMonth(loc, year, month, prefs){
  const key = monthKey(loc.lat, loc.lng, year, month, prefs);
  let cached = await store.getMeta(key);
  if(cached) return cached;

  /* One-time migration from the pre-provider cache. */
  if(_cacheProvider(prefs) === 'aladhan' && prefs.method === PRAYER_METHOD && prefs.school === PRAYER_SCHOOL){
    const legacy = await store.getMeta(_legacyMonthKey(loc.lat, loc.lng, year, month));
    if(legacy && Array.isArray(legacy.data) && legacy.data.length){
      try{ await store.setMeta(key, legacy); }catch(err){ /* non-fatal */ }
      return legacy;
    }
  }
  return null;
}

/* Remember the most recent month we successfully fetched, so we can
   serve it when the network is down and the current month is not cached. */
async function _rememberLastGoodMonth(data, lat, lng, year, month, prefs){
  try{
    await store.setMeta(PRAYER_LAST_GOOD_KEY, {
      data,
      ts: Date.now(),
      lat, lng, year, month,
      provider: _cacheProvider(prefs || PRAYER_DEFAULT_PREFS),
      method: (prefs || PRAYER_DEFAULT_PREFS).method,
      school: (prefs || PRAYER_DEFAULT_PREFS).school,
    });
  }catch(e){
    console.warn('[prayer] could not persist last-good month', e);
  }
}

/* Read the last-good snapshot, or null if there is none. */
async function _loadLastGoodMonth(){
  try{
    const snap = await store.getMeta(PRAYER_LAST_GOOD_KEY);
    if(snap && Array.isArray(snap.data) && snap.data.length){
      return snap;
    }
  }catch(e){
    console.warn('[prayer] could not read last-good month', e);
  }
  return null;
}

function _snapshotMatches(snap, loc, year, month, prefs){
  if(!snap || !Array.isArray(snap.data) || !snap.data.length) return false;
  if(snap.year && snap.month && (Number(snap.year) !== year || Number(snap.month) !== month)) return false;
  if(snap.lat != null && snap.lng != null){
    if(Math.abs(Number(snap.lat) - Number(loc.lat)) > 0.08) return false;
    if(Math.abs(Number(snap.lng) - Number(loc.lng)) > 0.08) return false;
  }
  if(snap.method != null && Number(snap.method) !== Number(prefs.method)) return false;
  if(snap.school != null && Number(snap.school) !== Number(prefs.school)) return false;
  return true;
}

/* ═══════════════════════════════════════════════════════════
   PROVIDER — AlAdhan
   ═══════════════════════════════════════════════════════════ */
async function fetchMonth(lat, lng, year, month, prefsOverride){
  const prefs = prefsOverride || await getPrayerPrefs();
  const url =
    `https://api.aladhan.com/v1/calendar` +
    `?latitude=${encodeURIComponent(lat)}&longitude=${encodeURIComponent(lng)}` +
    `&method=${encodeURIComponent(prefs.method)}&school=${encodeURIComponent(prefs.school)}` +
    `&month=${month}&year=${year}`;

  const res = await fetch(url);
  if(!res.ok) throw new Error('AlAdhan API returned ' + res.status);
  const json = await res.json();
  if(!json || !json.data || !Array.isArray(json.data)) throw new Error('AlAdhan returned an unexpected response');

  const mapped = json.data.map(day => ({
    date: day.date.gregorian.date,       /* DD-MM-YYYY */
    weekday: day.date.gregorian.weekday.en,
    hijri: {
      day: day.date.hijri.day,
      month: day.date.hijri.month.en,
      monthAr: day.date.hijri.month.ar,
      year: day.date.hijri.year,
    },
    timings: {
      Fajr:    cleanTime(day.timings.Fajr),
      Sunrise: cleanTime(day.timings.Sunrise),
      Dhuhr:   cleanTime(day.timings.Dhuhr),
      Asr:     cleanTime(day.timings.Asr),
      Maghrib: cleanTime(day.timings.Maghrib),
      Isha:    cleanTime(day.timings.Isha),
    },
  }));

  await _rememberLastGoodMonth(mapped, lat, lng, year, month, prefs);
  return mapped;
}

async function _aladhanMonth(loc, year, month, prefs, force = false){
  const key = monthKey(loc.lat, loc.lng, year, month, prefs);
  const cached = force ? null : await _readCachedMonth(loc, year, month, prefs);
  if(cached) return { data: cached.data, ts: cached.ts || Date.now(), stale: !!cached.stale, source: 'aladhan-cache' };

  /* De-duplicate concurrent fetches for the same month. */
  if(_prayerInflight.has(key)) return _prayerInflight.get(key);

  const task = (async () => {
    const data = await fetchMonth(loc.lat, loc.lng, year, month, prefs);
    const ts = Date.now();
    await store.setMeta(key, { data, ts });
    return { data, ts, stale: false, source: 'aladhan' };
  })();

  _prayerInflight.set(key, task);
  try{
    return await task;
  }finally{
    _prayerInflight.delete(key);
  }
}

/* ═══════════════════════════════════════════════════════════
   PROVIDER — offline calculation (Adhan.js)
   ═══════════════════════════════════════════════════════════ */
function _buildAdhanParams(prefs){
  if(typeof adhan === 'undefined'){
    throw new Error('Offline prayer calculator is unavailable');
  }
  const angles = ADHAN_METHOD_ANGLES[prefs.method] || ADHAN_METHOD_ANGLES[PRAYER_METHOD];
  const params = new adhan.CalculationParameters();
  params.fajrAngle = angles.fajr;
  params.ishaAngle = angles.isha || 0;
  params.ishaInterval = angles.interval || 0;
  if(prefs.method === 0) params.maghribAngle = 4; /* Shia Ithna-Ashari convention */
  params.madhab = Number(prefs.school) === 1 ? adhan.Madhab.Hanafi : adhan.Madhab.Shafi;
  params.highLatitudeRule = adhan.HighLatitudeRule.MiddleOfTheNight;
  params.rounding = adhan.Rounding.Nearest;
  return params;
}

function computeLocalMonth(lat, lng, year, month, prefs){
  if(typeof adhan === 'undefined') throw new Error('Offline prayer calculator is unavailable');
  const coordinates = new adhan.Coordinates(Number(lat), Number(lng));
  const params = _buildAdhanParams(prefs);
  const days = new Date(year, month, 0).getDate();
  const out = [];

  for(let d = 1; d <= days; d++){
    const date = new Date(year, month - 1, d, 12, 0, 0, 0);
    const pt = new adhan.PrayerTimes(coordinates, date, params);
    out.push({
      date: _dateKey(date),
      weekday: date.toLocaleDateString('en-US', { weekday: 'long' }),
      hijri: _hijriMeta(date),
      timings: {
        Fajr: _timeFromDate(pt.fajr),
        Sunrise: _timeFromDate(pt.sunrise),
        Dhuhr: _timeFromDate(pt.dhuhr),
        Asr: _timeFromDate(pt.asr),
        Maghrib: _timeFromDate(pt.maghrib),
        Isha: _timeFromDate(pt.isha)
      }
    });
  }
  return out;
}

async function _localMonth(loc, year, month, prefs, force = false){
  const key = monthKey(loc.lat, loc.lng, year, month, prefs);
  if(!force){
    const cached = await store.getMeta(key);
    if(cached && Array.isArray(cached.data) && cached.data.length){
      return { data: cached.data, ts: cached.ts || Date.now(), stale: false, source: 'local-cache' };
    }
  }
  const data = computeLocalMonth(loc.lat, loc.lng, year, month, prefs);
  const ts = Date.now();
  await store.setMeta(key, { data, ts });
  return { data, ts, stale: false, source: 'local' };
}

/* ═══════════════════════════════════════════════════════════
   PROVIDER — CSV schedule (local only)
   ═══════════════════════════════════════════════════════════ */
const CSV_HEADER_ALIASES = {
  Fajr: ['fajr'],
  Sunrise: ['sunrise', 'shuruq', 'shurooq', 'salah sunrise'],
  Dhuhr: ['dhuhr', 'zuhr', 'dhuhur'],
  Asr: ['asr'],
  Maghrib: ['maghrib', 'magrib'],
  Isha: ['isha', 'ishaa'],
  Date: ['date', 'gregorian date'],
  Day: ['day'],
  Month: ['month']
};

function _normalizeHeader(value){
  return String(value || '').trim().toLowerCase()
    .replace(/^\uFEFF/, '')
    .replace(/["']/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function _detectDelimiter(firstLine){
  const candidates = [',', ';', '\t', '|'];
  let best = ',';
  let bestCount = -1;
  for(const d of candidates){
    const count = firstLine.split(d).length - 1;
    if(count > bestCount){ best = d; bestCount = count; }
  }
  return best;
}

function _splitCsvLine(line, delimiter){
  const cells = [];
  let cur = '';
  let quoted = false;
  for(let i = 0; i < line.length; i++){
    const ch = line[i];
    if(quoted){
      if(ch === '"'){
        if(line[i + 1] === '"'){ cur += '"'; i++; }
        else quoted = false;
      } else cur += ch;
    } else if(ch === '"'){
      quoted = true;
    } else if(ch === delimiter){
      cells.push(cur);
      cur = '';
    } else {
      cur += ch;
    }
  }
  cells.push(cur);
  return cells.map(c => c.trim());
}

function _csvTime(value){
  const raw = String(value == null ? '' : value).trim();
  if(!raw || raw === '—' || raw === '-' || raw.toLowerCase() === 'n/a') return '';
  const mins = parseHM(raw);
  return mins == null ? null : formatMinutes(mins, '24h');
}

function _parseCsvDate(value, fallbackYear){
  const raw = String(value == null ? '' : value).trim();
  if(!raw) return null;
  let m = /^(\d{4})[-\/.](\d{1,2})[-\/.](\d{1,2})$/.exec(raw);
  if(m){
    return { y: +m[1], m: +m[2], d: +m[3] };
  }
  m = /^(\d{1,2})[-\/.](\d{1,2})[-\/.](\d{4})$/.exec(raw);
  if(m){
    const a = +m[1], b = +m[2];
    /* Prefer day-first (Awqat / Sahib). Swap only when the first value
       cannot be a day. */
    let day = a, mon = b;
    if(a > 31 && b <= 31){ day = b; mon = a; }
    return { y: +m[3], m: mon, d: day };
  }
  m = /^(\d{1,2})[-\/.](\d{1,2})$/.exec(raw);
  if(m){
    const a = +m[1], b = +m[2];
    let day = a, mon = b;
    if(a > 31 && b <= 31){ day = b; mon = a; }
    return { y: fallbackYear, m: mon, d: day };
  }
  return null;
}

function _validDateParts(p){
  if(!p || !p.y || !p.m || !p.d) return false;
  if(p.m < 1 || p.m > 12 || p.d < 1 || p.d > 31) return false;
  const dt = new Date(p.y, p.m - 1, p.d);
  return dt.getFullYear() === p.y && dt.getMonth() === p.m - 1 && dt.getDate() === p.d;
}

function parsePrayerCsv(text){
  const errors = [];
  const warnings = [];
  const rows = [];
  const seen = new Map();

  if(typeof text !== 'string' || !text.trim()){
    return { ok: false, errors: ['The file is empty.'], warnings, rows, headers: [], range: null };
  }
  if(text.length > 2 * 1024 * 1024){
    return { ok: false, errors: ['The file is larger than 2 MB.'], warnings, rows, headers: [], range: null };
  }

  const lines = text.replace(/\r\n?/g, '\n').split('\n')
    .map(l => l.replace(/^\uFEFF/, ''))
    .filter(l => l.trim() && !/^\s*#/.test(l));

  if(lines.length < 2){
    return { ok: false, errors: ['The file needs a header row and at least one prayer row.'], warnings, rows, headers: [], range: null };
  }

  const delimiter = _detectDelimiter(lines[0]);
  const headers = _splitCsvLine(lines[0], delimiter);
  const normalized = headers.map(_normalizeHeader);
  const index = {};

  Object.keys(CSV_HEADER_ALIASES).forEach(canonical => {
    const aliases = CSV_HEADER_ALIASES[canonical];
    const found = normalized.findIndex(h => aliases.includes(h));
    if(found >= 0) index[canonical] = found;
  });

  ['Fajr', 'Dhuhr', 'Asr', 'Maghrib', 'Isha'].forEach(name => {
    if(index[name] == null) errors.push(`Missing required column: ${name}`);
  });
  if(index.Date == null && (index.Day == null || index.Month == null)){
    errors.push('Missing Date column (or Day + Month columns).');
  }

  if(errors.length){
    return { ok: false, errors, warnings, rows, headers, range: null };
  }

  const now = new Date();
  const fallbackYear = now.getFullYear();

  for(let i = 1; i < lines.length; i++){
    if(rows.length + errors.length > 2500){
      errors.push('The file has too many rows (limit 2500).');
      break;
    }
    const cells = _splitCsvLine(lines[i], delimiter);
    const lineNo = i + 1;

    let parts = null;
    if(index.Date != null) parts = _parseCsvDate(cells[index.Date], fallbackYear);
    if(!parts && index.Day != null && index.Month != null){
      const day = parseInt(cells[index.Day], 10);
      const month = parseInt(cells[index.Month], 10);
      if(Number.isFinite(day) && Number.isFinite(month)){
        let year = fallbackYear;
        const candidate = new Date(year, month - 1, day);
        if(candidate.getTime() < now.getTime() - 300 * 86400000) year += 1;
        parts = { y: year, m: month, d: day };
      }
    }
    if(!_validDateParts(parts)){
      errors.push(`Row ${lineNo}: invalid date.`);
      continue;
    }

    const timings = {};
    let badTime = false;
    ['Fajr', 'Sunrise', 'Dhuhr', 'Asr', 'Maghrib', 'Isha'].forEach(name => {
      if(index[name] == null){ timings[name] = ''; return; }
      const parsed = _csvTime(cells[index[name]]);
      if(parsed == null){
        errors.push(`Row ${lineNo}: invalid ${name} time "${cells[index[name]] || ''}".`);
        badTime = true;
        return;
      }
      timings[name] = parsed;
    });
    if(badTime) continue;

    const date = new Date(parts.y, parts.m - 1, parts.d, 12, 0, 0, 0);
    const key = _dateKey(date);
    const entry = {
      date: key,
      weekday: date.toLocaleDateString('en-US', { weekday: 'long' }),
      hijri: _hijriMeta(date),
      timings
    };

    if(seen.has(key)){
      warnings.push(`Duplicate date ${key}; the last row was used.`);
      rows[seen.get(key)] = entry;
    } else {
      seen.set(key, rows.length);
      rows.push(entry);
    }
  }

  rows.sort((a, b) => {
    const [ad, am, ay] = a.date.split('-').map(Number);
    const [bd, bm, by] = b.date.split('-').map(Number);
    return new Date(ay, am - 1, ad) - new Date(by, bm - 1, bd);
  });

  if(errors.length && rows.length === 0){
    return { ok: false, errors, warnings, rows: [], headers, range: null };
  }

  return {
    ok: errors.length === 0 && rows.length > 0,
    errors,
    warnings,
    rows,
    headers,
    range: rows.length ? { from: rows[0].date, to: rows[rows.length - 1].date } : null
  };
}

async function getPrayerCsvSchedule(){
  try{
    const sched = await store.getMeta(PRAYER_CSV_KEY);
    if(sched && Array.isArray(sched.rows) && sched.rows.length) return sched;
  }catch(err){
    console.warn('[prayer] CSV schedule read failed', err);
  }
  return null;
}

async function importPrayerCsv(text, sourceName){
  const parsed = parsePrayerCsv(text);
  if(!parsed.ok){
    const err = new Error(parsed.errors[0] || 'Could not read that CSV file');
    err.parsed = parsed;
    throw err;
  }
  const payload = {
    rows: parsed.rows,
    importedAt: Date.now(),
    sourceName: sourceName || 'prayer-times.csv',
    count: parsed.rows.length,
    range: parsed.range
  };
  await store.setMeta(PRAYER_CSV_KEY, payload);
  window.dispatchEvent(new CustomEvent('sahib:prayercsv', { detail: { count: payload.count, range: payload.range } }));
  return payload;
}

async function clearPrayerCsv(){
  await store.setMeta(PRAYER_CSV_KEY, null);
  window.dispatchEvent(new CustomEvent('sahib:prayercsv', { detail: null }));
}

function buildPrayerCsvTemplate(){
  const now = new Date();
  const days = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const lines = ['Fajr,Shuruq,Dhuhr,Asr,Maghrib,Isha,Date,Day,Month'];
  for(let d = 1; d <= Math.min(days, 7); d++){
    const date = new Date(now.getFullYear(), now.getMonth(), d);
    lines.push(`05:30,06:45,12:30,15:45,18:10,19:30,${_dateKey(date)},${date.toLocaleDateString('en-US', { weekday: 'long' })},${date.getMonth() + 1}`);
  }
  return lines.join('\n') + '\n';
}

function _csvMonth(schedule, year, month){
  const mm = String(month).padStart(2, '0');
  return schedule.rows.filter(row => {
    const parts = String(row.date).split('-');
    return parts.length === 3 && parts[1] === mm && Number(parts[2]) === year;
  }).map(row => ({ ...row, timings: { ...row.timings } }));
}

/* ═══════════════════════════════════════════════════════════
   PUBLIC — provider router
   ═══════════════════════════════════════════════════════════ */
async function getMonth(year, month, force = false){
  const prefs = await getPrayerPrefs();
  const loc = await getLocation();
  let result = null;
  let fallback = false;
  let lastError = null;

  if(prefs.provider === 'csv'){
    const sched = await getPrayerCsvSchedule();
    if(!sched){
      const err = new Error('No CSV schedule has been imported');
      err.code = 'NO_CSV';
      throw err;
    }
    const rows = _csvMonth(sched, year, month);
    if(!rows.length){
      const err = new Error('The CSV schedule has no prayer times for this month');
      err.code = 'NO_CSV_MONTH';
      throw err;
    }
    result = { data: rows, ts: sched.importedAt, stale: false, source: 'csv' };
  } else if(prefs.provider === 'local'){
    result = await _localMonth(loc, year, month, prefs, force);
  } else {
    const offline = typeof navigator !== 'undefined' && navigator.onLine === false;
    if(!offline){
      try{
        result = await _aladhanMonth(loc, year, month, prefs, force);
      }catch(err){
        lastError = err;
        console.warn('[prayer] AlAdhan failed, falling back', err.message);
      }
    }

    if(!result){
      const snap = await _loadLastGoodMonth();
      if(_snapshotMatches(snap, loc, year, month, prefs)){
        result = { data: snap.data, ts: snap.ts, stale: true, source: 'last-good' };
        fallback = true;
      }
    }

    if(!result){
      try{
        result = await _localMonth(loc, year, month, prefs, true);
        result.stale = true;
        fallback = true;
      }catch(err){
        if(lastError) throw lastError;
        throw err;
      }
    }
  }

  _prayerRuntime = {
    provider: prefs.provider,
    providerLabel: PRAYER_PROVIDER_LABELS[prefs.provider] || prefs.provider,
    source: result.source,
    cachedAt: result.ts,
    stale: !!result.stale,
    fallback,
    online: typeof navigator === 'undefined' ? true : navigator.onLine,
    lastError: lastError ? lastError.message : null,
    method: prefs.method,
    school: prefs.school,
    timeFormat: prefs.timeFormat,
    adjusted: hasPrayerAdjustments(prefs)
  };

  return {
    data: _applyAdjustmentsToMonth(result.data, prefs),
    ts: result.ts,
    stale: !!result.stale
  };
}

/* ═══════════════════════════════════════════════════════════
   PUBLIC — getToday()
   Cache-first; fetches the current month if missing.
   ═══════════════════════════════════════════════════════════ */
async function getToday(forceRefresh = false){
  const loc = await getLocation(forceRefresh);
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  const prefs = await getPrayerPrefs();
  const cached = await getMonth(year, month, forceRefresh);

  const todayStr = _dateKey(now);
  const today = cached.data.find(d => d.date === todayStr) || null;

  return {
    today,
    location: loc,
    cachedAt: cached.ts,
    stale: !!cached.stale,
    provider: _prayerRuntime ? _prayerRuntime.provider : prefs.provider,
    prefs
  };
}

async function getPrayerDay(date){
  const day = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const result = await getMonth(day.getFullYear(), day.getMonth() + 1);
  return result.data.find(d => d.date === _dateKey(day)) || null;
}

function getPrayerStatus(){
  return _prayerRuntime ? { ..._prayerRuntime } : null;
}

/* Notify all surfaces after prefs/location/CSV changes. */
function notifyPrayerSurfaces(reason){
  window.dispatchEvent(new CustomEvent('sahib:prayerchange', { detail: { reason: reason || 'update' } }));
  if(typeof window.PrayerWidget !== 'undefined' && window.PrayerWidget.refreshAll){
    try{ window.PrayerWidget.refreshAll(); }catch(err){ console.warn('[prayer] widget refresh failed', err); }
  }
  if(typeof window.PrayerAlerts !== 'undefined' && window.PrayerAlerts.refresh){
    try{ window.PrayerAlerts.refresh(); }catch(err){ console.warn('[prayer] alert refresh failed', err); }
  }
}

/* Schedule a refresh when preferences change, unless caller already did. */
window.addEventListener('sahib:prayerprefs', () => {
  setTimeout(() => {
    if(typeof window.PrayerWidget !== 'undefined' && window.PrayerWidget.refreshAll){
      try{ window.PrayerWidget.refreshAll(); }catch(err){ console.warn('[prayer] widget refresh failed', err); }
    }
    if(typeof window.PrayerAlerts !== 'undefined' && window.PrayerAlerts.refresh){
      try{ window.PrayerAlerts.refresh(); }catch(err){ console.warn('[prayer] alert refresh failed', err); }
    }
  }, 0);
});

/* ═══════════════════════════════════════════════════════════
   PUBLIC — ensureCache()
   Prefetches up to 90 days ahead (in monthly chunks).
   Safe to call on every boot — skips months already cached.
   ═══════════════════════════════════════════════════════════ */
async function ensureCache(){
  let loc;
  try{
    loc = await getLocation();
  }catch(err){
    console.warn('[prayer] No location — skipping prefetch:', err.message);
    return { ok: false, reason: err.message };
  }

  const prefs = await getPrayerPrefs();
  if(prefs.provider === 'csv'){
    return { ok: true, fetched: 0, location: loc, provider: 'csv' };
  }

  const now = new Date();
  const monthsToFetch = Math.ceil(PRAYER_CACHE_DAYS / 30) + 1;
  let fetched = 0;

  for(let i = 0; i < monthsToFetch; i++){
    const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
    const y = d.getFullYear();
    const m = d.getMonth() + 1;
    try{
      if(prefs.provider === 'local'){
        const key = monthKey(loc.lat, loc.lng, y, m, prefs);
        const cached = await store.getMeta(key);
        if(!cached){ await _localMonth(loc, y, m, prefs, false); fetched++; }
      } else {
        const key = monthKey(loc.lat, loc.lng, y, m, prefs);
        const cached = await _readCachedMonth(loc, y, m, prefs);
        if(!cached){
          const data = await fetchMonth(loc.lat, loc.lng, y, m, prefs);
          await store.setMeta(key, { data, ts: Date.now() });
          fetched++;
          console.log('[prayer] Cached month', m, y);
        }
      }
    }catch(err){
      console.warn('[prayer] Failed to cache month', m, y, err.message);
    }
  }
  return { ok: true, fetched, location: loc, provider: prefs.provider };
}

/* ═══════════════════════════════════════════════════════════
   HELPERS — find the next prayer from a day's timings
   ═══════════════════════════════════════════════════════════ */
const PRAYER_ORDER = ['Fajr', 'Dhuhr', 'Asr', 'Maghrib', 'Isha'];

function findNextPrayer(timings, from){
  const now = from || new Date();
  const prefs = _prayerPrefsCache || PRAYER_DEFAULT_PREFS;
  const nowSec = now.getHours() * 3600 + now.getMinutes() * 60 + now.getSeconds();

  for(const name of PRAYER_ORDER){
    const mins = parseHM(timings[name]);
    if(mins == null) continue;
    if(mins * 60 > nowSec){
      return {
        name,
        time: formatPrayerTime(timings[name], prefs.timeFormat),
        rawTime: timings[name],
        minutesLeft: Math.max(0, Math.ceil((mins * 60 - nowSec) / 60)),
        secondsLeft: Math.max(0, mins * 60 - nowSec),
        tomorrow: false
      };
    }
  }

  /* All prayers have passed today → next is Fajr tomorrow */
  const fajr = parseHM(timings.Fajr);
  const diffSec = 86400 - nowSec + (fajr == null ? 0 : fajr * 60);
  return {
    name: 'Fajr',
    time: formatPrayerTime(timings.Fajr, prefs.timeFormat),
    rawTime: timings.Fajr,
    minutesLeft: Math.max(0, Math.ceil(diffSec / 60)),
    secondsLeft: diffSec,
    tomorrow: true
  };
}

/* ═══════════════════════════════════════════════════════════
   formatCountdown — "45 min" / "2h 15m"
   ═══════════════════════════════════════════════════════════ */
function formatCountdown(minutes){
  if(!Number.isFinite(minutes) || minutes < 0) return '—';
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  if(h === 0) return `${m} min`;
  return `${h}h ${m}m`;
}

function formatCountdownClock(totalSeconds){
  const s = Math.max(0, Math.round(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return {
    h: String(h).padStart(2, '0'),
    m: String(m).padStart(2, '0'),
    s: String(sec).padStart(2, '0')
  };
}
