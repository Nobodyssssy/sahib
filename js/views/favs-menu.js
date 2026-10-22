'use strict';

/* Two-item favorites dropdown anchored under #btn-favs. */

function toggleFavsMenu(event){
  if(event) event.stopPropagation();
  const menu = $('favs-menu');
  if(!menu) return;
  if(menu.classList.contains('open')){
    closeFavsMenu();
  } else {
    openFavsMenu();
  }
}

function openFavsMenu(){
  const menu = $('favs-menu');
  if(!menu) return;
  menu.classList.add('open');
  menu.setAttribute('aria-hidden', 'false');

  if(typeof injectHeaderIcons === 'function'){
    injectHeaderIcons();
  }

  refreshFavsMenuCounts();
}

function refreshFavsMenuCounts(){
  const adkarEl = $('favs-count-adkar');
  const booksEl = $('favs-count-books');
  const adkarRow = adkarEl ? adkarEl.closest('.favs-menu-item') : null;
  const booksRow = booksEl ? booksEl.closest('.favs-menu-item') : null;

  if(adkarEl && adkarRow){
    const n = (typeof favs !== 'undefined' && Array.isArray(favs)) ? favs.length : 0;
    if(n > 0){
      adkarEl.textContent = String(n);
      adkarEl.hidden = false;
      adkarRow.removeAttribute('data-empty');
    } else {
      adkarEl.textContent = '';
      adkarEl.hidden = true;
      adkarRow.setAttribute('data-empty', '1');
    }
  }

  if(booksEl && booksRow){
    let n = 0;
    if(typeof getFavoriteBooks === 'function'){
      try{ n = getFavoriteBooks().length; }catch(e){ n = 0; }
    }
    if(n > 0){
      booksEl.textContent = String(n);
      booksEl.hidden = false;
      booksRow.removeAttribute('data-empty');
    } else {
      booksEl.textContent = '';
      booksEl.hidden = true;
      booksRow.setAttribute('data-empty', '1');
    }
  }
}

function closeFavsMenu(){
  const menu = $('favs-menu');
  if(!menu) return;
  menu.classList.remove('open');
  menu.setAttribute('aria-hidden', 'true');
}

function openFavsAdkar(){
  closeFavsMenu();
  toggleFavsView();
}

async function openFavsBooks(){
  closeFavsMenu();
  if(typeof loadBookmarks === 'function'){
    try{ await loadBookmarks(); }catch(e){}
  }
  await renderFavBooksGrid();
  showView('view-fav-books');
}

function closeFavsBooks(){
  if(typeof goHomeView === 'function') goHomeView();
  else showView('view-home');
}

async function renderFavBooksGrid(){
  const host = $('fav-books-grid');
  if(!host) return;

  if(typeof loadBookmarks === 'function'){
    try{ await loadBookmarks(); }catch(e){}
  }

  if(typeof updateFavsButton === 'function') updateFavsButton();
  if(typeof refreshFavsMenuCounts === 'function') refreshFavsMenuCounts();

  const list = getFavoriteBooks();

  if(!list.length){
    host.innerHTML = `<div class="adkar-empty">
      <div class="adkar-empty-icon">${icon('bookmark-outline', 40)}</div>
      <div>No favorite books yet.<br>Bookmark a page or start reading to add a book here.</div>
    </div>`;
    return;
  }

  host.innerHTML = list.map(b => bookCardHTML(b)).join('');

  if(typeof generateCoversForGrid === 'function'){
    setTimeout(() => generateCoversForGrid(), 50);
  }
}

/* A book is "favorite" when it has at least one bookmark OR non-trivial reading progress. */
function getFavoriteBooks(){
  if(!_bookmarks) _bookmarks = {};
  const progress = _readingProgress || {};

  const ids = new Set();

  Object.keys(_bookmarks).forEach(k => {
    if(k === '_pinned') return;
    const list = _bookmarks[k];
    if(Array.isArray(list) && list.length) ids.add(k);
  });

  Object.keys(progress).forEach(k => {
    const p = progress[k];
    if(p && p.page > 1) ids.add(k);
  });

  const books = Array.from(ids).map(getBookById).filter(Boolean);

  books.sort((a, b) => {
    const pa = progress[a.id];
    const pb = progress[b.id];
    const ta = pa && pa.lastRead ? pa.lastRead : 0;
    const tb = pb && pb.lastRead ? pb.lastRead : 0;
    return tb - ta;
  });

  return books;
}

/* Close on outside click and Escape. */
document.addEventListener('click', (e) => {
  const menu = $('favs-menu');
  if(!menu || !menu.classList.contains('open')) return;
  if(menu.contains(e.target)) return;
  if(e.target.closest('#btn-favs')) return;
  closeFavsMenu();
});

document.addEventListener('keydown', (e) => {
  if(e.key === 'Escape'){
    const menu = $('favs-menu');
    if(menu && menu.classList.contains('open')) closeFavsMenu();
  }
});