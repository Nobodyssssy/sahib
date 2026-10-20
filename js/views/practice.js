'use strict';

/* ==========================================================================
   SAHIB Â· DAILY PRACTICE
   A local-first daybook for recurring worship, personal routines and honest
   time-limit trackers. State is stored in the existing IndexedDB `meta` store
   under `practiceStateV1`; no new database version is required.
   ========================================================================== */

const SahibPractice = (() => {
  const KEY = 'practiceStateV1';
  const VERSION = 1;
  const WEEKDAYS_EN = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const WEEKDAYS_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const HIJRI_MONTHS_EN = ['Muharram', 'Safar', 'Rabi al-Awwal', 'Rabi al-Thani', 'Jumada al-Ula', 'Jumada al-Akhirah', 'Rajab', 'Shaâ€˜ban', 'Ramadan', 'Shawwal', 'Dhul-Qaâ€˜dah', 'Dhul-Hijjah'];

  const runtime = {
    ready: false,
    data: null,
    timings: null,
    tab: 'today',
    calendarCursor: null,
    calendarSelected: null,
    editingId: null,
    timer: null,
    detailId: null
  };

  function _defaultState() {
    return {
      version: VERSION,
      enabled: {},
      overrides: {},
      custom: [],
      entries: [],
      lastDone: {},
      snoozes: {},
      notices: {},
      settings: {
        quietStart: '22:00',
        quietEnd: '06:30',
        notify: false,
        group: true
      },
      dismissedSetup: false
    };
  }

  function _normalize(raw) {
    const out = _defaultState();
    if (!raw || typeof raw !== 'object') return out;
    if (raw.enabled && typeof raw.enabled === 'object') out.enabled = { ...raw.enabled };
    if (raw.overrides && typeof raw.overrides === 'object') out.overrides = { ...raw.overrides };
    if (Array.isArray(raw.custom)) {
      out.custom = raw.custom.filter(p => p && typeof p.id === 'string' && p.title && p.schedule);
    }
    if (Array.isArray(raw.entries)) {
      out.entries = raw.entries.filter(e => e && e.practiceId && e.date && e.status);
    }
    if (raw.lastDone && typeof raw.lastDone === 'object') out.lastDone = { ...raw.lastDone };
    if (raw.snoozes && typeof raw.snoozes === 'object') out.snoozes = { ...raw.snoozes };
    if (raw.notices && typeof raw.notices === 'object') out.notices = { ...raw.notices };
    if (raw.settings && typeof raw.settings === 'object') out.settings = { ...out.settings, ...raw.settings };
    out.dismissedSetup = !!raw.dismissedSetup;
    out.entries = out.entries.slice(-4000);
    return out;
  }

  async function init() {
    if (runtime.ready) return runtime.data;
    let saved = null;
    try { saved = await store.getMeta(KEY); } catch (err) { console.warn('[practice] could not load state', err); }
    runtime.data = _normalize(saved);
    runtime.ready = true;
    startReminders();
    return runtime.data;
  }

  async function _save() {
    if (!runtime.data) return;
    runtime.data.entries = runtime.data.entries.slice(-4000);
    const cutoff = Date.now() - (7 * 86400000);
    for (const [k, v] of Object.entries(runtime.data.notices || {})) {
      if (!v || v < cutoff) delete runtime.data.notices[k];
    }
    try { await store.setMeta(KEY, runtime.data); }
    catch (err) { console.warn('[practice] could not save state', err); toast('Could not save practice data', 'alert'); }
  }

  function _category(id) {
    return PRACTICE_CATEGORIES.find(c => c.id === id) || PRACTICE_CATEGORIES[PRACTICE_CATEGORIES.length - 1];
  }

  function _allPractices() {
    const builtIn = PRACTICE_CATALOG.map(p => {
      const ov = runtime.data?.overrides?.[p.id] || {};
      const schedule = { ...(p.schedule || { type: 'daily' }), ...(ov.schedule || {}) };
      return {
        ...p,
        ...ov,
        id: p.id,
        title: p.title,
        titleAr: p.titleAr,
        category: p.category,
        status: p.status,
        summary: p.summary,
        source: p.source,
        sourceUrl: p.sourceUrl,
        sourceNote: p.sourceNote,
        schedule,
        builtIn: true,
        enabled: runtime.data?.enabled?.[p.id] === true && !p.templateOnly
      };
    });
    const custom = (runtime.data?.custom || []).map(p => ({
      ...p,
      schedule: { ...(p.schedule || { type: 'manual' }) },
      builtIn: false,
      enabled: runtime.data?.enabled?.[p.id] === true
    }));
    return [...builtIn, ...custom];
  }

  function _get(id) {
    return _allPractices().find(p => p.id === id) || null;
  }

  function _enabled() {
    return _allPractices().filter(p => p.enabled);
  }

  function _dateKey(d = new Date()) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }

  function _parseKey(key) {
    if (!key) return null;
    const parts = String(key).split('-').map(Number);
    if (parts.length !== 3 || parts.some(n => !Number.isFinite(n))) return null;
    return new Date(parts[0], parts[1] - 1, parts[2], 12, 0, 0, 0);
  }

  function _addDays(date, n) {
    const d = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 12, 0, 0, 0);
    d.setDate(d.getDate() + Number(n || 0));
    return d;
  }

  function _dayDiff(a, b) {
    const x = new Date(a.getFullYear(), a.getMonth(), a.getDate()).getTime();
    const y = new Date(b.getFullYear(), b.getMonth(), b.getDate()).getTime();
    return Math.round((y - x) / 86400000);
  }

  function _hijri(date) {
    try { return typeof getHijriParts === 'function' ? getHijriParts(date) : null; }
    catch (err) { return null; }
  }

  function _hijriMonthName(n) {
    if (typeof HIJRI_MONTHS_NAMES_EN !== 'undefined' && HIJRI_MONTHS_NAMES_EN[n - 1]) return HIJRI_MONTHS_NAMES_EN[n - 1];
    return HIJRI_MONTHS_EN[n - 1] || '';
  }

  function _hijriLine(date) {
    const h = _hijri(date);
    if (!h) return '';
    const ar = h.monthNameAr || '';
    return `${h.day} ${ar} ${h.year} Ù‡Ù€`;
  }

  function _fmtLong(date) {
    return date.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' });
  }

  function _fmtDate(key) {
    const d = _parseKey(key);
    return d ? d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' }) : key;
  }

  function _parseClock(value) {
    const m = String(value || '').match(/(\d{1,2}):(\d{2})/);
    if (!m) return null;
    const h = Number(m[1]);
    const min = Number(m[2]);
    if (h < 0 || h > 23 || min < 0 || min > 59) return null;
    return h * 60 + min;
  }

  function _fmtClock(minutes) {
    if (minutes == null || !Number.isFinite(minutes)) return '';
    const m = ((Math.round(minutes) % 1440) + 1440) % 1440;
    return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
  }

  function _prayerMinutes(prayer) {
    if (!prayer || !runtime.timings) return null;
    const raw = runtime.timings[prayer] || runtime.timings[prayer.toLowerCase()];
    return _parseClock(raw);
  }

  function _dueMinutes(practice, date = new Date()) {
    if (!practice) return null;
    if (practice.relativeTo) {
      if (_dateKey(date) !== _dateKey()) return null;
      const base = _prayerMinutes(practice.relativeTo);
      if (base == null) return null;
      return ((base + Number(practice.offsetMinutes || 0)) % 1440 + 1440) % 1440;
    }
    return _parseClock(practice.reminderTime);
  }

  function _timeText(practice, date = new Date()) {
    if (practice.schedule?.type === 'interval') return 'Anytime';
    if (practice.relativeTo) {
      const base = _prayerMinutes(practice.relativeTo);
      if (base != null && _dateKey(date) === _dateKey()) {
        return _fmtClock(base + Number(practice.offsetMinutes || 0));
      }
      return practice.relativeTo;
    }
    if (practice.reminderTime) return practice.reminderTime;
    return practice.timeLabel || 'Anytime';
  }

  function _timeSub(practice) {
    if (practice.schedule?.type === 'interval') return `Every ${Number(practice.schedule.everyDays || 40)} days`;
    if (practice.relativeTo) {
      const off = Number(practice.offsetMinutes || 0);
      const base = _prayerMinutes(practice.relativeTo);
      if (base != null) return practice.timeLabel || practice.relativeTo;
      if (off < 0) return `${Math.abs(off)} min before`;
      if (off > 0) return `${off} min after`;
      return 'Prayer time';
    }
    return practice.timeLabel || 'Your time';
  }

  function _scheduleText(practice) {
    const s = practice.schedule || { type: 'manual' };
    if (s.type === 'daily') return 'Every day';
    if (s.type === 'weekly') {
      const days = Array.isArray(s.days) ? s.days : [];
      return days.length ? days.map(d => WEEKDAYS_EN[d]).join(' & ') : 'Choose days';
    }
    if (s.type === 'gregorian-monthly') return `Monthly Â· day ${s.day || 1}`;
    if (s.type === 'hijri-monthly') {
      const days = Array.isArray(s.days) ? s.days : [];
      return `Hijri Â· ${days.length ? days.join(', ') : 'choose days'}`;
    }
    if (s.type === 'hijri-yearly') {
      const days = Array.isArray(s.days) ? s.days : [];
      return `Hijri Â· ${days.join(', ') || 'â€”'} ${_hijriMonthName(s.month || 1)}`;
    }
    if (s.type === 'hijri-range') {
      return `Hijri Â· ${s.start || 1}â€“${s.end || 1} ${_hijriMonthName(s.month || 1)}`;
    }
    if (s.type === 'interval') return `Every ${s.everyDays || 40} days`;
    if (s.type === 'once') return s.date ? `Once Â· ${_fmtDate(s.date)}` : 'One date Â· not set';
    return 'No date set';
  }

  function _statusChip(practice) {
    const label = PRACTICE_STATUS_LABELS[practice.status] || 'Practice';
    return `<span class="practice-chip practice-chip--${esc(practice.status || 'personal')}">${esc(label)}</span>`;
  }

  function _sourceLink(practice) {
    if (!practice.source) return '';
    const text = esc(practice.source);
    if (practice.sourceUrl) {
      return `<a class="practice-source-link" href="${esc(practice.sourceUrl)}" target="_blank" rel="noopener noreferrer">${text}</a>`;
    }
    return `<span class="practice-source-link">${text}</span>`;
  }

  function _isExcluded(practice, date) {
    const h = _hijri(date);
    if (!h) return false;
    return (practice.exclude || []).some(rule => {
      if (rule.hijriMonth && Number(rule.hijriMonth) !== Number(h.month)) return false;
      if (Array.isArray(rule.hijriDays) && !rule.hijriDays.map(Number).includes(Number(h.day))) return false;
      return true;
    });
  }

  function _occursOn(practice, date) {
    const s = practice.schedule || { type: 'manual' };
    if (s.type === 'manual') return false;
    if (_isExcluded(practice, date)) return false;
    const h = _hijri(date);
    if (s.type === 'daily') return true;
    if (s.type === 'weekly') return Array.isArray(s.days) && s.days.map(Number).includes(date.getDay());
    if (s.type === 'gregorian-monthly') return Number(s.day) === date.getDate();
    if (s.type === 'hijri-monthly') return !!h && Array.isArray(s.days) && s.days.map(Number).includes(Number(h.day));
    if (s.type === 'hijri-yearly') {
      return !!h && Number(h.month) === Number(s.month) && Array.isArray(s.days) && s.days.map(Number).includes(Number(h.day));
    }
    if (s.type === 'hijri-range') {
      return !!h && Number(h.month) === Number(s.month) && Number(h.day) >= Number(s.start || 1) && Number(h.day) <= Number(s.end || 1);
    }
    if (s.type === 'once') return s.date === _dateKey(date);
    return false;
  }

  function _entryFor(id, dateKey) {
    const rows = (runtime.data?.entries || []).filter(e => e.practiceId === id && e.date === dateKey);
    return rows.length ? rows[rows.length - 1] : null;
  }

  function _isSnoozed(id, dateKey) {
    const until = runtime.data?.snoozes?.[id];
    return !!until && dateKey <= until;
  }

  function _trackerInfo(practice, date = new Date()) {
    if (!practice || practice.schedule?.type !== 'interval') return null;
    const every = Math.max(1, Number(practice.schedule.everyDays || 40));
    const warning = Math.max(0, Number(practice.warningDays ?? 7));
    const last = runtime.data?.lastDone?.[practice.id] || null;
    if (!last) {
      return { practice, last: null, every, warning, dueDate: null, elapsed: null, daysLeft: null, state: 'setup' };
    }
    const lastDate = _parseKey(last);
    if (!lastDate) return { practice, last: null, every, warning, dueDate: null, elapsed: null, daysLeft: null, state: 'setup' };
    const dueDate = _addDays(lastDate, every);
    const daysLeft = _dayDiff(date, dueDate);
    const elapsed = Math.max(0, _dayDiff(lastDate, date));
    let state = 'ok';
    if (daysLeft < 0) state = 'overdue';
    else if (daysLeft === 0) state = 'due';
    else if (daysLeft <= warning) state = 'soon';
    return { practice, last, every, warning, dueDate, elapsed, daysLeft, state };
  }

  function _nextOccurrences(practice, count = 3, from = new Date()) {
    if (!practice) return [];
    const out = [];
    const s = practice.schedule || {};
    if (s.type === 'manual') return out;
    if (s.type === 'interval') {
      const tracker = _trackerInfo(practice, from);
      if (tracker?.dueDate) out.push(tracker.dueDate);
      return out;
    }
    for (let i = 1; i <= 400 && out.length < count; i++) {
      const d = _addDays(from, i);
      if (_occursOn(practice, d)) out.push(d);
      if (s.type === 'daily' && out.length >= count) break;
    }
    return out;
  }

  async function _complete(id, dateKey = _dateKey()) {
    const p = _get(id);
    if (!p) return;
    runtime.data.entries = runtime.data.entries.filter(e => !(e.practiceId === id && e.date === dateKey));
    runtime.data.entries.push({ practiceId: id, date: dateKey, status: 'done', at: Date.now() });
    if (p.schedule?.type === 'interval') {
      const current = runtime.data.lastDone[id];
      if (!current || dateKey >= current) runtime.data.lastDone[id] = dateKey;
    }
    delete runtime.data.snoozes[id];
    await _save();
    closePracticeDetail();
    _refreshSurfaces();
    toast(`${p.title} Â· marked done`, 'check');
  }

  async function _undo(id, dateKey = _dateKey()) {
    const p = _get(id);
    if (!p) return;
    runtime.data.entries = runtime.data.entries.filter(e => !(e.practiceId === id && e.date === dateKey));
    if (p.schedule?.type === 'interval') {
      const remaining = runtime.data.entries
        .filter(e => e.practiceId === id && e.status === 'done' && e.date <= dateKey)
        .map(e => e.date).sort();
      if (remaining.length) runtime.data.lastDone[id] = remaining[remaining.length - 1];
      else delete runtime.data.lastDone[id];
    }
    await _save();
    closePracticeDetail();
    _refreshSurfaces();
    toast('Completion undone', 'undo');
  }

  async function _skip(id, dateKey = _dateKey()) {
    const p = _get(id);
    if (!p) return;
    runtime.data.entries = runtime.data.entries.filter(e => !(e.practiceId === id && e.date === dateKey));
    runtime.data.entries.push({ practiceId: id, date: dateKey, status: 'skipped', at: Date.now() });
    delete runtime.data.snoozes[id];
    await _save();
    closePracticeDetail();
    _refreshSurfaces();
    toast(`${p.title} Â· set aside`, 'calm');
  }

  async function _snooze(id, days = 1) {
    const p = _get(id);
    if (!p) return;
    const from = new Date();
    const until = _addDays(from, Math.max(0, Number(days) - 1));
    runtime.data.snoozes[id] = _dateKey(until);
    await _save();
    closePracticeDetail();
    _refreshSurfaces();
    toast(`${p.title} Â· returned ${Number(days) === 1 ? 'tomorrow' : `in ${days} days`}`, 'clock');
  }

  async function _unsnooze(id) {
    delete runtime.data.snoozes[id];
    await _save();
    _refreshSurfaces();
  }

  async function _setLastDone(id, dateKey) {
    const p = _get(id);
    if (!p) return;
    const d = _parseKey(dateKey);
    if (!d || d > new Date()) { toast('Choose a date that has already passed', 'alert'); return; }
    runtime.data.lastDone[id] = dateKey;
    runtime.data.entries = runtime.data.entries.filter(e => !(e.practiceId === id && e.date === dateKey));
    runtime.data.entries.push({ practiceId: id, date: dateKey, status: 'done', at: Date.now(), source: 'backfill' });
    runtime.data.enabled[id] = true;
    await _save();
    closePracticeDetail();
    _refreshSurfaces();
    toast(`${p.title} Â· starting date saved`, 'check');
  }

  async function _toggleEnabled(id) {
    const p = _get(id);
    if (!p) return;
    const next = !runtime.data.enabled[id];
    runtime.data.enabled[id] = next;
    if (next && p.schedule?.type === 'interval' && !runtime.data.lastDone[id]) {
      toast('Tracker added Â· set the last-completed date', 'clock');
    } else {
      toast(next ? `${p.title} added` : `${p.title} paused`, next ? 'check' : 'calm');
    }
    await _save();
    _refreshSurfaces();
    if (runtime.detailId === id) openPracticeDetail(id);
  }

  async function _enableStarter(id) {
    if (!_get(id)) return;
    runtime.data.enabled[id] = true;
    runtime.data.dismissedSetup = true;
    await _save();
    _refreshSurfaces();
    toast('Added to your daybook', 'check');
  }

  async function _addStarterSet() {
    PRACTICE_STARTER_IDS.forEach(id => { if (_get(id)) runtime.data.enabled[id] = true; });
    runtime.data.dismissedSetup = true;
    await _save();
    _refreshSurfaces();
    toast('Starter daybook created', 'check');
  }

  async function _dismissSetup() {
    runtime.data.dismissedSetup = true;
    await _save();
    _refreshSurfaces();
  }

  function _refreshSurfaces() {
    if (document.getElementById('view-practice')?.classList.contains('active') && typeof renderPracticeView === 'function') {
      renderPracticeView();
    } else if (document.getElementById('view-home')?.classList.contains('active') && typeof renderHome === 'function') {
      renderHome();
    }
  }

  function _todayEntries(key) {
    const map = new Map(_allPractices().filter(p => p.enabled).map(p => [p.id, p]));
    return (runtime.data?.entries || [])
      .filter(e => e.date === key && map.has(e.practiceId))
      .map(e => ({ entry: e, practice: map.get(e.practiceId) }))
      .sort((a, b) => (b.entry.at || 0) - (a.entry.at || 0));
  }

  function getTodaySnapshot(date = new Date()) {
    const key = _dateKey(date);
    const enabled = _enabled();
    const due = [];
    const trackers = [];
    const snoozed = [];

    enabled.forEach(practice => {
      if (practice.schedule?.type === 'interval') {
        const tracker = _trackerInfo(practice, date);
        if (tracker) trackers.push(tracker);
        if (!tracker || tracker.state === 'setup' || tracker.state === 'ok') return;
        if (snoozed.some(x => x.practice.id === practice.id)) return;
        if (_isSnoozed(practice.id, key)) {
          snoozed.push({ practice, tracker, until: runtime.data.snoozes[practice.id] });
          return;
        }
        due.push({
          practice,
          tracker,
          status: tracker.state === 'overdue' ? 'overdue' : (tracker.state === 'due' ? 'due' : 'approaching'),
          dueMinutes: null
        });
        return;
      }
      if (!_occursOn(practice, date)) return;
      if (_isSnoozed(practice.id, key)) {
        snoozed.push({ practice, tracker: null, until: runtime.data.snoozes[practice.id] });
        return;
      }
      due.push({
        practice,
        tracker: null,
        status: 'due',
        dueMinutes: _dueMinutes(practice, date)
      });
    });

    const todayRows = _todayEntries(key);
    const completed = todayRows.filter(row => row.entry.status === 'done');
    const skipped = todayRows.filter(row => row.entry.status === 'skipped');
    const doneIds = new Set([...completed, ...skipped].map(row => row.practice.id));
    const dueFiltered = due.filter(item => !doneIds.has(item.practice.id));
    dueFiltered.sort((a, b) => {
      const am = a.dueMinutes == null ? 1800 : a.dueMinutes;
      const bm = b.dueMinutes == null ? 1800 : b.dueMinutes;
      return am - bm || a.practice.title.localeCompare(b.practice.title);
    });
    trackers.sort((a, b) => {
      const rank = { overdue: 0, due: 1, soon: 2, ok: 3, setup: 4 };
      return (rank[a.state] ?? 9) - (rank[b.state] ?? 9);
    });

    const upcoming = getUpcomingGroups(14, false, date).flatMap(group => group.items.map(item => ({ ...item, date: group.date, key: group.key })));
    return {
      key,
      date,
      enabled,
      due: dueFiltered,
      completed,
      skipped,
      snoozed,
      trackers,
      next: upcoming.slice(0, 4),
      hijri: _hijri(date)
    };
  }

  function getUpcomingGroups(days = 14, includeDaily = false, from = new Date()) {
    const groups = [];
    const enabled = _enabled();
    for (let offset = 1; offset <= days; offset++) {
      const date = _addDays(from, offset);
      const key = _dateKey(date);
      const items = [];
      enabled.forEach(practice => {
        if (practice.schedule?.type === 'interval') {
          const tracker = _trackerInfo(practice, from);
          if (tracker?.dueDate && _dateKey(tracker.dueDate) === key) {
            items.push({ practice, dueMinutes: null, tracker });
          }
          return;
        }
        if (!includeDaily && practice.schedule?.type === 'daily') return;
        if (_occursOn(practice, date)) {
          items.push({ practice, dueMinutes: null, tracker: null });
        }
      });
      if (items.length) {
        items.sort((a, b) => a.practice.title.localeCompare(b.practice.title));
        groups.push({ date, key, items });
      }
    }
    return groups;
  }

  function getDayAgenda(key) {
    const date = _parseKey(key) || new Date();
    const enabled = _enabled();
    const out = [];
    enabled.forEach(practice => {
      if (practice.schedule?.type === 'interval') {
        const tracker = _trackerInfo(practice, date);
        if (!tracker || tracker.state === 'setup' || tracker.state === 'ok') return;
        out.push({ practice, tracker, status: tracker.state, entry: _entryFor(practice.id, key) });
        return;
      }
      if (!_occursOn(practice, date)) return;
      const entry = _entryFor(practice.id, key);
      out.push({ practice, tracker: null, status: entry?.status || 'due', entry });
    });
    return out.sort((a, b) => a.practice.title.localeCompare(b.practice.title));
  }

  function getHomeSummary() {
    const snap = getTodaySnapshot();
    const next = snap.next[0] || null;
    return { ...snap, next };
  }

  function setTimings(timings) {
    if (timings && typeof timings === 'object') runtime.timings = timings;
  }

  function _renderChip(text, cls = '') {
    return `<span class="practice-chip ${cls}">${esc(text)}</span>`;
  }

  function _renderTrackerLine(tracker) {
    if (!tracker) return '';
    const { practice, every, elapsed, daysLeft, state } = tracker;
    if (state === 'setup') {
      return `<p class="practice-tracker-line">No starting date yet. <button class="practice-text-btn" onclick="openPracticeDetail('${esc(practice.id)}')">Set a date</button></p>`;
    }
    const label = state === 'overdue'
      ? `Day ${elapsed} of ${every} Â· ${Math.abs(daysLeft)} ${Math.abs(daysLeft) === 1 ? 'day' : 'days'} beyond your chosen limit`
      : state === 'due'
        ? `Day ${every} of ${every} Â· at your chosen limit`
        : `Day ${elapsed} of ${every} Â· ${daysLeft} ${daysLeft === 1 ? 'day' : 'days'} left`;
    return `<div class="practice-tracker-line"><div class="practice-meter practice-meter--${state}"><span style="width:${Math.min(100, Math.round((elapsed / every) * 100))}%"></span></div><p>${esc(label)}</p></div>`;
  }

  function _renderDueRow(item, key) {
    const p = item.practice;
    const cat = _category(p.category);
    const time = _timeText(p);
    const sub = _timeSub(p);
    const isTracker = p.schedule?.type === 'interval';
    const statusClass = item.status === 'overdue' ? 'is-overdue' : (item.status === 'approaching' ? 'is-approaching' : '');
    return `<article class="practice-entry ${statusClass}" data-practice-id="${esc(p.id)}">
      <div class="practice-entry-time"><strong>${esc(time)}</strong><span>${esc(sub)}</span></div>
      <div class="practice-entry-spine" aria-hidden="true"></div>
      <div class="practice-entry-copy">
        <div class="practice-entry-kicker"><span>${esc(cat.label)}</span>${_statusChip(p)}</div>
        <h3 class="practice-entry-title"><span class="practice-ar" lang="ar" dir="rtl">${esc(p.titleAr || '')}</span><span class="practice-en">${esc(p.title)}</span></h3>
        <p class="practice-entry-summary">${esc(p.summary || '')}</p>
        ${isTracker ? _renderTrackerLine(item.tracker) : ''}
        <div class="practice-entry-meta"><span>${esc(_scheduleText(p))}</span><span class="practice-meta-sep">Â·</span>${_sourceLink(p)}</div>
      </div>
      <div class="practice-entry-actions">
        <button class="practice-done-btn" onclick="practiceDone('${esc(p.id)}')" aria-label="Mark ${esc(p.title)} done for today">${icon('check', 12)} Mark done</button>
        <button class="practice-text-btn" onclick="openPracticeDetail('${esc(p.id)}')">Details</button>
      </div>
    </article>`;
  }

  function _renderFinishedRow(row) {
    const p = row.practice;
    const done = row.entry.status === 'done';
    return `<article class="practice-finished ${done ? 'is-done' : 'is-set-aside'}">
      <span class="practice-finished-mark" aria-hidden="true">${done ? icon('check', 14) : ''}</span>
      <div class="practice-finished-copy">
        <strong>${esc(p.title)}</strong>
        <span>${done ? 'Completed today' : 'Set aside for today Â· no failure implied'}</span>
      </div>
      <button class="practice-text-btn" onclick="practiceUndo('${esc(p.id)}')">Undo</button>
    </article>`;
  }

  function _renderNext(snap) {
    if (!snap.next.length) {
      return `<p class="practice-rail-empty">No dated practices ahead. Daily anchors continue on their own.</p>`;
    }
    return `<ul class="practice-next-list">${snap.next.map(item => `<li>
      <span class="practice-next-date">${esc(_fmtDate(item.key))}</span>
      <span class="practice-next-title">${esc(item.practice.title)}</span>
    </li>`).join('')}</ul>`;
  }

  function _renderTrackers(snap) {
    const trackers = snap.trackers.filter(t => t.practice.enabled);
    if (!trackers.length) {
      return `<p class="practice-rail-empty">No time limits are being tracked. <button class="practice-text-btn" onclick="showPracticeAll()">Set one up</button></p>`;
    }
    return `<div class="practice-tracker-list">${trackers.map(t => {
      const p = t.practice;
      const state = t.state;
      const pct = state === 'setup' ? 0 : Math.min(100, Math.round((t.elapsed / t.every) * 100));
      const label = state === 'setup'
        ? 'Waiting for a starting date'
        : `Day ${t.elapsed} of ${t.every}`;
      const sub = state === 'setup'
        ? 'No history has been assumed.'
        : state === 'overdue'
          ? `${Math.abs(t.daysLeft)} ${Math.abs(t.daysLeft) === 1 ? 'day' : 'days'} beyond your chosen limit`
          : state === 'due'
            ? 'At your chosen limit'
            : `${t.daysLeft} ${t.daysLeft === 1 ? 'day' : 'days'} remaining`;
      return `<button class="practice-tracker-mini practice-tracker-mini--${state}" onclick="openPracticeDetail('${esc(p.id)}')">
        <span class="practice-tracker-mini-top"><span>${esc(p.title)}</span><span>${esc(label)}</span></span>
        <span class="practice-meter practice-meter--${state}"><span style="width:${pct}%"></span></span>
        <span class="practice-tracker-mini-sub">${esc(sub)}</span>
      </button>`;
    }).join('')}</div>`;
  }

  function _renderWelcome() {
    const choices = PRACTICE_STARTER_IDS.map(id => _get(id)).filter(Boolean);
    return `<section class="practice-welcome">
      <div class="practice-welcome-copy">
        <span class="practice-eyebrow">A quiet beginning</span>
        <h2>Choose a few anchors, not a checklist.</h2>
        <p>Nothing is switched on by default. Start with what you already intend to keep, and leave the rest for another season.</p>
      </div>
      <div class="practice-welcome-choices">
        ${choices.map(p => `<button class="practice-welcome-choice" onclick="practiceWelcomeAdd('${esc(p.id)}')">
          <span class="practice-welcome-text"><strong>${esc(p.title)}</strong><span>${esc(_scheduleText(p))}</span></span>
          <span class="practice-welcome-add">${icon('plus', 14)} Add</span>
        </button>`).join('')}
      </div>
      <div class="practice-welcome-actions">
        <button class="practice-primary" onclick="practiceAddStarterSet()">Add these five</button>
        <button class="practice-text-btn" onclick="showPracticeAll()">Browse all practices</button>
        <button class="practice-text-btn" onclick="practiceDismissSetup()">Not now</button>
      </div>
    </section>`;
  }

  function _renderToday(snap) {
    if (!snap.enabled.length) {
      if (!runtime.data.dismissedSetup) return _renderWelcome();
      return `<section class="practice-empty">
        <span class="practice-eyebrow">Your daybook is quiet</span>
        <h2>No practices are being tracked yet.</h2>
        <p>Choose only what is useful to you. You can add or pause anything at any time.</p>
        <div class="practice-empty-actions"><button class="practice-primary" onclick="showPracticeAll()">Choose practices</button><button class="practice-text-btn" onclick="openPracticeForm()">Create a personal reminder</button></div>
      </section>`;
    }

    const dueHtml = snap.due.length
      ? snap.due.map(item => _renderDueRow(item, snap.key)).join('')
      : `<div class="practice-quiet"><span class="practice-quiet-mark">${icon('check', 16)}</span><p><strong>Nothing else is due today.</strong><span>What is done is enough. You can look ahead without turning the day into a score.</span></p></div>`;

    const completed = snap.completed.length
      ? `<section class="practice-finished-block"><h3 class="practice-subhead">Completed today</h3>${snap.completed.map(_renderFinishedRow).join('')}</section>`
      : '';
    const skipped = snap.skipped.length
      ? `<section class="practice-finished-block"><h3 class="practice-subhead">Set aside</h3>${snap.skipped.map(_renderFinishedRow).join('')}</section>`
      : '';
    const snoozed = snap.snoozed.length
      ? `<section class="practice-finished-block"><h3 class="practice-subhead">Returning later</h3>${snap.snoozed.map(row => `<div class="practice-finished is-snoozed"><span class="practice-finished-mark">${icon('clock', 14)}</span><div class="practice-finished-copy"><strong>${esc(row.practice.title)}</strong><span>Returning ${esc(_fmtDate(row.until))}</span></div><button class="practice-text-btn" onclick="practiceSnoozeUndo('${esc(row.practice.id)}')">Return now</button></div>`).join('')}</section>`
      : '';

    return `<div class="practice-today-layout">
      <div class="practice-main-column">
        <div class="practice-day-heading">
          <div><h2>Due today</h2></div>
          <p>${snap.due.length} waiting Â· ${snap.completed.length} complete${snap.skipped.length ? ` Â· ${snap.skipped.length} set aside` : ''}</p>
        </div>
        <div class="practice-agenda">${dueHtml}</div>
        ${completed}${skipped}${snoozed}
        <div class="practice-day-foot"><span>${icon('lock', 13)} Practice history stays in this browser.</span><button class="practice-text-btn" onclick="showPracticeAll()">Manage practices</button></div>
      </div>
      <aside class="practice-rail" aria-label="Practice overview">
        <section class="practice-rail-block">
          <div class="practice-rail-head"><span class="practice-eyebrow">Next</span><button class="practice-text-btn" onclick="showPracticeUpcoming()">All upcoming</button></div>
          ${_renderNext(snap)}
        </section>
        <section class="practice-rail-block">
          <div class="practice-rail-head"><span class="practice-eyebrow">Time limits</span><button class="practice-text-btn" onclick="showPracticeTab('all')">All practices</button></div>
          ${_renderTrackers(snap)}
          <p class="practice-rail-note">A tracker records your own date. It never assumes a completion or turns a scholarly limit into an obligation.</p>
        </section>
        <section class="practice-rail-block practice-rail-block--quiet">
          <span class="practice-eyebrow">Reminders</span>
          <p>Reminders are checked while Sahib is open. Background delivery depends on your browser, installed-app state and notification permission.</p>
          <button class="practice-text-btn" onclick="openPracticeReminders()">Open reminder centre</button>
        </section>
      </aside>
    </div>`;
  }

  function _renderUpcoming() {
    const groups = getUpcomingGroups(14, false);
    const intro = `<div class="practice-view-intro"><div><span class="practice-eyebrow">The next fourteen days</span><h2>What is coming</h2></div><p>Weekly, lunar and seasonal practices appear here. Daily anchors stay on Today.</p></div>`;
    if (!groups.length) {
      return `${intro}<div class="practice-empty practice-empty--bordered"><span class="practice-eyebrow">A clear fortnight</span><h2>No dated practices ahead.</h2><p>You can add a Friday routine, a lunar fast, or a one-off personal reminder.</p><button class="practice-primary" onclick="openPracticeForm()">Add a practice</button></div>`;
    }
    const html = groups.map(group => {
      const hijri = _hijri(group.date);
      return `<section class="practice-upcoming-group">
        <div class="practice-upcoming-date"><span class="practice-upcoming-day">${group.date.getDate()}</span><span class="practice-upcoming-month">${group.date.toLocaleDateString('en-GB', { month: 'short' })} Â· ${esc(WEEKDAYS_SHORT[group.date.getDay()])}</span>${hijri ? `<span class="practice-upcoming-hijri">${hijri.day} ${esc(hijri.monthNameAr || '')}</span>` : ''}</div>
        <div class="practice-upcoming-items">${group.items.map(item => `<button class="practice-upcoming-item" onclick="openPracticeDetail('${esc(item.practice.id)}')">
          <span class="practice-upcoming-copy"><strong>${esc(item.practice.title)}</strong><span>${esc(_scheduleText(item.practice))}</span></span>
          <span class="practice-upcoming-time">${esc(_timeText(item.practice, group.date))}${item.practice.relativeTo ? `<small>${esc(_timeSub(item.practice))}</small>` : ''}</span>
        </button>`).join('')}</div>
      </section>`;
    }).join('');
    return `${intro}<div class="practice-upcoming-list">${html}</div>`;
  }

  function _calendarItems(date) {
    const key = _dateKey(date);
    return getDayAgenda(key).filter(item => {
      if (item.practice.schedule?.type === 'daily') return false;
      if (item.practice.schedule?.type === 'interval') {
        const tracker = _trackerInfo(item.practice, date);
        return !!tracker?.dueDate && _dateKey(tracker.dueDate) === key;
      }
      return true;
    });
  }

  function _renderCalendar() {
    const cursor = runtime.calendarCursor || new Date(new Date().getFullYear(), new Date().getMonth(), 1);
    const year = cursor.getFullYear();
    const month = cursor.getMonth();
    const first = new Date(year, month, 1, 12);
    const start = _addDays(first, -first.getDay());
    const selectedKey = runtime.calendarSelected || _dateKey();
    const selectedDate = _parseKey(selectedKey) || new Date();
    const monthLabel = first.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
    const firstHijri = _hijri(first);
    const lastHijri = _hijri(new Date(year, month + 1, 0, 12));
    const hijriMonthLabel = firstHijri && lastHijri
      ? (Number(firstHijri.month) === Number(lastHijri.month)
          ? firstHijri.monthNameAr
          : `${firstHijri.monthNameAr} â€“ ${lastHijri.monthNameAr}`)
      : '';
    const cells = [];
    for (let i = 0; i < 42; i++) {
      const date = _addDays(start, i);
      const key = _dateKey(date);
      const inMonth = date.getMonth() === month;
      const items = _calendarItems(date);
      const isToday = key === _dateKey();
      const isSelected = key === selectedKey;
      const hijri = _hijri(date);
      cells.push(`<button class="practice-cal-cell ${inMonth ? '' : 'is-other-month'} ${isToday ? 'is-today' : ''} ${isSelected ? 'is-selected' : ''} ${items.length ? 'has-due' : ''}" onclick="practiceSelectDate('${key}')" aria-pressed="${isSelected ? 'true' : 'false'}" aria-label="${esc(date.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' }))}${items.length ? `, ${items.length} practices` : ''}">
        <span class="practice-cal-greg">${date.getDate()}</span>
        ${hijri ? `<span class="practice-cal-hijri">${hijri.day}</span>` : ''}
        ${items.length ? `<span class="practice-cal-dots">${items.slice(0, 3).map(item => `<i class="${item.entry?.status === 'done' ? 'is-done' : ''}"></i>`).join('')}</span>` : ''}
      </button>`);
    }
    const dayItems = _calendarItems(selectedDate);
    const isFuture = selectedKey > _dateKey();
    const dayAgenda = dayItems.length ? dayItems.map(item => {
      const p = item.practice;
      const done = item.entry?.status === 'done';
      const skipped = item.entry?.status === 'skipped';
      return `<div class="practice-cal-agenda-row ${done ? 'is-done' : ''}">
        <div class="practice-cal-agenda-copy"><span class="practice-eyebrow">${esc(_scheduleText(p))}</span><strong>${esc(p.title)}</strong><span>${esc(p.titleAr || '')}</span></div>
        <div class="practice-cal-agenda-actions">
          ${done ? `<span class="practice-cal-state">${icon('check', 13)} Done</span>` : skipped ? `<span class="practice-cal-state">Set aside</span>` : isFuture ? `<span class="practice-cal-state">Ahead</span>` : `<button class="practice-done-btn practice-done-btn--small" onclick="practiceDoneOn('${esc(p.id)}','${selectedKey}')" aria-label="Mark ${esc(p.title)} done on ${esc(_fmtDate(selectedKey))}">${icon('check', 11)} Mark done</button>`}
          <button class="practice-text-btn" onclick="openPracticeDetail('${esc(p.id)}')">Details</button>
        </div>
      </div>`;
    }).join('') : `<p class="practice-rail-empty">No dated practices for this day. Daily anchors continue on Today.</p>`;
    return `<div class="practice-view-intro"><div><span class="practice-eyebrow">Lunar and weekly rhythm</span><h2>Calendar</h2></div><p>Hijri dates follow the browserâ€™s Umm al-Qura conversion. Local moon-sighting may differ by a day.</p></div>
      <div class="practice-calendar-layout">
        <section class="practice-calendar-panel" aria-label="Practice calendar">
          <div class="practice-calendar-head">
            <button class="practice-cal-nav" onclick="practiceCalendarPrev()" aria-label="Previous month">${icon('chevron-right', 17)}</button>
            <div><strong>${esc(monthLabel)}</strong><span>${esc(hijriMonthLabel)}</span></div>
            <button class="practice-cal-nav" onclick="practiceCalendarNext()" aria-label="Next month">${icon('chevron-left', 17)}</button>
          </div>
          <div class="practice-cal-weekdays" dir="ltr">${['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map(d => `<span>${d}</span>`).join('')}</div>
          <div class="practice-cal-grid" dir="ltr">${cells.join('')}</div>
          <div class="practice-cal-legend"><span><i class="practice-cal-legend-dot"></i> Scheduled</span><span><i class="practice-cal-legend-dot is-done"></i> Completed</span><span>Daily anchors are on Today</span></div>
        </section>
        <aside class="practice-calendar-day">
          <div class="practice-calendar-day-head"><span class="practice-eyebrow">${esc(_fmtDate(selectedKey))}</span><h3>${esc(_hijriLine(selectedDate))}</h3></div>
          <div class="practice-cal-agenda">${dayAgenda}</div>
          <button class="practice-text-btn" onclick="practiceCalendarToday()">Return to today</button>
        </aside>
      </div>`;
  }

  function _renderAll() {
    const all = _allPractices();
    const categories = PRACTICE_CATEGORIES.map(cat => ({ cat, items: all.filter(p => p.category === cat.id) })).filter(group => group.items.length);
    const groups = categories.map(group => `<section class="practice-catalog-group" id="practice-cat-${esc(group.cat.id)}">
      <div class="practice-catalog-head"><div><span class="practice-eyebrow">${esc(group.cat.labelAr)}</span><h3>${esc(group.cat.label)}</h3><p>${esc(group.cat.blurb)}</p></div><span class="practice-catalog-count">${group.items.filter(p => p.enabled).length} active</span></div>
      <div class="practice-catalog-rows">${group.items.map(p => `<div class="practice-catalog-row ${p.enabled ? 'is-active' : ''}">
        <button class="practice-switch ${p.enabled ? 'is-on' : ''}" role="switch" aria-checked="${p.enabled ? 'true' : 'false'}" aria-label="${p.enabled ? 'Pause' : 'Track'} ${esc(p.title)}" onclick="practiceToggle('${esc(p.id)}')"><span></span></button>
        <div class="practice-catalog-copy">
          <div class="practice-catalog-title"><strong>${esc(p.title)}</strong><span lang="ar" dir="rtl">${esc(p.titleAr || '')}</span>${_statusChip(p)}</div>
          <p>${esc(p.summary || '')}</p>
          <div class="practice-entry-meta"><span>${esc(_scheduleText(p))}</span><span class="practice-meta-sep">Â·</span><span>${esc(_timeText(p))}</span>${p.schedule?.type === 'manual' ? '<span class="practice-meta-sep">Â·</span><span>Set a date in details</span>' : ''}</div>
        </div>
        <button class="practice-text-btn practice-details-btn" onclick="openPracticeDetail('${esc(p.id)}')">Details ${icon('arrow-left', 13)}</button>
      </div>`).join('')}</div>
    </section>`).join('');
    const activeCount = all.filter(p => p.enabled).length;
    const index = categories.map((group, i) => `<a class="practice-catalog-index-link" href="#practice-cat-${esc(group.cat.id)}">
      <span class="practice-catalog-index-num">${String(i + 1).padStart(2, '0')}</span>
      <span><strong>${esc(group.cat.label)}</strong><span>${group.items.filter(p => p.enabled).length} active</span></span>
    </a>`).join('');
    return `<div class="practice-view-intro practice-view-intro--actions"><div><span class="practice-eyebrow">The whole rule of life</span><h2>All practices</h2><p>Everything is opt-in. Pause a practice without deleting its history.</p></div><div class="practice-intro-actions"><button class="practice-primary" onclick="openPracticeForm()">Add a practice</button><button class="practice-text-btn" onclick="openPracticeSettings()">Practice settings</button></div></div>
      <div class="practice-catalog-layout">
        <div class="practice-catalog-main">
          <div class="practice-catalog">${groups}</div>
          <div class="practice-catalog-foot"><p>Sources are shown for every built-in practice. Personal notes stay separate from the sourced text.</p><span>Backups and reminders live in Practice settings.</span></div>
        </div>
        <aside class="practice-catalog-index" aria-label="Practice categories">
          <div class="practice-catalog-index-head"><span class="practice-eyebrow">Contents</span><span>${all.length} practices Â· ${activeCount} active</span></div>
          <nav>${index}</nav>
          <p>Everything is opt-in. Turning a practice off keeps its history.</p>
        </aside>
      </div>`;
  }

  function renderPracticeView() {
    const host = $('practice-body');
    if (!host) return;
    if (!runtime.ready) {
      host.innerHTML = '<div class="practice-loading">Opening your daybookâ€¦</div>';
      init().then(renderPracticeView);
      return;
    }
    const snap = getTodaySnapshot();
    const tab = runtime.tab || 'today';
    let content = '';
    if (tab === 'upcoming') content = _renderUpcoming();
    else if (tab === 'calendar') content = _renderCalendar();
    else if (tab === 'all') content = _renderAll();
    else content = _renderToday(snap);
    const late = snap.due.filter(item => item.dueMinutes != null && item.dueMinutes < _parseClock(new Date().toTimeString().slice(0, 5))).length;
    host.innerHTML = `<div class="practice-page">
      <div class="practice-head">
        <div class="practice-head-copy">
          <span class="practice-eyebrow">Sahib Â· daily practice Â· ÙˆÙØ±Ø¯</span>
          <h1>Your daybook</h1>
          <p>A quiet record of what you chose to keep. Nothing is switched on for you.</p>
        </div>
        <div class="practice-head-side">
          <div class="practice-head-date"><strong>${esc(_fmtLong(new Date()))}</strong><span>${esc(_hijriLine(new Date()))}</span></div>
          <div class="practice-head-actions">
            <button class="practice-icon-btn" onclick="openPracticeReminders()" aria-label="Open reminder centre${snap.due.length ? `, ${snap.due.length} waiting` : ''}">${icon('bell', 18)}${snap.due.length ? `<span class="practice-bell-count" aria-hidden="true">${snap.due.length}</span>` : ''}</button>
            <button class="practice-primary practice-primary--small" onclick="openPracticeForm()">${icon('plus', 14)} Add practice</button>
            <button class="practice-icon-btn" onclick="openPracticeSettings()" aria-label="Practice settings">${icon('settings', 18)}</button>
          </div>
        </div>
      </div>
      <nav class="practice-tabs" role="tablist" aria-label="Daily practice views">
        ${[['today','Today'],['upcoming','Upcoming'],['calendar','Calendar'],['all','All practices']].map(([id,label]) => `<button role="tab" id="practice-tab-${id}" aria-controls="practice-tab-panel" aria-selected="${tab === id}" class="practice-tab ${tab === id ? 'is-active' : ''}" onclick="showPracticeTab('${id}')">${label}</button>`).join('')}
      </nav>
      <div class="practice-tab-panel" id="practice-tab-panel" role="tabpanel" aria-labelledby="practice-tab-${tab}">${content}</div>
    </div>`;
    if (late && tab === 'today') {
      const bell = host.querySelector('.practice-bell-count');
      if (bell) bell.setAttribute('title', `${late} reminder${late === 1 ? '' : 's'} passed while the app was closed or idle`);
    }
  }

  function _overlay(id, html) {
    const old = document.getElementById(id);
    if (old) old.remove();
    const returnFocus = document.activeElement && document.activeElement !== document.body ? document.activeElement : null;
    const wrap = document.createElement('div');
    wrap.className = 'ov center practice-overlay';
    wrap.id = id;
    wrap.setAttribute('aria-hidden', 'false');
    wrap.innerHTML = html;
    wrap._returnFocus = returnFocus;
    wrap.addEventListener('click', event => { if (event.target === wrap) closePracticeOverlay(id); });
    wrap.addEventListener('keydown', event => {
      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopPropagation();
        closePracticeOverlay(id);
        return;
      }
      if (event.key !== 'Tab') return;
      const focusables = [...wrap.querySelectorAll('button:not([disabled]), [href], input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])')]
        .filter(el => el.getClientRects().length > 0);
      if (!focusables.length) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      } else if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!wrap.contains(document.activeElement)) {
        event.preventDefault();
        first.focus();
      }
    });
    document.body.appendChild(wrap);
    requestAnimationFrame(() => wrap.classList.add('open'));
    lockBody();
    const focusTarget = wrap.querySelector('[data-autofocus]') || wrap.querySelector('button, input, select, textarea');
    if (focusTarget) setTimeout(() => focusTarget.focus(), 30);
    return wrap;
  }

  function closePracticeOverlay(id) {
    const wrap = document.getElementById(id);
    if (!wrap) return;
    const returnFocus = wrap._returnFocus;
    wrap.classList.remove('open');
    setTimeout(() => {
      wrap.remove();
      if (!document.querySelector('.ov.open') && returnFocus && returnFocus.isConnected) returnFocus.focus();
    }, 170);
    if (!document.querySelector('.ov.open')) unlockBody();
    if (id === 'ov-practice-detail') runtime.detailId = null;
    if (id === 'ov-practice-form') runtime.editingId = null;
  }

  function closePracticeDetail() { closePracticeOverlay('ov-practice-detail'); }
  function closePracticeForm() { closePracticeOverlay('ov-practice-form'); }
  function closePracticeSettings() { closePracticeOverlay('ov-practice-settings'); }
  function closePracticeReminders() { closePracticeOverlay('ov-practice-reminders'); }

  function _nextDatesText(practice) {
    const next = _nextOccurrences(practice, 3);
    if (!next.length) return practice.schedule?.type === 'manual' ? 'No date has been chosen yet.' : 'No upcoming dates in the next year.';
    return next.map(d => d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })).join(' Â· ');
  }

  function _renderDetail() {
    const p = _get(runtime.detailId);
    if (!p) return '';
    const tracker = p.schedule?.type === 'interval' ? _trackerInfo(p) : null;
    const history = (runtime.data.entries || [])
      .filter(e => e.practiceId === p.id)
      .sort((a, b) => (b.at || 0) - (a.at || 0))
      .slice(0, 7);
    const doneToday = _entryFor(p.id, _dateKey())?.status === 'done';
    const sourceNote = p.sourceNote || '';
    const personalNote = p.personalNote || '';
    return `<div class="modal-box practice-detail-modal" role="dialog" aria-modal="true" aria-labelledby="practice-detail-title">
      <div class="mh practice-modal-head">
        <div><span class="practice-eyebrow">${esc(_category(p.category).label)}</span><h2 id="practice-detail-title">${esc(p.title)}</h2></div>
        <button class="btn-close" data-autofocus onclick="closePracticeDetail()" aria-label="Close practice details">${icon('x', 20)}</button>
      </div>
      <div class="practice-detail-body">
        <div class="practice-detail-lead"><h3 lang="ar" dir="rtl">${esc(p.titleAr || '')}</h3><p>${esc(p.summary || '')}</p><div class="practice-detail-chips">${_statusChip(p)}${p.enabled ? _renderChip('In your daybook') : _renderChip('Not tracked')}</div></div>
        <div class="practice-detail-grid">
          <div>
            <h4 class="practice-subhead">Schedule</h4>
            <p class="practice-detail-strong">${esc(_scheduleText(p))}</p>
            <p class="practice-detail-muted">${esc(_timeText(p))} Â· ${esc(p.advanceMinutes ? `${p.advanceMinutes} min advance notice` : 'No advance notice')}</p>
            <p class="practice-detail-muted">Next dates: ${esc(_nextDatesText(p))}</p>
            ${tracker ? `<div class="practice-detail-tracker">${_trackerDetail(tracker)}<div class="practice-last-done"><label for="practice-last-done">Last completed</label><input type="date" id="practice-last-done" max="${_dateKey()}" value="${esc(runtime.data.lastDone[p.id] || '')}"><button class="practice-secondary" onclick="practiceSaveLastDone('${esc(p.id)}')">Save date</button></div><p class="practice-detail-muted">Leave the field blank if you do not know. Sahib will not guess or invent a history.</p></div>` : ''}
          </div>
          <div>
            <h4 class="practice-subhead">Source & notes</h4>
            <div class="practice-detail-source">${_sourceLink(p)}${sourceNote ? `<p>${esc(sourceNote)}</p>` : ''}</div>
            ${personalNote ? `<div class="practice-personal-note"><span>Your note</span><p>${esc(personalNote)}</p></div>` : ''}
            <button class="practice-text-btn" onclick="practiceEdit('${esc(p.id)}')">Edit reminder & schedule</button>
          </div>
        </div>
        <div class="practice-detail-history"><h4 class="practice-subhead">Recent history</h4>${history.length ? `<ul>${history.map(e => `<li><span>${esc(_fmtDate(e.date))}</span><span>${e.status === 'done' ? 'Completed' : 'Set aside'}${e.source === 'backfill' ? ' Â· recorded by you' : ''}</span></li>`).join('')}</ul>` : `<p class="practice-detail-muted">No history yet. Nothing has been assumed.</p>`}</div>
        <div class="practice-detail-actions">
          ${p.link ? `<button class="practice-secondary" onclick="practiceOpenLink('${esc(p.id)}')">${esc(p.link.label)}</button>` : ''}
          ${p.enabled ? `${doneToday ? `<button class="practice-secondary" onclick="practiceUndo('${esc(p.id)}')">Undo todayâ€™s completion</button>` : `<button class="practice-primary" onclick="practiceDone('${esc(p.id)}')">Mark done today</button>`}<button class="practice-secondary" onclick="practiceSnooze('${esc(p.id)}',1)">Snooze 1 day</button><button class="practice-secondary" onclick="practiceSkip('${esc(p.id)}')">Set aside today</button>` : `<button class="practice-primary" onclick="practiceToggle('${esc(p.id)}')">Add to my daybook</button>`}
          ${p.builtIn ? '' : `<button class="practice-danger-text" onclick="practiceDelete('${esc(p.id)}')">Delete personal practice</button>`}
        </div>
        <p class="practice-detail-foot">${p.schedule?.type === 'interval' ? 'A time limit is sourced guidance and a personal reminder, not a ruling about your worship.' : 'Sahib does not record this as an obligation. Your history is stored only in this browser.'}</p>
      </div>
    </div>`;
  }

  function _trackerDetail(tracker) {
    if (tracker.state === 'setup') {
      return `<div class="practice-detail-tracker-box"><span class="practice-detail-tracker-number">â€”</span><p>No starting date set</p><div class="practice-meter practice-meter--setup"><span style="width:0%"></span></div></div>`;
    }
    const pct = Math.min(100, Math.round((tracker.elapsed / tracker.every) * 100));
    return `<div class="practice-detail-tracker-box">
      <div class="practice-detail-tracker-title"><strong>Day ${tracker.elapsed}</strong><span>of ${tracker.every}</span></div>
      <div class="practice-meter practice-meter--${tracker.state}"><span style="width:${pct}%"></span></div>
      <p>${tracker.state === 'overdue' ? `${Math.abs(tracker.daysLeft)} ${Math.abs(tracker.daysLeft) === 1 ? 'day' : 'days'} beyond your chosen limit` : tracker.daysLeft === 0 ? 'At your chosen limit' : `${tracker.daysLeft} ${tracker.daysLeft === 1 ? 'day' : 'days'} remaining`}</p>
      <p class="practice-detail-muted">Last completed ${esc(_fmtDate(tracker.last))} Â· chosen rhythm every ${tracker.every} days</p>
    </div>`;
  }

  function openPracticeDetail(id) {
    if (!runtime.ready) return;
    const p = _get(id);
    if (!p) return;
    runtime.detailId = id;
    const wrap = _overlay('ov-practice-detail', _renderDetail());
    const enableFocus = wrap.querySelector('[data-autofocus]');
    if (enableFocus) enableFocus.focus();
  }

  function _renderForm() {
    const p = runtime.editingId ? _get(runtime.editingId) : null;
    const isEdit = !!p;
    const builtIn = isEdit && p.builtIn;
    const schedule = p?.schedule || { type: 'daily', days: [5] };
    const relative = p?.relativeTo || '';
    const offset = p?.offsetMinutes ?? 0;
    const clock = p?.reminderTime || '09:00';
    const title = p?.title || '';
    const titleAr = p?.titleAr || '';
    const category = p?.category || 'personal';
    const note = p?.personalNote || '';
    const source = isEdit ? (p.source || '') : '';
    const sourceNote = isEdit ? (p.sourceNote || '') : '';
    const days = Array.isArray(schedule.days) ? schedule.days : [];
    const scheduleType = schedule.type || 'daily';
    return `<div class="modal-box practice-form-modal" role="dialog" aria-modal="true" aria-labelledby="practice-form-title">
      <div class="mh practice-modal-head">
        <div><span class="practice-eyebrow">${isEdit ? 'Adjust a practice' : 'A personal reminder'}</span><h2 id="practice-form-title">${isEdit ? esc(p.title) : 'Add a practice'}</h2></div>
        <button class="btn-close" data-autofocus onclick="closePracticeForm()" aria-label="Close form">${icon('x', 20)}</button>
      </div>
      <form class="practice-form" onsubmit="event.preventDefault();practiceSaveForm();">
        ${builtIn ? `<p class="practice-form-note">This is a built-in practice. Its title and sourced text are fixed; your schedule, reminder and personal note are yours to adjust.</p>` : ''}
        ${!builtIn ? `<div class="practice-form-section">
          <h3 class="practice-form-section-title">What it is</h3>
          <div class="practice-form-grid">
            <label class="practice-field"><span>Title</span><input id="pf-title" dir="auto" required maxlength="80" value="${esc(title)}" placeholder="Read a page of Qurâ€™an"></label>
            <label class="practice-field"><span>Arabic title <small>optional</small></span><input id="pf-title-ar" dir="rtl" lang="ar" maxlength="80" value="${esc(titleAr)}" placeholder="ÙˆØ±Ø¯ Ø´Ø®ØµÙŠ"></label>
            <label class="practice-field"><span>Category</span><select id="pf-category">${PRACTICE_CATEGORIES.map(c => `<option value="${c.id}" ${c.id === category ? 'selected' : ''}>${esc(c.label)}</option>`).join('')}</select></label>
          </div>
        </div>` : ''}
        <div class="practice-form-section">
          <h3 class="practice-form-section-title">When it returns</h3>
          <div class="practice-form-grid practice-form-grid--rhythm">
            <label class="practice-field"><span>Rhythm</span><select id="pf-schedule" onchange="practiceFormScheduleChanged(this.value)">${[['daily','Every day'],['weekly','Weekly'],['gregorian-monthly','Monthly Â· Gregorian day'],['hijri-monthly','Monthly Â· Hijri day'],['hijri-yearly','Yearly Â· Hijri date'],['hijri-range','Hijri season'],['interval','Every N days'],['once','One date'],['manual','No date yet']].map(([value,label]) => `<option value="${value}" ${scheduleType === value ? 'selected' : ''}>${label}</option>`).join('')}</select></label>
          </div>
          <div class="practice-form-schedule">
            <div class="practice-sched-row" data-sched="weekly"><span>Days</span><div class="practice-weekday-checks">${WEEKDAYS_SHORT.map((day, i) => `<label><input type="checkbox" name="pf-weekday" value="${i}" ${days.map(Number).includes(i) ? 'checked' : ''}><span>${day}</span></label>`).join('')}</div></div>
            <label class="practice-field practice-sched-row" data-sched="gregorian-monthly"><span>Day of month</span><input id="pf-greg-day" type="number" min="1" max="31" value="${schedule.day || 1}"></label>
            <label class="practice-field practice-sched-row" data-sched="hijri-monthly"><span>Hijri days <small>comma separated</small></span><input id="pf-hijri-days" value="${esc((schedule.days || []).join(','))}" placeholder="13,14,15"></label>
            <div class="practice-sched-row" data-sched="hijri-yearly"><label class="practice-field"><span>Hijri month</span><select id="pf-hijri-month">${HIJRI_MONTHS_EN.map((m, i) => `<option value="${i + 1}" ${Number(schedule.month) === i + 1 ? 'selected' : ''}>${m}</option>`).join('')}</select></label><label class="practice-field"><span>Days</span><input id="pf-hijri-year-days" value="${esc((schedule.days || []).join(','))}" placeholder="9"></label></div>
            <div class="practice-sched-row" data-sched="hijri-range"><label class="practice-field"><span>Hijri month</span><select id="pf-range-month">${HIJRI_MONTHS_EN.map((m, i) => `<option value="${i + 1}" ${Number(schedule.month) === i + 1 ? 'selected' : ''}>${m}</option>`).join('')}</select></label><label class="practice-field"><span>Start day</span><input id="pf-range-start" type="number" min="1" max="30" value="${schedule.start || 1}"></label><label class="practice-field"><span>End day</span><input id="pf-range-end" type="number" min="1" max="30" value="${schedule.end || 10}"></label></div>
            <div class="practice-sched-row" data-sched="interval">
              <label class="practice-field"><span>Every <small>days</small></span><input id="pf-interval" type="number" min="1" max="365" value="${schedule.everyDays || 40}"></label>
              <label class="practice-field" data-field="warning"><span>Gentle warning <small>days before your chosen limit</small></span><input id="pf-warning" type="number" min="0" max="30" value="${Number(p?.warningDays ?? 7)}"></label>
            </div>
            <label class="practice-field practice-sched-row" data-sched="once"><span>Date</span><input id="pf-once" type="date" value="${esc(schedule.date || '')}"></label>
          </div>
        </div>
        <div class="practice-form-section" data-section="reminder">
          <h3 class="practice-form-section-title">Reminder</h3>
          <div class="practice-form-grid practice-form-grid--reminder">
            <label class="practice-field" data-field="reminder"><span>Anchor</span><select id="pf-relative" onchange="practiceFormScheduleChanged(document.getElementById('pf-schedule').value)"><option value="" ${!relative ? 'selected' : ''}>Clock time</option>${['Fajr','Sunrise','Dhuhr','Asr','Maghrib','Isha'].map(name => `<option value="${name}" ${relative === name ? 'selected' : ''}>${name} offset</option>`).join('')}</select></label>
            <label class="practice-field" data-field="clock"><span>Clock time</span><input id="pf-time" type="time" value="${esc(clock)}"></label>
            <label class="practice-field" data-field="offset"><span>Prayer offset <small>minutes; negative = before</small></span><input id="pf-offset" type="number" min="-240" max="240" value="${Number(offset) || 0}"></label>
            <label class="practice-field" data-field="advance"><span>Advance notice <small>minutes</small></span><input id="pf-advance" type="number" min="0" max="240" value="${Number(p?.advanceMinutes) || 0}"></label>
          </div>
        </div>
        <div class="practice-form-section">
          <h3 class="practice-form-section-title">Source &amp; note</h3>
          ${builtIn ? `<div class="practice-form-source"><span class="practice-eyebrow">Sourced reference</span><p>${esc(p.source || '')}</p><p class="practice-detail-muted">${esc(sourceNote)}</p></div>` : `<label class="practice-field practice-field--wide"><span>Source or note <small>optional</small></span><input id="pf-source" dir="auto" value="${esc(source)}" placeholder="Personal routine, or a source reference"></label>`}
          <label class="practice-field practice-field--wide"><span>Your note <small>optional, private</small></span><textarea id="pf-note" dir="auto" rows="3" maxlength="500" placeholder="What would make this realistic?">${esc(note)}</textarea></label>
        </div>
        <div class="practice-form-actions"><button type="button" class="practice-text-btn" onclick="closePracticeForm()">Cancel</button><button type="submit" class="practice-primary">${isEdit ? 'Save changes' : 'Add to my daybook'}</button></div>
      </form>
    </div>`;
  }

  function _syncFormFields(type) {
    const relative = document.getElementById('pf-relative')?.value || '';
    const timed = type !== 'interval' && type !== 'manual';
    const fields = {
      reminder: timed,
      clock: timed && !relative,
      offset: timed && !!relative,
      advance: timed,
      warning: type === 'interval'
    };
    Object.entries(fields).forEach(([name, shown]) => {
      document.querySelectorAll(`#ov-practice-form [data-field="${name}"]`).forEach(field => {
        field.style.display = shown ? '' : 'none';
      });
    });
    const reminderSection = document.querySelector('#ov-practice-form [data-section="reminder"]');
    if (reminderSection) reminderSection.style.display = timed ? '' : 'none';
  }

  function _syncScheduleRows(type) {
    document.querySelectorAll('#ov-practice-form [data-sched]').forEach(row => {
      row.style.display = row.dataset.sched === type ? '' : 'none';
    });
    const schedule = document.querySelector('#ov-practice-form .practice-form-schedule');
    if (schedule) schedule.style.display = (type === 'daily' || type === 'manual') ? 'none' : '';
    _syncFormFields(type);
  }

  function practiceFormScheduleChanged(type) {
    _syncScheduleRows(type);
  }

  function openPracticeForm(id = null) {
    if (!runtime.ready) return;
    runtime.editingId = id || null;
    _overlay('ov-practice-form', _renderForm());
    const sel = document.getElementById('pf-schedule');
    if (sel) _syncScheduleRows(sel.value);
  }

  async function _saveForm() {
    const p = runtime.editingId ? _get(runtime.editingId) : null;
    const type = document.getElementById('pf-schedule')?.value || 'daily';
    const schedule = { type };
    if (type === 'weekly') {
      schedule.days = Array.from(document.querySelectorAll('input[name="pf-weekday"]:checked')).map(el => Number(el.value));
      if (!schedule.days.length) { toast('Choose at least one day', 'alert'); return; }
    }
    if (type === 'gregorian-monthly') schedule.day = Math.min(31, Math.max(1, Number(document.getElementById('pf-greg-day')?.value) || 1));
    if (type === 'hijri-monthly') {
      schedule.days = String(document.getElementById('pf-hijri-days')?.value || '').split(',').map(n => Number(n.trim())).filter(n => n >= 1 && n <= 30);
      if (!schedule.days.length) { toast('Choose at least one Hijri day', 'alert'); return; }
    }
    if (type === 'hijri-yearly') {
      schedule.month = Number(document.getElementById('pf-hijri-month')?.value) || 1;
      schedule.days = String(document.getElementById('pf-hijri-year-days')?.value || '').split(',').map(n => Number(n.trim())).filter(n => n >= 1 && n <= 30);
      if (!schedule.days.length) { toast('Add at least one Hijri day', 'alert'); return; }
    }
    if (type === 'hijri-range') {
      schedule.month = Number(document.getElementById('pf-range-month')?.value) || 1;
      schedule.start = Math.min(30, Math.max(1, Number(document.getElementById('pf-range-start')?.value) || 1));
      schedule.end = Math.min(30, Math.max(schedule.start, Number(document.getElementById('pf-range-end')?.value) || schedule.start));
    }
    if (type === 'interval') schedule.everyDays = Math.min(365, Math.max(1, Number(document.getElementById('pf-interval')?.value) || 40));
    if (type === 'once') {
      schedule.date = document.getElementById('pf-once')?.value || '';
      if (!schedule.date) { toast('Choose a date for this reminder', 'alert'); return; }
    }
    const relativeTo = (type === 'interval' || type === 'manual') ? '' : (document.getElementById('pf-relative')?.value || '');
    const offsetMinutes = Number(document.getElementById('pf-offset')?.value) || 0;
    const reminderTime = document.getElementById('pf-time')?.value || '09:00';
    const advanceMinutes = Math.max(0, Number(document.getElementById('pf-advance')?.value) || 0);
    const warningDays = Math.max(0, Number(document.getElementById('pf-warning')?.value) || 0);
    const personalNote = (document.getElementById('pf-note')?.value || '').trim();
    const timeLabel = relativeTo ? (offsetMinutes < 0 ? `${Math.abs(offsetMinutes)} min before ${relativeTo}` : offsetMinutes > 0 ? `${offsetMinutes} min after ${relativeTo}` : relativeTo) : 'Your time';

    if (p && p.builtIn) {
      runtime.data.overrides[p.id] = {
        ...(runtime.data.overrides[p.id] || {}),
        schedule,
        relativeTo,
        offsetMinutes,
        reminderTime,
        timeLabel,
        advanceMinutes,
        warningDays,
        personalNote
      };
      runtime.data.enabled[p.id] = true;
      await _save();
      closePracticeForm();
      openPracticeDetail(p.id);
      _refreshSurfaces();
      toast('Practice updated', 'check');
      return;
    }

    const title = (document.getElementById('pf-title')?.value || '').trim();
    if (!title) { toast('Give this practice a title', 'alert'); return; }
    const titleAr = (document.getElementById('pf-title-ar')?.value || '').trim();
    const category = document.getElementById('pf-category')?.value || 'personal';
    const source = (document.getElementById('pf-source')?.value || '').trim();
    if (p) {
      const idx = runtime.data.custom.findIndex(x => x.id === p.id);
      if (idx >= 0) {
        runtime.data.custom[idx] = {
          ...runtime.data.custom[idx],
          title, titleAr, category, schedule,
          relativeTo, offsetMinutes, reminderTime, timeLabel,
          advanceMinutes, warningDays, personalNote,
          source, sourceNote: source ? 'Personal note, not a religious ruling.' : '',
          summary: 'A personal reminder kept on your own terms.'
        };
      }
      runtime.data.enabled[p.id] = true;
      await _save();
      closePracticeForm();
      openPracticeDetail(p.id);
      _refreshSurfaces();
      toast('Practice updated', 'check');
      return;
    }
    const id = `custom_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
    runtime.data.custom.push({
      id,
      title,
      titleAr,
      category,
      status: 'personal',
      summary: 'A personal reminder kept on your own terms.',
      source,
      sourceNote: source ? 'Personal note, not a religious ruling.' : '',
      schedule,
      relativeTo,
      offsetMinutes,
      reminderTime,
      timeLabel,
      advanceMinutes,
      warningDays,
      personalNote,
      createdAt: Date.now()
    });
    runtime.data.enabled[id] = true;
    runtime.data.dismissedSetup = true;
    await _save();
    closePracticeForm();
    _refreshSurfaces();
    toast('Practice added', 'check');
  }

  function _renderSettings() {
    const settings = runtime.data.settings;
    const canNotify = typeof Notification !== 'undefined';
    const permission = canNotify ? Notification.permission : 'unsupported';
    return `<div class="modal-box practice-settings-modal" role="dialog" aria-modal="true" aria-labelledby="practice-settings-title">
      <div class="mh practice-modal-head"><div><span class="practice-eyebrow">Local preferences</span><h2 id="practice-settings-title">Practice settings</h2></div><button class="btn-close" data-autofocus onclick="closePracticeSettings()" aria-label="Close settings">${icon('x', 20)}</button></div>
      <div class="practice-settings-body">
        <section class="practice-settings-section">
          <h3 class="practice-subhead">Reminders</h3>
          <p class="practice-detail-muted">Sahib checks reminders while it is open. Background delivery depends on the browser, installing the app and notification permission.</p>
          <div class="practice-form-grid">
            <label class="practice-field"><span>Quiet hours begin</span><input id="ps-quiet-start" type="time" value="${esc(settings.quietStart)}"></label>
            <label class="practice-field"><span>Quiet hours end</span><input id="ps-quiet-end" type="time" value="${esc(settings.quietEnd)}"></label>
          </div>
          <label class="practice-check-row"><input id="ps-notify" type="checkbox" ${settings.notify ? 'checked' : ''} onchange="practiceNotifyToggle(this.checked)"><span>Browser notifications<small>${permission === 'unsupported' ? 'Not supported in this browser' : permission === 'denied' ? 'Permission blocked in browser settings' : permission === 'granted' ? 'Permission granted' : 'Permission will be requested once'}</small></span></label>
          <label class="practice-check-row"><input id="ps-group" type="checkbox" ${settings.group ? 'checked' : ''}><span>Group practices due together<small>One quiet prompt instead of a burst of notifications</small></span></label>
          <div class="practice-settings-actions"><button class="practice-primary practice-primary--small" onclick="practiceSaveSettings()">Save preferences</button><button class="practice-text-btn" onclick="openPracticeReminders()">Open reminder centre</button></div>
        </section>
        <section class="practice-settings-section">
          <h3 class="practice-subhead">Your data</h3>
          <p class="practice-detail-muted">Practice settings and completion history live in this browserâ€™s IndexedDB. They are included in a practice backup, not sent anywhere.</p>
          <div class="practice-settings-actions"><button class="practice-secondary" onclick="practiceExport()">Export practice data</button><label class="practice-secondary practice-file-label">Restore from file<input type="file" accept="application/json,.json" onchange="practiceImportFile(this)"></label><button class="practice-text-btn" onclick="practiceResetSetup()">Replay first-run choices</button></div>
        </section>
        <section class="practice-settings-section">
          <h3 class="practice-subhead">About sources</h3>
          <p class="practice-detail-muted">Built-in practices show a source and a note in their details. Scholarly differences are not flattened into a single answer. Personal practices are marked personal and carry no religious ruling.</p>
          <p class="practice-detail-muted">The forty-night report in Sahih Muslim 258 is presented as a sourced maximum interval, not a universal deadline. No completion history is created for you.</p>
        </section>
      </div>
    </div>`;
  }

  function openPracticeSettings() {
    if (!runtime.ready) return;
    _overlay('ov-practice-settings', _renderSettings());
  }

  async function _saveSettings() {
    const quietStart = document.getElementById('ps-quiet-start')?.value || '22:00';
    const quietEnd = document.getElementById('ps-quiet-end')?.value || '06:30';
    const group = !!document.getElementById('ps-group')?.checked;
    runtime.data.settings.quietStart = quietStart;
    runtime.data.settings.quietEnd = quietEnd;
    runtime.data.settings.group = group;
    await _save();
    toast('Practice preferences saved', 'check');
  }

  async function _requestNotifications(on) {
    runtime.data.settings.notify = !!on;
    if (!on) { await _save(); return; }
    if (typeof Notification === 'undefined') {
      runtime.data.settings.notify = false;
      await _save();
      toast('This browser does not support notifications', 'alert');
      return;
    }
    try {
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        runtime.data.settings.notify = false;
        await _save();
        const box = document.getElementById('ps-notify');
        if (box) box.checked = false;
        toast('Notification permission was not granted', 'alert');
        return;
      }
    } catch (err) {
      runtime.data.settings.notify = false;
      await _save();
      const box = document.getElementById('ps-notify');
      if (box) box.checked = false;
      toast('Could not request notification permission', 'alert');
      return;
    }
    await _save();
    toast('Browser notifications enabled', 'check');
  }

  function _inQuietHours(date = new Date()) {
    const start = _parseClock(runtime.data?.settings?.quietStart || '22:00');
    const end = _parseClock(runtime.data?.settings?.quietEnd || '06:30');
    if (start == null || end == null || start === end) return false;
    const now = date.getHours() * 60 + date.getMinutes();
    if (start < end) return now >= start && now < end;
    return now >= start || now < end;
  }

  function _reminderItems() {
    const snap = getTodaySnapshot();
    return snap.due.filter(item => item.dueMinutes != null);
  }

  function openPracticeReminders() {
    if (!runtime.ready) return;
    const snap = getTodaySnapshot();
    const quiet = _inQuietHours();
    const permission = typeof Notification !== 'undefined' ? Notification.permission : 'unsupported';
    const items = snap.due;
    const list = items.length ? items.map(item => `<div class="practice-reminder-row">
      <div class="practice-reminder-time">${esc(_timeText(item.practice))}<span>${esc(_timeSub(item.practice))}</span></div>
      <div class="practice-reminder-copy"><strong>${esc(item.practice.title)}</strong><span>${esc(_scheduleText(item.practice))} Â· ${esc(_category(item.practice.category).label)}</span></div>
      <button class="practice-text-btn" onclick="openPracticeDetail('${esc(item.practice.id)}')">Details</button>
    </div>`).join('') : `<p class="practice-rail-empty">Nothing is waiting right now. The daybook can stay quiet.</p>`;
    _overlay('ov-practice-reminders', `<div class="modal-box practice-reminder-modal" role="dialog" aria-modal="true" aria-labelledby="practice-reminders-title">
      <div class="mh practice-modal-head"><div><span class="practice-eyebrow">In-app reminder centre</span><h2 id="practice-reminders-title">What is waiting</h2></div><button class="btn-close" data-autofocus onclick="closePracticeReminders()" aria-label="Close reminder centre">${icon('x', 20)}</button></div>
      <div class="practice-reminder-body">
        <div class="practice-reminder-status"><span>${quiet ? icon('moon', 15) + ' Quiet hours are active' : icon('bell', 15) + ' Reminders are checked while Sahib is open'}</span><span>${permission === 'granted' ? 'Browser notifications allowed' : permission === 'denied' ? 'Browser notifications blocked' : 'Browser notifications optional'}</span></div>
        <div class="practice-reminder-list">${list}</div>
        <div class="practice-reminder-foot"><p>Due items remain here even when a browser notification cannot be shown. Sahib does not promise background alarms while the app is closed.</p><button class="practice-text-btn" onclick="closePracticeReminders();openPracticeSettings()">Reminder settings</button></div>
      </div>
    </div>`);
  }

  async function _sendNotification(title, body) {
    if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return;
    try {
      if ('serviceWorker' in navigator) {
        const reg = await navigator.serviceWorker.ready;
        if (reg && typeof reg.showNotification === 'function') {
          await reg.showNotification(title, { body, tag: 'sahib-practice', renotify: false, icon: 'icons/icon-192.png' });
          return;
        }
      }
      new Notification(title, { body, tag: 'sahib-practice', icon: 'icons/icon-192.png' });
    } catch (err) { /* Notifications are an enhancement, never a requirement. */ }
  }

  async function checkReminders() {
    if (!runtime.ready || !runtime.data) return [];
    const now = new Date();
    if (_inQuietHours(now)) return [];
    const due = _reminderItems();
    const nowMin = now.getHours() * 60 + now.getMinutes();
    const dueNow = due.filter(item => {
      const target = item.dueMinutes - Number(item.practice.advanceMinutes || 0);
      const key = `${item.practice.id}:${_dateKey(now)}:${target}`;
      if (runtime.data.notices[key]) return false;
      return nowMin >= target && nowMin <= target + 45;
    });
    if (!dueNow.length) return [];
    dueNow.forEach(item => {
      const target = item.dueMinutes - Number(item.practice.advanceMinutes || 0);
      runtime.data.notices[`${item.practice.id}:${_dateKey(now)}:${target}`] = Date.now();
    });
    await _save();
    if (dueNow.length === 1) {
      toast(`${dueNow[0].practice.title} Â· ${_timeText(dueNow[0].practice)}`, 'bell');
    } else {
      toast(`${dueNow.length} practices are waiting Â· open your daybook`, 'bell');
    }
    if (runtime.data.settings.notify) {
      const body = runtime.data.settings.group
        ? dueNow.map(item => item.practice.title).join(' Â· ')
        : dueNow.map(item => `${item.practice.title} â€” ${_timeText(item.practice)}`).join('\n');
      _sendNotification('Sahib Â· Daily practice', body);
    }
    return dueNow;
  }

  function startReminders() {
    if (runtime.timer) return;
    runtime.timer = setInterval(() => { checkReminders(); }, 60000);
    setTimeout(() => { checkReminders(); }, 15000);
  }

  async function _exportPractice() {
    const payload = {
      app: 'Sahib',
      kind: 'practice-state',
      version: VERSION,
      exportedAt: new Date().toISOString(),
      state: runtime.data
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `sahib-practice-${_dateKey()}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    toast('Practice backup exported', 'download');
  }

  async function _importPractice(file) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async event => {
      try {
        const json = JSON.parse(event.target.result);
        if (!json || json.kind !== 'practice-state' || !json.state) { toast('Not a Sahib practice backup', 'alert'); return; }
        const next = _normalize(json.state);
        runtime.data = next;
        await _save();
        closePracticeSettings();
        _refreshSurfaces();
        toast('Practice data restored', 'check');
      } catch (err) {
        toast('Could not read that practice backup', 'alert');
      } finally {
        const input = document.querySelector('input[type="file"][accept*="json"]');
        if (input) input.value = '';
      }
    };
    reader.readAsText(file);
  }

  async function _resetSetup() {
    runtime.data.dismissedSetup = false;
    await _save();
    closePracticeSettings();
    runtime.tab = 'today';
    _refreshSurfaces();
    toast('First-run choices reopened', 'calm');
  }

  async function _deletePractice(id) {
    const p = _get(id);
    if (!p || p.builtIn) return;
    if (!window.confirm(`Delete â€œ${p.title}â€ and its local history? This cannot be undone.`)) return;
    runtime.data.custom = runtime.data.custom.filter(x => x.id !== id);
    delete runtime.data.enabled[id];
    delete runtime.data.overrides[id];
    delete runtime.data.lastDone[id];
    delete runtime.data.snoozes[id];
    runtime.data.entries = runtime.data.entries.filter(e => e.practiceId !== id);
    await _save();
    closePracticeDetail();
    _refreshSurfaces();
    toast('Personal practice deleted', 'trash');
  }

  async function _openLink(id) {
    const p = _get(id);
    if (!p || !p.link) return;
    closePracticeDetail();
    const action = p.link.action;
    if (action && typeof window[action] === 'function') {
      window[action](p.link.arg);
    } else {
      toast('That collection is not available', 'alert');
    }
  }

  function _setTab(tab) {
    if (['today', 'upcoming', 'calendar', 'all'].includes(tab)) runtime.tab = tab;
    if (tab === 'calendar') {
      if (!runtime.calendarCursor) runtime.calendarCursor = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
      if (!runtime.calendarSelected) runtime.calendarSelected = _dateKey();
    }
  }

  function _calendarPrev() {
    const cur = runtime.calendarCursor || new Date(new Date().getFullYear(), new Date().getMonth(), 1);
    runtime.calendarCursor = new Date(cur.getFullYear(), cur.getMonth() - 1, 1);
    runtime.tab = 'calendar';
    renderPracticeView();
  }

  function _calendarNext() {
    const cur = runtime.calendarCursor || new Date(new Date().getFullYear(), new Date().getMonth(), 1);
    runtime.calendarCursor = new Date(cur.getFullYear(), cur.getMonth() + 1, 1);
    runtime.tab = 'calendar';
    renderPracticeView();
  }

  function _calendarToday() {
    const today = new Date();
    runtime.calendarCursor = new Date(today.getFullYear(), today.getMonth(), 1);
    runtime.calendarSelected = _dateKey();
    runtime.tab = 'calendar';
    renderPracticeView();
  }

  function _selectDate(key) {
    if (!_parseKey(key)) return;
    runtime.calendarSelected = key;
    runtime.tab = 'calendar';
    renderPracticeView();
  }

  return {
    init,
    isReady: () => runtime.ready,
    setTab: _setTab,
    render: renderPracticeView,
    getTodaySnapshot,
    getHomeSummary,
    getDayAgenda,
    getUpcomingGroups,
    getAll: _allPractices,
    getPractice: _get,
    setTimings,
    checkReminders,
    refresh: _refreshSurfaces,
    complete: _complete,
    undo: _undo,
    skip: _skip,
    snooze: _snooze,
    unsnooze: _unsnooze,
    setLastDone: _setLastDone,
    toggle: _toggleEnabled,
    enableStarter: _enableStarter,
    addStarterSet: _addStarterSet,
    dismissSetup: _dismissSetup,
    openDetail: openPracticeDetail,
    closeDetail: closePracticeDetail,
    openForm: openPracticeForm,
    closeForm: closePracticeForm,
    formScheduleChanged: practiceFormScheduleChanged,
    saveForm: _saveForm,
    openSettings: openPracticeSettings,
    closeSettings: closePracticeSettings,
    openReminders: openPracticeReminders,
    closeReminders: closePracticeReminders,
    saveSettings: _saveSettings,
    requestNotifications: _requestNotifications,
    exportData: _exportPractice,
    importData: _importPractice,
    resetSetup: _resetSetup,
    deletePractice: _deletePractice,
    openLink: _openLink,
    isQuiet: _inQuietHours,
    calendarPrev: _calendarPrev,
    calendarNext: _calendarNext,
    calendarToday: _calendarToday,
    selectDate: _selectDate
  };
})();

