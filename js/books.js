'use strict';

/* ==========================================================================
   Books - helpers
   - Search by Arabic/English title, author, description
   - Filter by category
   - Resolve file paths to URLs
   - Reading progress + bookmarks (via store.meta)
   ========================================================================== */

const BOOKS_BASE_PATH = 'https://sahib-proxy.sahib-app.workers.dev/books/';

/* --- Basic lookups ----------------------------------------------------- */

function allBooks(){
  if(typeof getLocalBooks !== 'function') return BOOKS;
  return BOOKS.concat(getLocalBooks());
}

function getBookById(id){
  return BOOKS.find(b => b.id === id) || getLocalBookById(id) || null;
}

function getBooksByCategory(categoryId){
  if(!categoryId || categoryId === 'all') return allBooks();
  if(categoryId === 'local') return getLocalBooks();
  return BOOKS.filter(b => b.category === categoryId);
}

function getCategoryById(id){
  if(id === 'local'){
    return { id: 'local', ar: 'كتبي المحلية', en: 'My local books', color: '#7aa2f7' };
  }
  return BOOK_CATEGORIES.find(c => c.id === id) || null;
}

/* --- Search ------------------------------------------------------------ */
function searchBooks(query){
  const q = (query || '').trim();
  if(!q) return allBooks();

  const nqAr = (typeof normalizeAr === 'function') ? normalizeAr(q) : q.toLowerCase();
  const nqEn = (typeof normalizeEn === 'function') ? normalizeEn(q) : q.toLowerCase();

  return allBooks().filter(b => {
    const hayAr = [b.titleAr, b.author, b.descriptionAr || ''].join(' ');
    const hayEn = [b.titleEn || '', b.authorEn || '', b.descriptionEn || ''].join(' ');
    const normAr = (typeof normalizeAr === 'function') ? normalizeAr(hayAr) : hayAr.toLowerCase();
    const normEn = (typeof normalizeEn === 'function') ? normalizeEn(hayEn) : hayEn.toLowerCase();

    return (nqAr && normAr.includes(nqAr)) || (nqEn && normEn.includes(nqEn));
  });
}

/* --- Path resolution --------------------------------------------------- */
function resolveBookPath(book){
  if(!book) return '';
  if(book.isLocal) return '';          /* resolved via IndexedDB, not a path */
  if(!book.file) return '';
  return BOOKS_BASE_PATH + book.file.split('/').map(encodeURIComponent).join('/');
}

/* --- Category counts --------------------------------------------------- */
function getCategoryBookCounts(){
  const counts = {};
  BOOK_CATEGORIES.forEach(c => {
    counts[c.id] = BOOKS.filter(b => b.category === c.id).length;
  });
  if(typeof getLocalBooks === 'function'){
    counts['local'] = getLocalBooks().length;
  }
  return counts;
}

/* ==========================================================================
   Reading progress - IndexedDB via store.meta
   Shape: { [bookId]: { page, totalPages, lastRead } }
   ========================================================================== */

let _readingProgress = null;
let _readingProgressLoaded = false;

async function loadReadingProgress(){
  /* Callers such as the header star may run before IndexedDB answers. An empty
     object is not proof that progress was loaded, so track the load explicitly
     instead of trusting the cache's truthiness. */
  if(_readingProgressLoaded && _readingProgress !== null) return _readingProgress;
  const stored = await store.getMeta('books-progress');
  _readingProgress = (stored && typeof stored === 'object') ? stored : {};
  _readingProgressLoaded = true;
  return _readingProgress;
}

function getBookProgress(bookId){
  if(!_readingProgress) return null;
  return _readingProgress[bookId] || null;
}

async function saveBookProgress(bookId, page, totalPages){
  if(!_readingProgress) await loadReadingProgress();
  _readingProgress[bookId] = {
    page: page || 1,
    totalPages: totalPages || null,
    lastRead: Date.now(),
  };
  await store.setMeta('books-progress', _readingProgress);
}

async function clearBookProgress(bookId){
  if(!_readingProgress) await loadReadingProgress();
  delete _readingProgress[bookId];
  await store.setMeta('books-progress', _readingProgress);
}

/* ==========================================================================
   Bookmarks - per book, list of page numbers
   ========================================================================== */

let _bookmarks = null;

