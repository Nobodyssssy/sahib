'use strict';

/* Books library view - categories first, drill down to books
   Landing: category cards (+ continue-reading strip + beginner banner + search)
   Category: book list for that category
   Local: user-uploaded PDFs
   Detail: book modal with start/continue */

let _booksLang = 'ar';
let _booksCategory = null;
let _booksQuery = '';
let _booksDetailId = null;

async function openBooksView(){
  await loadReadingProgress();
  await loadBookmarks();
  await loadLocalBooks();
  _booksQuery = '';
  _booksCategory = null;
  showView('view-books');
  renderBooksGrid();
}

function closeBooksView(){
  if(_booksCategory){
    closeBooksCategory();
    return;
  }
  goHome();
}

async function renderBooksGrid(){
  const host = $('books-body');
  if(!host) return;

  await loadLocalBooks();
  await renderDesktopLibrary(host);
}

function localBookCardHTML(b){
  const title = _booksLang === 'ar' ? (b.titleAr || b.titleEn) : (b.titleEn || b.titleAr);
  const author = _booksLang === 'ar' ? (b.author || '') : (b.authorEn || b.author || '');
  const sizeMb = (b.size / 1048576).toFixed(1);

  return `<div class="book-card local-book-card" onclick="openLocalBookDetail('${b.id}')">
    <div class="book-cover local-book-cover" id="cover-${b.id}">
      <div class="local-cover-inner" id="local-cover-inner-${b.id}">
        ${icon('book-open', 30)}
        <div class="local-cover-label">PDF</div>
      </div>
    </div>
    <div class="book-info">
      <div class="book-cat-badge local-badge">${_booksLang === 'ar' ? 'محلي' : 'Local'}</div>
      <div class="book-title">${esc(title)}</div>
      ${author ? `<div class="book-author">${esc(author)}</div>` : ''}
      <div class="book-author" style="opacity:.6">${sizeMb} MB</div>
      ${bookReadingProgressHTML(b.id)}
    </div>
    <button class="local-trash-btn" onclick="event.stopPropagation();onDeleteLocalBook('${b.id}')" title="${_booksLang === 'ar' ? 'حذف' : 'Delete'}" aria-label="Delete">
      ${icon('trash-2', 14)}
    </button>
  </div>`;
}

function bookReadingProgressHTML(id){
  const progress = getBookProgress(id);
  const isRead = !!progress;
  const isFinished = progress && progress.totalPages && progress.page >= progress.totalPages;
  let progressLine = '';
  if(isRead && progress.totalPages){
    const pct = Math.round(progress.page / progress.totalPages * 100);
    progressLine = `
      <div class="book-progress-bar">
        <div class="book-progress-fill" style="width:${pct}%"></div>
      </div>
      <div class="book-progress-text">
        ${isFinished
          ? `${icon('check', 12)} ${_booksLang === 'ar' ? 'منتهي' : 'Finished'}`
          : (_booksLang === 'ar'
              ? `صفحة ${progress.page} / ${progress.totalPages}`
              : `Page ${progress.page} of ${progress.totalPages}`)}
      </div>`;
  }

  return progressLine;
}

