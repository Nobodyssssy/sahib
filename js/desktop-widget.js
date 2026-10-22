'use strict';
(async()=>{
 const invoke=window.__TAURI__.core.invoke;let state=null;
 const el=id=>document.getElementById(id);
 function render(){if(!state)return;const ar=state.schedule.language==='ar',now=Date.now(),next=state.schedule.prayers.filter(p=>p.at>now).sort((a,b)=>a.at-b.at)[0];document.documentElement.lang=ar?'ar':'en';document.documentElement.dir=ar?'rtl':'ltr';
  for(const [key,value]of Object.entries(state.schedule.theme||{}))if(key.startsWith('--'))document.documentElement.style.setProperty(key,value);
  el('widget').style.opacity=state.prefs.widgetOpacity;
  el('widget-label').textContent=ar?'الصلاة القادمة':'Next prayer';el('widget-name').textContent=next?(ar?next.nameAr:next.name):'Sahib';el('widget-clock').textContent=next?.clock||'—';el('widget-location').textContent=state.schedule.location||(ar?'اختر موقعك في صاحب':'Choose your location in Sahib');
  el('widget-status').textContent=state.schedule.validUntil<now?(ar?'افتح صاحب لتحديث المواقيت':'Open Sahib to refresh prayer times'):(ar?'اسحب من الأعلى لتحريك الأداة':'Drag the header to move');
  const seconds=next?Math.max(0,Math.floor((next.at-now)/1000)):0;el('widget-countdown').textContent=next?[Math.floor(seconds/3600),Math.floor(seconds%3600/60),seconds%60].map(v=>String(v).padStart(2,'0')).join(':'):'—';
  for(const [id,en,arabic]of [['widget-open','Open Sahib','فتح صاحب'],['widget-stop','Stop audio','إيقاف الصوت'],['widget-close','Hide widget','إخفاء الأداة']]){el(id).title=ar?arabic:en;el(id).setAttribute('aria-label',el(id).title);}
 }
 async function refresh(){state=await invoke('desktop_state');render();}
 el('widget-open').onclick=()=>invoke('desktop_show_main');el('widget-stop').onclick=()=>invoke('desktop_stop_audio');el('widget-close').onclick=()=>invoke('desktop_hide_widget');
 document.querySelector('header').addEventListener('mousedown',event=>{if(event.button===0&&!event.target.closest('button'))window.__TAURI__.window.getCurrentWindow().startDragging();});
 await window.__TAURI__.event.listen('sahib:desktop-state',refresh);await refresh();setInterval(render,1000);setInterval(refresh,30000);
})().catch(console.error);
