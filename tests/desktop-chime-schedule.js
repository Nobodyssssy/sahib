(async()=>{
 const original=await getPrayerPrefs(),saved={};
 for(const kind of ['standard','fajr'])saved[kind]=await store.getMeta(ADHAN_LOCAL_KEYS[kind]);
 const checks=[];
 try{
  for(const kind of ['standard','fajr'])await store.setMeta(ADHAN_LOCAL_KEYS[kind],null);
  const perPrayer=Object.fromEntries(['Fajr','Dhuhr','Asr','Maghrib','Isha'].map(name=>[name,{mode:'chime',alert:true,sound:true}]));
  await savePrayerPrefs({alerts:{enabled:true,notify:false,volume:0,atTime:true,audio:{standard:'local',fajr:'local'},perPrayer}});
  await SahibDesktop.sync();let state;
  for(let i=0;i<100;i++){
   state=await SahibDesktop.invoke('desktop_state');
   if(state.schedule.alerts.some(alert=>alert.id.startsWith('prayer:')))break;
   await new Promise(resolve=>setTimeout(resolve,100));
  }
  const prayers=state.schedule.alerts.filter(alert=>alert.id.startsWith('prayer:'));
  checks.push({name:'Chime reminders work without unused imported recordings',pass:prayers.length>0&&prayers.every(alert=>alert.sound==='chime')});
  checks.push({name:'Widget timetable survives missing unused recordings',pass:state.schedule.prayers.length>0});
  checks.push({name:'No missing-recording error for chime-only reminders',pass:!SahibDesktop.error});
 }finally{
  for(const kind of ['standard','fajr'])await store.setMeta(ADHAN_LOCAL_KEYS[kind],saved[kind]||null);
  await savePrayerPrefs({alerts:original.alerts});await SahibDesktop.sync();
 }
 return checks;
})()
