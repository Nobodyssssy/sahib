'use strict';

/* ==========================================================================
   SAHIB SETTINGS
   Appearance (theme families, mode, accents, fonts)
   Prayer   (provider, method, school, format, adjustments, CSV import)
   Alerts   (approaching reminders, per-prayer toggles, chime, notifications)
   Data     (backup, prayer cache, storage)
   About    (privacy, sources, licences)
   ========================================================================== */

const SETTINGS_TABS = ['appearance', 'prayer', 'alerts', 'data', 'about'];
let _settingsTab = 'appearance';
let _settingsCsvText = '';
let _settingsCsvName = '';
let _settingsCsvParsed = null;
let _settingsPrayerRefreshTimer = null;

function _refreshPrayerUIIfActive(){
  if(!document.querySelector('#view-prayer.active')) return;
  if(typeof openPrayerView !== 'function') return;
  clearTimeout(_settingsPrayerRefreshTimer);
  _settingsPrayerRefreshTimer = setTimeout(() => openPrayerView(), 120);
}

function openSettings(tab){
  if(tab && SETTINGS_TABS.includes(tab)) _settingsTab = tab;

  const menuOverlay = document.querySelector('.menu-overlay.open');
  if(menuOverlay) menuOverlay.classList.remove('open');

  const ov = $('ov-settings');
  if(!ov) return;
  ov.classList.add('open');
  if(typeof lockBody === 'function') lockBody();

  document.querySelectorAll('.side-nav-item[data-nav]').forEach(btn =>
    btn.classList.toggle('active', btn.getAttribute('data-nav') === 'settings'));

  _syncSettingsTabs();
  renderSettingsBody();
}

function closeSettings(){
  const ov = $('ov-settings');
  if(!ov) return;
  ov.classList.remove('open');
  if(typeof unlockBody === 'function') unlockBody();
  const activeView = document.querySelector('.view.active');
  if(activeView && typeof updateShellNav === 'function') updateShellNav(activeView.id);
}

function setSettingsTab(tab){
  if(!SETTINGS_TABS.includes(tab)) return;
  _settingsTab = tab;
  _syncSettingsTabs();
  renderSettingsBody();
}

function _syncSettingsTabs(){
  document.querySelectorAll('#settings-tabs [data-settings-tab]').forEach(btn => {
    const on = btn.getAttribute('data-settings-tab') === _settingsTab;
    btn.classList.toggle('active', on);
    btn.setAttribute('aria-selected', on ? 'true' : 'false');
  });
}

/* Theme engine calls this after every apply(); keep selections in sync. */
function updateSettingsUI(){
  const body = $('settings-body');
  if(!body) return;
  const state = (typeof SAHIB_THEME !== 'undefined') ? SAHIB_THEME.state : null;
  if(!state) return;

  document.querySelectorAll('[data-theme-option]').forEach(el =>
    el.classList.toggle('active', el.getAttribute('data-theme-option') === state.theme));
  document.querySelectorAll('[data-mode-option]').forEach(el =>
    el.classList.toggle('active', el.getAttribute('data-mode-option') === state.mode));
  document.querySelectorAll('[data-accent-option]').forEach(el =>
    el.classList.toggle('active', el.getAttribute('data-accent-option') === state.accent));
  document.querySelectorAll('[data-font-option]').forEach(el =>
    el.classList.toggle('active', el.getAttribute('data-font-option') === state.font));
}

async function renderSettingsBody(){
  const body = $('settings-body');
  if(!body) return;
  body.setAttribute('aria-busy', 'true');
  let html = '';
  try{
    if(_settingsTab === 'appearance') html = _appearanceHTML();
    else if(_settingsTab === 'prayer') html = await _prayerHTML();
    else if(_settingsTab === 'alerts') html = await _alertsHTML();
    else if(_settingsTab === 'data') html = _dataHTML();
    else html = _aboutHTML();
  }catch(err){
    console.error('[settings]', err);
    html = `<div class="settings-note">Something went wrong while loading these settings: ${esc(err.message)}</div>`;
  }
  body.innerHTML = html;
  body.removeAttribute('aria-busy');
  if(typeof injectHeaderIcons === 'function') setTimeout(() => injectHeaderIcons(), 0);
  if(_settingsTab === 'data') _hydrateStorageInfo();
  if(_settingsTab === 'prayer') _hydratePrayerLocation();
}

async function _hydratePrayerLocation(){
  const el = $('settings-location-desc');
  if(!el) return;
  try{
    const loc = await getLocation();
    const label = loc.label || `${Number(loc.lat).toFixed(3)}, ${Number(loc.lng).toFixed(3)}`;
    el.textContent = `${label} · ${loc.manual ? 'manual' : 'GPS'} · saved ${_settingsAgo(loc.ts)}`;
  }catch(err){
    el.textContent = 'No location set — choose a city or use GPS.';
  }
}