function bookCardHTML(b){
  const cat = getCategoryById(b.category);
  const progress = getBookProgress(b.id);
  const isRead = !!progress;
  const isFinished = progress && progress.totalPages && progress.page >= progress.totalPages;

  const title = _booksLang === 'ar' ? b.titleAr : (b.titleEn || b.titleAr);
  const author = _booksLang === 'ar' ? b.author : (b.authorEn || b.author);

  const progressLine = bookReadingProgressHTML(b.id);

  return `<div class="book-card" style="--cc:${cat.color}" onclick="openBookDetail('${b.id}')">
    <div class="book-cover" id="cover-${b.id}">
      <div class="book-cover-placeholder">${icon('book-open', 30)}</div>
    </div>
    <div class="book-info">
      <div class="book-cat-badge" style="background:${cat.color}22;color:${cat.color};border-color:${cat.color}">${_booksLang === 'ar' ? cat.ar : cat.en}</div>
      <div class="book-title">${esc(title)}</div>
      <div class="book-author">${esc(author)}</div>
      ${progressLine}
    </div>
    <button class="icon-btn" id="download-card-btn-${b.id}" title="${b.downloadAllowed?(_booksLang==='ar'?'تحميل':'Download'):(_booksLang==='ar'?'استيراد ملف PDF الخاص بي':'Import my PDF')}" onclick="event.stopPropagation(); ${b.downloadAllowed?'onDownloadBookCard':'importCatalogPdf'}('${b.id}')">
      ${icon(b.downloadAllowed?'download':'upload', 16)}
    </button>
  </div>`;
}

function getRecentlyReadBooks(limit){
  limit = limit || 3;
  const progress = _readingProgress || {};

  const seen = new Set();
  const result = [];

  const recent = Object.entries(progress)
    .filter(([_, p]) => p && p.lastRead && (!p.totalPages || p.page < p.totalPages))
    .sort((a, b) => b[1].lastRead - a[1].lastRead);

  for(const [id] of recent){
    if(result.length >= limit) break;
    if(seen.has(id)) continue;
    const book = getBookById(id);
    if(book){
      result.push(book);
      seen.add(id);
    }
  }

  return result.slice(0, limit);
}

function closeBooksCategory(){
  _booksCategory = null;
  _booksQuery = '';
  renderBooksGrid();
}

let _booksSearchTimer;
function onBooksSearch(value){
  clearTimeout(_booksSearchTimer);
  _booksQuery = value;
  _booksSearchTimer = setTimeout(() => {
    renderBooksGrid();
    const input = $('books-search');
    if(input){
      input.focus();
      input.setSelectionRange(input.value.length, input.value.length);
    }
  }, 200);
}

function openBookDetail(id){
  const b = getBookById(id);
  if(!b) return;
  _booksDetailId = id;

  window._booksSavedScroll = window.scrollY || window.pageYOffset || 0;

  ensureBookDetailModal();
  renderBookDetail(b);

  $('ov-book-detail').classList.add('open');
  lockBody();
}

function renderBookDetail(b){
  const cat = getCategoryById(b.category);
  const progress = getBookProgress(b.id);
  const isRead = !!progress && progress.page > 1;
  const isFinished = progress && progress.totalPages && progress.page >= progress.totalPages;
  const ar = _booksLang === 'ar';

  const title = ar ? b.titleAr : (b.titleEn || b.titleAr);
  const author = ar ? b.author : (b.authorEn || b.author);
  const description = ar ? b.descriptionAr : (b.descriptionEn || b.descriptionAr);

  $('book-detail-title').innerHTML = esc(title);

  $('book-detail-body').innerHTML = `
    <div class="book-detail-hero">
      <div class="book-detail-cover" id="detail-cover-${b.id}">
        <div class="book-cover-placeholder">${icon('book-open', 30)}</div>
      </div>
      <div class="book-detail-meta">
        <div class="book-cat-badge" style="background:${cat.color}22;color:${cat.color};border-color:${cat.color}">
          ${ar ? cat.ar : cat.en}
        </div>
        <div class="book-detail-author">${esc(author)}</div>
      </div>
    </div>

    <div class="book-detail-desc ${ar?'ar':'en'}">
      ${esc(description)}
    </div>

    ${isRead ? `
      <div class="book-detail-progress">
        <div class="book-progress-bar">
          <div class="book-progress-fill" style="width:${progress.totalPages ? Math.round(progress.page/progress.totalPages*100) : 0}%"></div>
        </div>
        <div class="book-progress-text">
          ${isFinished
            ? `${icon('check', 12)} ${ar ? 'انتهيت من هذا الكتاب' : 'Finished reading'}`
            : (ar ? `توقفت عند صفحة ${progress.page}` : `Stopped at page ${progress.page}`)}
        </div>
      </div>` : ''}

    ${!b.downloadAllowed ? `<p class="settings-note">${ar?'تحميل جديد غير متاح حتى التحقق من إذن التوزيع. تبقى النسخ المخزنة والملفات الشخصية متاحة.':'New downloads await redistribution permission. Existing cached copies and personal imports remain available.'}</p>` : ''}
    ${b.officialUrl?`<a href="${esc(b.officialUrl)}" target="_blank" rel="noopener noreferrer">${ar?'المصدر الرسمي':'Official source'}</a>`:''}
    <div class="book-detail-actions" id="book-detail-actions-${b.id}" style="display:flex;gap:10px"></div>

    ${isRead ? `
      <button class="book-reset-btn" onclick="resetBookProgress('${b.id}')">
        ${icon('rotate-ccw', 14)} ${ar ? 'إعادة تعيين التقدم' : 'Reset progress'}
      </button>` : ''}
  `;

  const coverEl = $(`detail-cover-${b.id}`);
  if(coverEl && typeof attachBookCover === 'function'){
    setTimeout(() => attachBookCover(b.id, coverEl), 30);
  }
  setTimeout(() => updateDownloadButton(b.id), 30);
}

