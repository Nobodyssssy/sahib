'use strict';

/* ==========================================================================
   SAHIB PRAYER SURFACES
   • PrayerWidget — home hero panel + prayer page panel
   • PrayerAlerts — approaching / entered reminders, chime and notifications
   One shared one-second ticker powers every widget instance.
   ========================================================================== */

const PRAYER_NAMES_AR = {
  Fajr: 'الفجر', Sunrise: 'الشروق', Dhuhr: 'الظهر',
  Asr: 'العصر', Maghrib: 'المغرب', Isha: 'العشاء'
};

const PRAYER_ICONS = {
  Fajr: 'sunrise', Dhuhr: 'sun', Asr: 'sun', Maghrib: 'sunset', Isha: 'moon'
};

/* Bundled adhan recordings. Each source is documented in
   assets/adhan/LICENSES.md and must be CC0 / public-domain before it is added. */
const ADHAN_BUNDLED = {
  standard: [
    { id: 'azhar', label: 'Al-Azhar Park, Cairo', src: 'assets/adhan/al-azhar-park.mp3', credit: 'Ahmad Aiuby · CC0' },
    { id: 'quseir', label: 'Quseir by the sea, Egypt', src: 'assets/adhan/quseir-sea.mp3', credit: 'Ahmad Aiuby · CC0' }
  ],
  fajr: [
    { id: 'fajr-balakong', label: 'Balakong, Kuala Lumpur', src: 'assets/adhan/fajr-balakong.mp3', credit: 'aridtrax · CC0' }
  ]
};
const ADHAN_LOCAL_KEYS = {
  standard: 'adhanLocalStandard',
  fajr: 'adhanLocalFajr'
};
const ADHAN_LOCAL_MAX_BYTES = 20 * 1024 * 1024;
const ADHAN_LOCAL_MAX_SECONDS = 12 * 60;

function _pwDateFormat(key){
  const parts = String(key || '').split('-').map(Number);
  if(parts.length !== 3) return null;
  return new Date(parts[2], parts[1] - 1, parts[0], 12, 0, 0, 0);
}

function _pwEventDate(dateKey, time){
  const base = _pwDateFormat(dateKey);
  const mins = (typeof parseHM === 'function') ? parseHM(time) : null;
  if(!base || mins == null) return null;
  return new Date(base.getFullYear(), base.getMonth(), base.getDate(), Math.floor(mins / 60), mins % 60, 0, 0);
}

function _pwDayKey(date){
  return String(date.getDate()).padStart(2, '0') + '-' +
         String(date.getMonth() + 1).padStart(2, '0') + '-' +
         date.getFullYear();
}

