'use strict';

/* Offline PDF cache. Catalog permissions govern new downloads;
   existing user caches keep the same bucket and URL identities. */

const OFFLINE_BOOKS_CACHE = 'sahib-books';
const OFFLINE_BOOKS_BASE  = 'https://sahib-proxy.sahib-app.workers.dev/books/';

/* Derived from the canonical catalog; cache names and legacy URLs stay stable. */
const ALL_KNOWN_BOOK_URLS = Object.fromEntries(BOOKS.filter(b=>b.file).map(b=>[b.id,resolveBookPath(b)]));
const BEGINNER_BOOK_URLS = Object.fromEntries(BOOKS.filter(b=>b.readingOrder).map(b=>[b.id,resolveBookPath(b)]));
const LARGE_BOOK_URLS = {};

/* Build a URL from an id. Falls back to the current resolveBookPath helper
   when the id is unknown (e.g. non-beginner books from BOOKS). */
function offlineBookUrl(id){
  if(ALL_KNOWN_BOOK_URLS[id]) return ALL_KNOWN_BOOK_URLS[id];
  if(typeof resolveBookPath === 'function'){
    const b = (typeof getBookById === 'function') ? getBookById(id) : null;
    if(b) return resolveBookPath(b);
  }
  return null;
}

async function offlineBooksCache(){
  return caches.open(OFFLINE_BOOKS_CACHE);
}

async function isBookCached(id){
  const url = offlineBookUrl(id);
  if(!url) return false;
  const c = await offlineBooksCache();
  const r = await c.match(url);
  return !!r;
}

async function listCachedBookIds(){
  const out = [];
  for(const id of Object.keys(ALL_KNOWN_BOOK_URLS)){
    if(await isBookCached(id)) out.push(id);
  }
  return out;
}

async function cacheBookById(id, signal){
  const url = offlineBookUrl(id);
  if(!url) throw new Error('Unknown book id: ' + id);
  const c = await offlineBooksCache();
  const existing = await c.match(url);
  if(existing) return { id, cached: true, skipped: true };
  if(!getBookById(id)?.downloadAllowed) throw new Error('Download unavailable: redistribution permission has not been verified.');
  const res = await fetch(url, { signal });
  if(!res.ok) throw new Error('HTTP ' + res.status + ' for ' + id);
  await c.put(url, res.clone());
  // Notify UI to update the cached count
  if (window.OFFLINE_UI && typeof window.OFFLINE_UI.refresh === 'function') {
    window.OFFLINE_UI.refresh();
  }
  return { id, cached: true, skipped: false };
}

async function cacheBeginnerBooks(onProgress, signal){
  const ids = BOOKS.filter(b=>b.readingOrder && b.downloadAllowed).map(b=>b.id);
  let done = 0;
  for(const id of ids){
    if(signal && signal.aborted) throw new Error('aborted');
    await cacheBookById(id, signal);
    done++;
    if(typeof onProgress === 'function') onProgress(done, ids.length, id);
  }
  return done;
}

async function clearOfflineBooks(){
  await caches.delete(OFFLINE_BOOKS_CACHE);
}

/* Expose for inline handlers and for the reader to check cached state. */
window.OFFLINE_BOOKS = {
  CACHE: OFFLINE_BOOKS_CACHE,
  BEGINNER_BOOK_URLS,
  LARGE_BOOK_URLS,
  ALL_KNOWN_BOOK_URLS,
  offlineBookUrl,
  isBookCached,
  listCachedBookIds,
  cacheBookById,
  cacheBeginnerBooks,
  clearOfflineBooks,
};