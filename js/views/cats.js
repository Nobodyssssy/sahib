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
    const catLabel = c.ar || c.en || c.key;
    return `<article class="cat-card" style="--cc:${c.color}">
      <button type="button" class="cat-open" onclick="openCat('${c.key}')" aria-label="Open ${esc(c.en || c.key)} adkar">
        <span class="cat-icon">${icon(iconName, 24)}</span>
        <span class="cat-name">${esc(c.ar)}</span>
        <span class="cat-en">${esc(c.en)}</span>
        <span class="cat-count">${n} adkar</span>
        ${n > 0 ? `<span class="cat-prog-bar" aria-hidden="true"><span class="cat-prog-fill" style="width:${pct}%"></span></span>
        <span class="cat-progress-label">${done}/${n} today</span>` : ''}
      </button>
      <div class="cat-actions">
        <button type="button" class="cat-start-btn" onclick="startSessionFromCategory('${c.key}', event)" aria-label="Start ${esc(c.en || c.key)} session">
          ${icon('play', 13)}<span>Start session</span>
        </button>
        <button type="button" class="cat-sm-btn edit" onclick="openEditCat('${c.key}')" title="Edit ${esc(c.en || catLabel)}" aria-label="Edit ${esc(c.en || catLabel)}">${icon('pencil', 12)}</button>
        <button type="button" class="cat-sm-btn del" onclick="askDelCat('${c.key}')" title="Delete ${esc(c.en || catLabel)}" aria-label="Delete ${esc(c.en || catLabel)}">${icon('trash', 12)}</button>
      </div>
    </article>`;
  }).join('')
  + `<button type="button" class="cat-new-card" onclick="openCatMgr()">
       <span class="cat-new-plus">${icon('plus', 20)}</span><span>New category</span>
     </button>`;
}

/* Category-card CTA: set the active category and enter the session without
   requiring a second tap on the Adkar list. Other card controls remain
   separate buttons, so they can never trigger this action. */
function startSessionFromCategory(key, event){
  if(event){
    event.preventDefault();
    event.stopPropagation();
  }
  currentCat = key;
  const cat = (typeof getCat === 'function') ? getCat(key) : null;
  const title = document.getElementById('adkar-view-title');
  if(title && cat) title.textContent = cat.ar;
  if(typeof startSession === 'function') startSession();
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

/* Kept as a compatibility no-op: the add and manage actions now live in the
   static page header beside each other. */
function ensureCatsSettingsButton(){}

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