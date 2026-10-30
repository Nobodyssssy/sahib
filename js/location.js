'use strict';

/* Location picker - online geocoding + manual coordinates
   Primary: Open-Meteo Geocoding API (free, no key)
   Fallback: manual lat/lng input
   Recent cities cached in IndexedDB */

const RECENT_MAX = 5;

async function setManualLocation(lat, lng, label){
  const loc = {
    lat: Number(lat),
    lng: Number(lng),
    label: label || null,
    manual: true,
    ts: Date.now(),
  };
  await store.setMeta('location', loc);
  return loc;
}

async function clearManualLocation(){
  await store.setMeta('location', null);
}

async function getRecentCities(){
  const list = await store.getMeta('recentCities');
  return Array.isArray(list) ? list : [];
}

async function addRecentCity(city){
  const list = await getRecentCities();
  const filtered = list.filter(c =>
    !(c.name === city.name && c.country === city.country)
  );
  filtered.unshift(city);
  const trimmed = filtered.slice(0, RECENT_MAX);
  await store.setMeta('recentCities', trimmed);
}

let _geocodeController = null;

async function geocodeSearch(query){
  const q = (query || '').trim();
  if(q.length < 2) return [];

  if(_geocodeController) _geocodeController.abort();
  _geocodeController = new AbortController();

  const url = `https://geocoding-api.open-meteo.com/v1/search` +
              `?name=${encodeURIComponent(q)}&count=15&language=en&format=json`;

  try{
    const res = await fetch(url, { signal: _geocodeController.signal });
    if(!res.ok) throw new Error('Geocoding failed: ' + res.status);
    const json = await res.json();
    return (json.results || []).map(r => ({
      name: r.name,
      country: r.country || '',
      admin1: r.admin1 || '',
      lat: r.latitude,
      lng: r.longitude,
    }));
  }catch(err){
    if(err.name === 'AbortError') return null;
    console.warn('[geocode]', err);
    return [];
  }
}

function openLocationPicker(){
  ensureLocationModal();
  $('location-search').value = '';
  $('ov-location').classList.add('open');
  lockBody();
  renderLocationList('');
  setTimeout(() => $('location-search').focus(), 200);
}

function closeLocationPicker(){
  $('ov-location').classList.remove('open');
  unlockBody();
}

function ensureLocationModal(){
  if($('ov-location')) return;

  const modal = document.createElement('div');
  modal.className = 'ov center';
  modal.id = 'ov-location';
  modal.setAttribute('onclick', 'if(event.target===this)closeLocationPicker()');
  modal.innerHTML = `
    <div class="modal-box" style="max-width:460px">
      <div class="mh">
        <h2>Choose Location</h2>
        <button class="btn-close" onclick="closeLocationPicker()" data-icon="x"><span class="btn-icon"></span></button>
      </div>
      <div class="mb" style="gap:10px">
        <div class="fg" style="direction:ltr">
          <label class="fl">Search any city worldwide</label>
          <input class="fi" id="location-search" placeholder="e.g. Zurich, Collo, Paris..."
                 oninput="onLocationSearchInput(this.value)" autocomplete="off"
                 dir="ltr" style="text-align:left;direction:ltr">
        </div>
        <div id="location-list" style="max-height:340px;overflow-y:auto;display:flex;flex-direction:column;gap:6px"></div>

        <button class="io-btn" onclick="openCoordsModal()" data-icon="map-pin" style="margin-top:4px;direction:ltr;justify-content:center">
        <span class="btn-icon"></span><span>Enter coordinates manually</span>
        </button>

        <button class="btn-cancel" style="width:100%;direction:ltr;justify-content:center" onclick="useGPSLocation()" data-icon="compass">
          <span class="btn-icon"></span><span>Use my GPS instead</span>
        </button>
      </div>
    </div>`;

  const coordsModal = document.createElement('div');
  coordsModal.className = 'ov center';
  coordsModal.id = 'ov-coords';
  coordsModal.setAttribute('onclick', 'if(event.target===this)closeCoordsModal()');
  coordsModal.style.zIndex = '360';
  coordsModal.innerHTML = `
    <div class="modal-box" style="max-width:360px">
      <div class="mh">
        <h2>Enter coordinates</h2>
        <button class="btn-close" onclick="closeCoordsModal()" data-icon="x"><span class="btn-icon"></span></button>
      </div>
      <div class="mb" style="gap:12px;direction:ltr">
        <div class="fg">
          <label class="fl">Latitude</label>
          <input class="fi" id="loc-lat" type="number" step="0.0001" placeholder="e.g. 37.0072"
                 style="direction:ltr;text-align:left" dir="ltr">
        </div>
        <div class="fg">
          <label class="fl">Longitude</label>
          <input class="fi" id="loc-lng" type="number" step="0.0001" placeholder="e.g. 6.5612"
                 style="direction:ltr;text-align:left" dir="ltr">
        </div>
        <div style="display:flex;gap:8px;margin-top:6px">
          <button class="btn-cancel" style="flex:1" onclick="closeCoordsModal()">Cancel</button>
          <button class="btn-save" style="flex:1" onclick="applyManualCoords()">Apply</button>
        </div>
      </div>
    </div>`;

  document.body.appendChild(modal);
  document.body.appendChild(coordsModal);

  [modal, coordsModal].forEach(m => {
    m.querySelectorAll('[data-icon] > .btn-icon').forEach(span => {
      const name = span.parentElement.getAttribute('data-icon');
      if(name && typeof icon === 'function') span.innerHTML = icon(name, 15);
    });
  });
}

