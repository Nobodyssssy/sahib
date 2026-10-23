'use strict';
(async()=>{
 const invoke=window.__TAURI__.core.invoke,el=id=>document.getElementById(id);let state=null,remindersKey='';
 const families={sahib:['green','tajawal'],aura:['mauve','dm-sans'],dracula:['mauve','inter'],catppuccin:['mauve','manrope'],'rose-pine':['pink','amiri'],'tokyo-night':['blue','cairo']};
 const icons={Fajr:'☾',Sunrise:'☀',Dhuhr:'☀',Asr:'◷',Maghrib:'◒',Isha:'☾'};
 const action=action=>invoke('desktop_widget_action',{action});
 function render(){
  if(!state)return;const {schedule:s,prefs:p}=state,ar=s.language==='ar',text=(en,arabic)=>ar?arabic:en,now=Date.now();
  const next=s.prayers.filter(p=>p.at>now).sort((a,b)=>a.at-b.at)[0],day=(s.widgetDays||[]).find(d=>d.start<=now&&d.end>now);
  const root=document.documentElement,theme=s.theme||{},family=p.widgetTheme==='app'?(theme.family||'sahib'):families[p.widgetTheme]?p.widgetTheme:'sahib';
  root.lang=ar?'ar':'en';root.dir=ar?'rtl':'ltr';root.dataset.theme=family;root.dataset.mode=p.widgetTheme==='windows'?(state.systemLight?'light':'dark'):(theme.mode||'light');root.dataset.accent=p.widgetTheme==='app'?(theme.accent||'green'):families[family][0];root.dataset.font=p.widgetTheme==='app'?(theme.font||'tajawal'):families[family][1];
  root.style.cssText='';
  if(p.widgetTheme==='windows'){root.dataset.font='system';root.style.setProperty('--font-display',"'Segoe UI',sans-serif");}
  if(p.widgetTheme==='app')for(const [key,value]of Object.entries(theme))if(key.startsWith('--'))root.style.setProperty(key,value);
  if(p.widgetTheme==='app')for(const [key,source]of Object.entries({surface:'--surface',soft:'--surface-2',text:'--text',muted:'--text-muted',line:'--border',accent:'--accent'}))if(theme[source])root.style.setProperty('--widget-'+key,theme[source]);
  if(p.widgetTheme==='windows')for(const [key,value]of Object.entries(state.systemLight?{surface:'#f3f3f3',soft:'#e7e7e7',text:'#171717',muted:'#505050',line:'#c5c5c5',accent:'#005fb8'}:{surface:'#202020',soft:'#303030',text:'#ffffff',muted:'#d0d0d0',line:'#595959',accent:'#75baff'}))root.style.setProperty('--widget-'+key,value);
  root.style.setProperty('--widget-panel','color-mix(in srgb,var(--widget-surface) '+Math.max(50,p.widgetOpacity*100)+'%,transparent)');
  document.body.dataset.mode=p.widgetMode;document.body.dataset.expanded=String(state.widgetExpanded);document.body.dataset.soon=String(!!next&&next.at-now<=p.widgetWarningMinutes*60000);
  const name=next?(ar?next.nameAr:next.name):text('Sahib','صاحب'),clock=next?.clock||'—',seconds=next?Math.max(0,Math.floor((next.at-now)/1000)):0,countdown=next?[Math.floor(seconds/3600),Math.floor(seconds%3600/60),seconds%60].map(v=>String(v).padStart(2,'0')).join(':'):'—';
  for(const id of ['widget-name','compact-name'])el(id).textContent=name;
  for(const id of ['widget-clock','compact-clock'])el(id).textContent=clock;
  for(const id of ['widget-countdown','compact-countdown'])el(id).textContent=countdown;
  el('widget-label').textContent=text('Next prayer','الصلاة القادمة');el('compact-label').textContent=text('Remaining','المتبقي');
  el('widget-location').textContent=s.location||text('Choose your location in Sahib','اختر موقعك في صاحب');
  el('widget-date').textContent=day?.label||'';el('widget-hijri').textContent=day?.hijri||'';
  el('widget-status').textContent=s.validUntil<now?text('Open Sahib to refresh','افتح صاحب للتحديث'):text('Local prayer timetable','مواقيت الصلاة المحلية');
  el('widget-timetable').replaceChildren();for(const prayer of day?.prayers||[]){const row=document.createElement('div');row.className='prayer-row'+(prayer.at<=now?' passed':'')+(prayer.at===next?.at?' next':'');const label=document.createElement('span'),time=document.createElement('time');label.textContent=(prayer.at<=now?'✓':icons[prayer.name]||'◷')+'  '+(ar?prayer.nameAr:prayer.name);time.textContent=prayer.clock;row.append(label,time);el('widget-timetable').append(row);}
  const reminders=p.widgetReminders?(day?.reminders||[]):[],key=JSON.stringify([s.language,state.widgetExpanded,reminders]);
  if(key!==remindersKey){remindersKey=key;el('widget-reminders').replaceChildren();
  for(const reminder of reminders.slice(0,state.widgetExpanded?30:2)){const button=document.createElement('button');button.className='widget-reminder';const title=document.createElement('strong'),detail=document.createElement('small');title.textContent=reminder.title;detail.textContent=reminder.detail;button.append(title,detail);button.onclick=()=>action('practice');el('widget-reminders').append(button);}
  if(!reminders.length){const empty=document.createElement('span');empty.className='widget-empty';empty.textContent=text('Your day, with a little more intention.','يومك بذكر ونيّة.');el('widget-reminders').append(empty);}
  }
  el('compact-reminder').textContent=reminders.length?'• '+reminders[Math.floor(now/10000)%reminders.length].title:'';
  el('widget-details').textContent=state.widgetExpanded?text('Collapse','طيّ'):text('Today’s timetable','مواقيت اليوم');
  el('widget-stop').dataset.playing=String(state.audioPlaying);
  for(const [id,en,arabic]of [['widget-compact','Open prayer timetable','فتح مواقيت الصلاة'],['widget-settings','Widget settings','إعدادات الأداة'],['widget-open','Open Sahib','فتح صاحب'],['widget-stop','Stop audio','إيقاف الصوت'],['widget-close',p.widgetMode==='taskbar'?'Collapse panel':'Hide widget',p.widgetMode==='taskbar'?'طيّ اللوحة':'إخفاء الأداة'],['widget-refresh','Refresh prayer times','تحديث المواقيت']]){el(id).title=text(en,arabic);el(id).setAttribute('aria-label',text(en,arabic));}
  el('widget-compact').setAttribute('aria-expanded',String(state.widgetExpanded));
 }
 async function refresh(){state=await invoke('desktop_state');render();}
 el('widget-open').onclick=()=>invoke('desktop_show_main');el('widget-stop').onclick=()=>invoke('desktop_stop_audio').then(refresh);el('widget-close').onclick=()=>state?.prefs.widgetMode==='taskbar'?action('collapse'):invoke('desktop_hide_widget');el('widget-settings').onclick=()=>action('settings');el('widget-details').onclick=el('widget-compact').onclick=()=>action('toggle');el('widget-refresh').onclick=()=>action('refresh');
 document.querySelector('header').addEventListener('mousedown',event=>{if(state?.prefs.widgetMode!=='taskbar'&&event.button===0&&!event.target.closest('button'))window.__TAURI__.window.getCurrentWindow().startDragging();});
 document.addEventListener('keydown',event=>{if(event.key==='Escape')action('collapse');});
 await window.__TAURI__.event.listen('sahib:desktop-state',refresh);await refresh();setInterval(render,1000);setInterval(refresh,5000);
})().catch(console.error);
