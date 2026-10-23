(async()=>{
 const checks=[],check=(name,pass)=>checks.push({name,pass:!!pass}),invoke=SahibDesktop.invoke;
 const saved=await invoke('desktop_state'),prefs=await getPrayerPrefs();let unlisten;
 try{
  const events=[];unlisten=await window.__TAURI__.event.listen('sahib:desktop-alert',e=>events.push({event:e.payload,received:Date.now()}));
  const perPrayer=Object.fromEntries(['Fajr','Dhuhr','Asr','Maghrib','Isha'].map(name=>[name,{mode:'adhan'}]));
  await savePrayerPrefs({alerts:{enabled:true,notify:false,volume:0,atTime:true,audio:{standard:'qatami',fajr:'qatami-fajr'},perPrayer}});await SahibDesktop.sync();
  await new Promise(r=>setTimeout(r,700));await SahibDesktop.sync();
  const generated=(await invoke('desktop_state')).schedule.alerts.filter(a=>a.id.endsWith(':time'));
  check('Fajr schedule selects the Fajr adhan',generated.some(a=>a.id.includes(':Fajr:')&&a.sound==='qatami-fajr'));
  check('Other prayers select the standard adhan',generated.some(a=>a.id.includes(':Dhuhr:')&&a.sound==='qatami'));
  // Real native deadlines and output streams at zero volume; no unexpected audible adhan.
  for(const [name,sound]of [['standard','qatami'],['fajr','qatami-fajr'],['practice','off']]){
   const id='acceptance:'+name+':'+Date.now(),at=Date.now()+1500;
   await invoke('desktop_sync_schedule',{schedule:{...saved.schedule,alerts:[{id,at,title:'Sahib verification',body:name,sound,volume:0,notify:false}]}});
   let delivered,playing=false;
   for(let i=0;i<70;i++){
    await new Promise(r=>setTimeout(r,100));const s=await invoke('desktop_state');
    delivered=events.find(e=>e.event.id===id);if(s.audioError)throw Error(s.audioError);
    playing=playing||s.audioPlaying;if(delivered&&(sound==='off'||playing))break;
   }
   check(name+' fires once at its native deadline',!!delivered&&delivered.received>=at&&delivered.received-at<2000&&events.filter(e=>e.event.id===id).length===1);
   if(sound!=='off')check(name+' starts the native audio stream',playing);
   await invoke('desktop_stop_audio');
  }
 }finally{unlisten?.();await invoke('desktop_stop_audio');await savePrayerPrefs({alerts:prefs.alerts});await SahibDesktop.sync();}
 return checks;
})()
