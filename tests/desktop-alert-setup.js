(async()=>{
 const checks=[],check=(name,pass)=>checks.push({name,pass:!!pass}),saved=await getPrayerPrefs();
 try{
  await savePrayerPrefs({alerts:{enabled:false,notify:false}});openSettings('alerts');await new Promise(r=>setTimeout(r,350));
  check('Disabled prayer alerts are explicit',document.getElementById('desktop-alert-status')?.textContent.includes('Prayer alerts are off'));
  check('Timing controls cannot imply active alerts',Array.from(document.querySelectorAll('.alert-setting-grid button,.alert-setting-grid select')).every(c=>c.disabled));
  const setup=Array.from(document.querySelectorAll('#desktop-alert-status button')).find(b=>b.textContent.includes('Enable Adhan'));
  check('Explicit Adhan setup is available',!!setup);setup.click();
  let prefs,state;
  for(let i=0;i<150;i++){prefs=await getPrayerPrefs();state=await SahibDesktop.invoke('desktop_state');if(prefs.alerts.enabled&&state.schedule.alerts.some(a=>a.id.endsWith(':time')&&a.sound!=='chime'))break;await new Promise(r=>setTimeout(r,100));}
  check('Adhan setup enables master and at-time playback',prefs.alerts.enabled&&prefs.alerts.atTime&&PRAYER_ALERTABLE.every(name=>prefs.alerts.perPrayer[name].mode==='adhan'));
  check('Adhan setup keeps volume and recordings',prefs.alerts.volume===saved.alerts.volume&&prefs.alerts.audio.standard===saved.alerts.audio.standard&&prefs.alerts.audio.fajr===saved.alerts.audio.fajr);
  check('Notifications remain an explicit choice',prefs.alerts.notify===false);
  check('Adhan setup reaches the native schedule',state.schedule.alerts.some(a=>a.id.includes(':Dhuhr:time')&&a.sound!=='chime'&&a.sound!=='off'));
 }finally{await savePrayerPrefs({alerts:saved.alerts});await SahibDesktop.sync();closeSettings();}
 return checks;
})()