/* ═══════════════════════════════════════════════════════════
   APPEARANCE
   ═══════════════════════════════════════════════════════════ */
function _appearanceHTML(){
  const state = (typeof SAHIB_THEME !== 'undefined') ? SAHIB_THEME.state : { theme: 'catppuccin', mode: 'dark', accent: 'gold', font: 'tajawal' };
  const themes = (typeof SAHIB_THEME !== 'undefined') ? SAHIB_THEME.THEMES : [];
  const accents = (typeof SAHIB_THEME !== 'undefined') ? SAHIB_THEME.ACCENTS : [];
  const fonts = (typeof SAHIB_THEME !== 'undefined') ? SAHIB_THEME.FONTS : [];

  return `
    <div class="settings-section">
      <div class="settings-section-title">Theme family</div>
      <div class="theme-grid">
        ${themes.map(t => `
          <button type="button" class="theme-card ${state.theme === t.id ? 'active' : ''}" data-theme-option="${t.id}" onclick="setThemeFamily('${t.id}')">
            <span class="theme-preview t-${t.id}"></span>
            <span class="theme-card-name">${esc(t.label)}</span>
            <span class="theme-card-hint">${esc(t.hint)}</span>
          </button>`).join('')}
      </div>
    </div>

    <div class="settings-section">
      <div class="settings-section-title">Mode</div>
      <div class="segmented">
        <button type="button" class="${state.mode === 'dark' ? 'active' : ''}" data-mode-option="dark" onclick="setThemeModeOption('dark')">Dark</button>
        <button type="button" class="${state.mode === 'light' ? 'active' : ''}" data-mode-option="light" onclick="setThemeModeOption('light')">Light</button>
      </div>
      <div class="settings-section-desc">Every theme family ships with a light and a dark palette. The choice is stored on this device.</div>
    </div>

    <div class="settings-section">
      <div class="settings-section-title">Accent</div>
      <div class="accent-grid">
        ${accents.map(a => `
          <button type="button" class="accent-option ${state.accent === a.id ? 'active' : ''}" data-accent-option="${a.id}" onclick="setAccentOption('${a.id}')">
            <span class="accent-dot dot-${a.id}"></span>
            <span>${esc(a.label)}</span>
          </button>`).join('')}
      </div>
    </div>

    <div class="settings-section">
      <div class="settings-section-title">Typeface</div>
      <div class="font-grid">
        ${fonts.map(f => `
          <button type="button" class="font-option ${state.font === f.id ? 'active' : ''}" data-font-option="${f.id}" onclick="setFontOption('${f.id}')">
            <span class="font-sample">صاحب Aa</span>
            <span>${esc(f.label)}</span>
          </button>`).join('')}
      </div>
      <div class="settings-note">
        <strong>Arabic text</strong> keeps a dedicated Arabic face for Quran, adhkar and the Hijri calendar.
        The typeface setting changes the interface around it.
      </div>
    </div>

    <div class="settings-section">
      <div class="settings-row">
        <div class="settings-row-info">
          <div class="settings-row-title">Reset appearance</div>
          <div class="settings-row-desc">Catppuccin · dark · gold · Tajawal</div>
        </div>
        <div class="settings-row-actions">
          <button type="button" class="btn-cancel" onclick="resetAppearanceSettings()">Reset</button>
        </div>
      </div>
    </div>`;
}

function setThemeFamily(id){
  if(typeof SAHIB_THEME === 'undefined') return;
  SAHIB_THEME.setTheme(id);
  updateSettingsUI();
}

function setThemeModeOption(mode){
  if(typeof SAHIB_THEME === 'undefined') return;
  SAHIB_THEME.setMode(mode);
  updateSettingsUI();
}

function setAccentOption(id){
  if(typeof SAHIB_THEME === 'undefined') return;
  SAHIB_THEME.setAccent(id);
  updateSettingsUI();
}

function setFontOption(id){
  if(typeof SAHIB_THEME === 'undefined') return;
  SAHIB_THEME.setFont(id);
  updateSettingsUI();
}

async function resetAppearanceSettings(){
  if(typeof SAHIB_THEME === 'undefined') return;
  await SAHIB_THEME.setTheme('catppuccin');
  await SAHIB_THEME.setMode('dark');
  await SAHIB_THEME.setAccent('gold');
  await SAHIB_THEME.setFont('tajawal');
  updateSettingsUI();
  toast('Appearance reset', 'check');
}

/* ═══════════════════════════════════════════════════════════
   PRAYER
   ═══════════════════════════════════════════════════════════ */