async function updateDownloadButton(id){
  const target = document.getElementById('book-detail-actions-'+id);
  if(!target) return;
  const availability = await getBookAvailability(id);
  if(!target.isConnected || _booksDetailId!==id) return;
  const ar = _booksLang==='ar';
  const primary = availability.readable
    ? `<button class="btn-save" style="flex:1;padding:14px;font-size:15px" id="book-read-${id}" onclick="readBook('${id}')">${icon('book-open',16)} ${ar?'قراءة':'Read'}</button>`
    : availability.canDownload
      ? `<button class="btn-save" style="flex:1;padding:14px;font-size:15px" id="download-btn-${id}" onclick="onDownloadBook('${id}')">${icon('download',16)} ${ar?'تحميل':'Download'}</button>`
      : '';
  target.innerHTML = primary+`<button class="${primary?'io-btn':'btn-save'}" onclick="importCatalogPdf('${id}')">${icon('upload',16)} ${ar?'استيراد ملف PDF الخاص بي':'Import my PDF'}</button>`;
}

async function updateDownloadButtonCard(id){
  const btn = document.getElementById(`download-card-btn-${id}`);
  if(!btn) return;
  try {
    const availability = await getBookAvailability(id);
    if(!btn.isConnected) return;
    const ar = _booksLang==='ar';
    const action = availability.readable?'readBook':availability.canDownload?'onDownloadBookCard':'importCatalogPdf';
    btn.innerHTML = icon(availability.readable?'book-open':availability.canDownload?'download':'upload',16);
    btn.title = availability.readable?(ar?'قراءة':'Read'):availability.canDownload?(ar?'تحميل':'Download'):(ar?'استيراد ملف PDF الخاص بي':'Import my PDF');
    btn.setAttribute('aria-label',btn.title);
    btn.onclick = event=>{event.stopPropagation();window[action](id);};
  } catch(e){
    console.error('Error checking cache (card)', e);
  }
}

async function allowBookDownload(id){
  const availability = await getBookAvailability(id);
  if(availability.readable){readBook(id);return false;}
  if(availability.canDownload) return true;
  await updateDownloadButton(id);
  await updateDownloadButtonCard(id);
  toast(_booksLang==='ar'?'التحميل غير متاح. استورد ملف PDF الخاص بك أو استخدم المصدر الرسمي.':'Download unavailable. Import your PDF or use the official source.');
  return false;
}

