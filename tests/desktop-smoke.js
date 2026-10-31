(async()=>{
 const checks=[],check=(name,pass)=>checks.push({name,pass:!!pass});
 check('Desktop adapter loaded',SahibDesktop.available);
 check('Zurich summer offset',_pwEventDate('15-07-2026','21:30','Europe/Zurich').toISOString()==='2026-07-15T19:30:00.000Z');
 check('Zurich winter offset',_pwEventDate('15-12-2026','21:30','Europe/Zurich').toISOString()==='2026-12-15T20:30:00.000Z');
 check('Tokyo offset',_pwEventDate('15-07-2026','21:30','Asia/Tokyo').toISOString()==='2026-07-15T12:30:00.000Z');
 check('Zurich DST transition before rollback',_pwEventDate('25-10-2026','01:30','Europe/Zurich').toISOString()==='2026-10-24T23:30:00.000Z');
 check('Zurich DST transition after rollback',_pwEventDate('25-10-2026','03:30','Europe/Zurich').toISOString()==='2026-10-25T02:30:00.000Z');
 const date=new Date(),loc=await getLocation(),prefs=await getPrayerPrefs(),key=monthKey(loc.lat,loc.lng,date.getFullYear(),date.getMonth()+1,prefs),cached=await store.getMeta(key);
 try{const stale=structuredClone(cached);stale.data.forEach(day=>day.timezone='Pacific/Honolulu');await store.setMeta(key,stale);check('Offline cache refreshes after a device timezone change',(await getPrayerDay(date)).timezone===Intl.DateTimeFormat().resolvedOptions().timeZone);}finally{await store.setMeta(key,cached);}
 const invoke=window.__TAURI__.core.invoke,state=await invoke('desktop_state');
 check('Native schedule extends beyond a month',state.schedule.validUntil>Date.now()+30*86400000);
 check('Widget has future prayers',state.schedule.prayers.some(p=>p.at>Date.now()));
 check('Browser SW disabled',(await navigator.serviceWorker.getRegistrations()).length===0);
 openSettings('desktop');await new Promise(r=>setTimeout(r,300));check('Native settings present',document.querySelectorAll('[data-desktop-pref]').length===(state.nativeAvailable?17:16));closeSettings();
 // Public catalog downloads require verified rights; exercise the engine with an authored local PDF.
 const objects=['<< /Type /Catalog /Pages 2 0 R >>','<< /Type /Pages /Kids [3 0 R] /Count 1 >>','<< /Type /Page /Parent 2 0 R /MediaBox [0 0 600 800] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>','<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>'];
 const text='BT /F1 24 Tf 72 720 Td (Sahib native reader smoke test) Tj ET';objects.push(`<< /Length ${text.length} >>\nstream\n${text}\nendstream`);
 let pdf='%PDF-1.4\n';const offsets=[];objects.forEach((object,i)=>{offsets.push(pdf.length);pdf+=`${i+1} 0 obj\n${object}\nendobj\n`;});const xref=pdf.length;pdf+='xref\n0 6\n0000000000 65535 f \n'+offsets.map(n=>String(n).padStart(10,'0')+' 00000 n \n').join('')+`trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
 const book=await addLocalBookFromFile(new File([pdf],'Native reader smoke.pdf',{type:'application/pdf'}));
 try{await openReader(book.id);check('Native PDF reader',_readerTotalPages===1&&document.querySelectorAll('#reader-body canvas').length>0);}finally{_closeReaderFromHistory();await deleteLocalBook(book.id);}
 check('Arbitrary audio paths rejected',await invoke('desktop_preview_audio',{id:'../../private.mp3',volume:0}).then(()=>false,()=>true));
 check('External non-web schemes rejected',await invoke('desktop_open_url',{url:'file:///C:/Windows/win.ini'}).then(()=>false,()=>true));
 return checks;
})()
