'use strict';

/* Reader tools: in-book search and page notes (ReadEra / Kindle style). */

let _readerSearchToken = 0;
let _readerSearchMemo = { bookId: null, query: '', html: '' };
let _readerNotes = null;

async function openReaderSearch(){
  if(!_readerBookId) return;
  _sidebarOpen = false;
  await toggleReaderSidebar('search');
  setTimeout(() => { const input = $('reader-search-input'); if(input){ input.focus(); input.select(); } }, 50);
}

function renderReaderSearch(){
  const sb = $('reader-sidebar');
  if(!sb) return;
  const memo = _readerSearchMemo.bookId === _readerBookId ? _readerSearchMemo : { query: '', html: '' };
  sb.innerHTML = `
    <div class="reader-sidebar-title">
      <span>Search in book</span>
      <button class="reader-sidebar-close" onclick="toggleReaderSidebar()" title="Close" data-icon="x"><span class="btn-icon"></span></button>
    </div>
    <form class="reader-search-form" onsubmit="event.preventDefault(); runReaderSearch(this.q.value)">
      <input type="search" name="q" id="reader-search-input" class="fi" placeholder="Search text, press Enter" value="${esc(memo.query)}" autocomplete="off">
    </form>
    <div class="reader-search-results" id="reader-search-results">${memo.html}</div>`;
  if(typeof injectHeaderIcons === 'function') injectHeaderIcons();
}

async function runReaderSearch(raw){
  const host = $('reader-search-results');
  const query = String(raw || '').trim();
  if(!host || !_readerPdf) return;
  if(query.length < 2){ host.innerHTML = '<div class="reader-search-note">Type at least 2 characters.</div>'; return; }
  const token = ++_readerSearchToken;
  host.innerHTML = '<div class="reader-search-note">Searching…</div>';
  try{
    const engine = await initPdfEngine();
    const doc = _readerPdf._doc;
    const found = await engine.searchAllPages(doc, query, { flags: [] }).toPromise();
    if(token !== _readerSearchToken || !$('reader-search-results')) return;
    const hits = (found.results || []).slice(0, 200);
    if(!hits.length){
      const html = '<div class="reader-search-note">No matches. Scanned books without a text layer cannot be searched.</div>';
      host.innerHTML = html;
      _readerSearchMemo = { bookId: _readerBookId, query, html };
      return;
    }
    const lead = 40;
    const slices = hits.map(h => ({ pageIndex: h.pageIndex, charIndex: Math.max(0, h.charIndex - lead), charCount: h.charCount + 2 * lead }));
    const texts = await engine.getTextSlices(doc, slices).toPromise();
    if(token !== _readerSearchToken || !$('reader-search-results')) return;
    const pages = new Set(hits.map(h => h.pageIndex));
    const rows = hits.map((h, i) => {
      const text = String(texts[i] || '').replace(/\s+/g, ' ');
      const at = Math.min(lead, h.charIndex);
      const before = esc(text.slice(0, at)), match = esc(text.slice(at, at + h.charCount)), after = esc(text.slice(at + h.charCount));
      return `<button type="button" class="reader-search-hit" onclick="gotoReaderPage(${h.pageIndex + 1}); if(window.innerWidth < 700) toggleReaderSidebar();"><span class="reader-search-page">p. ${h.pageIndex + 1}</span><span class="reader-search-snippet">…${before}<mark>${match}</mark>${after}…</span></button>`;
    }).join('');
    const more = found.total > hits.length ? ` (showing first ${hits.length})` : '';
    const html = `<div class="reader-search-note">${found.total} match${found.total === 1 ? '' : 'es'} on ${pages.size} page${pages.size === 1 ? '' : 's'}${more}</div>${rows}`;
    host.innerHTML = html;
    _readerSearchMemo = { bookId: _readerBookId, query, html };
  }catch(err){
    console.warn('[reader] search failed', err);
    if(token === _readerSearchToken && $('reader-search-results')) $('reader-search-results').innerHTML = '<div class="reader-search-note">Search failed for this book.</div>';
  }
}

async function loadReaderNotes(){
  if(_readerNotes) return _readerNotes;
  const stored = await store.getMeta('books-notes');
  _readerNotes = (stored && typeof stored === 'object') ? stored : {};
  return _readerNotes;
}

function getReaderNote(bookId, page){
  return (_readerNotes && _readerNotes[bookId] && _readerNotes[bookId][page]) || '';
}

async function saveReaderNote(bookId, page, text){
  await loadReaderNotes();
  const value = String(text || '').trim().slice(0, 1000);
  const book = _readerNotes[bookId] || (_readerNotes[bookId] = {});
  if(value) book[page] = value; else delete book[page];
  if(!Object.keys(book).length) delete _readerNotes[bookId];
  await store.setMeta('books-notes', _readerNotes);
}

async function copyReaderNotes(){
  await loadReaderNotes();
  const book = typeof getBookById === 'function' ? getBookById(_readerBookId) : null;
  const pages = getBookBookmarks(_readerBookId);
  const lines = [book?.title || book?.titleEn || '', ''];
  pages.forEach(p => { const n = getReaderNote(_readerBookId, p); lines.push(n ? `Page ${p}: ${n}` : `Page ${p}`); });
  try{
    await navigator.clipboard.writeText(lines.join('\n').trim());
    toast('Bookmarks and notes copied');
  }catch(e){
    toast('Could not copy');
  }
}