async function onDownloadBook(id){
  if(!await allowBookDownload(id)) return;
  const btn = document.getElementById(`download-btn-${id}`);
  if(!btn) return;
  const ar = _booksLang === 'ar';
  btn.innerHTML = icon('loader', 16);
  btn.disabled = true;
  try {
    await window.OFFLINE_BOOKS.cacheBookById(id);
    toast(ar ? 'تم التحميل' : 'Downloaded', 'check');
    updateDownloadButton(id);
  } catch(e) {
    console.error('Download error', e);
    toast(ar ? 'فشل التحميل' : 'Download failed');
    updateDownloadButton(id);
  }
}

async function onDownloadBookCard(id){
  if(!await allowBookDownload(id)) return;
  const ar = _booksLang === 'ar';
  try {
    await window.OFFLINE_BOOKS.cacheBookById(id);
    toast(ar ? 'تم التحميل' : 'Downloaded', 'check');
    updateDownloadButtonCard(id);
  } catch(e) {
    console.error('Download error', e);
    toast(ar ? 'فشل التحميل' : 'Download failed');
    updateDownloadButtonCard(id);
  }
}

function importCatalogPdf(id){
  const input = document.createElement('input');
  input.type='file';input.accept='.pdf,application/pdf';input.hidden=true;
  input.oncancel=()=>input.remove();
  input.onchange=async()=>{
    const file=input.files?.[0];
    input.remove();
    if(!file) return;
    try{
      await addLocalBookFromFile(file,{catalogId:id});
      toast(_booksLang==='ar'?'تم حفظ ملف PDF على هذا الجهاز فقط':'PDF saved on this device only','check');
      if(_booksDetailId===id) renderBookDetail(getBookById(id));
      else renderBooksGrid();
      updateDownloadButtonCard(id);
    }catch(err){
      if(err.message==='Cancelled by user') return;
      toast(err.message==='PDF file required'?(_booksLang==='ar'?'اختر ملف PDF صالحاً':'Choose a valid PDF file'):(_booksLang==='ar'?'تعذر الاستيراد: ':'Could not import: ')+err.message);
    }
  };
  document.body.append(input);input.click();
}

function closeBookDetail(){
  const modal = $('ov-book-detail');
  if(modal) modal.classList.remove('open');
  unlockBody();
  _booksDetailId = null;

  renderBooksGrid();

  requestAnimationFrame(() => {
    const y = window._booksSavedScroll || 0;
    window.scrollTo(0, y);
  });
}

function ensureBookDetailModal(){
  if($('ov-book-detail')) return;

  const modal = document.createElement('div');
  modal.className = 'ov center';
  modal.id = 'ov-book-detail';
  modal.setAttribute('onclick', 'if(event.target===this)closeBookDetail()');
  modal.innerHTML = `
    <div class="modal-box" style="max-width:520px">
      <div class="mh">
        <h2 id="book-detail-title"></h2>
        <button class="btn-close" onclick="closeBookDetail()" aria-label="Close">${icon('x', 16)}</button>
      </div>
      <div class="mb" id="book-detail-body"></div>
    </div>`;
  document.body.appendChild(modal);
}

async function resetBookProgress(id){
  const ar = _booksLang === 'ar';
  if(!confirm(ar ? 'هل تريد إعادة تعيين التقدم في هذا الكتاب؟' : 'Reset progress for this book?')) return;
  await clearBookProgress(id);
  const b = getBookById(id);
  if(b) renderBookDetail(b);
  toast(ar ? 'تمت إعادة التعيين' : 'Progress reset', 'rotate-ccw');
}

async function readBook(id){
  const b = getBookById(id);
  if(!b) return;
  const availability = await getBookAvailability(id);
  if(!availability.readable && !availability.canDownload){
    openBookDetail(id);
    return;
  }

  closeBookDetail();
  return openReader(id);
}

/* ==========================================================================
   Local books - upload, detail, edit, delete
   ========================================================================== */