async function loadBookmarks(){
  if(_bookmarks) return _bookmarks;
  const stored = await store.getMeta('books-bookmarks');
  _bookmarks = (stored && typeof stored === 'object') ? stored : {};
  /* One-shot cleanup: the pin feature was removed. Delete any residual `_pinned`. */
  if('_pinned' in _bookmarks){
    delete _bookmarks['_pinned'];
    await store.setMeta('books-bookmarks', _bookmarks);
  }
  return _bookmarks;
}

function getBookBookmarks(bookId){
  if(!_bookmarks) return [];
  return _bookmarks[bookId] || [];
}

async function toggleBookBookmark(bookId, page){
  if(!_bookmarks) await loadBookmarks();
  const list = _bookmarks[bookId] || [];
  const idx = list.indexOf(page);
  if(idx >= 0) list.splice(idx, 1);
  else list.push(page);
  list.sort((a, b) => a - b);
  _bookmarks[bookId] = list;
  await store.setMeta('books-bookmarks', _bookmarks);
  return list;
}

function isBookPageBookmarked(bookId, page){
  if(!_bookmarks) return false;
  return (_bookmarks[bookId] || []).includes(page);
}

/* ==========================================================================
   Beginner path - curated reading order for newcomers.
   Virtual category id: '__beginner' (double underscore = not a real category).
   ========================================================================== */

const BEGINNER_BOOK_IDS = [
  'quran-tadabbur-amal',
  'tafsir-sadi',
  'jazariyyah',
  'bukhari-maktabah',
  'sharh-arbaeen-nawawi',
  'riyad-salihin',
  'tawhid-haqq-allah',
  'ma-la-yasa-u-jahl',
  'manhaj-salikin',
  'hisn-muslim',
];

const BEGINNER_BOOK_NOTES = {
  'quran-tadabbur-amal':  { ar: 'ابدأ من هنا: كيف تتعامل مع القرآن تدبرًا وعملًا.', en: 'Start here: how to engage the Quran with reflection and action.' },
  'tafsir-sadi':          { ar: 'تفسير مختصر واضح تقرؤه يوميًا مع وردك.', en: 'A short, clear tafsir to read daily alongside your portion.' },
  'jazariyyah':           { ar: 'أساسيات التجويد قبل التعمق في التلاوة.', en: 'Tajweed basics before deeper recitation.' },
  'bukhari-maktabah':     { ar: 'أساس السنة: صحيح البخاري.', en: 'The foundation of Sunnah: Sahih al-Bukhari.' },
  'sharh-arbaeen-nawawi': { ar: 'أربعون حديثًا مع شرح مبسط: بوابة الحديث.', en: 'Forty hadiths with simple commentary: the gateway to hadith.' },
  'riyad-salihin':        { ar: 'حديث يومي يبني عادة القراءة.', en: 'A daily hadith to build a steady habit.' },
  'tawhid-haqq-allah':    { ar: 'أصل التوحيد: حق الله على العبيد.', en: 'The core of monotheism: the right of Allah upon His servants.' },
  'ma-la-yasa-u-jahl':    { ar: 'ما لا يسع المسلم جهله: أساسيات العبادة والأخلاق.', en: 'Essentials of worship and manners every Muslim must know.' },
  'manhaj-salikin':       { ar: 'ملخص فقهي واضح للسالك المبتدئ.', en: 'A clear fiqh summary for the beginner.' },
  'hisn-muslim':          { ar: 'تطبيق عملي: أذكار اليوم والليلة.', en: 'Practical application: daily and nightly adhkar.' },
};

function isBeginnerCategoryId(id){
  return id === '__beginner';
}

function getBeginnerBooks(){
  return BEGINNER_BOOK_IDS
    .map(id => getBookById(id))
    .filter(Boolean);
}

function getBeginnerBookNote(bookId){
  const n = BEGINNER_BOOK_NOTES[bookId];
  if(!n) return null;
  const lang = (typeof _booksLang === 'string') ? _booksLang : 'ar';
  return lang === 'ar' ? n.ar : n.en;
}

/* ==========================================================================
   Local books - user uploads, stored in IndexedDB as Blob.
   ========================================================================== */

const LOCAL_BOOK_LIMITS = {
  single:  500 * 1024 * 1024,        /* 500 MB hard cap per file */
  warn:    900 * 1024 * 1024,        /* 900 MB soft cap: confirm before adding */
  refuse: 1229 * 1024 * 1024,        /* ~1.2 GB hard cap for the whole store */
};

let _localBooks = null;   /* in-memory cache: array of metadata objects (no Blob) */
let _localBooksBytes = 0; /* total bytes currently stored */

