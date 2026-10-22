'use strict';
let _appSearchResults=[];
let _appSearchOrigin=null;
function appSearchRecords(){
  const ar=window.SAHIB_I18N?.language==='ar';
  const out=[],add=(group,title,subtitle,terms,open,id)=>out.push({group,title,subtitle,id,terms:`${title} ${subtitle} ${terms||''}`,open});
  const sections=[['Home','الرئيسية',goHomeView],['Adhkar','الأذكار',goToAdkarCategories],['Prayer times','مواقيت الصلاة',openPrayerView],['Day rhythm','إيقاع اليوم',()=>{goHomeView();turnHomePrayer(0,1)}],['Daily practice','الورد اليومي',openPracticeView],['Hijri calendar','التقويم الهجري',openHijriView],['99 Names of Allah','أسماء الله الحسنى',openAsmaView],['Library','المكتبة',openBooksView],['Tasbih','التسبيح',openTasbihView],['Reminders','التذكيرات',openPracticeReminders],['Favorites','المفضلة',toggleFavsView]];
  for(const [en,arabic,fn]of sections)add('Pages',ar?arabic:en,'',en+' '+arabic,fn);
  for(const [id,en,arabic]of [['appearance','Appearance','المظهر'],['prayer','Prayer settings','إعدادات الصلاة'],['alerts','Alerts','التنبيهات'],['data','Data and backup','البيانات والنسخ الاحتياطي'],['about','About Sahib','حول صاحب']])add('Settings',ar?arabic:en,'',en+' '+arabic+' '+({appearance:'font typeface theme accent color language خط مظهر لون لغة',prayer:'location calculation method CSV timetable موقع حساب طريقة',alerts:'audio sound adhan notifications volume صوت أذان إشعارات',data:'backup import export restore نسخ احتياطي استيراد تصدير',about:'sources licences privacy مصادر تراخيص خصوصية'}[id]),()=>openSettings(id));
  for(const c of cats)add('Categories',ar?c.ar:c.en,'',c.ar+' '+c.en,()=>openCat(c.key));
  const localIds=new Set(getLocalBooks().map(b=>b.id));
  for(const b of [...BOOKS,...getLocalBooks()])add('Books',ar?b.titleAr||b.title:b.titleEn||b.titleAr||b.title,ar?b.author:b.authorEn||b.author,`${b.titleAr} ${b.titleEn} ${b.author} ${b.authorEn} ${b.descriptionAr||''} ${b.descriptionEn||''}`,()=>localIds.has(b.id)?openLocalBookDetail(b.id):openBookDetail(b.id));
  for(const n of ASMA_NAMES)add('Names',ar?n.ar:n.transliteration,ar?n.tafsirAr:n.meaningEn,`${n.ar} ${n.transliteration} ${n.meaningEn} ${n.tafsirAr} ${n.tafsirEn}`,()=>openAsmaDetail(n.id));
  for(const p of SahibPractice.getAll())add('Practices',ar?p.titleAr||p.title:p.title,p.timeLabel||'',`${p.title} ${p.titleAr} ${p.description||''} ${p.descriptionAr||''}`,()=>openPracticeDetail(p.id));
  for(const d of data)add('Adhkar',d.situation||d.arabic.slice(0,65),d.arabic.slice(0,100),`${d.arabic} ${d.transliteration} ${d.situation} ${d.hadith} ${d.virtue}`,()=>openDetail(d.id),d.id);
  if(typeof QUOTES!=='undefined')QUOTES.forEach((q,i)=>add('Readings',q.ref,ar?q.tafsirAr:q.tafsirEn,`${q.ar} ${q.tafsirAr} ${q.tafsirEn}`,()=>openAppReading(i)));
  if(typeof HIJRI_EVENTS!=='undefined')for(const ev of HIJRI_EVENTS)add('Calendar events',ar?ev.nameAr:ev.nameEn||ev.nameAr,'',JSON.stringify(ev),()=>openHijriEvent(ev.id));
  return out;
}
function openAppSearch(){
  _appSearchOrigin=document.activeElement;
  let ov=document.getElementById('ov-app-search');
  if(!ov){ov=document.createElement('div');ov.id='ov-app-search';ov.className='ov center app-search-ov';ov.innerHTML=`<section class="modal-box app-search-modal" role="dialog" aria-modal="true" aria-labelledby="app-search-title"><header><h2 id="app-search-title">Search the whole app</h2><button onclick="closeAppSearch()" class="btn-close" aria-label="Close">${icon('x',18)}</button></header><label class="app-search-input">${icon('search',19)}<input id="app-search-input" data-autofocus type="search" placeholder="Search pages, adhkar, books, names and practices…" oninput="renderAppSearch()" aria-label="Search the whole app"></label><div id="app-search-results" aria-live="polite"></div></section>`;ov.addEventListener('click',e=>{if(e.target===ov)closeAppSearch()});document.body.append(ov);}
  ov.classList.add('open');lockBody();renderAppSearch();
  loadLocalBooks().then(()=>{if(document.getElementById('ov-app-search')?.classList.contains('open'))renderAppSearch()});requestAnimationFrame(()=>document.getElementById('app-search-input').focus());
}
function closeAppSearch(){document.getElementById('ov-app-search')?.classList.remove('open');unlockBody();}
function renderAppSearch(){
  const query=document.getElementById('app-search-input').value.trim();
  const norm=s=>String(s||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f\u064b-\u065f]/g,'').replace(/[أإآ]/g,'ا');
  const words=norm(query).split(/\s+/).filter(Boolean),records=appSearchRecords();
  const fuzzyIds=new Set(query?searchAdkar(query,{}).map(d=>d.id):[]);

  // Search every record in both languages; fuzzy adhkar search remains available locally.
  const matches=records.filter(r=>!query?r.group==='Pages':((r.group==='Adhkar'&&fuzzyIds.has(r.id))||words.every(w=>norm(r.terms).includes(w))));
  const order=['Pages','Settings','Categories','Books','Names','Practices','Readings','Calendar events','Adhkar'];
  _appSearchResults=order.flatMap(group=>matches.filter(r=>r.group===group).sort((a,b)=>Number(norm(b.title).includes(norm(query)))-Number(norm(a.title).includes(norm(query)))).slice(0,query?8:20));

  const host=document.getElementById('app-search-results');let group='';
  host.innerHTML=_appSearchResults.length?_appSearchResults.map((r,i)=>{const heading=r.group!==group?`<h3>${esc(r.group)}</h3>`:'';group=r.group;return `${heading}<button class="app-search-result" onclick="openAppSearchResult(${i})"><span><strong>${esc(r.title)}</strong>${r.subtitle?`<small>${esc(r.subtitle)}</small>`:''}</span>${icon('arrow-left',16)}</button>`}).join(''):'<p class="app-search-empty">No results. Try another word.</p>';
  window.SAHIB_I18N?.apply(host);
}
function openAppSearchResult(index){const result=_appSearchResults[index];if(!result)return;closeAppSearch();if(_appSearchOrigin?.isConnected&&_appSearchOrigin.getClientRects().length)_appSearchOrigin.focus({preventScroll:true});result.open();}
document.addEventListener('keydown',e=>{if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='k'){e.preventDefault();openAppSearch();}if(e.key==='Escape')closeAppSearch();});