async function onLocalFileChosen(ev){
  const input = ev && ev.target;
  const file = input && input.files && input.files[0];
  if(input) input.value = '';
  if(!file) return;

  const name = (file.name || '').toLowerCase();
  const isPdf = (file.type === 'application/pdf') || name.endsWith('.pdf');
  if(!isPdf){
    toast(_booksLang === 'ar' ? 'ملفات PDF فقط' : 'PDF files only');
    return;
  }

  try{
    await addLocalBookFromFile(file);
    toast(_booksLang === 'ar' ? 'تمت الإضافة' : 'Added', 'check');
    renderBooksGrid();
  }catch(err){
    if(err && err.message === 'Cancelled by user') return;
    console.error('[local upload]', err);
    toast((_booksLang === 'ar' ? 'تعذر الإضافة: ' : 'Could not add: ') + (err.message || ''));
  }
}

async function onDeleteLocalBook(id){
  const ar = _booksLang === 'ar';
  if(!confirm(ar ? 'حذف هذا الكتاب المحلي؟' : 'Delete this local book?')) return;
  await deleteLocalBook(id);
  toast(ar ? 'تم الحذف' : 'Deleted', 'trash-2');
  renderBooksGrid();
}

async function openLocalBookDetail(id){
  await loadLocalBooks();
  const b = getLocalBookById(id);
  if(!b) return;
  _booksDetailId = id;
  window._booksSavedScroll = window.scrollY || window.pageYOffset || 0;
  ensureBookDetailModal();
  renderLocalBookDetail(b);
  $('ov-book-detail').classList.add('open');
  lockBody();
}

function renderLocalBookDetail(b){
  const ar = _booksLang === 'ar';
  const title = ar ? (b.titleAr || b.titleEn) : (b.titleEn || b.titleAr);
  const author = ar ? (b.author || '') : (b.authorEn || b.author || '');
  const description = ar ? (b.descriptionAr || '') : (b.descriptionEn || b.descriptionAr || '');
  const progress = getBookProgress(b.id);
  const isRead = !!progress && progress.page > 1;
  const isFinished = progress && progress.totalPages && progress.page >= progress.totalPages;
  const sizeMb = (b.size / 1048576).toFixed(1);

  $('book-detail-title').innerHTML = esc(title);

  $('book-detail-body').innerHTML = `
    <div class="book-detail-hero">
      <div class="book-detail-cover" id="detail-cover-${b.id}">
        <div class="book-cover-placeholder">${icon('book-open', 30)}</div>
      </div>
      <div class="book-detail-meta">
        <div class="book-cat-badge local-badge">${ar ? 'محلي' : 'Local'}</div>
        ${author ? `<div class="book-detail-author">${esc(author)}</div>` : ''}
        <div class="book-detail-author" style="opacity:.6">${sizeMb} MB</div>
      </div>
    </div>

    ${description ? `<div class="book-detail-desc ${ar?'ar':'en'}">${esc(description)}</div>` : ''}

    ${isRead ? `
      <div class="book-detail-progress">
        <div class="book-progress-bar">
          <div class="book-progress-fill" style="width:${progress.totalPages ? Math.round(progress.page/progress.totalPages*100) : 0}%"></div>
        </div>
        <div class="book-progress-text">
          ${isFinished
            ? `${icon('check', 12)} ${ar ? 'انتهيت من هذا الكتاب' : 'Finished reading'}`
            : (ar ? `توقفت عند صفحة ${progress.page}` : `Stopped at page ${progress.page}`)}
        </div>
      </div>` : ''}

    <div class="local-detail-primary-row">
      <button class="btn-save" onclick="readBook('${b.id}')">
        ${isRead
          ? `${icon('book-open', 16)} ${ar ? 'متابعة القراءة' : 'Continue reading'}`
          : `${icon('book-open', 16)} ${ar ? 'ابدأ القراءة' : 'Start reading'}`}
      </button>
      <button class="local-icon-btn" onclick="openEditLocalBook('${b.id}')" title="${ar ? 'تحرير' : 'Edit'}" aria-label="${ar ? 'تحرير' : 'Edit'}">
        ${icon('edit', 16)}
      </button>
    </div>

    <button class="local-delete-btn" onclick="closeLocalBookDetail('${b.id}')">
      ${icon('trash-2', 14)} ${ar ? 'حذف الكتاب' : 'Delete book'}
    </button>
  `;

  const coverEl = $(`detail-cover-${b.id}`);
  if(coverEl && typeof attachLocalBookCover === 'function'){
    setTimeout(() => attachLocalBookCover(b.id, coverEl), 30);
  }
}

