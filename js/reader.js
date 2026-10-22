'use strict';

let _pdfEngine = null;
let _pdfDocs = {};

async function initPdfEngine(){
  if(_pdfEngine) return _pdfEngine;

  try{
    const enginesMod = await import('./vendor/embedpdf/engines/dist/lib/pdfium/index.js');
    const convertersMod = await import('./vendor/embedpdf/engines/dist/lib/converters/index.js');
    const pdfiumMod = await import('./vendor/embedpdf/pdfium/dist/index.browser.js');

    const wasmUrl = 'js/vendor/embedpdf/pdfium/dist/pdfium.wasm';
    const response = await fetch(wasmUrl);
    if(!response.ok) throw new Error('pdfium.wasm not found at ' + wasmUrl);
    const wasmBinary = await response.arrayBuffer();

    const pdfiumModule = await pdfiumMod.init({ wasmBinary });
    const native = new enginesMod.PdfiumNative(pdfiumModule);
    _pdfEngine = new enginesMod.PdfEngine(native, {
      imageConverter: convertersMod.browserImageDataToBlobConverter,
    });

    console.log('[reader] PDFium engine ready');
    return _pdfEngine;
  }catch(err){
    console.error('[reader] engine init failed', err);
    throw err;
  }
}

async function loadPdfDocument(bookId, overrideUrl){
  if(_pdfDocs[bookId]) return _pdfDocs[bookId];

  const book = getBookById(bookId);
  if(!book) throw new Error('Book not found');

  const engine = await initPdfEngine();
  let doc;
  if(book.isLocal){
    // WebView2 custom HTTPS origins cannot reliably fetch their own blob URLs.
    // Read the existing IndexedDB Blob directly, without a second URL transport.
    const row = await db.localBooks.get(bookId);
    if(!row || !row.blob) throw new Error('Local book not found');
    doc = await engine.openDocumentBuffer({ id: bookId, content: await row.blob.arrayBuffer() }).toPromise();
  }else{
    const url = overrideUrl || resolveBookPath(book);
    if(!url) throw new Error('No source URL for book');
    doc = await engine.openDocumentUrl({ id: bookId, url }).toPromise();
  }

  const wrapped = {
    numPages: doc.pages.length,
    _doc: doc,
    _pages: doc.pages,
    getPage: async (pageNum) => doc.pages[pageNum - 1],
    getOutline: async () => [],
    getMetadata: async () => ({ info: { Title: null, Author: null } }),
  };

  _pdfDocs[bookId] = wrapped;
  return wrapped;
}

function getCachedPdf(bookId){
  return _pdfDocs[bookId] || null;
}

function clearPdfCache(bookId){
  if(bookId){
    delete _pdfDocs[bookId];
  } else {
    _pdfDocs = {};
  }
}

const COVER_WIDTH = 320;
const COVER_CACHE_KEY = 'book-covers-v2';

let _coverCache = null;
let _legacyCoverCache = {};

async function loadCoverCache(){
  if(_coverCache) return _coverCache;
  const stored = await store.getMeta(COVER_CACHE_KEY);
  _legacyCoverCache = await store.getMeta('book-covers') || {};
  _coverCache = (stored && typeof stored === 'object') ? stored : {};
  return _coverCache;
}

async function saveCoverCache(){
  await store.setMeta(COVER_CACHE_KEY, _coverCache || {});
}

function getCachedCover(bookId){
  if(!_coverCache) return null;
  return _coverCache[bookId] || _legacyCoverCache[bookId] || null;
}

const _coverJobs = new Map();
function generateBookCover(bookId){
  if(_coverJobs.has(bookId)) return _coverJobs.get(bookId);
  const job = _renderBookCover(bookId).finally(() => _coverJobs.delete(bookId));
  _coverJobs.set(bookId,job);
  return job;
}
async function _renderBookCover(bookId){
  await loadCoverCache();

  const cached = _coverCache[bookId];
  if(cached) return cached;

  try{
    const book = getBookById(bookId);
    if(!book) return null;

    const engine = await initPdfEngine();
    const url = resolveBookPath(book);

    /* Open a fresh document just for the cover render */
    const doc = await engine.openDocumentUrl({ id: 'cover-' + bookId, url }).toPromise();
    const page = doc.pages[0];

    const baseWidth = page.size.width;
    const scale = COVER_WIDTH / baseWidth;

    const blob = await engine.renderPage(doc, page, {
      scaleFactor: scale,
      dpr: 1,
      imageType: 'image/jpeg',
    }).toPromise();

    const dataUrl = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });

    /* Close the doc after use if the API exposes it */
    if(typeof engine.closeDocument === 'function'){
      try{ await engine.closeDocument(doc).toPromise(); }catch(e){ /* ignore */ }
    }

    _coverCache[bookId] = dataUrl;
    await saveCoverCache();
    return dataUrl;

  }catch(err){
    console.warn('[reader] cover generation failed for', bookId, err);
    return null;
  }
}

async function attachBookCover(bookId, element){
  if(!element) return;
  await loadCoverCache();

  const cached = getCachedCover(bookId);
  if(cached){
    element.innerHTML = '<img src="' + cached + '" alt="">';
    if(_coverCache[bookId]) return;
  }

  generateBookCover(bookId).then(dataUrl => {
    if(document.body.contains(element)){
      if(dataUrl) element.innerHTML = '<img src="' + dataUrl + '" alt="">';
      else if(!cached) element.innerHTML = '<span class="book-cover-unavailable">' + icon('book-open',24) + '<small>Preview unavailable</small></span>';
    }
  });
}