function openCoordsModal(){
  const modal = $('ov-coords');
  if(modal) modal.classList.add('open');
  setTimeout(() => $('loc-lat')?.focus(), 100);
}

function closeCoordsModal(){
  const modal = $('ov-coords');
  if(modal) modal.classList.remove('open');
  const lat = $('loc-lat'); if(lat) lat.value = '';
  const lng = $('loc-lng'); if(lng) lng.value = '';
}

let _geocodeTimer;
function onLocationSearchInput(value){
  clearTimeout(_geocodeTimer);
  const q = value.trim();

  if(q.length < 2){
    renderLocationList('');
    return;
  }

  $('location-list').innerHTML =
    `<div style="text-align:center;color:var(--text3);padding:14px;font-size:12px">Searching...</div>`;

  _geocodeTimer = setTimeout(async () => {
    const results = await geocodeSearch(q);
    if(results === null) return;
    renderLocationResults(results, q);
  }, 350);
}

async function renderLocationList(query){
  const list = $('location-list');
  if(!list) return;

  const q = (query || '').trim();
  if(q.length >= 2) return;

  const recent = await getRecentCities();
  if(!recent.length){
    list.innerHTML = `<div style="text-align:center;color:var(--text3);padding:14px;font-size:12px">
      Type at least 2 characters to search any city worldwide.
    </div>`;
    return;
  }

  list.innerHTML = `
    <div style="font-size:11px;color:var(--text3);font-weight:700;letter-spacing:.05em;text-transform:uppercase;padding:4px 2px">Recent</div>
    ${recent.map(c => cityRowHTML(c, true)).join('')}
  `;
}

function renderLocationResults(results, query){
  const list = $('location-list');
  if(!list) return;

  if(!results.length){
    list.innerHTML = `<div style="text-align:center;color:var(--text3);padding:14px;font-size:12px">
      No city found for "${esc(query)}".<br>Try another spelling or enter coordinates below.
    </div>`;
    return;
  }

  list.innerHTML = results.map(c => cityRowHTML(c, false)).join('');
}

function cityRowHTML(c, isRecent){
  const detail = [c.admin1, c.country].filter(Boolean).join(', ');
  const safeName = c.name.replace(/'/g, "\\'");
  const safeCountry = (c.country || '').replace(/'/g, "\\'");
  const safeAdmin = (c.admin1 || '').replace(/'/g, "\\'");
  return `<button class="loc-row"
                  onclick="applyCity('${safeName}','${safeCountry}','${safeAdmin}',${c.lat},${c.lng})">
    <span class="loc-name">${esc(c.name)}${isRecent ? ' ' + icon('favorite-filled', 12) : ''}</span>
    <span class="loc-detail">${esc(detail)}</span>
  </button>`;
}

function refreshPrayerConsumers(){
  const prayerView = $('view-prayer');
  if(prayerView && prayerView.classList.contains('active')){
    openPrayerView();
    return;
  }

  const homeView = $('view-home');
  if(homeView && homeView.classList.contains('active')){
    renderHome();
  }
}

async function applyCity(name, country, admin, lat, lng){
  const label = [name, admin, country].filter(Boolean).join(', ');
  await setManualLocation(lat, lng, label);
  if(await store.getMeta('regionalMethodAuto')){
    const region=PRAYER_REGIONS.find(r=>r[0]===prayerRegionForLocation({country}));
    if(region&&region[1]!==null){await savePrayerPrefs({method:region[1]});await store.setMeta('prayerRegion',region[0]);}
  }
  await addRecentCity({ name, country, admin1: admin, lat, lng });
  closeLocationPicker();
  toast(`${name} saved`, 'map-pin');

  refreshPrayerConsumers();
}

async function applyManualCoords(){
  const lat = parseFloat($('loc-lat').value);
  const lng = parseFloat($('loc-lng').value);
  if(Number.isNaN(lat) || Number.isNaN(lng)){
    toast('Enter both latitude and longitude', 'alert');
    return;
  }
  if(lat < -90 || lat > 90 || lng < -180 || lng > 180){
    toast('Coordinates out of range', 'alert');
    return;
  }
  await setManualLocation(lat, lng, `${lat.toFixed(3)}, ${lng.toFixed(3)}`);
  closeCoordsModal();
  closeLocationPicker();
  toast('Location saved', 'map-pin');

  refreshPrayerConsumers();
}

async function useGPSLocation(){
  closeLocationPicker();
  toast('Requesting GPS...', 'compass');
  try{
    const loc = await requestGPSLocation();
    await store.setMeta('location', loc);
    toast('GPS location saved', 'map-pin');

    refreshPrayerConsumers();
  }catch(err){
    toast(err.message, 'alert');
  }
}