window.SahibPractice = SahibPractice;

/* Global entry points used by inline controls and the rest of the app. */
function openPracticeView(tab = 'today') {
  if (!window.SahibPractice) return;
  SahibPractice.setTab(tab);
  showView('view-practice');
  if (!SahibPractice.isReady()) {
    SahibPractice.init().then(() => SahibPractice.render());
  } else {
    SahibPractice.render();
  }
  window.scrollTo({ top: 0, behavior: 'auto' });
}

function showPracticeTab(tab) {
  SahibPractice.setTab(tab);
  SahibPractice.render();
}

function showPracticeAll() { showPracticeTab('all'); }
function showPracticeUpcoming() { showPracticeTab('upcoming'); }

function practiceCalendarPrev() { SahibPractice.calendarPrev(); }
function practiceCalendarNext() { SahibPractice.calendarNext(); }
function practiceCalendarToday() { SahibPractice.calendarToday(); }
function practiceSelectDate(key) { SahibPractice.selectDate(key); }

function practiceDone(id) { SahibPractice.complete(id); }
function practiceDoneOn(id, key) { SahibPractice.complete(id, key); }
function practiceUndo(id) { SahibPractice.undo(id); }
function practiceSkip(id) { SahibPractice.skip(id); }
function practiceSnooze(id, days = 1) { SahibPractice.snooze(id, days); }
function practiceSnoozeUndo(id) { SahibPractice.unsnooze(id); }