async function openEditLocalBook(id){
  await loadLocalBooks();
  const b = getLocalBookById(id);
  if(!b) return;
  const ar = _booksLang === 'ar';
  const title = ar ? (b.titleAr || b.titleEn) : (b.titleEn || b.titleAr);
  const author = ar ? (b.author || '') : (b.authorEn || b.author || '');
  const description = ar ? (b.descriptionAr || '') : (b.descriptionEn || b.descriptionAr || '');

  const newTitle = prompt(ar ? 'العنوان' : 'Title', title);
  if(newTitle === null) return;
  const newAuthor = prompt(ar ? 'المؤلف' : 'Author', author);
  if(newAuthor === null) return;
  const newDescription = prompt(ar ? 'الوصف' : 'Description', description);
  if(newDescription === null) return;

  await updateLocalBookMeta(id, {
    titleAr: newTitle.trim(),
    titleEn: newTitle.trim(),
    author: newAuthor.trim(),
    authorEn: newAuthor.trim(),
    descriptionAr: newDescription,
    descriptionEn: newDescription,
  });

  const fresh = getLocalBookById(id);
  if(fresh) renderLocalBookDetail(fresh);
  toast(ar ? 'تم الحفظ' : 'Saved', 'check');
}

async function closeLocalBookDetail(id){
  const ar = _booksLang === 'ar';
  if(!confirm(ar ? 'حذف هذا الكتاب؟' : 'Delete this book?')) return;
  await deleteLocalBook(id);
  closeBookDetail();
  toast(ar ? 'تم الحذف' : 'Deleted', 'trash-2');
}

