'use strict';
(async()=>{
 const invoke=window.__TAURI__.core.invoke,el=id=>document.getElementById(id);
 let state=null,remindersKey='',tickKey='',lastHeight=0,refreshTimer,drag=null,ignoreClick=false,movePending=false;
 const families={sahib:['green','tajawal'],aura:['mauve','dm-sans'],dracula:['mauve','inter'],catppuccin:['mauve','manrope'],'rose-pine':['pink','amiri'],'tokyo-night':['blue','cairo']};
 const icons={Fajr:'moon',Sunrise:'sunrise',Dhuhr:'sun',Asr:'cloud',Maghrib:'sunset',Isha:'moon'},action=action=>invoke('desktop_widget_action',{action});
 const icon=name=>{const svg=document.createElementNS('http://www.w3.org/2000/svg','svg'),use=document.createElementNS('http://www.w3.org/2000/svg','use');svg.setAttribute('class','wi');svg.setAttribute('aria-hidden','true');use.setAttribute('href','#wi-'+name);svg.append(use);return svg;};
 const put=(id,value)=>{if(el(id).textContent!==value)el(id).textContent=value;};
 function moments(){const now=Date.now(),s=state.schedule;return {now,next:s.prayers.find(p=>p.at>now),day:(s.widgetDays||[]).find(d=>d.start<=now&&d.end>now)};}
 function fit(){
  if(!state||document.body.dataset.mode==='taskbar'&&!state.widgetExpanded)return;
  requestAnimationFrame(()=>{const card=el('widget'),style=getComputedStyle(card),children=[...card.children].filter(child=>getComputedStyle(child).display!=='none');const height=Math.ceil(children.reduce((sum,child)=>sum+(child.id==='widget-reminders'?Math.min(child.scrollHeight,144):child.getBoundingClientRect().height),0)+parseFloat(style.paddingTop)+parseFloat(style.paddingBottom)+parseFloat(style.rowGap)*(children.length-1)+16);if(Math.abs(height-lastHeight)>=2){lastHeight=height;invoke('desktop_widget_size',{height}).catch(console.error);}});
 }
 function tick(){
  if(!state)return;const {now,next,day}=moments(),key=[next?.at,day?.start,state.schedule.validUntil<now].join(':');
  if(key!==tickKey){tickKey=key;renderContent();return;}
  const seconds=next?Math.max(0,Math.floor((next.at-now)/1000)):0;
  const value=next?[Math.floor(seconds/3600),Math.floor(seconds%3600/60),seconds%60].map(v=>String(v).padStart(2,'0')).join(':'):'—';
  put('widget-countdown',value);put('compact-countdown',value);
  const previous=day?.prayers.filter(p=>p.at<=now).at(-1),progress=previous&&next?Math.max(0,Math.min(1,(now-previous.at)/(next.at-previous.at))):0;el('widget-compact').style.setProperty('--prayer-progress',String(Math.floor(progress*1000)/1000));
  const soon=String(!!next&&next.at-now<=state.prefs.widgetWarningMinutes*60000);if(document.body.dataset.soon!==soon)document.body.dataset.soon=soon;
 }
 function renderContent(){
  if(!state)return;const {schedule:s,prefs:p}=state,ar=s.language==='ar',text=(en,arabic)=>ar?arabic:en,{now,next,day}=moments();
  const root=document.documentElement,theme=s.theme||{},family=p.widgetTheme==='app'?(theme.family||'sahib'):families[p.widgetTheme]?p.widgetTheme:'sahib';
  root.lang=ar?'ar':'en';root.dir=ar?'rtl':'ltr';root.dataset.theme=family;root.dataset.appearance=p.widgetTheme;root.dataset.mode=p.widgetTheme==='windows'?(state.systemLight?'light':'dark'):(theme.mode||'light');root.dataset.accent=p.widgetTheme==='app'?(theme.accent||'green'):families[family][0];root.dataset.font=p.widgetTheme==='windows'?'system':p.widgetTheme==='app'?(theme.font||'tajawal'):families[family][1];
  root.style.cssText='';
  if(p.widgetTheme==='app')for(const [key,value]of Object.entries(theme))if(key.startsWith('--'))root.style.setProperty(key,value);
  if(p.widgetTheme==='app')for(const [key,source]of Object.entries({surface:'--surface',soft:'--surface-2',text:'--text',muted:'--text-muted',line:'--border',accent:'--accent'}))if(theme[source])root.style.setProperty('--widget-'+key,theme[source]);
  root.style.setProperty('--widget-frame-opacity',p.widgetOpacity);
  document.body.dataset.mode=state.view?.effectiveMode||p.widgetMode;document.body.dataset.expanded=String(state.widgetExpanded);
  const name=next?(ar?next.nameAr:next.name):text('Sahib','صاحب'),clock=next?.clock||'—';
  for(const id of ['widget-name','compact-name'])put(id,name);for(const id of ['widget-clock','compact-clock'])put(id,clock);
  put('widget-label',text('Next prayer','الصلاة القادمة'));put('compact-label',text('Remaining','المتبقي'));
  put('widget-location',s.location||text('Choose your location in Sahib','اختر موقعك في صاحب'));
  put('widget-date',day?.label||'');put('widget-hijri',day?.hijri||'');
  put('widget-status',state.view?.fallback?text('No taskbar space · floating','لا مساحة في الشريط · عائمة'):s.validUntil<now?text('Open Sahib to refresh','افتح صاحب للتحديث'):text('Local prayer timetable','مواقيت الصلاة المحلية'));
  el('widget-status').dataset.warning=String(!!state.view?.fallback||s.validUntil<now);
  el('widget-timetable').replaceChildren();for(const prayer of day?.prayers||[]){const row=document.createElement('div');row.className='prayer-row'+(prayer.at<=now?' passed':'')+(prayer.at===next?.at?' next':'');const label=document.createElement('span'),time=document.createElement('time');label.append(icon(icons[prayer.name]||'clock'),document.createTextNode(ar?prayer.nameAr:prayer.name));time.textContent=prayer.clock;row.append(label,time);el('widget-timetable').append(row);}
  const reminders=p.widgetReminders?(day?.reminders||[]):[],key=JSON.stringify([s.language,reminders]);
  if(key!==remindersKey){remindersKey=key;el('widget-reminders').replaceChildren();
   for(const reminder of reminders){const button=document.createElement('button');button.className='widget-reminder';const title=document.createElement('strong'),detail=document.createElement('small');title.textContent=reminder.title;detail.textContent=reminder.detail;const copy=document.createElement('span');copy.className='reminder-copy';copy.append(title,detail);button.append(icon('calendar'),copy,icon('chevron'));button.onclick=()=>action('practice');el('widget-reminders').append(button);}
   if(!reminders.length){const empty=document.createElement('span');empty.className='widget-empty';empty.textContent=text('Your day, with a little more intention.','يومك بذكر ونيّة.');el('widget-reminders').append(empty);}
  }
  put('widget-details-label',text('Full timetable','مواقيت الصلاة'));put('widget-open-label',text('Open Sahib','فتح صاحب'));put('widget-settings-label',text('Settings','الإعدادات'));el('widget-stop').dataset.playing=String(state.audioPlaying);
  for(const [id,en,arabic]of [['widget-compact','Open timetable · drag to position','افتح المواقيت · اسحب لتحديد الموضع'],['widget-settings','Widget settings','إعدادات الأداة'],['widget-open','Open Sahib','فتح صاحب'],['widget-stop','Stop audio','إيقاف الصوت'],['widget-close',p.widgetMode==='taskbar'?'Collapse panel':'Hide widget',p.widgetMode==='taskbar'?'طيّ اللوحة':'إخفاء الأداة'],['widget-refresh','Refresh prayer times','تحديث المواقيت']]){el(id).title=text(en,arabic);el(id).setAttribute('aria-label',text(en,arabic));}
  for(const [target,source]of [['widget-open-top','widget-open'],['widget-settings-footer','widget-settings']]){el(target).title=el(source).title;el(target).setAttribute('aria-label',el(source).getAttribute('aria-label'));}
  el('widget-compact').setAttribute('aria-expanded',String(state.widgetExpanded));tickKey=[next?.at,day?.start,s.validUntil<now].join(':');tick();fit();
 }
 async function refresh(){state=await invoke('desktop_widget_state');renderContent();}
 function queueRefresh(){clearTimeout(refreshTimer);refreshTimer=setTimeout(()=>refresh().catch(console.error),60);}
 el('widget-open-top').onclick=()=>invoke('desktop_show_main');el('widget-settings-footer').onclick=()=>action('settings');
 el('widget-open').onclick=()=>invoke('desktop_show_main');el('widget-stop').onclick=()=>invoke('desktop_stop_audio').then(()=>setTimeout(queueRefresh,100));el('widget-close').onclick=()=>state?.prefs.widgetMode==='taskbar'?action('collapse'):invoke('desktop_hide_widget');el('widget-settings').onclick=()=>action('settings');el('widget-details').onclick=()=>action('timetable');el('widget-compact').onclick=()=>{if(ignoreClick){ignoreClick=false;return;}action('toggle');};el('widget-refresh').onclick=()=>action('refresh');
 const compact=el('widget-compact');
 compact.addEventListener('pointerdown',event=>{if(event.button!==0)return;drag={x:event.screenX};ignoreClick=false;compact.setPointerCapture(event.pointerId);invoke('desktop_widget_drag',{phase:'start'}).catch(console.error);});
 compact.addEventListener('pointermove',event=>{if(!drag||Math.abs(event.screenX-drag.x)<4&&!ignoreClick)return;ignoreClick=true;document.body.dataset.dragging='true';if(!movePending){movePending=true;setTimeout(()=>{movePending=false;if(drag)invoke('desktop_widget_drag',{phase:'move'}).catch(console.error);},40);}});
 compact.addEventListener('pointerup',()=>{if(!drag)return;drag=null;document.body.dataset.dragging='false';invoke('desktop_widget_drag',{phase:ignoreClick?'end':'cancel'}).catch(console.error);});
 compact.addEventListener('pointercancel',()=>{drag=null;document.body.dataset.dragging='false';invoke('desktop_widget_drag',{phase:'cancel'}).catch(console.error);});
 document.querySelector('header').addEventListener('mousedown',event=>{if(document.body.dataset.mode!=='taskbar'&&event.button===0&&!event.target.closest('button'))window.__TAURI__.window.getCurrentWindow().startDragging();});
 document.addEventListener('keydown',event=>{if(event.key==='Escape')action('collapse');});
 new ResizeObserver(fit).observe(el('widget'));
 await window.__TAURI__.event.listen('sahib:desktop-state',queueRefresh);
 await window.__TAURI__.event.listen('sahib:desktop-alert',()=>setTimeout(queueRefresh,400));
 await refresh();setInterval(tick,1000);setInterval(()=>{if(state?.prefs.widgetVisible)queueRefresh();},30000);setInterval(()=>{if(state?.audioPlaying)queueRefresh();},2000);
})().catch(console.error);
