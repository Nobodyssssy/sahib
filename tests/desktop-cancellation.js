(async()=>{
 const originalPrefs=await getPrayerPrefs(),originalGet=getPrayerDay;
 const wait=ms=>new Promise(r=>setTimeout(r,ms));let release,entered=false;
 try{
  await savePrayerPrefs({alerts:{enabled:true,notify:false,volume:0}});await wait(900);await SahibDesktop.sync();await wait(600);
  const gate=new Promise(resolve=>release=resolve);let hold=true;
  getPrayerDay=async date=>{if(hold){hold=false;entered=true;await gate;}return originalGet(date);};
  const pending=SahibDesktop.sync();await wait(50);
  await savePrayerPrefs({alerts:{enabled:false}});await wait(100);release();await pending;
  // Saving preferences dispatches an async cancellation listener. Wait for that
  // native replacement, rather than racing its bridge reply with this read.
  let state;
  for(let i=0;i<30;i++){state=await SahibDesktop.invoke('desktop_state');if(!state.schedule.alerts.some(a=>a.id.startsWith('prayer:')))break;await wait(100);}
  return [{name:'Settings changed during schedule preparation',pass:entered},{name:'Old schedule cannot re-enable disabled prayer alerts',pass:!state.schedule.alerts.some(a=>a.id.startsWith('prayer:'))}];
 }finally{release?.();getPrayerDay=originalGet;await savePrayerPrefs({alerts:originalPrefs.alerts});await SahibDesktop.sync();}
})()