let _libraryView = null;
let _librarySort = 'title';
async function setLibraryView(view){
  _libraryView = view === 'folders' ? 'folders' : 'grid';
  await store.setMeta('libraryDesktopView', _libraryView);
  await renderBooksGrid();
}
async function renderDesktopLibrary(host){
  if(!_libraryView){ const saved = await store.getMeta('libraryDesktopView'); _libraryView = _libraryView || saved || 'grid'; }
  const ar = window.SAHIB_I18N?.language === 'ar';
  _booksLang = ar ? 'ar' : 'en';
  const label = (en,arabic) => ar ? arabic : en;
  let books = _booksQuery.trim() ? searchBooks(_booksQuery) : allBooks();
  if(_booksCategory === '__beginner') books = getBeginnerBooks();
  else if(_booksCategory) books = books.filter(b=>_booksCategory === 'local' ? b.isLocal : b.category === _booksCategory);
  books = books.slice().sort((a,b)=>{
    if(_booksCategory === '__beginner') return (a.readingOrder||0)-(b.readingOrder||0);
    if(_librarySort === 'recent') return (getBookProgress(b.id)?.lastRead||0)-(getBookProgress(a.id)?.lastRead||0);
    if(_librarySort === 'author') return (a.author||'').localeCompare(b.author||'',ar?'ar':'en');
    return (ar?a.titleAr:a.titleEn||a.titleAr).localeCompare(ar?b.titleAr:b.titleEn||b.titleAr,ar?'ar':'en');
  });
  const categoryButton = (id,title) => `<button type="button" aria-pressed="${(_booksCategory||'')===id}" onclick="_booksCategory='${id}';renderBooksGrid()">${esc(title)}</button>`;
  const sourceLabel = b=>b.isLocal?label('Personal PDF','ملف شخصي'):b.source==='included'?label('Included','مضمّن'):b.downloadAllowed?label('Catalog','الفهرس'):label('Metadata / cached copy','بيانات / نسخة مخزنة');
  host.innerHTML = `<div class="library-desktop" data-view="${_libraryView}" dir="${ar?'rtl':'ltr'}">
    <header class="library-toolbar"><h1>${label('Library','المكتبة')}</h1><span>${books.length} ${label('books','كتاب')}</span>
      <div class="library-view-toggle" aria-label="${label('Library view','عرض المكتبة')}"><button aria-pressed="${_libraryView==='grid'}" onclick="setLibraryView('grid')">${label('Cards','البطاقات')}</button><button aria-pressed="${_libraryView==='folders'}" onclick="setLibraryView('folders')">${label('Folder explorer','المجلدات')}</button></div>
      <button type="button" class="btn-cancel" onclick="window.OFFLINE_UI.open()">${icon('download',16)} ${label('Downloads & storage','التنزيلات والتخزين')}</button>
      <label class="btn-cancel">${label('Add PDF','أضف PDF')}<input type="file" accept="application/pdf,.pdf" hidden onchange="onLocalFileChosen(event)"></label>
    </header>
    <div class="library-filters"><input id="books-search" class="fi" value="${esc(_booksQuery)}" placeholder="${label('Search books and authors','ابحث في الكتب والمؤلفين')}" oninput="onBooksSearch(this.value)"><label>${label('Sort','الترتيب')} <select onchange="_librarySort=this.value;renderBooksGrid()"><option value="title" ${_librarySort==='title'?'selected':''}>${label('Title','العنوان')}</option><option value="author" ${_librarySort==='author'?'selected':''}>${label('Author','المؤلف')}</option><option value="recent" ${_librarySort==='recent'?'selected':''}>${label('Recently read','آخر قراءة')}</option></select></label></div>
    <div class="library-workspace"><nav class="library-folders" aria-label="${label('Categories','الفئات')}">${categoryButton('',label('All books','كل الكتب'))}${categoryButton('__beginner',label('Beginner path','مسار المبتدئ'))}${categoryButton('local',label('Personal imports','الملفات الشخصية'))}${BOOK_CATEGORIES.map(c=>categoryButton(c.id,ar?c.ar:c.en)).join('')}</nav>
    <section class="library-results">${_libraryView==='grid'?`<div class="books-grid">${books.map(b=>b.isLocal?localBookCardHTML(b):bookCardHTML(b)).join('')}</div>`:
    `<table class="library-table"><thead><tr><th>${label('Title','العنوان')}</th><th>${label('Author','المؤلف')}</th><th>${label('Source','المصدر')}</th><th>${label('Progress','التقدم')}</th></tr></thead><tbody>${books.map(b=>{const p=getBookProgress(b.id);return `<tr><td><button onclick="${b.isLocal?'openLocalBookDetail':'openBookDetail'}('${b.id}')">${esc(ar?b.titleAr:b.titleEn||b.titleAr)}</button></td><td>${esc(ar?b.author||'':b.authorEn||b.author||'')}</td><td>${esc(sourceLabel(b))}</td><td>${p?`${p.page} / ${p.totalPages||'—'}`:'—'}</td></tr>`;}).join('')}</tbody></table>`}
    ${books.length?'':`<p>${label('No results','لا توجد نتائج')}</p>`}</section></div></div>`;
  if(_libraryView==='grid'){
    generateCoversForGrid();
    for(const b of books){
      const card=$('cover-'+b.id)?.closest('.book-card');
      if(card){card.tabIndex=0;card.setAttribute('role','button');card.onkeydown=e=>{if(e.target===card&&(e.key==='Enter'||e.key===' ')){e.preventDefault();card.click();}};}
      updateDownloadButtonCard(b.id);
    }
  }
}
