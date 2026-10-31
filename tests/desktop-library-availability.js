(async()=>{
 const results=[],check=(name,pass)=>{results.push({name,pass:!!pass});if(!pass)throw Error(name);};
 await openBooksView();_booksLang='en';
 const saved=await store.getMeta('library-availability-test');
 if(saved){
  for(const id of [saved.catalog,saved.cached,saved.personal]){
   check('Available after application restart: '+id,(await getBookAvailability(id)).readable);
   await openReader(id);check('PDF renders after restart: '+id,_readerTotalPages===2&&document.querySelectorAll('#reader-body canvas').length>0);
   if(id===saved.catalog){check('Catalog page restored',_readerCurrentPage===2);check('Catalog bookmark restored',getBookBookmarks(id).includes(2));}
   _closeReaderFromHistory();
  }
  await SAHIB_I18N.setLanguage('ar');_booksLang='ar';openBookDetail(saved.catalog);await updateDownloadButton(saved.catalog);
  check('Arabic actions reflect attached PDF',document.getElementById('book-read-'+saved.catalog)?.textContent.includes('قراءة')&&document.getElementById('book-detail-actions-'+saved.catalog).textContent.includes('استيراد'));
  check('Catalog attachment is not a duplicate personal book',!getLocalBooks().some(b=>b.id===saved.catalog)&&BOOKS.length===70);
  return results;
 }
 const book=BOOKS[0],cached=BOOKS[1];
 check('Catalog remains visible and unapproved',BOOKS.length===70&&BOOKS.every(b=>!b.downloadAllowed));
 openBookDetail(book.id);await updateDownloadButton(book.id);
 check('Unavailable entry offers import instead of disabled reading/download',!document.getElementById('book-read-'+book.id)&&!document.getElementById('download-btn-'+book.id)&&document.getElementById('book-detail-actions-'+book.id).textContent.includes('Import my PDF'));
 const official=book.officialUrl;book.officialUrl='https://example.test/official';renderBookDetail(book);await updateDownloadButton(book.id);
 check('Official source is offered when present',document.querySelector('#book-detail-body a[href="https://example.test/official"]')?.textContent==='Official source');book.officialUrl=official;
 const stale=document.createElement('button');stale.id='download-btn-'+book.id;document.getElementById('book-detail-actions-'+book.id).append(stale);
 const originalFetch=window.fetch,originalToast=toast,toasts=[];let downloads=0;
 window.fetch=(url,...args)=>{if(String(url).startsWith(BOOKS_BASE_PATH)){downloads++;throw Error('Unexpected book network request');}return originalFetch(url,...args);};toast=message=>toasts.push(message);
 try{
  await onDownloadBook(book.id);await onDownloadBookCard(book.id);
  check('Known restriction has a specific message, never a network error',toasts.length===2&&toasts.every(t=>t.includes('Download unavailable')&&!t.includes('failed')));
  check('Stale Download action is removed',!document.getElementById('download-btn-'+book.id));
  const blocked=await OFFLINE_BOOKS.cacheBookById(book.id).then(()=>false,error=>error.message.includes('permission'));
  check('Approval gate blocks without any PDF download',blocked&&downloads===0);
 }finally{window.fetch=originalFetch;toast=originalToast;}
 const objects=['<< /Type /Catalog /Pages 2 0 R >>','<< /Type /Pages /Kids [3 0 R 4 0 R] /Count 2 >>',...['6','7'].map(n=>`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 600 800] /Resources << /Font << /F1 5 0 R >> >> /Contents ${n} 0 R >>`),'<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',...['1','2'].map(n=>{const text=`BT /F1 24 Tf 72 720 Td (Sahib local availability ${n}) Tj ET`;return `<< /Length ${text.length} >>\nstream\n${text}\nendstream`;})];
 let pdf='%PDF-1.4\n';const offsets=[];objects.forEach((object,i)=>{offsets.push(pdf.length);pdf+=`${i+1} 0 obj\n${object}\nendobj\n`;});const xref=pdf.length;pdf+='xref\n0 8\n0000000000 65535 f \n'+offsets.map(n=>String(n).padStart(10,'0')+' 00000 n \n').join('')+`trailer\n<< /Size 8 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
 const file=new File([pdf],'My copy.pdf',{type:'application/pdf'});
 await saveBookProgress(book.id,2,2);await toggleBookBookmark(book.id,2);
 const progress=JSON.stringify(await store.getMeta('books-progress')),bookmarks=JSON.stringify(await store.getMeta('books-bookmarks'));
 const choose=HTMLInputElement.prototype.click;
 try{HTMLInputElement.prototype.click=function(){};importCatalogPdf(book.id);}finally{HTMLInputElement.prototype.click=choose;}
 const picker=Array.from(document.querySelectorAll('input[type=file]')).at(-1),selection=new DataTransfer();selection.items.add(file);picker.files=selection.files;await picker.onchange();
 check('Attachment keeps canonical ID and existing reading data',(await db.localBooks.get(book.id)).blob.size===file.size&&JSON.stringify(await store.getMeta('books-progress'))===progress&&JSON.stringify(await store.getMeta('books-bookmarks'))===bookmarks);
 const bytes=getLocalBooksBytes();await addLocalBookFromFile(file,{catalogId:book.id});
 check('Replacing an attachment does not double-count storage',getLocalBooksBytes()===bytes);
 check('Invalid PDF cannot replace a working attachment',await addLocalBookFromFile(new File(['not a PDF'],'bad.pdf'),{catalogId:book.id}).then(()=>false,()=>true));
 check('Attaching does not approve downloads',!getBookById(book.id).downloadAllowed);
 renderBookDetail(book);await updateDownloadButton(book.id);
 check('Attached entry offers Read without Download',!!document.getElementById('book-read-'+book.id)&&!document.getElementById('download-btn-'+book.id));
 await readBook(book.id);check('Attached PDF renders at preserved page and bookmark',_readerTotalPages===2&&_readerCurrentPage===2&&getBookBookmarks(book.id).includes(2));_closeReaderFromHistory();
 await (await caches.open(OFFLINE_BOOKS_CACHE)).put(offlineBookUrl(cached.id),new Response(file,{headers:{'Content-Type':'application/pdf'}}));
 openBookDetail(cached.id);await updateDownloadButton(cached.id);
 check('Previously cached, unapproved entry offers Read',!!document.getElementById('book-read-'+cached.id)&&!document.getElementById('download-btn-'+cached.id));closeBookDetail();
 const personal=await addLocalBookFromFile(file);
 check('Personal imports and catalog coexist',getLocalBookById(personal.id)?.isLocal&&allBooks().length===71);
 await store.setMeta('library-availability-test',{catalog:book.id,cached:cached.id,personal:personal.id});
 openBookDetail(book.id);await updateDownloadButton(book.id);
 return results;
})()
