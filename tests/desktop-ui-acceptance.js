(async()=>{
 const check=(value,message)=>{if(!value)throw Error(message);};
 const results={width:innerWidth,height:innerHeight,dpr:devicePixelRatio};
 check(!document.body.textContent.includes('Zurich memory fixture'),'QA fixture leaked');
 await renderHome();check(document.getElementById('garden-greeting').textContent==='Peace be upon you','English greeting');
 const NativeDate=Date;
 try{
  for(const hour of [0,9,14,18,23]){
   const stamp=new NativeDate(2030,0,2,hour).getTime();window.Date=class extends NativeDate{constructor(...args){super(...(args.length?args:[stamp]));}};
   refreshHomeGreeting();check(document.getElementById('garden-time-greeting').textContent===greetingForNow(new Date()),'Time greeting update');
  }
 }finally{window.Date=NativeDate;}
 await SAHIB_I18N.setLanguage('ar');check(document.getElementById('garden-greeting').textContent.includes('عَلَيْكُمْ'),'Arabic greeting');
 await SAHIB_I18N.setLanguage('en');
 _asmaLang='en';renderAsmaGrid();check(document.querySelector('.asma-card-ar').textContent===ASMA_NAMES[0].ar,'Arabic name retained');
 openAppSearch();await new Promise(r=>setTimeout(r,100));document.getElementById('app-search-input').focus();document.dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowDown',bubbles:true}));check(document.activeElement.classList.contains('app-search-result'),'Search arrow navigation');closeAppSearch();
 currentCat='sabah';await startSession();const id=sessItems[sessIdx].id,before=counters['c_'+id]||0;
 if(innerWidth>=1024){document.body.dispatchEvent(new KeyboardEvent('keydown',{key:' ',bubbles:true}));await new Promise(r=>setTimeout(r,100));check(counters['c_'+id]===before+1,'Session keyboard count');check(getComputedStyle(document.getElementById('sess-body')).display==='grid','Desktop workspace');}
 else check(getComputedStyle(document.querySelector('.session-reading')).display==='contents','Mobile layout preserved');
 _closeSessionFromHistory();
 const objects=['<< /Type /Catalog /Pages 2 0 R >>','<< /Type /Pages /Kids [3 0 R 4 0 R] /Count 2 >>',...['6','7'].map(n=>`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 600 800] /Resources << /Font << /F1 5 0 R >> >> /Contents ${n} 0 R >>`),'<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',...['1','2'].map(n=>{const text=`BT /F1 24 Tf 72 720 Td (Sahib reader acceptance ${n}) Tj ET`;return `<< /Length ${text.length} >>\nstream\n${text}\nendstream`;})];
 let pdf='%PDF-1.4\n',offsets=[0];objects.forEach((o,i)=>{offsets.push(pdf.length);pdf+=`${i+1} 0 obj\n${o}\nendobj\n`;});const xref=pdf.length;pdf+=`xref\n0 8\n0000000000 65535 f \n`+offsets.slice(1).map(n=>String(n).padStart(10,'0')+' 00000 n \n').join('')+`trailer\n<< /Size 8 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
 const book=await addLocalBookFromFile(new File([pdf],'Reader acceptance.pdf',{type:'application/pdf'}));
 await openReader(book.id);check(_readerTotalPages===2,'PDF engine');await readerFit('page');check(_readerZoom>0,'Fit page');await readerFit('actual');check(_readerZoom>0,'Actual size');await readerFit('width');
 await gotoReaderPage(2);await togglePageBookmark();await saveBookProgress(book.id,2,2);_closeReaderFromHistory();await openReader(book.id);check(_readerCurrentPage===2&&getBookBookmarks(book.id).includes(2),'Reading persistence');
 if(innerWidth>=1024){document.activeElement.blur();readerWakeControls();await new Promise(r=>setTimeout(r,3300));check(document.getElementById('reader-overlay').classList.contains('reader-idle'),'Reader inactivity');document.getElementById('reader-sidebar-btn').focus();check(!document.getElementById('reader-overlay').classList.contains('reader-idle'),'Reader focus wake');}
 _closeReaderFromHistory();await openBooksView();
 if(innerWidth>=1024){await setLibraryView('folders');check(document.querySelector('.library-table'),'Folder explorer');await setLibraryView('grid');await new Promise(r=>setTimeout(r,600));check(document.getElementById('cover-'+book.id)?.querySelector('img'),'Personal preview');check(await store.getMeta('libraryDesktopView')==='grid','View persistence');}
 check(!document.documentElement.scrollWidth||document.documentElement.scrollWidth<=innerWidth,'Horizontal overflow');
 results.greetings=results.searchKeyboard=results.session=results.pdfPersistence=results.library=true;return results;
})()