async function generateCoversForGrid(){
  await loadCoverCache();

  const cards = document.querySelectorAll('[id^="cover-"]');
  for(const card of cards){
    const bookId = card.id.replace(/^cover-/, '');
    await attachBookCover(bookId, card);
  }
}

async function ensureAllCovers(){
  await loadCoverCache();

  const missing = BOOKS.filter(b => !getCachedCover(b.id));
  if(!missing.length) return;

  for(const book of missing){
    await generateBookCover(book.id);
  }
}

function getCoverCacheStats(){
  if(!_coverCache) return { count: 0, size: 0 };
  const all = {..._legacyCoverCache,..._coverCache};
  const keys = Object.keys(all);
  let size = 0;
  for(const cache of [_legacyCoverCache,_coverCache]) Object.values(cache).forEach(value => {size += (value || '').length;});
  return { count: keys.length, size };
}

async function clearCoverCache(){
  _coverCache = {};
  _legacyCoverCache = {};
  await Promise.all([saveCoverCache(),store.setMeta('book-covers',{})]);
}

async function renderPageToCanvas(pdf, pageNum, canvas, containerWidth, zoomFactor){
  zoomFactor = zoomFactor || 1;

  const page = await pdf.getPage(pageNum);
  const engine = await initPdfEngine();

  const baseWidth = page.size.width;
  const fitScale = containerWidth / baseWidth;
  const scale = fitScale * zoomFactor;

  const blob = await engine.renderPage(pdf._doc, page, {
    scaleFactor: scale,
    dpr: window.devicePixelRatio || 1,
    imageType: 'image/png',
  }).toPromise();

  const img = await new Promise((resolve, reject) => {
    const i = new Image();
    i.onload = () => resolve(i);
    i.onerror = reject;
    i.src = URL.createObjectURL(blob);
  });

  canvas.width = img.naturalWidth;
  canvas.height = img.naturalHeight;
  canvas.style.width = (baseWidth * scale) + 'px';
  canvas.style.height = (page.size.height * scale) + 'px';
  canvas.style.maxWidth = 'none';
  canvas.style.maxHeight = 'none';

  const ctx = canvas.getContext('2d');
  ctx.drawImage(img, 0, 0);
  URL.revokeObjectURL(img.src);

  return { width: baseWidth * scale, height: page.size.height * scale };
}

async function getPdfOutline(pdf){
  return [];
}

async function getPdfMetadata(pdf){
  return { title: null, author: null, pages: pdf.numPages };
}

function enterFullscreen(el){
  if(el.requestFullscreen) el.requestFullscreen().catch(() => {});
}
function exitFullscreen(){
  if(document.fullscreenElement) document.exitFullscreen().catch(() => {});
}

/* ==========================================================================
   Local book covers - rendered page 1, cached separately from static books.
   ========================================================================== */

const COVER_CACHE_LOCAL_KEY = 'book-covers-local';
let _coverCacheLocal = null;

async function loadCoverCacheLocal(){
  if(_coverCacheLocal) return _coverCacheLocal;
  const stored = await store.getMeta(COVER_CACHE_LOCAL_KEY);
  _coverCacheLocal = (stored && typeof stored === 'object') ? stored : {};
  return _coverCacheLocal;
}

async function saveCoverCacheLocal(){
  await store.setMeta(COVER_CACHE_LOCAL_KEY, _coverCacheLocal || {});
}

function getCachedLocalCover(bookId){
  if(!_coverCacheLocal) return null;
  return _coverCacheLocal[bookId] || null;
}

async function generateLocalBookCover(bookId){
  await loadCoverCacheLocal();

  const cached = getCachedLocalCover(bookId);
  if(cached) return cached;

  try{
    const book = getLocalBookById(bookId);
    if(!book) return null;

    const row = await db.localBooks.get(bookId);
    if(!row || !row.blob) return null;

    const engine = await initPdfEngine();
    const doc = await engine.openDocumentBuffer({ id: 'cover-' + bookId, content: await row.blob.arrayBuffer() }).toPromise();
    const page = doc.pages[0];

    const baseWidth = page.size.width;
    const scale = COVER_WIDTH / baseWidth;

    const blob = await engine.renderPage(doc, page, {
      scaleFactor: scale,
      dpr: 1,
      imageType: 'image/jpeg',
    }).toPromise();

    const dataUrl = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });

    if(typeof engine.closeDocument === 'function'){
      try{ await engine.closeDocument(doc).toPromise(); }catch(e){ /* ignore */ }
    }

    _coverCacheLocal[bookId] = dataUrl;
    await saveCoverCacheLocal();
    return dataUrl;

  }catch(err){
    console.warn('[reader] local cover generation failed for', bookId, err);
    return null;
  }
}

async function attachLocalBookCover(bookId, element){
  if(!element) return;
  const dataUrl = await generateLocalBookCover(bookId);
  if(!dataUrl) return;
  element.innerHTML = '';
  const img = document.createElement('img');
  img.src = dataUrl;
  img.alt = '';
  img.loading = 'lazy';
  img.style.width = '100%';
  img.style.height = '100%';
  img.style.objectFit = 'cover';
  img.style.borderRadius = '8px';
  element.appendChild(img);
}