function _pwAgo(ts){
  if(!ts) return '';
  const mins = Math.max(0, Math.round((Date.now() - ts) / 60000));
  if(mins < 1) return 'just now';
  if(mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if(hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function _pwEsc(value){
  return (typeof esc === 'function') ? esc(value) : String(value == null ? '' : value);
}

/* ═══════════════════════════════════════════════════════════
   SHARED SCHEDULE
   ═══════════════════════════════════════════════════════════ */
function _pwSchedule(today, nextDay, now){
  if(!today || !today.timings) return null;
  const todayKey = today.date;
  const events = [];
  ['Fajr', 'Dhuhr', 'Asr', 'Maghrib', 'Isha'].forEach(name => {
    const date = _pwEventDate(todayKey, today.timings[name]);
    if(date) events.push({ name, date, dateKey: todayKey, tomorrow: false });
  });

  let nextDayEstimated = false;
  let tomorrowFajrTime = nextDay && nextDay.timings ? nextDay.timings.Fajr : null;
  let tomorrowKey = null;
  if(nextDay && nextDay.date){
    tomorrowKey = nextDay.date;
  } else {
    const d = _pwDateFormat(todayKey);
    if(d){
      d.setDate(d.getDate() + 1);
      tomorrowKey = _pwDayKey(d);
      tomorrowFajrTime = today.timings.Fajr;
      nextDayEstimated = true;
    }
  }
  if(tomorrowKey && tomorrowFajrTime){
    const date = _pwEventDate(tomorrowKey, tomorrowFajrTime);
    if(date) events.push({ name: 'Fajr', date, dateKey: tomorrowKey, tomorrow: true, estimated: nextDayEstimated });
  }

  const current = now || new Date();
  const nowMs = current.getTime();
  let next = events.find(e => e.date.getTime() > nowMs) || null;
  let prev = null;
  for(const e of events){
    if(e.date.getTime() <= nowMs) prev = e;
  }
  if(!prev){
    /* Before today's Fajr: measure progress from yesterday's Isha. */
    const isha = _pwEventDate(todayKey, today.timings.Isha);
    if(isha){
      const yesterdayIsha = new Date(isha.getTime() - 86400000);
      prev = { name: 'Isha', date: yesterdayIsha, dateKey: todayKey, tomorrow: false, previousDay: true };
    }
  }
  if(!next){
    next = events[events.length - 1] || null;
  }

  let progress = 0;
  if(prev && next){
    const span = next.date.getTime() - prev.date.getTime();
    progress = span > 0 ? Math.max(0, Math.min(1, (nowMs - prev.date.getTime()) / span)) : 0;
  }

  const entered = !!(prev && nowMs - prev.date.getTime() >= 0 && nowMs - prev.date.getTime() < 10 * 60 * 1000);

  return { events, next, prev, progress, entered, todayKey, tomorrowKey, nextDayEstimated };
}

/* ═══════════════════════════════════════════════════════════
   PRAYER WIDGET
   ═══════════════════════════════════════════════════════════ */
const PrayerWidget = (() => {
  const instances = new Map();
  let started = false;
  let tickTimer = null;
  let refreshTimer = null;

  function _root(target){
    if(!target) return null;
    return typeof target === 'string' ? document.getElementById(target) : target;
  }

  function _statusText(inst){
    if(inst.error) return 'Offline';
    if(!inst.today) return 'Waiting';
    const status = (typeof getPrayerStatus === 'function') ? getPrayerStatus() : null;
    if(inst.stale || (status && status.stale)) return 'Cached';
    return 'Live';
  }

  function _renderLoading(root, variant){
    root.className = `prayer-widget prayer-widget--${variant || 'hero'} is-loading`;
    root.setAttribute('aria-busy', 'true');
    root.innerHTML = `
      <div class="pw-head">
        <div>
          <div class="pw-label">Next prayer</div>
          <div class="pw-status"><span class="pw-status-dot"></span><span>Loading</span></div>
        </div>
      </div>
      <div class="pw-skeleton pw-skeleton-title"></div>
      <div class="pw-skeleton pw-skeleton-line"></div>
      <div class="pw-skeleton pw-skeleton-bar"></div>`;
  }

  function _renderEmpty(root, variant, mode, message){
    root.className = `prayer-widget prayer-widget--${variant || 'hero'} is-empty`;
    root.setAttribute('aria-busy', 'false');
    const noLoc = mode === 'location';
    root.innerHTML = `
      <div class="pw-head">
        <div>
          <div class="pw-label">Prayer times</div>
          <div class="pw-status"><span class="pw-status-dot"></span><span>${noLoc ? 'Location needed' : 'Unavailable'}</span></div>
        </div>
      </div>
      <div class="pw-empty">
        <div class="pw-empty-icon">${typeof icon === 'function' ? icon(noLoc ? 'map-pin' : 'mosque', 26) : ''}</div>
        <div class="pw-empty-title">${noLoc ? 'Set your location' : 'Could not load prayer times'}</div>
        <div class="pw-empty-text">${_pwEsc(message || (noLoc ? 'Prayer times need a city or coordinates. Stored on this device only.' : 'Try again, or use offline calculation in settings.'))}</div>
        ${noLoc ? `<div class="pw-empty-times" aria-hidden="true">
          ${['Fajr', 'Sunrise', 'Dhuhr', 'Asr', 'Maghrib', 'Isha'].map(name => `<div><span>${name}</span><strong>—</strong></div>`).join('')}
        </div>` : ''}
        <div class="pw-empty-actions">
          ${noLoc
            ? `<button type="button" class="btn-save" data-pw-action="location">Choose location</button>`
            : `<button type="button" class="btn-save" data-pw-action="retry">Retry</button>`}
          <button type="button" class="btn-cancel" data-pw-action="settings">Prayer settings</button>
        </div>
      </div>`;
  }

  function _render(inst){
    const root = inst.root;
    if(!inst.today || !inst.today.timings){
      _renderEmpty(root, inst.options.variant, 'error', 'No prayer times are available for today.');
      return;
    }
    const prefs = inst.prefs;
    const status = (typeof getPrayerStatus === 'function') ? getPrayerStatus() : null;
    const providerLabel = status && status.providerLabel ? status.providerLabel : 'Sahib';
    const times = ['Fajr', 'Sunrise', 'Dhuhr', 'Asr', 'Maghrib', 'Isha'];
    const cells = times.map(name => `
      <div class="pw-time-cell ${name === 'Sunrise' ? 'sunrise' : ''}" data-pw-cell="${name}">
        <span>${name === 'Sunrise' ? 'Sunrise' : name}</span>
        <strong>${_pwEsc(formatPrayerTime(inst.today.timings[name], prefs.timeFormat))}</strong>
      </div>`).join('');

    root.className = `prayer-widget prayer-widget--${inst.options.variant || 'hero'}`;
    root.setAttribute('aria-busy', 'false');
    root.innerHTML = `
      <div class="pw-head">
        <div class="pw-head-info">
          <div class="pw-label">Next prayer</div>
          <div class="pw-status" data-pw="status"><span class="pw-status-dot"></span><span data-pw="status-text">Live</span></div>
        </div>
        <div class="pw-prayer-time" data-pw="next-time">—</div>
      </div>

      <div class="pw-main">
        <div class="pw-main-name">
          <div class="pw-prayer-ar" data-pw="next-ar"></div>
          <div class="pw-prayer-name" data-pw="next-name">—</div>
        </div>
        <div class="pw-countdown-block">
          <div class="pw-countdown-label">Remaining</div>
          <div class="pw-countdown" aria-label="Time remaining">
            <span class="pw-countdown-unit" data-pw="h">--</span>
            <span class="pw-countdown-sep">:</span>
            <span class="pw-countdown-unit" data-pw="m">--</span>
            <span class="pw-countdown-sep">:</span>
            <span class="pw-countdown-unit" data-pw="s">--</span>
          </div>
        </div>
      </div>

      <div class="pw-period" data-pw="period">Calculating…</div>

      <div class="pw-progress" role="progressbar" aria-valuemin="0" aria-valuemax="100" data-pw="progress-wrap">
        <div class="pw-progress-fill" data-pw="progress"></div>
      </div>

      ${inst.options.showTimes === false ? '' : `<div class="pw-times">${cells}</div>`}

      <div class="pw-foot">
        <span data-pw="fresh">${_pwEsc(providerLabel)}</span>
        ${inst.options.showLink === false ? '' : `<button type="button" data-pw-action="timetable">Full timetable</button>`}
      </div>`;

    inst.rendered = true;
    inst.lastNextKey = null;
    _update(inst, new Date());
  }

  function _set(inst, role, text){
    const el = inst.root.querySelector(`[data-pw="${role}"]`);
    if(el && el.textContent !== text) el.textContent = text;
  }

  function _update(inst, now){
    if(!inst.root || !document.body.contains(inst.root)){ instances.delete(inst.root); return; }
    if(inst.loading || !inst.rendered || !inst.today) return;

    /* Day rollover / long-lived tab: reload quietly. */
    if(inst.today.date !== _pwDayKey(now) && !inst.reloading){
      inst.reloading = true;
      _load(inst).finally(() => { inst.reloading = false; });
      return;
    }
    if(now.getTime() - (inst.loadedAt || 0) > 30 * 60 * 1000 && !inst.reloading && document.visibilityState !== 'hidden'){
      inst.reloading = true;
      _load(inst).finally(() => { inst.reloading = false; });
      return;
    }

    const schedule = _pwSchedule(inst.today, inst.nextDay, now);
    if(!schedule || !schedule.next) return;
    const next = schedule.next;
    const prefs = inst.prefs;
    const remaining = Math.max(0, next.date.getTime() - now.getTime());
    const clock = formatCountdownClock(remaining / 1000);

    _set(inst, 'h', clock.h);
    _set(inst, 'm', clock.m);
    _set(inst, 's', clock.s);
    _set(inst, 'next-name', next.name);
    _set(inst, 'next-ar', PRAYER_NAMES_AR[next.name] || '');
    _set(inst, 'next-time', formatPrayerTime(next.tomorrow && inst.nextDay ? inst.nextDay.timings[next.name] : inst.today.timings[next.name], prefs.timeFormat));
    _set(inst, 'period', next.tomorrow
      ? `${next.name} tomorrow${next.estimated ? ' (estimated)' : ''} · ${formatPrayerTime(inst.today.timings[next.name], prefs.timeFormat)}`
      : `Until ${next.name} · ${formatPrayerTime(inst.today.timings[next.name], prefs.timeFormat)}`);

    const progress = inst.root.querySelector('[data-pw="progress"]');
    if(progress) progress.style.width = `${Math.round(schedule.progress * 100)}%`;
    const wrap = inst.root.querySelector('[data-pw="progress-wrap"]');
    if(wrap) wrap.setAttribute('aria-valuenow', String(Math.round(schedule.progress * 100)));

    const status = inst.root.querySelector('[data-pw="status"]');
    const statusText = inst.root.querySelector('[data-pw="status-text"]');
    const stale = inst.stale || ((typeof getPrayerStatus === 'function' && getPrayerStatus()) || {}).stale;
    if(status && statusText){
      status.classList.remove('live', 'entered', 'cached');
      if(schedule.entered && schedule.prev){
        status.classList.add('entered');
        statusText.textContent = `${schedule.prev.name} entered`;
      } else if(stale){
        status.classList.add('cached');
        statusText.textContent = 'Cached';
      } else {
        status.classList.add('live');
        statusText.textContent = 'Live';
      }
    }

    const nextKey = `${next.name}:${next.tomorrow ? 'tmr' : 'today'}`;
    if(inst.lastNextKey !== nextKey){
      inst.root.querySelectorAll('[data-pw-cell]').forEach(cell => {
        const isNext = cell.getAttribute('data-pw-cell') === next.name;
        cell.classList.toggle('next', isNext);
        if(isNext && next.tomorrow) cell.setAttribute('title', 'Tomorrow');
        else cell.removeAttribute('title');
      });
      inst.lastNextKey = nextKey;
    }

    const statusInfo = (typeof getPrayerStatus === 'function') ? getPrayerStatus() : null;
    const provider = statusInfo && statusInfo.providerLabel ? statusInfo.providerLabel : 'Sahib';
    const foot = inst.root.querySelector('[data-pw="fresh"]');
    if(foot){
      const fresh = stale
        ? `Offline snapshot · ${_pwAgo(inst.cachedAt)}`
        : `${provider} · updated ${_pwAgo(inst.cachedAt)}`;
      if(foot.textContent !== fresh) foot.textContent = fresh;
    }
  }

  async function _load(inst){
    const token = ++inst.token;
    inst.loading = true;
    _renderLoading(inst.root, inst.options.variant);
    try{
      if(typeof getToday !== 'function') throw new Error('Prayer module unavailable');
      const prefs = await getPrayerPrefs();
      const result = await getToday();
      if(token !== inst.token) return;
      if(!result || !result.today) throw new Error('No prayer times for today');

      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(12, 0, 0, 0);
      let nextDay = null;
      try{ nextDay = await getPrayerDay(tomorrow); }catch(err){ /* current month data still useful */ }
      if(token !== inst.token) return;

      inst.today = result.today;
      inst.nextDay = nextDay;
      inst.cachedAt = result.cachedAt;
      inst.stale = !!result.stale;
      inst.prefs = prefs;
      inst.loadedAt = Date.now();
      inst.error = null;
      inst.loading = false;
      _render(inst);
    }catch(err){
      if(token !== inst.token) return;
      inst.loading = false;
      inst.error = err;
      const noLocation = err && (err.code === 'NO_LOCATION' || err.message === 'No location set');
      _renderEmpty(inst.root, inst.options.variant, noLocation ? 'location' : 'error', err.message);
      console.warn('[prayer-widget]', err.message);
    }
  }

  function _bindActions(inst){
    inst.root.addEventListener('click', (event) => {
      const action = event.target.closest('[data-pw-action]');
      if(!action) return;
      const name = action.getAttribute('data-pw-action');
      if(name === 'location' && typeof openLocationPicker === 'function') openLocationPicker();
      else if(name === 'settings' && typeof openSettings === 'function') openSettings('prayer');
      else if(name === 'timetable' && typeof openPrayerView === 'function') openPrayerView();
      else if(name === 'retry') refreshAll();
    });
  }

  async function mount(target, options = {}){
    const root = _root(target);
    if(!root) return null;

    if(instances.has(root)){
      try{ await instances.get(root).token++; }catch(err){ /* ignore */ }
      instances.delete(root);
    }

    const inst = {
      root,
      options: { variant: 'hero', showTimes: true, showLink: true, ...options },
      today: null,
      nextDay: null,
      prefs: null,
      cachedAt: null,
      stale: false,
      loading: true,
      rendered: false,
      token: 0,
      loadedAt: 0,
      error: null,
      lastNextKey: null
    };
    instances.set(root, inst);
    _bindActions(inst);
    await _load(inst);
    return inst;
  }

  function unmount(target){
    const root = _root(target);
    if(!root) return;
    const inst = instances.get(root);
    if(inst) inst.token++;
    instances.delete(root);
  }

  function refreshAll(){
    if(refreshTimer) return;
    refreshTimer = setTimeout(() => {
      refreshTimer = null;
      for(const [root, inst] of Array.from(instances.entries())){
        if(!document.body.contains(root)){
          inst.token++;
          instances.delete(root);
          continue;
        }
        _load(inst);
      }
      if(typeof PrayerAlerts !== 'undefined' && PrayerAlerts.refresh) PrayerAlerts.refresh();
    }, 40);
  }

  function tick(){
    const now = new Date();
    for(const [root, inst] of Array.from(instances.entries())){
      if(!document.body.contains(root)){
        inst.token++;
        instances.delete(root);
        continue;
      }
      _update(inst, now);
    }
    if(started) PrayerAlerts.check(now);
  }

  function init(){
    if(started) return;
    started = true;
    tickTimer = setInterval(tick, 1000);
    document.addEventListener('visibilitychange', () => {
      if(document.visibilityState === 'visible'){
        tick();
        refreshAll();
      }
    });
    window.addEventListener('online', refreshAll);
    window.addEventListener('sahib:prayerchange', refreshAll);
    window.addEventListener('sahib:prayerprefs', refreshAll);
    tick();
  }

  return {
    init, mount, unmount, refreshAll,
    update: (target) => {
      const root = _root(target);
      const inst = root && instances.get(root);
      if(inst) _update(inst, new Date());
    },
    schedule: _pwSchedule,
    instances
  };
})();

/* ═══════════════════════════════════════════════════════════
   AUDIO — a small, original reminder chime (no recitation)
   WebAudio only; unlocked by a user gesture.
   ═══════════════════════════════════════════════════════════ */
let _sahibAudioCtx = null;
let _sahibAudioUnlocked = false;

function _audioContext(){
  if(_sahibAudioCtx) return _sahibAudioCtx;
  const Ctx = window.AudioContext || window.webkitAudioContext;
  if(!Ctx) return null;
  try{ _sahibAudioCtx = new Ctx(); }catch(err){ return null; }
  return _sahibAudioCtx;
}

function unlockPrayerAudio(){
  const ctx = _audioContext();
  if(!ctx) return;
  if(ctx.state === 'suspended') ctx.resume().catch(() => {});
  _sahibAudioUnlocked = true;
}

if(typeof document !== 'undefined'){
  document.addEventListener('pointerdown', unlockPrayerAudio, { once: true });
  document.addEventListener('keydown', unlockPrayerAudio, { once: true });
}

/* Three soft rising tones. Original composition, no sampled material. */
function playPrayerChime(volume = 0.55){
  const ctx = _audioContext();
  if(!ctx) return false;
  if(ctx.state === 'suspended') ctx.resume().catch(() => {});
  const master = Math.max(0, Math.min(1, Number(volume) || 0)) * 0.22;
  if(master <= 0) return false;
  const notes = [
    { freq: 523.25, at: 0.00, dur: 1.15 },
    { freq: 659.25, at: 0.18, dur: 1.15 },
    { freq: 783.99, at: 0.36, dur: 1.35 }
  ];
  const start = ctx.currentTime + 0.02;
  notes.forEach(note => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(note.freq, start + note.at);
    gain.gain.setValueAtTime(0.0001, start + note.at);
    gain.gain.exponentialRampToValueAtTime(master, start + note.at + 0.04);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + note.at + note.dur);
    osc.connect(gain).connect(ctx.destination);
    osc.start(start + note.at);
    osc.stop(start + note.at + note.dur + 0.05);
  });
  return true;
}

/* ═══════════════════════════════════════════════════════════
   ADHAN AUDIO
   Bundled CC0 field recordings plus optional user files stored in
   IndexedDB. No external CDN and no fake preview buttons.
   ═══════════════════════════════════════════════════════════ */
let _sahibAdhanAudio = null;
let _sahibAdhanObjectUrl = null;

function _adhanAudioPrefs(prefs){
  if(prefs && prefs.alerts && prefs.alerts.audio) return prefs.alerts.audio;
  return { standard: 'azhar', fajr: 'fajr-balakong' };
}

async function resolveAdhanSource(kind, prefs){
  const audio = _adhanAudioPrefs(prefs);
  const selection = kind === 'fajr' ? audio.fajr : audio.standard;
  if(selection === 'local'){
    try{
      const saved = await store.getMeta(ADHAN_LOCAL_KEYS[kind]);
      if(saved && saved.blob){
        const url = URL.createObjectURL(saved.blob);
        return { url, local: true, name: saved.name || 'Local recording', revoke: true };
      }
    }catch(err){
      console.warn('[adhan] local file unavailable', err);
    }
  }
  const list = ADHAN_BUNDLED[kind] || ADHAN_BUNDLED.standard;
  const picked = list.find(item => item.id === selection) || list[0];
  return picked ? { ...picked, url: picked.src || picked.url, local: false } : null;
}

function stopPrayerAdhan(){
  if(_sahibAdhanAudio){
    try{ _sahibAdhanAudio.pause(); }catch(err){ /* already stopped */ }
    _sahibAdhanAudio = null;
  }
  if(_sahibAdhanObjectUrl){
    try{ URL.revokeObjectURL(_sahibAdhanObjectUrl); }catch(err){ /* ignore */ }
    _sahibAdhanObjectUrl = null;
  }
}

async function playPrayerAdhan(kind, volume, prefs){
  unlockPrayerAudio();
  stopPrayerAdhan();
  if(!prefs) prefs = await getPrayerPrefs();
  const source = await resolveAdhanSource(kind, prefs);
  if(!source || !source.url) return false;
  const audio = new Audio(source.url);
  audio.preload = 'auto';
  audio.volume = Math.max(0, Math.min(1, Number(volume) || 0));
  _sahibAdhanAudio = audio;
  if(source.revoke) _sahibAdhanObjectUrl = source.url;
  const cleanup = () => {
    if(_sahibAdhanAudio === audio){
      _sahibAdhanAudio = null;
      if(_sahibAdhanObjectUrl === source.url){
        try{ URL.revokeObjectURL(source.url); }catch(err){ /* ignore */ }
        _sahibAdhanObjectUrl = null;
      }
    }
  };
  audio.addEventListener('ended', cleanup, { once: true });
  try{
    await audio.play();
    return true;
  }catch(err){
    cleanup();
    console.warn('[adhan] playback blocked or unavailable', err.message);
    return false;
  }
}

async function previewPrayerAdhan(kind, volume){
  const prefs = await getPrayerPrefs();
  return playPrayerAdhan(kind === 'fajr' ? 'fajr' : 'standard', volume == null ? prefs.alerts.volume : volume, prefs);
}

function adhanPreviewPlaying(){
  return !!(_sahibAdhanAudio && !_sahibAdhanAudio.paused && !_sahibAdhanAudio.ended);
}

/* ═══════════════════════════════════════════════════════════
   PRAYER ALERTS
   ═══════════════════════════════════════════════════════════ */
const PrayerAlerts = (() => {
  const state = {
    prefs: null,
    today: null,
    nextDay: null,
    loadedKey: null,
    loadedAt: 0,
    errorAt: 0,
    loading: false,
    fired: new Set(),
    firedDate: null,
    timer: null
  };

  async function init(){
    await refresh();
    if(state.timer) return;
    state.timer = setInterval(() => {
      check(new Date());
      if(state.prefs && state.prefs.alerts.enabled){
        _ensureData(new Date()).catch(() => {});
      }
    }, 20000);
    document.addEventListener('visibilitychange', () => {
      if(document.visibilityState === 'visible') check(new Date());
    });
  }

  async function refresh(){
    state.prefs = await getPrayerPrefs();
    state.loadedKey = null;
    state.loadedAt = 0;
    state.errorAt = 0;
    if(state.prefs.alerts.enabled){
      await _ensureData(new Date());
      check(new Date());
    }
  }

  async function _ensureData(now, force = false){
    if(state.loading) return;
    if(!state.prefs) state.prefs = await getPrayerPrefs();
    if(!state.prefs.alerts.enabled) return;
    const key = _pwDayKey(now);
    if(!force && state.today && state.loadedKey === key && Date.now() - state.loadedAt < 10 * 60 * 1000) return;
    if(!force && Date.now() - state.errorAt < 60 * 1000) return;

    state.loading = true;
    try{
      const result = await getToday();
      const tomorrow = new Date(now);
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(12, 0, 0, 0);
      let nextDay = null;
      try{ nextDay = await getPrayerDay(tomorrow); }catch(err){ /* optional */ }
      state.today = result && result.today ? result.today : null;
      state.nextDay = nextDay;
      state.loadedKey = key;
      state.loadedAt = Date.now();
      if(state.firedDate !== key){
        state.fired.clear();
        state.firedDate = key;
      }
    }catch(err){
      state.errorAt = Date.now();
      console.warn('[prayer-alerts]', err.message);
    }finally{
      state.loading = false;
    }
  }

  function _events(now){
    if(!state.today) return [];
    const events = [];
    ['Fajr', 'Dhuhr', 'Asr', 'Maghrib', 'Isha'].forEach(name => {
      const date = _pwEventDate(state.today.date, state.today.timings[name]);
      if(date) events.push({ name, date, dateKey: state.today.date, tomorrow: false });
    });
    if(state.nextDay){
      const date = _pwEventDate(state.nextDay.date, state.nextDay.timings.Fajr);
      if(date) events.push({ name: 'Fajr', date, dateKey: state.nextDay.date, tomorrow: true });
    }
    return events;
  }

  function _alertMode(pp){
    if(!pp) return 'off';
    if(pp.mode === 'off' || pp.mode === 'chime' || pp.mode === 'adhan') return pp.mode;
    if(pp.alert === false) return 'off';
    return pp.sound === false ? 'off' : 'chime';
  }

  function _notificationAllowed(prefs){
    return !!prefs.alerts.notify && typeof Notification !== 'undefined' && Notification.permission === 'granted';
  }

  function _notify(title, body){
    if(typeof Notification === 'undefined' || Notification.permission !== 'granted') return;
    try{
      if(navigator.serviceWorker && navigator.serviceWorker.ready){
        navigator.serviceWorker.ready.then(reg => {
          if(reg && reg.showNotification){
            reg.showNotification(title, {
              body,
              icon: 'icons/icon-192.png',
              badge: 'icons/icon-192.png',
              tag: 'sahib-prayer',
              renotify: true,
              data: { url: './index.html' }
            });
          } else {
            const n = new Notification(title, { body, icon: 'icons/icon-192.png', tag: 'sahib-prayer' });
            n.onclick = () => { window.focus(); n.close(); };
          }
        }).catch(() => {
          const n = new Notification(title, { body, icon: 'icons/icon-192.png', tag: 'sahib-prayer' });
          n.onclick = () => { window.focus(); n.close(); };
        });
      } else {
        const n = new Notification(title, { body, icon: 'icons/icon-192.png', tag: 'sahib-prayer' });
        n.onclick = () => { window.focus(); n.close(); };
      }
    }catch(err){
      console.warn('[prayer-alerts] notification failed', err.message);
    }
  }

  function _fire(kind, event, prefs){
    const key = `${event.dateKey}:${event.name}:${kind}`;
    if(state.fired.has(key)) return;
    state.fired.add(key);

    const pp = prefs.alerts.perPrayer[event.name] || {};
    const mode = _alertMode(pp);
    if(mode === 'off') return;
    const time = formatPrayerTime(
      event.tomorrow ? (state.nextDay && state.nextDay.timings.Fajr) : (state.today && state.today.timings[event.name]),
      prefs.timeFormat
    );

    let message;
    if(kind === 'time'){
      message = `${event.name} has entered · ${time}`;
    } else {
      const mins = Math.max(1, Math.round((event.date.getTime() - Date.now()) / 60000));
      message = `${event.name} in ${mins} min · ${time}`;
    }

    if(typeof toast === 'function') toast(message, 'mosque');
    if(mode === 'adhan'){
      playPrayerAdhan(event.name === 'Fajr' ? 'fajr' : 'standard', prefs.alerts.volume, prefs)
        .then(ok => { if(!ok && typeof toast === 'function') toast('Adhan audio could not start — tap Preview in Alerts to unlock audio.', 'alert'); });
    } else if(mode === 'chime'){
      playPrayerChime(prefs.alerts.volume);
    }
    if(_notificationAllowed(prefs)) _notify(`Sahib · ${event.name}`, message);
  }

  function check(now = new Date()){
    const prefs = state.prefs;
    if(!prefs || !prefs.alerts.enabled || !state.today || !state.today.timings) return;
    const nowMs = now.getTime();
    const leadMs = Math.max(1, Number(prefs.alerts.leadMinutes) || 10) * 60 * 1000;

    for(const event of _events(now)){
      const pp = prefs.alerts.perPrayer[event.name];
      if(_alertMode(pp) === 'off') continue;
      const diff = event.date.getTime() - nowMs;

      if(diff > 0 && diff <= leadMs && nowMs >= event.date.getTime() - leadMs){
        if(state.fired.has(`${event.dateKey}:${event.name}:lead`)) continue;
        /* If the tab was asleep, avoid firing a reminder long after its window. */
        if(nowMs - (event.date.getTime() - leadMs) <= 10 * 60 * 1000){
          _fire('lead', event, prefs);
        }
      }

      if(prefs.alerts.atTime && diff <= 0 && -diff <= 2 * 60 * 1000){
        if(state.fired.has(`${event.dateKey}:${event.name}:time`)) continue;
        _fire('time', event, prefs);
      }
    }
  }

  async function requestNotificationPermission(){
    if(typeof Notification === 'undefined') return 'unsupported';
    if(Notification.permission === 'granted') return 'granted';
    if(Notification.permission === 'denied') return 'denied';
    try{
      return await Notification.requestPermission();
    }catch(err){
      return 'unsupported';
    }
  }

  function notificationState(){
    if(typeof Notification === 'undefined') return 'unsupported';
    return Notification.permission;
  }

  function previewChime(volume){
    unlockPrayerAudio();
    return playPrayerChime(volume == null ? 0.55 : volume);
  }

  async function previewAdhan(kind, volume){
    const prefs = state.prefs || await getPrayerPrefs();
    return playPrayerAdhan(kind, volume == null ? prefs.alerts.volume : volume, prefs);
  }

  function stopAdhan(){
    stopPrayerAdhan();
  }

  async function testNotification(){
    const prefs = state.prefs || await getPrayerPrefs();
    _notify('Sahib · Prayer reminder', `This is how a ${prefs.alerts.leadMinutes}-minute reminder will appear.`);
  }

  return {
    init, refresh, check,
    requestNotificationPermission,
    notificationState,
    previewChime,
    previewAdhan,
    stopAdhan,
    adhanPreviewPlaying,
    testNotification,
    playChime: playPrayerChime,
    playAdhan: playPrayerAdhan,
    state
  };
})();

window.PrayerWidget = PrayerWidget;
window.PrayerAlerts = PrayerAlerts;
window.playPrayerChime = playPrayerChime;
window.unlockPrayerAudio = unlockPrayerAudio;
window.ADHAN_BUNDLED = ADHAN_BUNDLED;
window.ADHAN_LOCAL_KEYS = ADHAN_LOCAL_KEYS;
window.ADHAN_LOCAL_MAX_BYTES = ADHAN_LOCAL_MAX_BYTES;
window.ADHAN_LOCAL_MAX_SECONDS = ADHAN_LOCAL_MAX_SECONDS;
window.resolveAdhanSource = resolveAdhanSource;
window.previewPrayerAdhan = previewPrayerAdhan;
window.stopPrayerAdhan = stopPrayerAdhan;