function practiceSaveLastDone(id) {
  const input = document.getElementById('practice-last-done');
  if (!input || !input.value) { toast('Choose the date you last completed it', 'alert'); return; }
  SahibPractice.setLastDone(id, input.value);
}

function practiceToggle(id) {
  const p = SahibPractice.getPractice(id);
  if (!p) return;
  if (p.templateOnly && p.schedule?.type === 'manual') {
    toast('Choose a date before adding this practice', 'calm');
    SahibPractice.openDetail(id);
    return;
  }
  SahibPractice.toggle(id);
}

function practiceWelcomeAdd(id) { SahibPractice.enableStarter(id); }
function practiceAddStarterSet() { SahibPractice.addStarterSet(); }
function practiceDismissSetup() { SahibPractice.dismissSetup(); }

function openPracticeDetail(id) { SahibPractice.openDetail(id); }
function closePracticeDetail() { SahibPractice.closeDetail(); }
function openPracticeForm(id) { SahibPractice.openForm(id || null); }
function closePracticeForm() { SahibPractice.closeForm(); }
function practiceSaveForm() { SahibPractice.saveForm(); }
function practiceFormScheduleChanged(type) { SahibPractice.formScheduleChanged(type); }

function practiceEdit(id) {
  SahibPractice.closeDetail();
  setTimeout(() => SahibPractice.openForm(id), 170);
}

function practiceDelete(id) { SahibPractice.deletePractice(id); }
function practiceOpenLink(id) { SahibPractice.openLink(id); }

function openPracticeSettings() { SahibPractice.openSettings(); }
function closePracticeSettings() { SahibPractice.closeSettings(); }
function practiceSaveSettings() { SahibPractice.saveSettings(); }
function practiceNotifyToggle(on) { SahibPractice.requestNotifications(on); }
function practiceExport() { SahibPractice.exportData(); }
function practiceImportFile(input) { SahibPractice.importData(input.files?.[0]); }
function practiceResetSetup() { SahibPractice.resetSetup(); }

function openPracticeReminders() { SahibPractice.openReminders(); }
function closePracticeReminders() { SahibPractice.closeReminders(); }