function openAppReading(index){
 const q=QUOTES[index];if(!q)return;const ar=SAHIB_I18N.language==='ar';
 let el=document.getElementById('ov-app-reading');if(!el){el=document.createElement('div');el.id='ov-app-reading';el.className='ov center';el.onclick=e=>{if(e.target===el)closeAppReading()};document.body.append(el)}
 el.innerHTML=`<section class="modal-box app-reading-modal" role="dialog" aria-modal="true" aria-label="Reading"><header><h2>${esc(q.ref)}</h2><button class="btn-close" onclick="closeAppReading()" aria-label="Close">${icon('x',18)}</button></header><p class="app-reading-source" lang="ar" dir="rtl" data-no-i18n>${esc(q.ar)}</p><h3>${ar?'التدبر':'Reflection'}</h3><p data-no-i18n dir="${ar?'rtl':'ltr'}">${esc(ar?q.tafsirAr:q.tafsirEn)}</p>${q.link?`<a href="${esc(q.link)}" target="_blank" rel="noopener">${ar?'المصدر':'Source'}</a>`:''}</section>`;el.classList.add('open');lockBody();
}
function closeAppReading(){document.getElementById('ov-app-reading')?.classList.remove('open');unlockBody();}
document.addEventListener('keydown',e=>{if(e.key==='Escape')closeAppReading()});
