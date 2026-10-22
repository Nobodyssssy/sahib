(async()=>{
 const originalPrefs=await getPrayerPrefs(),originalGet=getPrayerDay;
 const wait=ms=>new Promise(r=>setTimeout(r,ms));let release,entered=false;
 try{
  await savePrayerPrefs({alerts:{enabled:true,notify:false,volume:0}});await wait(900);await SahibDesktop.sync();await wait(600);
  const gate=new Promise(resolve=>release=resolve);let hold=true;
  getPrayerDay=async date=>{if(hold){hold=false;entered=true;await gate;}return originalGet(date);};
  const pending=SahibDesktop.sync();await wait(50);
  await savePrayerPrefs({alerts:{enabled:false}});await wait(100);release();await pending;
  const state=await SahibDesktop.invoke('desktop_state');
  return [{name:'Settings changed during schedule preparation',pass:entered},{name:'Old schedule cannot re-enable disabled prayer alerts',pass:!state.schedule.alerts.some(a=>a.id.startsWith('prayer:'))}];
 }finally{release?.();getPrayerDay=originalGet;await savePrayerPrefs({alerts:originalPrefs.alerts});await SahibDesktop.sync();}
})()
