(async()=>{
 const checks=[],check=(name,pass)=>checks.push({name,pass:!!pass});
 check('Desktop adapter loaded',SahibDesktop.available);
 check('Zurich summer offset',_pwEventDate('15-07-2026','21:30','Europe/Zurich').toISOString()==='2026-07-15T19:30:00.000Z');
 check('Zurich winter offset',_pwEventDate('15-12-2026','21:30','Europe/Zurich').toISOString()==='2026-12-15T20:30:00.000Z');
 check('Tokyo offset',_pwEventDate('15-07-2026','21:30','Asia/Tokyo').toISOString()==='2026-07-15T12:30:00.000Z');
 const invoke=window.__TAURI__.core.invoke,state=await invoke('desktop_state');
 check('Native schedule extends beyond a month',state.schedule.validUntil>Date.now()+30*86400000);
 check('Widget has future prayers',state.schedule.prayers.some(p=>p.at>Date.now()));
 check('Browser SW disabled',(await navigator.serviceWorker.getRegistrations()).length===0);
 openSettings('desktop');await new Promise(r=>setTimeout(r,300));check('Native settings present',document.querySelectorAll('[data-desktop-pref]').length===14);closeSettings();
 await openReader('jazariyyah');check('Native PDF reader',_readerTotalPages>0&&document.querySelectorAll('#reader-body canvas').length>0);_closeReaderFromHistory();
 check('Arbitrary audio paths rejected',await invoke('desktop_preview_audio',{id:'../../private.mp3',volume:0}).then(()=>false,()=>true));
 check('External non-web schemes rejected',await invoke('desktop_open_url',{url:'file:///C:/Windows/win.ini'}).then(()=>false,()=>true));
 return checks;
})()