function _providerStatusHTML(prefs, status){
  const online = typeof navigator === 'undefined' ? true : navigator.onLine;
  const provider = (PRAYER_PROVIDER_LABELS[prefs.provider] || prefs.provider);
  const sourceLabels = {
    'aladhan': 'AlAdhan API',
    'aladhan-cache': 'AlAdhan cache',
    'local': 'Offline calculation',
    'local-cache': 'Offline calculation',
    'last-good': 'Offline snapshot',
    'csv': 'CSV schedule'
  };
  let freshness;
  if(status){
    const sourceLabel = sourceLabels[status.source] || status.source || 'ready';
    const sourceDiffers = String(sourceLabel).toLowerCase() !== String(provider).toLowerCase();
    const prefix = status.fallback
      ? 'Offline fallback'
      : status.stale
        ? 'Cached snapshot'
        : (sourceDiffers ? sourceLabel : '');
    freshness = `${prefix ? prefix + ' · ' : ''}updated ${_settingsAgo(status.cachedAt)}`;
  } else {
    freshness = online ? 'Ready' : 'Offline — cached data will be used';
  }
  return `
    <div class="settings-row">
      <div class="settings-row-info">
        <div class="settings-row-title">Current source: <strong>${esc(provider)}</strong></div>
        <div class="settings-row-desc">${esc(freshness)}</div>
      </div>
      <div class="settings-row-actions">
        <button type="button" class="btn-cancel" onclick="refreshPrayerCacheNow()">Refresh now</button>
      </div>
    </div>`;
}

function _adjustmentInputHTML(name, minutes){
  return `
    <label class="settings-adjust">
      <span class="settings-adjust-name">${name}</span>
      <input class="fi settings-adjust-input" type="number" min="-60" max="60" step="1"
             value="${Number(minutes) || 0}"
             onchange="onPrayerAdjustmentChange('${name}', this.value)">
    </label>`;
}

