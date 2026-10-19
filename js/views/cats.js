'use strict';

/* ═══════════════════════════════════════════════════════════
   Categories grid
   Counts items by checking categories.includes(key)
   ═══════════════════════════════════════════════════════════ */
   
/* Display order for category cards. Buckets not listed here fall to the end
   in their natural order. */
var CAT_DISPLAY_ORDER = [
  'sabah',
  'masaa',
  'nawm',
  'salah',
  'salah_after',
  'wudu',
  'masjid',
  'food',
  'travel',
  'hajj',
  'sickness',
  'janazah',
  'clothing',
  'home',
  'duaa',
  'dhikr',
  'aam'
];
function _catOrderIndex(key){
  var i = CAT_DISPLAY_ORDER.indexOf(key);
  return i === -1 ? 9999 : i;
}

function renderCatsGrid(){
  /* Render the daily quote card above the categories */
  if(typeof renderQuoteCard === 'function') renderQuoteCard();

  /* Ensure the page header has the settings button */
  ensureCatsSettingsButton();
  
  const g = $('cats-grid');
  const sortedCats = cats.slice().sort((a, b) => _catOrderIndex(a.key) - _catOrderIndex(b.key));
  g.innerHTML = sortedCats.map(c => {
    const items = data.filter(d =>
      Array.isArray(d.categories) && d.categories.includes(c.key)
    );
    const n = items.length;
    const done = items.filter(d => (counters[`c_${d.id}`]||0) >= d.repeat).length;
    const pct = n > 0 ? Math.round(done / n * 100) : 0;
    const iconName = c.icon || CAT_ICONS[c.key] || CAT_ICON_DEFAULT;
	return `<div class="cat-card" style="--cc:${c.color}" onclick="openCat('${c.key}')">
	  <div class="cat-icon" style="background:${c.color}22;color:${c.color}">${icon(iconName, 24)}</div>
	  <div class="cat-name">${c.ar}</div>
      <div class="cat-en">${c.en}</div>
      <span class="cat-count" style="color:${c.color};border-color:${c.color};background:${c.color}18">${n} adkar</span>
      ${n>0?`<div class="cat-prog-bar"><div class="cat-prog-fill" style="width:${pct}%;background:${c.color}"></div></div>
      <div style="font-size:10px;color:var(--text3)">${done}/${n} done today</div>`:''}
		<div class="cat-edit-row" onclick="event.stopPropagation()">
		<button class="cat-sm-btn edit" onclick="openEditCat('${c.key}')" title="Edit">${icon('pencil', 12)}</button>
		<button class="cat-sm-btn del" onclick="askDelCat('${c.key}')" title="Delete">${icon('trash', 12)}</button>
	  </div>
    </div>`;
  }).join('')
  + `<div class="cat-new-card" onclick="openCatMgr()">
       <span style="font-size:24px">＋</span><span>New category</span>
     </div>`;
}

function openCat(key){
  window._catsSavedScroll = window.scrollY || window.pageYOffset || 0;
  currentCat = key;
  $('adkar-view-title').textContent = getCat(key).ar;
  renderAdkarGrid();
  window.scrollTo(0, 0);
  showView('view-adkar');
  pushViewState('adkar');
}

/* Called by the popstate handler. Does the close without pushing another entry. */
function _closeCatFromHistory(){
  currentCat = null;
  if(typeof clearSearch === 'function') clearSearch();
  $('btn-favs').classList.remove('active');
  showView('view-cats');
  renderCatsGrid();
  requestAnimationFrame(() => {
    window.scrollTo(0, window._catsSavedScroll || 0);
  });
}

/* UI-initiated close of the adhkar view. Pops the history entry. */
function closeAdkarView(){
  if(window.history && window.history.length > 1){
    history.back();
  } else {
    _closeCatFromHistory();
  }
}

function showView(id){
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  $(id).classList.add('active');

  if(typeof updateShellNav === 'function') updateShellNav(id);

  /* Search bar visibility — only on Adkar and Library views */
  const searchBar = document.getElementById('search-bar');
  if(searchBar){
const showSearch = (id === 'view-cats' || id === 'view-books' || id === 'view-search');
    searchBar.style.display = showSearch ? '' : 'none';

    /* Update placeholder + behavior based on context */
    const input = document.getElementById('search-input');
    if(input){
      if(id === 'view-books'){
        input.placeholder = 'Search books & authors...';
        input.oninput = function(){ if(typeof onBooksSearch === 'function') onBooksSearch(this.value); };
      } else {
        input.placeholder = 'Search all adkar...';
        input.oninput = function(){ if(typeof handleSearch === 'function') handleSearch(); };
      }
if(id !== 'view-search'){ input.value = ''; }    }
  }

  /* Inject any SVG icons in the newly-shown view */
  if(typeof injectHeaderIcons === 'function') {
    setTimeout(() => injectHeaderIcons(), 0);
  }
}

/* Navigate to adkar categories grid */
function goToAdkarCategories(){
  showView('view-cats');
  currentCat = null;
  clearSearch();
  $('btn-favs').classList.remove('active');
  renderCatsGrid();
  requestAnimationFrame(() => {
    window.scrollTo(0, window._catsSavedScroll || 0);
  });
}

/* Navigate to the main dashboard (home) */
function goHome(){
  goHomeView();
}

/* Add ⚙️ settings button to the categories view header (one-time) */
function ensureCatsSettingsButton(){
  const header = document.querySelector('#view-cats .page-header');
  if(!header) return;
  if(header.querySelector('.cats-settings-btn')) return;  /* already added */

  const btn = document.createElement('button');
  btn.className = 'icon-btn cats-settings-btn';
  btn.title = 'Manage categories';
  btn.innerHTML = '⚙️';
  btn.onclick = () => openCatMgr();
  header.appendChild(btn);
}

function toggleTheme(){
  if(typeof SAHIB_THEME !== 'undefined' && SAHIB_THEME.toggleMode){
    SAHIB_THEME.toggleMode();
    return;
  }
  isLight = !isLight;
  document.body.classList.toggle('light', isLight);
  if(typeof updateThemeToggleIcon === 'function') updateThemeToggleIcon();
  if(typeof updateThemeColorMeta === 'function') updateThemeColorMeta();
  store.setMeta('theme', isLight ? 'light' : 'dark');
  if(typeof updateMenuState === 'function') updateMenuState();
}