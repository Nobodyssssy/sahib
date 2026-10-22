(async()=>{
 const checks=[],check=(name,pass)=>checks.push({name,pass:!!pass}),prefs=await getPrayerPrefs(),saved=await store.getMeta(ADHAN_LOCAL_KEYS.standard);let importedBook;
 try{
  const response=await fetch('assets/adhan/nasser-al-qatami.mp3'),blob=await response.blob();
  await store.setMeta(ADHAN_LOCAL_KEYS.standard,{name:'Disposable native audio verification.mp3',blob,size:blob.size,ts:Date.now()});
  await SahibDesktop.preview('standard',0,{...prefs,alerts:{...prefs.alerts,audio:{...prefs.alerts.audio,standard:'local'}}});await new Promise(r=>setTimeout(r,500));
  let state=await SahibDesktop.invoke('desktop_state');check('Imported audio plays natively',state.audioPlaying&&!state.audioError);
  await clearLocalAdhan('standard');check('Local audio removed from IndexedDB',!await store.getMeta(ADHAN_LOCAL_KEYS.standard));
  const pdf=await(await fetch(offlineBookUrl('jazariyyah'))).blob();importedBook=await addLocalBookFromFile(new File([pdf],'Disposable native reader verification.pdf',{type:'application/pdf'}));
  await openReader(importedBook.id);check('Imported PDF renders',_readerTotalPages===12&&document.querySelectorAll('#reader-body canvas').length>0);_closeReaderFromHistory();
  const cover=await generateLocalBookCover(importedBook.id);check('Imported PDF cover preview',typeof cover==='string'&&cover.startsWith('data:image/'));
 }finally{
  await SahibDesktop.invoke('desktop_stop_audio');if(importedBook)await deleteLocalBook(importedBook.id);
  await store.setMeta(ADHAN_LOCAL_KEYS.standard,saved||null);await savePrayerPrefs({alerts:prefs.alerts});await SahibDesktop.sync();
 }
 return checks;
})()