async function _prayerHTML(){
  const prefs = await getPrayerPrefs();
  const status = (typeof getPrayerStatus === 'function') ? getPrayerStatus() : null;
  const csv = await getPrayerCsvSchedule();
  const isCsv = prefs.provider === 'csv';
  const adjusted = hasPrayerAdjustments(prefs);

  return `
    <div class="settings-section">
      <div class="settings-section-title">Location</div>
      <div class="settings-row">
        <div class="settings-row-info">
          <div class="settings-row-title" id="settings-location-title">Location used for prayer times</div>
          <div class="settings-row-desc" id="settings-location-desc">Loading…</div>
        </div>
        <div class="settings-row-actions">
          <button type="button" class="btn-cancel" onclick="useGPSLocation()">Use GPS</button>
          <button type="button" class="btn-save" onclick="openLocationPicker()">Change</button>
        </div>
      </div>
      <div class="settings-note">
        <strong>Time zone:</strong> times are shown in your device's local time. Offline calculation is exact only when the
        device time zone matches the selected location; AlAdhan returns the location's own time zone.
      </div>
    </div>

    <div class="settings-section">
      <div class="settings-section-title">Provider</div>
      <div class="fg">
        <select class="fse" id="settings-provider" onchange="onSettingProviderChange(this.value)">
          ${PRAYER_PROVIDERS.map(p => `
            <option value="${p.id}" ${prefs.provider === p.id ? 'selected' : ''}>${esc(p.label)} — ${esc(p.hint)}</option>
          `).join('')}
        </select>
      </div>
      ${_providerStatusHTML(prefs, status)}
    </div>

    <div class="settings-section">
      <div class="settings-section-title">Calculation</div>
      <div class="settings-grid-2">
        <div class="fg">
          <label class="fl" for="settings-method">Method</label>
          <select class="fse" id="settings-method" ${isCsv ? 'disabled' : ''} onchange="onPrayerMethodChange(this.value)">
            ${PRAYER_METHODS.map(m => `
              <option value="${m.id}" ${prefs.method === m.id ? 'selected' : ''}>${esc(m.label)}</option>
            `).join('')}
          </select>
        </div>
        <div class="fg">
          <label class="fl">Asr madhab</label>
          <div class="segmented">
            <button type="button" class="${prefs.school === 0 ? 'active' : ''}" ${isCsv ? 'disabled' : ''} onclick="onPrayerSchoolChange(0)">Standard</button>
            <button type="button" class="${prefs.school === 1 ? 'active' : ''}" ${isCsv ? 'disabled' : ''} onclick="onPrayerSchoolChange(1)">Hanafi</button>
          </div>
        </div>
      </div>
      <div class="fg">
        <label class="fl">Time format</label>
        <div class="segmented">
          <button type="button" class="${prefs.timeFormat === '24h' ? 'active' : ''}" onclick="onTimeFormatChange('24h')">24-hour</button>
          <button type="button" class="${prefs.timeFormat === '12h' ? 'active' : ''}" onclick="onTimeFormatChange('12h')">12-hour</button>
        </div>
      </div>
      ${isCsv ? `<div class="settings-note">Method and madhab apply to AlAdhan and offline calculation. Your CSV schedule already contains fixed times.</div>` : ''}
    </div>

    <div class="settings-section">
      <div class="settings-section-title">Fine adjustments (minutes)</div>
      <div class="settings-adjust-grid">
        ${PRAYER_ADJUSTABLE.map(name => _adjustmentInputHTML(name, prefs.adjustments[name])).join('')}
      </div>
      <div class="settings-inline-actions">
        <button type="button" class="btn-cancel" onclick="resetPrayerAdjustmentsSetting()" ${adjusted ? '' : 'disabled'}>Reset adjustments</button>
        <span class="settings-file-name">${adjusted ? 'Adjustments are applied on top of the source times.' : 'No adjustments applied.'}</span>
      </div>
    </div>

    <div class="settings-section">
      <div class="settings-section-title">CSV schedule (local only)</div>
      <div class="settings-section-desc">
        Import a timetable that follows Awqat Salaat's column layout:
        <code>Fajr, Shuruq, Dhuhr, Asr, Maghrib, Isha, Date, Day, Month</code>.
        The file is validated, previewed, and stored only on this device. Importing replaces just the CSV schedule — AlAdhan caches are untouched.
      </div>
      ${csv ? `
        <div class="settings-note">
          <strong>${csv.count} rows</strong> · ${esc(csv.range ? csv.range.from + ' → ' + csv.range.to : '') } · ${esc(csv.sourceName || 'local file')} · imported ${_settingsAgo(csv.importedAt)}
        </div>` : ''}
      <div class="settings-inline-actions">
        <label class="io-btn" style="margin:0">
          <span class="btn-icon" data-icon="upload"></span> Choose CSV file
          <input type="file" accept=".csv,text/csv" style="display:none" onchange="onPrayerCsvFileSelected(event)">
        </label>
        ${_settingsCsvParsed && _settingsCsvParsed.ok ? `
          <button type="button" class="btn-save" onclick="confirmPrayerCsvImport()">Import and use schedule</button>
          <button type="button" class="btn-cancel" onclick="cancelPrayerCsvImport()">Cancel</button>` : ''}
        <button type="button" class="io-btn" onclick="downloadPrayerCsvTemplate()">Download template</button>
        ${csv ? `<button type="button" class="io-btn settings-danger" onclick="clearPrayerCsvSchedule()">Remove CSV schedule</button>` : ''}
      </div>
      ${_settingsCsvPreviewHTML()}
    </div>

    <div class="settings-section">
      <div class="settings-section-title">Timetable</div>
      <div class="settings-inline-actions">
        <button type="button" class="io-btn" onclick="openPrayerMonthView()">Monthly overview</button>
        <button type="button" class="io-btn" onclick="printPrayerTimetable()">Print timetable</button>
        <button type="button" class="io-btn" onclick="exportPrayerMonthCsv()">Export this month as CSV</button>
      </div>
    </div>`;
}