async function loadLocalBooks(){
  if(_localBooks) return _localBooks;
  const rows = await db.localBooks.getAll();
  _localBooks = [];
  _localBooksBytes = 0;
  rows.forEach(r => {
    _localBooksBytes += (r.size || 0);
    _localBooks.push({
      id: r.id,
      titleAr: r.titleAr || '',
      titleEn: r.titleEn || '',
      author:  r.author  || '',
      authorEn: r.authorEn || '',
      descriptionAr: r.descriptionAr || '',
      descriptionEn: r.descriptionEn || '',
      size: r.size || 0,
      addedAt: r.addedAt || 0,
      category: 'local',
      isLocal: true,
    });
  });
  _localBooks.sort((a, b) => (b.addedAt || 0) - (a.addedAt || 0));
  return _localBooks;
}

function getLocalBooks(){
  return _localBooks ? [..._localBooks] : [];
}

function getLocalBookById(id){
  if(!_localBooks) return null;
  return _localBooks.find(b => b.id === id) || null;
}

function getLocalBooksBytes(){
  return _localBooksBytes;
}

async function addLocalBookFromFile(file, overrides){
  if(!file) throw new Error('No file');

  if(file.size > LOCAL_BOOK_LIMITS.single){
    throw new Error(`File is ${(file.size/1048576).toFixed(1)} MB - over the ${LOCAL_BOOK_LIMITS.single/1048576} MB per-file limit.`);
  }

  const totalAfter = _localBooksBytes + file.size;
  if(totalAfter > LOCAL_BOOK_LIMITS.refuse){
    throw new Error(`Adding this file would exceed the ${Math.round(LOCAL_BOOK_LIMITS.refuse/1048576)} MB local storage limit.`);
  }

  if(totalAfter > LOCAL_BOOK_LIMITS.warn){
    const ok = confirm(`This will bring local storage to about ${Math.round(totalAfter/1048576)} MB. Continue?`);
    if(!ok) throw new Error('Cancelled by user');
  }

  const id = 'local-' + Date.now() + '-' + Math.floor(Math.random()*1e6);
  const baseName = (file.name || 'Untitled').replace(/\.pdf$/i, '');
  const now = Date.now();

  const title = (overrides && overrides.title) || baseName;
  const author = (overrides && overrides.author) || '';

  const record = {
    id,
    blob: file,
    size: file.size,
    addedAt: now,
    titleAr: title,
    titleEn: title,
    author,
    authorEn: author,
    descriptionAr: (overrides && overrides.description) || '',
    descriptionEn: (overrides && overrides.description) || '',
  };

  await db.localBooks.put(record);

  if(!_localBooks) await loadLocalBooks();
  _localBooks.unshift({
    id,
    titleAr: title,
    titleEn: title,
    author,
    authorEn: author,
    descriptionAr: record.descriptionAr,
    descriptionEn: record.descriptionEn,
    size: file.size,
    addedAt: now,
    category: 'local',
    isLocal: true,
  });
  _localBooksBytes += file.size;

  return getLocalBookById(id);
}

async function updateLocalBookMeta(id, patch){
  const row = await db.localBooks.get(id);
  if(!row) return null;
  Object.assign(row, patch);
  await db.localBooks.put(row);

  if(!_localBooks) await loadLocalBooks();
  const cached = _localBooks.find(b => b.id === id);
  if(cached) Object.assign(cached, patch);
  return cached || null;
}

async function deleteLocalBook(id){
  const row = await db.localBooks.get(id);
  await db.localBooks.delete(id);
  if(_localBooks){
    _localBooks = _localBooks.filter(b => b.id !== id);
  }
  if(row) _localBooksBytes = Math.max(0, _localBooksBytes - (row.size || 0));

  /* Drop the cached cover so it does not leak in the meta store */
  if(typeof store !== 'undefined'){
    try{
      const stored = await store.getMeta('book-covers-local');
      if(stored && typeof stored === 'object' && id in stored){
        delete stored[id];
        await store.setMeta('book-covers-local', stored);
      }
    }catch(e){}
  }
}

async function deleteAllLocalBooks(){
  await db.localBooks.clear();
  _localBooks = [];
  _localBooksBytes = 0;
  if(typeof store !== 'undefined'){
    try{ await store.setMeta('book-covers-local', {}); }catch(e){}
  }
}

async function getLocalBookBlobUrl(id){
  const row = await db.localBooks.get(id);
  if(!row || !row.blob) return null;
  return URL.createObjectURL(row.blob);
}