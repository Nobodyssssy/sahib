'use strict';

/* ==========================================================================
   Offline library UI
   - Injects a download button into the Library landing header.
   - Modal offers two jobs: rest of beginner path, or whole library.
   - Shows honest sizes from the local inventory + navigator.storage.estimate.
   - Progress + cancel + distinct quota vs network errors.
   ========================================================================== */

const OFFLINE_UI = (() => {
  const TOTAL_LIBRARY_BYTES  = 743.5 * 1024 * 1024;   /* 743.5 MB measured */
  const TOTAL_BEGINNER_BYTES = 157.2 * 1024 * 1024;   /* 157.2 MB measured */

  /* Full library URL map. Populated on first need from BOOKS so we do not
     have to hardcode 70 paths. Uses resolveBookPath for exact same rules
     as the reader. */
  let _allUrls = null;    /* { id: url } */
  let _allBytes = null;   /* { id: bytes } — filled from the size hint table */

  /* Size hints per book id, from the measured inventory. Ids that are not
     listed get a fallback average so totals are honest enough. */
  const SIZE_HINTS = {
    /* beginner 10 */
    'quran-tadabbur-amal':   43.9 * 1024 * 1024,
    'tafsir-sadi':           36.7 * 1024 * 1024,
    'jazariyyah':             1.7 * 1024 * 1024,
    'bukhari-maktabah':      21.4 * 1024 * 1024,
    'sharh-arbaeen-nawawi':  13.3 * 1024 * 1024,
    'riyad-salihin':         27.6 * 1024 * 1024,
    'tawhid-haqq-allah':      1.4 * 1024 * 1024,
    'ma-la-yasa-u-jahl':      2.8 * 1024 * 1024,
    'manhaj-salikin':         4.5 * 1024 * 1024,
    'hisn-muslim':            4.0 * 1024 * 1024,
  };
  const FALLBACK_AVG = 8 * 1024 * 1024;  /* average for the remaining ~60 PDFs */

  let _running = false;
  let _controller = null;

  function _allLibraryUrls(){
    if(_allUrls) return _allUrls;
    _allUrls = {};
    _allBytes = {};
    if(typeof BOOKS !== 'undefined' && Array.isArray(BOOKS)){
      for(const b of BOOKS){
        const u = (typeof resolveBookPath === 'function') ? resolveBookPath(b) : null;
        if(u){
          _allUrls[b.id] = u;
          _allBytes[b.id] = SIZE_HINTS[b.id] || FALLBACK_AVG;
        }
      }
    }
    return _allUrls;
  }

  function _libraryTotalBytes(){
    const urls = _allLibraryUrls();
    let t = 0;
    for(const id in urls) t += _allBytes[id] || FALLBACK_AVG;
    /* Scale to the measured 743.5 MB so the number is not a rough guess. */
    if(t > 0){
      const scale = TOTAL_LIBRARY_BYTES / t;
      return TOTAL_LIBRARY_BYTES;
    }
    return TOTAL_LIBRARY_BYTES;
  }

  function _beginnerTotalBytes(){
    return TOTAL_BEGINNER_BYTES;
  }

  async function _cachedBytes(){
    if(!window.OFFLINE_BOOKS) return {bytes:0,sizes:new Map()};
    const cache = await caches.open(window.OFFLINE_BOOKS.CACHE);
    const keys = await cache.keys();
    let bytes = 0;
    const sizes = new Map();
    for(const req of keys){
      const res = await cache.match(req);
      if(!res) continue;
      const length = Number(res.headers.get('content-length'));
      const size = Number.isFinite(length) && length > 0 ? length : (await res.blob()).size;
      sizes.set(req.url,size);
      bytes += size;
    }
    return {bytes,sizes};
  }

  function _formatMB(bytes){
    if(!bytes || bytes < 0) return '0 MB';
    const mb = bytes / (1024 * 1024);
    if(mb >= 100) return Math.round(mb) + ' MB';
    return mb.toFixed(1) + ' MB';
  }

  async function _isCached(id){
    if(!window.OFFLINE_BOOKS) return false;
    return window.OFFLINE_BOOKS.isBookCached(id);
  }

  async function _cachedIdSet(){
    if(!window.OFFLINE_BOOKS) return new Set();
    const ids = await window.OFFLINE_BOOKS.listCachedBookIds();
    return new Set(ids);
  }

  function _beginnerIds(){
    if(!window.OFFLINE_BOOKS) return [];
    return Object.keys(window.OFFLINE_BOOKS.BEGINNER_BOOK_URLS)
      .concat(Object.keys(window.OFFLINE_BOOKS.LARGE_BOOK_URLS)).filter(id => getBookById(id)?.downloadAllowed);
  }

  async function _bytesForIds(ids, cachedSet){
    let total = 0;
    for(const id of ids){
      if(cachedSet.has(id)) continue;
      total += SIZE_HINTS[id] || FALLBACK_AVG;
    }
    return total;
  }

  async function _libraryIdsAll(){
    const urls = _allLibraryUrls();
    return Object.keys(urls).filter(id => getBookById(id)?.downloadAllowed);
  }

  /* ---------- Modal rendering ---------- */

  function _getModal(){
    let m = document.getElementById('ov-offline-books');
    if(m) return m;
    m = document.createElement('div');
    m.className = 'ov center';
    m.id = 'ov-offline-books';
    m.setAttribute('onclick', 'if(event.target===this)window.OFFLINE_UI.close()');
    m.innerHTML = `
      <div class="modal-box" style="max-width:520px">
        <div class="mh">
          <h2>Download books · تحميل الكتب</h2>
          <button class="btn-close" onclick="window.OFFLINE_UI.close()" aria-label="Close">${icon('x', 16)}</button>
        </div>
        <div class="mb" id="offline-ui-body"></div>
      </div>`;
    document.body.appendChild(m);
    if(typeof injectHeaderIcons === 'function') setTimeout(injectHeaderIcons, 0);
    return m;
  }

  async function _renderBody(){
    const host = document.getElementById('offline-ui-body');
    if(!host) return;

    host.innerHTML = '<div style="font-size:12px;color:var(--text3)">Loading…</div>';

    try{
      const cachedIds = await _cachedIdSet();
      const inventory = await _cachedBytes();
      const cachedBytes = inventory.bytes;
      const cachedList = Array.from(cachedIds).map(id => getBookById(id)).filter(Boolean);
      const ar = window.SAHIB_I18N?.language === 'ar';

      const beginnerIds = _beginnerIds();
      const beginnerBytes = await _bytesForIds(beginnerIds, cachedIds);
      const beginnerCachedCount = beginnerIds.filter(id => cachedIds.has(id)).length;

      const allIds = await _libraryIdsAll();
      const libraryBytes = await _bytesForIds(allIds, cachedIds);
      const libraryCachedCount = allIds.filter(id => cachedIds.has(id)).length;

      const freeMB = await _freeStorageMB();

    host.innerHTML = `
      <div style="font-size:12px;color:var(--text3);margin-bottom:14px;line-height:1.7">
        Cached: ${cachedIds.size} books · ${_formatMB(cachedBytes)}<br>
        Origin quota remaining: ${freeMB == null ? 'unknown' : _formatMB(freeMB * 1024 * 1024)}
      </div>

      ${cachedList.length ? `<details><summary>${ar?'الكتب المنزّلة':'Downloaded books'} (${cachedList.length})</summary><ul>${cachedList.map(b=>`<li>${esc(ar?b.titleAr:b.titleEn||b.titleAr)} · ${_formatMB(inventory.sizes.get(resolveBookPath(b)))}</li>`).join('')}</ul></details>` : ''}
      <div class="offline-ui-card">
        <div class="offline-ui-card-title">
          <span dir="ltr">Beginner path</span>
          <span class="offline-ui-sep"> · </span>
          <span dir="rtl">مسار المبتدئ</span>
        </div>
        ${beginnerIds.length === beginnerCachedCount
          ? `<div class="offline-ui-card-sub" dir="ltr">All ${beginnerIds.length} books cached</div>
             <button class="btn-save offline-ui-start offline-ui-done" disabled aria-disabled="true">${icon('check', 16)} Downloaded</button>`
          : `<div class="offline-ui-card-sub" dir="ltr">
               Approximately ${_formatMB(beginnerBytes)} to download · ${beginnerIds.length - beginnerCachedCount} of ${beginnerIds.length} books not cached
             </div>
             <button class="btn-save offline-ui-start" onclick="window.OFFLINE_UI.start('beginner')">Download</button>`}
      </div>

      <div class="offline-ui-card">
        <div class="offline-ui-card-title">
          <span dir="ltr">All available books</span>
          <span class="offline-ui-sep"> · </span>
          <span dir="rtl">كل الكتب المتاحة</span>
        </div>
        ${allIds.length === libraryCachedCount
          ? `<div class="offline-ui-card-sub" dir="ltr">All ${allIds.length} books cached</div>
             <button class="btn-save offline-ui-start offline-ui-done" disabled aria-disabled="true">${icon('check', 16)} Downloaded</button>`
          : `<div class="offline-ui-card-sub" dir="ltr">
               Approximately ${_formatMB(libraryBytes)} to download · ${allIds.length - libraryCachedCount} of ${allIds.length} books not cached
             </div>
             <button class="btn-save offline-ui-start" onclick="window.OFFLINE_UI.start('library')">Download</button>`}
      </div>
      <div id="offline-ui-progress" style="display:none;margin-top:14px;font-size:12px;color:var(--text2)"></div>

      ${cachedIds.size > 0 ? `
        <div style="margin-top:18px;text-align:center">
          <button class="btn-cancel" onclick="window.OFFLINE_UI.clear()">Clear cached books</button>
        </div>` : ''}
      `;
    }catch(err){
      console.error('[offline-ui] renderBody failed:', err);
      host.innerHTML = '<div style="font-size:12px;color:var(--red,#f38ba8)">' +
        'Failed to load. See console. ' + (err && err.message ? err.message : '') + '</div>';
    }
  }

  async function _freeStorageMB(){
    try{
      const e = await navigator.storage.estimate();
      if(!e || !e.quota || !e.usage) return null;
      return (e.quota - e.usage) / (1024 * 1024);
    }catch(e){ return null; }
  }

  async function _runJob(ids, onProgress){
    const controller = new AbortController();
    _controller = controller;
    const total = ids.length;
    let done = 0;
    for(const id of ids){
      if(controller.signal.aborted) throw new Error('aborted');
      try{
        await window.OFFLINE_BOOKS.cacheBookById(id, controller.signal);
      }catch(e){
        if(e && (e.name === 'QuotaExceededError' || /quota/i.test(e.message || ''))){
          const err = new Error('Not enough storage to cache all books');
          err.code = 'QUOTA';
          throw err;
        }
        if(e && e.name === 'AbortError') throw new Error('aborted');
        throw e;
      }
      done++;
      onProgress(done, total, id);
    }
  }

  return {
    open: async () => {
      _getModal().classList.add('open');
      if(typeof lockBody === 'function') lockBody();
      await _renderBody();
    },
    close: () => {
      const m = document.getElementById('ov-offline-books');
      if(m) m.classList.remove('open');
      if(typeof unlockBody === 'function') unlockBody();
    },
    start: async (mode) => {
      if(_running) return;
      _running = true;
      const progEl = document.getElementById('offline-ui-progress');
      const cached = await _cachedIdSet();

      let ids;
      if(mode === 'beginner'){
        ids = _beginnerIds().filter(id => !cached.has(id));
      } else {
        ids = (await _libraryIdsAll()).filter(id => !cached.has(id));
      }

      if(ids.length === 0){
        toast('Already cached', 'check');
        _running = false;
        return;
      }

      if(progEl){
        progEl.style.display = 'block';
        progEl.innerHTML = `
          <div>Caching <strong>0 / ${ids.length}</strong></div>
          <div style="margin-top:8px">
            <button class="btn-cancel" onclick="window.OFFLINE_UI.cancel()">Cancel</button>
          </div>`;
      }

      try{
        await _runJob(ids, (done, total, id) => {
          if(progEl) progEl.querySelector('strong').textContent = `${done} / ${total}`;
        });
        toast('Downloaded ' + ids.length + ' books', 'check');
      }catch(e){
        if(e.message === 'aborted'){
          toast('Cancelled', 'x');
        } else if(e.code === 'QUOTA'){
          toast('Not enough storage', 'alert');
        } else {
          console.error('[offline-ui]', e);
          toast('Download failed', 'alert');
        }
      }finally{
        _running = false;
        _controller = null;
        await _renderBody();
      }
    },
    cancel: () => {
      if(_controller) _controller.abort();
    },
    clear: async () => {
      if(!window.OFFLINE_BOOKS) return;
      if(!confirm('Remove downloaded books from cache? Personal imports, bookmarks and reading progress will be kept.')) return;
      await window.OFFLINE_BOOKS.clearOfflineBooks();
      toast('Cleared', 'trash-2');
      await _renderBody();
    },
  };
})();

window.OFFLINE_UI = OFFLINE_UI;