function _settingsAgo(ts){
  if(!ts) return '—';
  const mins = Math.max(0, Math.round((Date.now() - ts) / 60000));
  if(mins < 1) return 'just now';
  if(mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if(hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function _settingsCsvPreviewHTML(){
  if(!_settingsCsvParsed) return '';
  const parsed = _settingsCsvParsed;
  const errors = (parsed.errors || []).slice(0, 8);
  const warnings = (parsed.warnings || []).slice(0, 4);
  const rows = (parsed.rows || []).slice(0, 5);

  return `
    <div class="import-preview">
      <div class="${parsed.ok ? 'import-ok' : 'import-errors'}">
        ${parsed.ok
          ? `${parsed.rows.length} valid rows · ${esc(parsed.range ? parsed.range.from + ' → ' + parsed.range.to : '')} · ${esc(_settingsCsvName || 'file')}`
          : `${errors.length} problem${errors.length === 1 ? '' : 's'} found — the schedule was not imported.`}
      </div>
      ${rows.length ? `
        <div class="month-table-wrap">
          <table class="import-preview-table">
            <thead><tr><th>Date</th><th>Fajr</th><th>Sunrise</th><th>Dhuhr</th><th>Asr</th><th>Maghrib</th><th>Isha</th></tr></thead>
            <tbody>
              ${rows.map(r => `
                <tr>
                  <td>${esc(r.date)}</td>
                  <td>${esc(r.timings.Fajr || '—')}</td>
                  <td>${esc(r.timings.Sunrise || '—')}</td>
                  <td>${esc(r.timings.Dhuhr || '—')}</td>
                  <td>${esc(r.timings.Asr || '—')}</td>
                  <td>${esc(r.timings.Maghrib || '—')}</td>
                  <td>${esc(r.timings.Isha || '—')}</td>
                </tr>`).join('')}
            </tbody>
          </table>
        </div>` : ''}
      ${errors.length ? `<ul class="import-errors">${errors.map(e => `<li>${esc(e)}</li>`).join('')}</ul>` : ''}
      ${warnings.length ? `<div class="settings-note">${warnings.map(w => esc(w)).join('<br>')}</div>` : ''}
    </div>`;
}

async function onSettingProviderChange(value){
  const prefs = await getPrayerPrefs();
  if(value === prefs.provider) return;
  if(value === 'csv'){
    const csv = await getPrayerCsvSchedule();
    if(!csv){
      toast('Import a CSV schedule first', 'alert');
      renderSettingsBody();
      return;
    }
  }
  await savePrayerPrefs({ provider: value });
  toast(`Provider: ${PRAYER_PROVIDER_LABELS[value] || value}`, 'check');
  renderSettingsBody();
  _refreshPrayerUIIfActive();
}

async function onPrayerMethodChange(value){
  const method = Number(value);
  await savePrayerPrefs({ method });
  toast('Calculation method updated', 'check');
  _refreshPrayerUIIfActive();
}

async function onPrayerSchoolChange(value){
  await savePrayerPrefs({ school: Number(value) === 1 ? 1 : 0 });
  renderSettingsBody();
  _refreshPrayerUIIfActive();
}

async function onTimeFormatChange(value){
  await savePrayerPrefs({ timeFormat: value === '12h' ? '12h' : '24h' });
  document.querySelectorAll('.segmented button').forEach(btn => {
    if(btn.textContent.trim() === '24-hour') btn.classList.toggle('active', value === '24h');
    if(btn.textContent.trim() === '12-hour') btn.classList.toggle('active', value === '12h');
  });
  renderSettingsBody();
  _refreshPrayerUIIfActive();
}

async function onPrayerAdjustmentChange(name, value){
  const minutes = Math.max(-60, Math.min(60, Math.round(Number(value) || 0)));
  await savePrayerPrefs({ adjustments: { [name]: minutes } });
  _refreshPrayerUIIfActive();
}

async function resetPrayerAdjustmentsSetting(){
  await resetPrayerAdjustments();
  renderSettingsBody();
  _refreshPrayerUIIfActive();
  toast('Adjustments reset', 'check');
}

async function refreshPrayerCacheNow(){
  try{
    const now = new Date();
    await getMonth(now.getFullYear(), now.getMonth() + 1, true);
    await ensureCache();
    if(typeof PrayerWidget !== 'undefined') PrayerWidget.refreshAll();
    toast('Prayer data refreshed', 'check');
    renderSettingsBody();
  }catch(err){
    toast(err.message || 'Could not refresh prayer data', 'alert');
  }
}

/* ── CSV import ── */
async function onPrayerCsvFileSelected(event){
  const file = event.target.files && event.target.files[0];
  event.target.value = '';
  if(!file) return;

  if(file.size > 2 * 1024 * 1024){
    _settingsCsvParsed = { ok: false, errors: ['The file is larger than 2 MB.'], warnings: [], rows: [], range: null };
    _settingsCsvName = file.name;
    renderSettingsBody();
    return;
  }

  try{
    const text = await file.text();
    _settingsCsvText = text;
    _settingsCsvName = file.name;
    _settingsCsvParsed = parsePrayerCsv(text);
  }catch(err){
    _settingsCsvParsed = { ok: false, errors: [err.message || 'Could not read the file.'], warnings: [], rows: [], range: null };
    _settingsCsvName = file.name;
  }
  renderSettingsBody();
}

async function confirmPrayerCsvImport(){
  if(!_settingsCsvText || !_settingsCsvParsed || !_settingsCsvParsed.ok) return;
  try{
    const payload = await importPrayerCsv(_settingsCsvText, _settingsCsvName);
    await savePrayerPrefs({ provider: 'csv' });
    _settingsCsvText = '';
    _settingsCsvName = '';
    _settingsCsvParsed = null;
    toast(`Imported ${payload.count} CSV rows`, 'check');
    renderSettingsBody();
    _refreshPrayerUIIfActive();
  }catch(err){
    toast(err.message || 'Import failed', 'alert');
  }
}

function cancelPrayerCsvImport(){
  _settingsCsvText = '';
  _settingsCsvName = '';
  _settingsCsvParsed = null;
  renderSettingsBody();
}

async function clearPrayerCsvSchedule(){
  if(!window.confirm('Remove the imported CSV schedule from this device?')) return;
  await clearPrayerCsv();
  const prefs = await getPrayerPrefs();
  if(prefs.provider === 'csv') await savePrayerPrefs({ provider: 'aladhan' });
  toast('CSV schedule removed', 'trash');
  renderSettingsBody();
  _refreshPrayerUIIfActive();
}

function downloadPrayerCsvTemplate(){
  const blob = new Blob([buildPrayerCsvTemplate()], { type: 'text/csv;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'sahib-prayer-template.csv';
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

/* ═══════════════════════════════════════════════════════════
   ALERTS
   ═══════════════════════════════════════════════════════════ */
async function _alertsHTML(){
  const prefs = await getPrayerPrefs();
  const a = prefs.alerts;
  const permission = (typeof PrayerAlerts !== 'undefined') ? PrayerAlerts.notificationState() : 'unsupported';
  const permissionLabel = permission === 'granted' ? 'Allowed'
    : permission === 'denied' ? 'Blocked in browser settings'
    : permission === 'unsupported' ? 'Not supported by this browser'
    : 'Not requested yet';

  return `
    <div class="settings-section">
      <div class="settings-row">
        <div class="settings-row-info">
          <div class="settings-row-title">Approaching reminders</div>
          <div class="settings-row-desc">In-app reminder before each prayer while Sahib is open or installed.</div>
        </div>
        <div class="settings-row-actions">
          <button type="button" class="switch ${a.enabled ? 'on' : ''}" data-alert-switch="enabled" role="switch" aria-checked="${a.enabled}" onclick="togglePrayerAlertSetting('enabled')" aria-label="Approaching reminders"></button>
        </div>
      </div>

      <div class="settings-row">
        <div class="settings-row-info">
          <div class="settings-row-title">Lead time</div>
          <div class="settings-row-desc">How long before the prayer the reminder appears.</div>
        </div>
        <div class="settings-row-actions">
          <select class="fse" style="width:auto" onchange="setAlertLead(this.value)">
            ${[5, 10, 15, 20, 30, 45, 60].map(m => `<option value="${m}" ${a.leadMinutes === m ? 'selected' : ''}>${m} min</option>`).join('')}
          </select>
        </div>
      </div>

      <div class="settings-row">
        <div class="settings-row-info">
          <div class="settings-row-title">When the prayer enters</div>
          <div class="settings-row-desc">A second reminder at the exact entered time.</div>
        </div>
        <div class="settings-row-actions">
          <button type="button" class="switch ${a.atTime ? 'on' : ''}" data-alert-switch="atTime" role="switch" aria-checked="${a.atTime}" onclick="togglePrayerAlertSetting('atTime')" aria-label="Reminder when the prayer enters"></button>
        </div>
      </div>
    </div>

    <div class="settings-section">
      <div class="settings-section-title">Per prayer</div>
      <div class="alert-prayer-list">
        ${PRAYER_ALERTABLE.map(name => {
          const pp = a.perPrayer[name] || { alert: true, sound: true };
          return `
            <div class="alert-prayer-row">
              <div class="alert-prayer-name"><strong>${name}</strong><span>${PRAYER_NAMES_AR[name] || ''}</span></div>
              <button type="button" class="switch ${pp.alert ? 'on' : ''}" data-pp-switch="${name}:alert" role="switch" aria-checked="${pp.alert}" onclick="togglePerPrayerSetting('${name}','alert')" aria-label="${name} reminder"></button>
              <button type="button" class="switch ${pp.sound ? 'on' : ''}" data-pp-switch="${name}:sound" role="switch" aria-checked="${pp.sound}" onclick="togglePerPrayerSetting('${name}','sound')" aria-label="${name} chime"></button>
            </div>`;
        }).join('')}
      </div>
      <div class="settings-section-desc">Right toggle: reminder · left toggle: chime.</div>
    </div>

    <div class="settings-section">
      <div class="settings-section-title">Chime</div>
      <div class="settings-row">
        <div class="settings-row-info">
          <div class="settings-row-title">Sound</div>
          <div class="settings-row-desc">A short built-in chime. No recitation audio is bundled.</div>
        </div>
        <div class="settings-row-actions">
          <button type="button" class="switch ${a.sound ? 'on' : ''}" data-alert-switch="sound" role="switch" aria-checked="${a.sound}" onclick="togglePrayerAlertSetting('sound')" aria-label="Chime"></button>
        </div>
      </div>
      <div class="settings-row">
        <div class="settings-row-info">
          <div class="settings-row-title">Volume</div>
          <div class="settings-row-desc" id="settings-volume-label">${Math.round(a.volume * 100)}%</div>
        </div>
        <div class="settings-row-actions">
          <input type="range" min="0" max="100" value="${Math.round(a.volume * 100)}" oninput="onSoundVolumeChange(this.value)" style="width:160px">
          <button type="button" class="io-btn" onclick="previewPrayerChime()">Preview</button>
        </div>
      </div>
      <div class="settings-note">
        Browsers require one interaction with the page before audio can play — tapping Preview unlocks it for this session.
      </div>
    </div>

    <div class="settings-section">
      <div class="settings-section-title">Browser notifications</div>
      <div class="settings-row">
        <div class="settings-row-info">
          <div class="settings-row-title">Notification permission: <strong>${esc(permissionLabel)}</strong></div>
          <div class="settings-row-desc">Optional. In-app reminders work without it.</div>
        </div>
        <div class="settings-row-actions">
          ${permission === 'granted'
            ? `<button type="button" class="btn-cancel" onclick="testPrayerNotification()">Test</button>`
            : `<button type="button" class="btn-save" onclick="enablePrayerNotifications()">Enable notifications</button>`}
        </div>
      </div>
      <div class="settings-note">
        <strong>Browser limits:</strong> reminders run while Sahib is open, installed, or recently active. Background delivery is not
        guaranteed by any browser, and audio may be muted until the page has been touched. Sahib never asks for notification
        permission on its own — only from this button.
      </div>
    </div>`;
}

async function togglePrayerAlertSetting(field){
  const prefs = await getPrayerPrefs();
  if(field === 'notify' && !prefs.alerts.notify){
    await enablePrayerNotifications();
    return;
  }
  const next = !prefs.alerts[field];
  await savePrayerPrefs({ alerts: { [field]: next } });
  const el = document.querySelector(`[data-alert-switch="${field}"]`);
  if(el){
    el.classList.toggle('on', next);
    el.setAttribute('aria-checked', next ? 'true' : 'false');
  }
}

async function setAlertLead(value){
  const minutes = Math.max(1, Math.min(120, Math.round(Number(value) || 10)));
  await savePrayerPrefs({ alerts: { leadMinutes: minutes } });
}

async function togglePerPrayerSetting(name, field){
  const prefs = await getPrayerPrefs();
  const pp = { ...(prefs.alerts.perPrayer[name] || { alert: true, sound: true }) };
  pp[field] = !pp[field];
  await savePrayerPrefs({ alerts: { perPrayer: { [name]: pp } } });
  const el = document.querySelector(`[data-pp-switch="${name}:${field}"]`);
  if(el){
    el.classList.toggle('on', pp[field]);
    el.setAttribute('aria-checked', pp[field] ? 'true' : 'false');
  }
}

async function onSoundVolumeChange(value){
  const volume = Math.max(0, Math.min(1, (Number(value) || 0) / 100));
  const label = $('settings-volume-label');
  if(label) label.textContent = `${Math.round(volume * 100)}%`;
  await savePrayerPrefs({ alerts: { volume } });
}

function previewPrayerChime(){
  const ok = (typeof PrayerAlerts !== 'undefined') ? PrayerAlerts.previewChime() : false;
  if(!ok) toast('Audio is not available in this browser', 'alert');
}

async function enablePrayerNotifications(){
  if(typeof PrayerAlerts === 'undefined'){ toast('Notifications are not available', 'alert'); return; }
  const result = await PrayerAlerts.requestNotificationPermission();
  if(result === 'granted'){
    await savePrayerPrefs({ alerts: { notify: true, enabled: true } });
    toast('Notifications enabled', 'check');
  } else if(result === 'denied'){
    toast('Notifications are blocked in your browser settings', 'alert');
  } else {
    toast('Notifications are not supported by this browser', 'alert');
  }
  renderSettingsBody();
}

async function testPrayerNotification(){
  if(typeof PrayerAlerts !== 'undefined') await PrayerAlerts.testNotification();
  previewPrayerChime();
}

/* ═══════════════════════════════════════════════════════════
   DATA
   ═══════════════════════════════════════════════════════════ */
function _dataHTML(){
  return `
    <div class="settings-section">
      <div class="settings-section-title">Backup</div>
      <div class="settings-section-desc">
        Your adhkar, categories and favorites are exported as a single JSON file. Nothing is uploaded anywhere.
      </div>
      <div class="settings-inline-actions">
        <button type="button" class="io-btn" onclick="exportData()"><span class="btn-icon" data-icon="download"></span> Export JSON</button>
        <label class="io-btn" style="margin:0"><span class="btn-icon" data-icon="upload"></span> Import JSON (replace)<input type="file" accept=".json" onchange="importData(event,'replace')" style="display:none"></label>
        <label class="io-btn" style="margin:0"><span class="btn-icon" data-icon="shuffle"></span> Import JSON (merge)<input type="file" accept=".json" onchange="importData(event,'merge')" style="display:none"></label>
      </div>
    </div>

    <div class="settings-section">
      <div class="settings-section-title">Prayer data</div>
      <div class="settings-inline-actions">
        <button type="button" class="io-btn" onclick="refreshPrayerCacheNow()">Rebuild offline prayer cache</button>
        <button type="button" class="io-btn" onclick="openPrayerMonthView()">Open monthly overview</button>
      </div>
      <div class="settings-note">
        AlAdhan months are cached in IndexedDB and refreshed on demand. The CSV schedule, if imported, is stored separately and is never mixed into API caches.
      </div>
    </div>

    <div class="settings-section">
      <div class="settings-section-title">Storage</div>
      <div class="settings-row">
        <div class="settings-row-info">
          <div class="settings-row-title">Estimated usage</div>
          <div class="settings-row-desc" id="settings-storage">Checking…</div>
        </div>
      </div>
      <div class="settings-note">
        Sahib keeps working offline through IndexedDB and the service worker. Books you save offline use their own cache, which is never cleared by app updates.
      </div>
    </div>`;
}

async function _hydrateStorageInfo(){
  const el = $('settings-storage');
  if(!el) return;
  try{
    if(navigator.storage && navigator.storage.estimate){
      const { usage, quota } = await navigator.storage.estimate();
      const used = usage ? (usage / 1048576).toFixed(1) : '0';
      const total = quota ? (quota / 1073741824).toFixed(1) : '?';
      el.textContent = `${used} MB used of about ${total} GB available`;
    } else {
      el.textContent = 'Storage estimate is not available in this browser';
    }
  }catch(err){
    el.textContent = 'Storage estimate is not available';
  }
}

/* ═══════════════════════════════════════════════════════════
   ABOUT
   ═══════════════════════════════════════════════════════════ */
function _aboutHTML(){
  return `
    <div class="settings-section">
      <div class="settings-section-title">Sahib Islamic Companion</div>
      <div class="settings-section-desc">
        A local-first PWA for adhkar, prayer times, the Hijri calendar, the 99 Names and a small Islamic library.
        No accounts, no analytics, no cloud sync. Your data stays in your browser.
      </div>
      <div class="settings-note settings-attribution">
        <strong>Version:</strong> v2.10.68 · service worker v2.10.68<br>
        <strong>Privacy:</strong> the only network requests are for content you ask for — AlAdhan prayer times,
        Open-Meteo geocoding, and books/audio already shipped with the app.
      </div>
    </div>

    <div class="settings-section">
      <div class="settings-section-title">Sources & licences</div>
      <div class="settings-note settings-attribution">
        <strong>Adhkar:</strong> Hisn al-Muslim · <a href="https://sunnah.com/hisn" target="_blank" rel="noopener">sunnah.com</a><br>
        <strong>Prayer times:</strong> <a href="https://aladhan.com" target="_blank" rel="noopener">AlAdhan API</a> by default; offline calculation uses
        <a href="https://github.com/batoulapps/adhan-js" target="_blank" rel="noopener">Adhan.js</a> (MIT, © Batoul Apps).<br>
        <strong>Prayer feature study:</strong> <a href="https://github.com/Khiro95/Awqat-Salaat" target="_blank" rel="noopener">Awqat Salaat</a> by Khiro95 (MIT, © 2023 Khiro) —
        used as a behavioural reference for reminders, CSV import and per-prayer adjustments. No Awqat Salaat code or audio assets are bundled.<br>
        <strong>Themes:</strong> Catppuccin, Aura, Dracula, Tokyo Night, Rosé Pine (community palettes).<br>
        <strong>Fonts:</strong> Amiri, Tajawal, Cairo, Inter — SIL Open Font License.<br>
        <strong>Icons:</strong> Lucide (ISC). <strong>PDF:</strong> EmbedPDF / PDFium.
      </div>
    </div>

    <div class="settings-section">
      <div class="settings-row">
        <div class="settings-row-info">
          <div class="settings-row-title">Report an issue</div>
          <div class="settings-row-desc">Sahib is developed in the open.</div>
        </div>
        <div class="settings-row-actions">
          <a class="io-btn" href="https://github.com/Nobodyssssy/adkar/issues" target="_blank" rel="noopener">GitHub issues</a>
        </div>
      </div>
    </div>`;
}

/* Expose for inline handlers (classic scripts are global already, explicit for safety). */
window.openSettings = openSettings;
window.closeSettings = closeSettings;
window.setSettingsTab = setSettingsTab;
window.updateSettingsUI = updateSettingsUI;
