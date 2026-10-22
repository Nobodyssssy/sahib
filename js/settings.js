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

  for(const [key, value] of Object.entries({theme:state.theme, mode:state.mode, accent:state.accent, font:state.font})){
    document.querySelectorAll(`[data-${key}-option]`).forEach(el => {
      const on = el.getAttribute(`data-${key}-option`) === value;
      el.classList.toggle('active', on);
      el.setAttribute('aria-pressed', String(on));
    });
  }
  document.querySelectorAll('[data-theme-font]').forEach(el=>{const on=document.documentElement.dataset.fontSource==='theme';el.classList.toggle('active',on);el.setAttribute('aria-pressed',String(on));});
  document.querySelectorAll('[data-sidebar-position-option]').forEach(el => {
    const on = el.getAttribute('data-sidebar-position-option') === state.sidebarPosition;
    el.classList.toggle('active', on);
    el.setAttribute('aria-pressed', on ? 'true' : 'false');
  });
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
  updateSettingsUI();
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
  const state = (typeof SAHIB_THEME !== 'undefined') ? SAHIB_THEME.state : { theme: 'catppuccin', mode: 'dark', accent: 'gold', font: 'tajawal', sidebarPosition: 'right' };
  const themes = (typeof SAHIB_THEME !== 'undefined') ? SAHIB_THEME.THEMES : [];
  const accents = (typeof SAHIB_THEME !== 'undefined') ? SAHIB_THEME.accentsForTheme(state.theme) : [];
  const fonts = (typeof SAHIB_THEME !== 'undefined') ? SAHIB_THEME.FONTS : [];

  return `
    <div class="settings-section"><div class="settings-section-title">Interface language</div><div class="segmented"><button data-app-language="en" onclick="SAHIB_I18N.setLanguage('en')">English</button><button data-app-language="ar" onclick="SAHIB_I18N.setLanguage('ar')">العربية</button></div></div>
    <div class="settings-section">
      <div class="settings-section-title">Theme family</div>
      <div class="theme-grid">
        ${themes.map(t => `
          <button type="button" class="theme-card ${state.theme === t.id ? 'active' : ''}" data-theme-option="${t.id}" onclick="setThemeFamily('${t.id}')">
            <span class="theme-preview t-${t.id}" aria-hidden="true">
              <span class="theme-preview-sheet"></span>
              <span class="theme-preview-glyph">ص</span>
            </span>
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
      <div class="settings-section-title">Accent · ${esc((themes.find(t => t.id === state.theme) || {}).label || state.theme)}</div>
      <div class="accent-grid">
        ${accents.map(a => `
          <button type="button" class="accent-option ${state.accent === a.id ? 'active' : ''}" data-accent-option="${a.id}" onclick="setAccentOption('${a.id}')" aria-label="${esc(a.label)} accent">
            <span class="accent-dot dot-${a.id}"></span>
            <span>${esc(a.label)}</span>
          </button>`).join('')}
      </div>
      <div class="settings-section-desc">Accents come from this theme’s own palette. Sahib remembers your choice for each theme.</div>
    </div>

    <div class="settings-section">
      <div class="settings-section-title">Navigation</div>
      <div class="settings-row">
        <div class="settings-row-info">
          <div class="settings-row-title">Sidebar position</div>
          <div class="settings-row-desc">Physical side of the screen. Works independently of text direction.</div>
        </div>
        <div class="settings-row-actions">
          <div class="segmented" role="group" aria-label="Sidebar position">
            <button type="button" class="${state.sidebarPosition === 'left' ? 'active' : ''}" data-sidebar-position-option="left" aria-pressed="${state.sidebarPosition === 'left'}" onclick="setSidebarPositionOption('left')">Left</button>
            <button type="button" class="${state.sidebarPosition === 'right' ? 'active' : ''}" data-sidebar-position-option="right" aria-pressed="${state.sidebarPosition === 'right'}" onclick="setSidebarPositionOption('right')">Right</button>
          </div>
        </div>
      </div>
      <div class="settings-note">The collapse control lives at the top of the sidebar. Its state is remembered on this device.</div>
    </div>

    <div class="settings-section">
      <div class="settings-section-title">Typeface</div><button class="btn-cancel" onclick="setFontOption('theme')" data-theme-font>Use theme font</button>
      <div class="font-grid">
        ${fonts.map(f => `
          <button type="button" class="font-option ${state.font === f.id ? 'active' : ''}" data-font-option="${f.id}" onclick="setFontOption('${f.id}')">
            <span class="font-sample" style="font-family:'${esc(f.label)}',Tajawal,sans-serif">صاحب Aa</span>
            <span>${esc(f.label)}</span><small>${esc(f.hint)}</small>
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
          <div class="settings-row-desc">Sahib · light · sage · Tajawal</div>
        </div>
        <div class="settings-row-actions">
          <button type="button" class="btn-cancel" onclick="resetAppearanceSettings()">Reset</button>
        </div>
      </div>
    </div>`;
}

async function setThemeFamily(id){
  if(typeof SAHIB_THEME === 'undefined') return;
  await SAHIB_THEME.setTheme(id);
  renderSettingsBody();
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

function setSidebarPositionOption(position){
  if(typeof SAHIB_THEME === 'undefined') return;
  SAHIB_THEME.setSidebarPosition(position);
  updateSettingsUI();
}

async function toggleSidebarCollapseOption(){
  if(typeof SAHIB_THEME === 'undefined') return;
  await SAHIB_THEME.toggleSidebarCollapsed();
  updateSettingsUI();
}

async function resetAppearanceSettings(){
  if(typeof SAHIB_THEME === 'undefined') return;
  await SAHIB_THEME.setTheme('sahib');
  await SAHIB_THEME.setMode('light');
  await SAHIB_THEME.setAccent('green');
  await SAHIB_THEME.setFont('theme');
  await SAHIB_THEME.setSidebarPosition('left');
  await SAHIB_THEME.setSidebarCollapsed(false);
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
  const localStandard = await _getLocalAdhan('standard');
  const localFajr = await _getLocalAdhan('fajr');
  const standardSelected = (a.audio.standard === 'local' && !localStandard) ? 'azhar' : a.audio.standard;
  const fajrSelected = (a.audio.fajr === 'local' && !localFajr) ? 'fajr-balakong' : a.audio.fajr;

  return `
    <div class="alerts-panel">
      <section class="alert-master ${a.enabled ? 'is-on' : ''}">
        <div class="alert-master-copy">
          <div class="settings-section-title">Prayer alerts</div>
          <h3>Remember the next prayer</h3>
          <p>${a.enabled
            ? 'A quiet nudge before the prayer and, if you choose, at the moment it enters.'
            : 'Alerts are off. Turn this on to use the per-prayer schedule below.'}</p>
        </div>
        <button type="button" class="switch ${a.enabled ? 'on' : ''}" data-alert-switch="enabled" role="switch" aria-checked="${a.enabled}" onclick="togglePrayerAlertSetting('enabled')" aria-label="Prayer alerts"></button>
      </section>

      <section class="settings-section">
        <div class="alert-setting-grid">
          <div class="settings-row">
            <div class="settings-row-info">
              <div class="settings-row-title">Lead time</div>
              <div class="settings-row-desc">How long before the prayer the reminder appears.</div>
            </div>
            <div class="settings-row-actions">
              <select class="fse" style="width:auto" onchange="setAlertLead(this.value)" aria-label="Reminder lead time">
                ${[5, 10, 15, 20, 30, 45, 60].map(m => `<option value="${m}" ${a.leadMinutes === m ? 'selected' : ''}>${m} min before</option>`).join('')}
              </select>
            </div>
          </div>
          <div class="settings-row">
            <div class="settings-row-info">
              <div class="settings-row-title">At the entered time</div>
              <div class="settings-row-desc">A second reminder when the prayer begins.</div>
            </div>
            <div class="settings-row-actions">
              <button type="button" class="switch ${a.atTime ? 'on' : ''}" data-alert-switch="atTime" role="switch" aria-checked="${a.atTime}" onclick="togglePrayerAlertSetting('atTime')" aria-label="Reminder when the prayer enters"></button>
            </div>
          </div>
        </div>
      </section>

      <section class="settings-section">
        <div class="settings-section-title">Per prayer</div>
        <div class="alert-prayer-list">
          ${PRAYER_ALERTABLE.map(name => {
            const pp = a.perPrayer[name] || { mode: 'off' };
            const mode = pp.mode || (pp.alert === false ? 'off' : 'chime');
            return `
              <div class="alert-prayer-row ${mode === 'off' ? 'is-off' : ''}">
                <div class="alert-prayer-name"><strong>${PRAYER_NAMES_AR[name] || name}</strong><span>${name}</span></div>
                <div class="alert-mode" role="group" aria-label="${name} alert">
                  ${['off', 'chime', 'adhan'].map(value => `
                    <button type="button" class="alert-mode-btn ${mode === value ? 'active' : ''}"
                            data-pp-mode="${name}:${value}" aria-pressed="${mode === value}"
                            onclick="setPerPrayerMode('${name}','${value}')">${value === 'off' ? 'Off' : value === 'chime' ? 'Chime' : 'Adhan'}</button>`).join('')}
                </div>
              </div>`;
          }).join('')}
        </div>
        <div class="settings-section-desc">Off suppresses the alert for that prayer. Chime is a short original tone. Adhan plays the selected recording.</div>
      </section>

      <section class="settings-section">
        <div class="settings-section-title">Adhan audio</div>
        <div class="adhan-audio-grid">
          <div class="adhan-field">
            <label class="adhan-label" for="adhan-standard-select">Standard adhan</label>
            <select class="fse" id="adhan-standard-select" onchange="setAdhanSource('standard', this.value)">
              ${_adhanOptionsHTML('standard', standardSelected, localStandard)}
            </select>
            <div class="adhan-file-meta">${localStandard ? `${esc(localStandard.name)} · ${_audioSize(localStandard.size)} · ${_audioDuration(localStandard.duration)}` : 'Bundled recordings with individual rights notices. Available offline.'}</div>
            <div class="adhan-file-actions">
              <label class="io-btn adhan-file-label">
                <span class="btn-icon" data-icon="upload"></span> Choose local file
                <input type="file" accept="audio/*,.mp3,.ogg,.oga,.wav,.m4a,.aac" onchange="importAdhanFile('standard', this)" hidden>
              </label>
              ${localStandard ? `<button type="button" class="btn-cancel" onclick="clearLocalAdhan('standard')">Remove local file</button>` : ''}
            </div>
          </div>

          <div class="adhan-field">
            <label class="adhan-label" for="adhan-fajr-select">Fajr adhan</label>
            <select class="fse" id="adhan-fajr-select" onchange="setAdhanSource('fajr', this.value)">
              ${_adhanOptionsHTML('fajr', fajrSelected, localFajr)}
            </select>
            <div class="adhan-file-meta">${localFajr ? `${esc(localFajr.name)} · ${_audioSize(localFajr.size)} · ${_audioDuration(localFajr.duration)}` : 'Bundled Fajr recording. The Fajr preview uses this file.'}</div>
            <div class="adhan-file-actions">
              <label class="io-btn adhan-file-label">
                <span class="btn-icon" data-icon="upload"></span> Choose local Fajr file
                <input type="file" accept="audio/*,.mp3,.ogg,.oga,.wav,.m4a,.aac" onchange="importAdhanFile('fajr', this)" hidden>
              </label>
              ${localFajr ? `<button type="button" class="btn-cancel" onclick="clearLocalAdhan('fajr')">Remove local file</button>` : ''}
            </div>
          </div>
        </div>

        <div class="adhan-play-row">
          <button type="button" class="io-btn adhan-preview-btn" onclick="previewAdhanFromSettings('standard')">${icon('play', 14)} Preview standard</button>
          <button type="button" class="io-btn adhan-preview-btn" onclick="previewAdhanFromSettings('fajr')">${icon('play', 14)} Preview Fajr</button>
          <button type="button" class="btn-cancel" onclick="stopAdhanFromSettings()">Stop</button>
          <label class="adhan-volume">Volume
            <input type="range" min="0" max="100" value="${Math.round(a.volume * 100)}" oninput="onSoundVolumeChange(this.value)" aria-label="Adhan volume">
            <span id="settings-volume-label">${Math.round(a.volume * 100)}%</span>
          </label>
          <button type="button" class="io-btn" onclick="previewPrayerChime()">${icon('volume', 14)} Test chime</button>
        </div>

        <div class="settings-note">
          <strong>Local files:</strong> audio is validated, kept in IndexedDB on this device and available offline. It is never uploaded or synced. Clearing browser storage removes it.
        </div>
        <div class="settings-note">
          <strong>Browser limits:</strong> audio starts only after you touch or type on the page. While the installed PWA is fully closed or suspended, browsers may pause timers and stop audio or notifications; Sahib cannot guarantee background playback. Keep Sahib open at prayer time for the most reliable alert.
        </div>
      </section>

      <section class="settings-section">
        <div class="settings-section-title">Notifications</div>
        <div class="settings-row">
          <div class="settings-row-info">
            <div class="settings-row-title">Browser notifications</div>
            <div class="settings-row-desc">Permission: <strong>${esc(permissionLabel)}</strong>. Optional; in-app reminders and audio work without it.</div>
          </div>
          <div class="settings-row-actions">
            <button type="button" class="switch ${a.notify ? 'on' : ''}" data-alert-switch="notify" role="switch" aria-checked="${a.notify}" onclick="togglePrayerAlertSetting('notify')" aria-label="Browser notifications"></button>
            ${permission === 'granted'
              ? `<button type="button" class="btn-cancel" onclick="testPrayerNotification()">Test</button>`
              : `<button type="button" class="btn-save" onclick="enablePrayerNotifications()">Enable</button>`}
          </div>
        </div>
        <div class="settings-note">
          Sahib never asks for notification permission on its own. A notification is still subject to your operating system's focus and battery settings.
        </div>
      </section>
    </div>`;
}

function _adhanOptionsHTML(kind, selected, localMeta){
  const bundled = (typeof ADHAN_BUNDLED !== 'undefined' && ADHAN_BUNDLED[kind]) ? ADHAN_BUNDLED[kind] : [];
  return bundled.map(source =>
    `<option value="${source.id}" ${selected === source.id ? 'selected' : ''}>${esc(source.label)} · ${esc(source.credit)}</option>`
  ).join('') + (localMeta
    ? `<option value="local" ${selected === 'local' ? 'selected' : ''}>Local file · ${esc(localMeta.name)}</option>`
    : '');
}

function _audioSize(bytes){
  const n = Number(bytes) || 0;
  if(n >= 1048576) return `${(n / 1048576).toFixed(1)} MB`;
  return `${Math.max(1, Math.round(n / 1024))} KB`;
}

function _audioDuration(seconds){
  const n = Number(seconds);
  if(!Number.isFinite(n) || n <= 0) return 'duration unknown';
  const m = Math.floor(n / 60);
  const s = Math.round(n % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

async function _getLocalAdhan(kind){
  try{
    if(typeof ADHAN_LOCAL_KEYS === 'undefined') return null;
    return await store.getMeta(ADHAN_LOCAL_KEYS[kind]);
  }catch(err){
    return null;
  }
}

function _readAudioDuration(file){
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const audio = document.createElement('audio');
    let done = false;
    const finish = (value) => {
      if(done) return;
      done = true;
      URL.revokeObjectURL(url);
      resolve(value);
    };
    audio.preload = 'metadata';
    audio.onloadedmetadata = () => finish(Number.isFinite(audio.duration) ? audio.duration : null);
    audio.onerror = () => finish(null);
    setTimeout(() => finish(null), 6000);
    audio.src = url;
  });
}

async function importAdhanFile(kind, input){
  const file = input && input.files && input.files[0];
  if(!file) return;
  const name = file.name || 'recording';
  const extOk = /\.(mp3|ogg|oga|wav|m4a|aac)$/i.test(name);
  const typeOk = !file.type || /^audio\//i.test(file.type);
  const maxBytes = (typeof ADHAN_LOCAL_MAX_BYTES !== 'undefined') ? ADHAN_LOCAL_MAX_BYTES : 20 * 1024 * 1024;
  if(!extOk || !typeOk){
    toast('Choose an MP3, OGG, WAV, M4A or AAC audio file', 'alert');
    input.value = '';
    return;
  }
  if(file.size <= 0 || file.size > maxBytes){
    toast(`Audio must be smaller than ${Math.round(maxBytes / 1048576)} MB`, 'alert');
    input.value = '';
    return;
  }
  const duration = await _readAudioDuration(file);
  const maxSeconds = (typeof ADHAN_LOCAL_MAX_SECONDS !== 'undefined') ? ADHAN_LOCAL_MAX_SECONDS : 720;
  if(duration && duration > maxSeconds){
    toast('That recording is longer than 12 minutes', 'alert');
    input.value = '';
    return;
  }
  try{
    await store.setMeta(ADHAN_LOCAL_KEYS[kind], {
      name,
      type: file.type || 'audio/mpeg',
      size: file.size,
      duration,
      ts: Date.now(),
      blob: file
    });
    await savePrayerPrefs({ alerts: { audio: { [kind]: 'local' } } });
    toast('Audio saved on this device', 'check');
    renderSettingsBody();
  }catch(err){
    console.error('[adhan] save failed', err);
    toast('Could not save that audio file', 'alert');
  }finally{
    input.value = '';
  }
}

async function clearLocalAdhan(kind){
  try{
    if(typeof db !== 'undefined' && db.meta && db.meta.delete){
      await db.meta.delete(ADHAN_LOCAL_KEYS[kind]);
    } else {
      await store.setMeta(ADHAN_LOCAL_KEYS[kind], null);
    }
    const fallback = kind === 'fajr' ? 'fajr-balakong' : 'azhar';
    await savePrayerPrefs({ alerts: { audio: { [kind]: fallback } } });
    if(typeof stopPrayerAdhan === 'function') stopPrayerAdhan();
    toast('Local audio removed', 'check');
    renderSettingsBody();
  }catch(err){
    toast('Could not remove the local audio file', 'alert');
  }
}

async function setAdhanSource(kind, value){
  const allowed = kind === 'fajr' ? ['fajr-balakong', 'qatami-fajr', 'local'] : ['azhar', 'quseir', 'qatami', 'local'];
  const next = allowed.includes(value) ? value : allowed[0];
  await savePrayerPrefs({ alerts: { audio: { [kind]: next } } });
  renderSettingsBody();
}

async function previewAdhanFromSettings(kind){
  stopAdhanFromSettings();
  const ok = (typeof PrayerAlerts !== 'undefined')
    ? await PrayerAlerts.previewAdhan(kind)
    : false;
  if(!ok){
    toast('Audio could not play. Check the file and tap Preview again.', 'alert');
  }
}

function stopAdhanFromSettings(){
  if(typeof PrayerAlerts !== 'undefined' && PrayerAlerts.stopAdhan) PrayerAlerts.stopAdhan();
}

async function setPerPrayerMode(name, mode){
  if(!['off', 'chime', 'adhan'].includes(mode)) return;
  const prefs = await getPrayerPrefs();
  const pp = { ...(prefs.alerts.perPrayer[name] || {}) };
  pp.mode = mode;
  pp.alert = mode !== 'off';
  pp.sound = mode !== 'off';
  await savePrayerPrefs({ alerts: { perPrayer: { [name]: pp } } });
  document.querySelectorAll(`[data-pp-mode^="${name}:"]`).forEach(btn => {
    const on = btn.getAttribute('data-pp-mode') === `${name}:${mode}`;
    btn.classList.toggle('active', on);
    btn.setAttribute('aria-pressed', on ? 'true' : 'false');
    btn.closest('.alert-prayer-row')?.classList.toggle('is-off', mode === 'off');
  });
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
        Daily Practice completions, trackers and custom reminders have a separate backup under Practice settings.
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
        <strong>Version:</strong> v2.13.8 · service worker v2.13.8<br>
        <strong>Privacy:</strong> the only network requests are for content you ask for — AlAdhan prayer times,
        Open-Meteo geocoding, and books/audio already shipped with the app. Local adhan files never leave this device.
      </div>
    </div>

    <div class="settings-section">
      <div class="settings-section-title">Sources & licences</div>
      <div class="settings-note settings-attribution">
        <strong>Adhkar:</strong> Hisn al-Muslim · <a href="https://sunnah.com/hisn" target="_blank" rel="noopener">sunnah.com</a><br>
        <strong>Prayer times:</strong> <a href="https://aladhan.com" target="_blank" rel="noopener">AlAdhan API</a> by default; offline calculation uses
        <a href="https://github.com/batoulapps/adhan-js" target="_blank" rel="noopener">Adhan.js</a> (MIT, © Batoul Apps).<br>
        <strong>Prayer feature study:</strong> <a href="https://github.com/Khiro95/Awqat-Salaat" target="_blank" rel="noopener">Awqat Salaat</a> by Khiro95 (MIT, © 2023 Khiro) —
        used as a behavioural reference for reminders, CSV import and per-prayer adjustments. No Awqat Salaat application code is bundled. The two Nasser Al-Qatami recordings are sourced from its repository with separate audio notices.<br>
        <strong>Adhan recordings:</strong>
        <a href="https://freesound.org/people/AhmadAiuby/sounds/683120/" target="_blank" rel="noopener">Al-Azhar Park, Cairo</a> and
        <a href="https://freesound.org/people/AhmadAiuby/sounds/555065/" target="_blank" rel="noopener">Quseir by the sea</a> by Ahmad Aiuby;
        <a href="https://freesound.org/people/aridtrax/sounds/863861/" target="_blank" rel="noopener">Fajr, Balakong</a> by aridtrax.
        These three field recordings are CC0 1.0. The additional Sheikh Nasser Al-Qatami recordings have reserved rights: upstream explicitly credits Sharjah Quran for Fajr. No CC0 or MIT audio rights are claimed. See <a href="assets/adhan/LICENSES.md" target="_blank" rel="noopener">audio provenance and rights notices</a>.<br>
        <strong>Themes:</strong> Catppuccin, Aura, Dracula, Tokyo Night, Rosé Pine (community palettes).<br>
        <strong>Fonts:</strong> Amiri, Tajawal, Cairo, Inter, DM Sans, Manrope.<br>
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
          <a class="io-btn" href="https://github.com/Nobodyssssy/sahib/issues" target="_blank" rel="noopener">GitHub issues</a>
        </div>
      </div>
    </div>`;
}

/* Expose for inline handlers (classic scripts are global already, explicit for safety). */
window.openSettings = openSettings;
window.closeSettings = closeSettings;
window.setSettingsTab = setSettingsTab;
window.updateSettingsUI = updateSettingsUI;
