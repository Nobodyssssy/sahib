(async()=>{
 const checks=[],check=(name,pass)=>checks.push({name,pass:!!pass});
 const saved={counters:{...counters},last:store.getLastReset(),timer:(await SahibDesktop.invoke('desktop_state')).timer};
 try{
  counters={c_1:33};await store.saveCounters(counters);await store.setMeta('lastReset','yesterday');
  const result=await Promise.all([store.checkDailyReset(),store.checkDailyReset()]);
  check('Daily reset synchronizes live counters',result.every(Boolean)&&Object.keys(counters).length===0&&Object.keys(store.getCounters()).length===0);
  check('Daily reset persists the current local date',store.getLastReset()===new Date().toDateString());
  counters.c_1=2;await store.saveCounters(counters);check('Same-day progress is retained',!(await store.checkDailyReset())&&counters.c_1===2);
  await store.setMeta('lastReset','yesterday');await store.saveCounters({c_1:99});await store.checkDailyReset();
  check('Pending counter save cannot restore yesterday counts',Object.keys(store.getCounters()).length===0);
  counters.c_1=8;await store.saveCounters(counters);await store.setMeta('lastReset','yesterday');window.dispatchEvent(new Event('focus'));
  for(let i=0;i<30&&store.getLastReset()!==new Date().toDateString();i++)await new Promise(r=>setTimeout(r,50));
  check('Returning to an open app resets the previous day',store.getLastReset()===new Date().toDateString()&&Object.keys(counters).length===0);
  homeOpenPractice('morning-adhkar');check('Morning shortcut opens morning collection',currentCat==='sabah'&&document.getElementById('view-adkar').classList.contains('active'));
  homeOpenPractice('evening-adhkar');check('Evening shortcut opens evening collection',currentCat==='masaa');
  const invoke=SahibDesktop.invoke;
  check('Timer rejects an invalid interval',await invoke('desktop_timer',{action:'start',seconds:0,repeat:false,focus:false}).then(()=>false,()=>true));
  await invoke('desktop_timer',{action:'start',seconds:300,repeat:true,focus:true});let t=(await invoke('desktop_state')).timer;
  check('Native timer starts and persists focus/repeat',t.seconds===300&&t.repeat&&t.focus&&t.deadline>Date.now());
  await invoke('desktop_timer',{action:'restart'});check('Timer restarts with the same duration',(await invoke('desktop_state')).timer.seconds===300);
  await invoke('desktop_timer',{action:'stop'});check('Stopping timer clears focus and deadline',!(await invoke('desktop_state')).timer.focus&&!(await invoke('desktop_state')).timer.deadline);
 }finally{
  counters=saved.counters;await store.saveCounters(counters);await store.setMeta('lastReset',saved.last);lastReset=saved.last;
  if(saved.timer?.deadline>Date.now())await SahibDesktop.invoke('desktop_timer',{action:'start',seconds:Math.max(10,Math.ceil((saved.timer.deadline-Date.now())/1000)),repeat:saved.timer.repeat,focus:saved.timer.focus});
  showView('view-home');
 }
 return checks;
})()
