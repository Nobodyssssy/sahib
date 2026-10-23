'use strict';
/* Platform adapter. This file is injected only into the packaged desktop entry. */
window.SahibDesktop=(()=>{
 const available=!!window.__TAURI__,invoke=(name,args)=>window.__TAURI__.core.invoke(name,args);
 let started=false,busy=false,again=false,revision=0,timer,state=null,lastError='',audioPlaying=false;
 const imported=new Map(),ar=()=>window.SAHIB_I18N?.language==='ar',text=(en,arabic)=>ar()?arabic:en;
 const nameAR={Fajr:'الفجر',Dhuhr:'الظهر',Asr:'العصر',Maghrib:'المغرب',Isha:'العشاء'};
 function error(err){lastError=String(err?.message||err);console.warn('[desktop]',lastError);if(typeof toast==='function')toast(text('Windows: ','ويندوز: ')+lastError,'alert');}
 async function refresh(){state=await invoke('desktop_state');audioPlaying=state.audioPlaying;if(state.audioError&&lastError!==state.audioError)error(state.audioError);return state;}
 function presentation(){const styles=getComputedStyle(document.documentElement),theme={};for(const [widget,app]of Object.entries({'--surface':'--color-surface-raised','--surface-2':'--color-surface','--text':'--color-text-primary','--text-muted':'--color-text-secondary','--border':'--color-border','--accent':'--color-accent','--font-ui':'--font-ui','--font-display':'--font-display'}))theme[widget]=styles.getPropertyValue(app).trim();return Object.assign(theme,{family:SAHIB_THEME.state.theme,mode:SAHIB_THEME.state.mode,accent:SAHIB_THEME.state.accent,font:SAHIB_THEME.state.font});}
 async function sound(kind,prefs){
  const selected=prefs.alerts.audio[kind];
  if(selected!=='local')return (ADHAN_BUNDLED[kind].find(s=>s.id===selected)||ADHAN_BUNDLED[kind][0]).id;
  const saved=await store.getMeta(ADHAN_LOCAL_KEYS[kind]);
  if(!saved?.blob)throw Error(text('Import the local adhan again in Alerts.','أعد استيراد الأذان المحلي من التنبيهات.'));
  const signature=`${saved.ts}:${saved.size}:${saved.name}`;
  if(imported.get(kind)!==signature){
   const encoded=await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result.split(',')[1]);reader.onerror=reject;reader.readAsDataURL(saved.blob);});
   await invoke('desktop_save_audio',{kind,encoded});imported.set(kind,signature);
  }
  return 'local-'+kind;
 }
 async function sync(){
  if(!available||!started)return;if(busy){again=true;return;}busy=true;const buildRevision=revision;
  try{
   const prefs=await getPrayerPrefs(),now=Date.now(),days=[];let location;
   try{location=await getLocation();}catch(err){if(err.code!=='NO_LOCATION')throw err;await invoke('desktop_sync_schedule',{schedule:{alerts:[],prayers:[],location:'',language:ar()?'ar':'en',theme:presentation(),validUntil:now}});return;}
   for(let i=0;i<35;i++){
    const date=new Date();date.setHours(12,0,0,0);date.setDate(date.getDate()+i);
    const day=await getPrayerDay(date);if(day)days.push(day);
   }
   if(!days.length)throw Error(text('Set a location and load prayer times first.','اختر موقعك وحمّل مواقيت الصلاة أولاً.'));
   const prayers=[],alerts=[],sounds={};
   for(const day of days)for(const name of Object.keys(nameAR)){
    const date=_pwEventDate(day.date,day.timings[name],day.timezone);if(!date||date.getTime()<=now)continue;
    const at=date.getTime(),label=ar()?nameAR[name]:name,clock=formatPrayerTime(day.timings[name],prefs.timeFormat);
    prayers.push({name,nameAr:nameAR[name],at,clock});
    if(!prefs.alerts.enabled)continue;
    const choice=prefs.alerts.perPrayer[name]||{},mode=choice.mode||(choice.alert===false||choice.sound===false?'off':'chime');if(mode==='off')continue;
    if(mode==='adhan'&&prefs.alerts.atTime){const kind=name==='Fajr'?'fajr':'standard';if(!(kind in sounds))sounds[kind]=await sound(kind,prefs);}
    const add=(kind,time)=>{if(time<=now)return;alerts.push({id:`prayer:${day.date}:${name}:${kind}`,at:time,title:`${ar()?'صاحب':'Sahib'} · ${label}`,body:kind==='time'?`${label} · ${clock}`:text(`${label} in ${prefs.alerts.leadMinutes} minutes · ${clock}`,`${label} بعد ${prefs.alerts.leadMinutes} دقيقة · ${clock}`),sound:kind==='lead'?'chime':mode==='adhan'?sounds[name==='Fajr'?'fajr':'standard']:'chime',volume:prefs.alerts.volume,notify:!!prefs.alerts.notify});};
    if(prefs.alerts.atTime)add('time',at);
    add('lead',at-Math.max(1,prefs.alerts.leadMinutes||10)*60000);
   }
   await SahibPractice.init();alerts.push(...SahibPractice.nativeSchedule(days));
   const widgetDays=days.map(day=>{
    const date=_pwDateFormat(day.date),tomorrow=new Date(date);tomorrow.setDate(date.getDate()+1);
    const nextDate=`${String(tomorrow.getDate()).padStart(2,'0')}-${String(tomorrow.getMonth()+1).padStart(2,'0')}-${tomorrow.getFullYear()}`;
    return {start:_pwEventDate(day.date,'00:00',day.timezone).getTime(),end:_pwEventDate(nextDate,'00:00',day.timezone).getTime(),label:date.toLocaleDateString(ar()?'ar':'en-GB',{weekday:'long',day:'numeric',month:'long'}),hijri:new Intl.DateTimeFormat(ar()?'ar-u-ca-islamic-umalqura':'en-u-ca-islamic-umalqura',{day:'numeric',month:'long',year:'numeric'}).format(date),prayers:['Fajr','Sunrise','Dhuhr','Asr','Maghrib','Isha'].map(name=>({name,nameAr:nameAR[name]||'الشروق',at:_pwEventDate(day.date,day.timings[name],day.timezone).getTime(),clock:formatPrayerTime(day.timings[name],prefs.timeFormat)})),reminders:SahibPractice.widgetReminders(date)};
   });
   const theme=presentation();
   if(buildRevision!==revision)return;
   await invoke('desktop_sync_schedule',{schedule:{alerts,prayers,widgetDays,location:location.label||`${location.lat}, ${location.lng}`,language:ar()?'ar':'en',theme,validUntil:Math.max(...prayers.map(p=>p.at),now)}});
   lastError='';await refresh();
  }catch(err){error(err);}finally{busy=false;if(again){again=false;queueSync();}}
 }
 function queueSync(){revision++;clearTimeout(timer);timer=setTimeout(sync,450);}
 async function invalidateAlerts(){revision++;try{await refresh();await invoke('desktop_sync_schedule',{schedule:{...state.schedule,alerts:[],prayers:state.schedule.prayers.filter(p=>p.at>Date.now())}});}catch(err){error(err);}queueSync();}
 async function preview(kind,volume,prefs){try{prefs=prefs||await getPrayerPrefs();await invoke('desktop_preview_audio',{id:await sound(kind,prefs),volume:Number(volume??prefs.alerts.volume)});audioPlaying=true;return true;}catch(err){error(err);return false;}}
 async function preferences(key,value){try{await refresh();const args={prefs:{...state.prefs},autostart:null};if(key==='autostart')args.autostart=value;else args.prefs[key]=value;if(key==='widgetMode'&&value==='taskbar')args.prefs.widgetVisible=true;if(key==='widgetOffset'&&args.prefs.widgetEdge==='right'){args.prefs.widgetRightOffset=value;args.prefs.widgetOffset=state.prefs.widgetOffset;}if(key==='widgetOffset'&&args.prefs.widgetEdge==='manual'){const name=state.widgetViews?.widget?.monitor;args.prefs.widgetPositions={...args.prefs.widgetPositions,[name]:value};}await invoke('desktop_set_preferences',args);await refresh();if(_settingsTab==='desktop')await settings();}catch(err){error(err);}}
 async function settings(){
  await refresh();const p=state.prefs;
  const check=(key,en,arabic,value=p[key])=>'<label class="desktop-option"><span>'+text(en,arabic)+'</span><input type="checkbox" data-desktop-pref="'+key+'" '+(value?'checked':'')+'></label>';
  const select=(key,en,arabic,options)=>'<label class="desktop-option"><span>'+text(en,arabic)+'</span><select data-desktop-pref="'+key+'">'+options.map(([v,title])=>'<option value="'+esc(v)+'" '+(p[key]===v?'selected':'')+'>'+esc(title)+'</option>').join('')+'</select></label>';
  const section=(title,content)=>'<section class="settings-card"><h3>'+title+'</h3>'+content+'</section>';
  const note=value=>'<p class="settings-note">'+value+'</p>';
  const number=(key,label,value,min,max)=>'<label class="desktop-option"><span>'+label+'</span><input type="number" min="'+min+'" max="'+max+'" value="'+value+'" data-desktop-pref="'+key+'"></label>';
  const primary=state.widgetViews?.widget,manual=p.widgetPositions?.[primary?.monitor]??p.widgetOffset;
  const placement=check('widgetVisible','Show prayer widget','إظهار أداة الصلاة')+
   select('widgetMode','Placement','الموضع',[['floating',text('Floating widget','أداة عائمة')],['taskbar',text('Taskbar overlay','أداة فوق شريط المهام')]])+
   select('widgetMonitor','Displays','الشاشات',[['primary',text('Primary display','الشاشة الرئيسية')],['all',text('All taskbar displays','كل شاشات شريط المهام')],...(state.monitors||[]).map(n=>[n,n])])+
   select('widgetEdge','Position','الموضع',[['left',text('Left','اليسار')],['right',text('Before notification area','قبل منطقة الإشعارات')],['manual',text('Manual — drag on each display','يدوي — اسحب في كل شاشة')]])+
   number('widgetOffset',text(p.widgetEdge==='manual'?'Position on this display (px)':'Extra spacing (px)',p.widgetEdge==='manual'?'الموضع في هذه الشاشة (بكسل)':'المسافة الإضافية (بكسل)'),p.widgetEdge==='manual'?Math.round(manual):p.widgetEdge==='right'?p.widgetRightOffset:p.widgetOffset,0,4000)+
   note(text('Drag the compact widget along the taskbar to position it. Each display remembers its own position. If space is insufficient, Sahib uses a floating card.','اسحب الأداة المصغّرة على شريط المهام لتحديد موضعها. يُحفظ موضع مستقل لكل شاشة. عند ضيق المساحة تُستخدم بطاقة عائمة.'))+
   '<button class="io-btn" id="desktop-reset-position">'+text('Reset taskbar positions','إعادة ضبط مواضع شريط المهام')+'</button>';
  const appearance=select('widgetTheme','Appearance','المظهر',[['app',text('Follow Sahib','اتباع صاحب')],['windows',text('Windows style','نمط ويندوز')],...SAHIB_THEME.THEMES.map(t=>[t.id,t.label])])+
   '<label class="desktop-option"><span>'+text('Frame opacity','عتامة الإطار')+'</span><input type="range" min="50" max="100" step="5" value="'+Math.round(p.widgetOpacity*100)+'" data-desktop-pref="widgetOpacity"></label>'+
   note(text('The panel and prayer cards stay opaque for readability; opacity adjusts the frame.','تبقى اللوحة وبطاقات الصلاة معتمة لسهولة القراءة؛ يتحكم الإعداد في الإطار.'))+
   check('widgetReminders','Show daily practice and fasting prompts','إظهار الورد وتذكيرات الصيام')+
   number('widgetWarningMinutes',text('Highlight prayer within (minutes)','إبراز الصلاة خلال (دقائق)'),p.widgetWarningMinutes,1,60);
  const startup=check('closeToTray','Keep reminders running when I close the window','استمرار التنبيهات عند إغلاق النافذة')+
   check('autostart','Start with Windows','التشغيل مع ويندوز',state.autostart)+check('startMinimized','Start in the system tray','البدء في علبة النظام')+
   note(text('Quitting Sahib stops reminders. It does not wake a sleeping PC.','إنهاء صاحب يوقف التنبيهات، ولا يوقظ التطبيق الحاسوب النائم.'));
  const advanced=check('widgetAlwaysOnTop','Keep the floating widget above other windows','إبقاء الأداة العائمة فوق النوافذ')+
   check('widgetClickThrough','Pass mouse clicks through the floating widget','تمرير النقرات عبر الأداة العائمة')+
   note(text('Click-through prevents clicking or dragging the floating card. Restore interaction from the Sahib tray menu → Restore widget clicks. Taskbar overlays always accept clicks.','يمنع تمرير النقرات التفاعل مع البطاقة العائمة أو سحبها. لإعادة التفاعل افتح قائمة صاحب في علبة النظام ← إعادة تفاعل الأداة. تبقى أدوات شريط المهام قابلة للنقر.'))+
   note(text('Schedule stored until ','المواقيت محفوظة حتى ')+new Date(state.schedule.validUntil||Date.now()).toLocaleDateString(ar()?'ar':'en-GB'))+
   '<button class="io-btn" id="desktop-refresh">'+text('Refresh reminders','تحديث التنبيهات')+'</button><button class="io-btn" id="desktop-stop">'+text('Stop audio','إيقاف الصوت')+'</button><p id="desktop-error" role="status">'+esc(lastError)+'</p>';
  const body=document.getElementById('settings-body');body.innerHTML=section(text('Widget visibility & placement','ظهور الأداة وموضعها'),placement)+section(text('Widget appearance','مظهر الأداة'),appearance)+section(text('Startup & background','التشغيل والخلفية'),startup)+section(text('Advanced interaction','التفاعل المتقدم'),advanced);
  body.querySelectorAll('[data-desktop-pref]').forEach(input=>input.onchange=()=>preferences(input.dataset.desktopPref,input.type==='range'?Number(input.value)/100:input.type==='number'?Number(input.value):input.tagName==='SELECT'?input.value:input.checked));
  document.getElementById('desktop-reset-position').onclick=async()=>{await refresh();await invoke('desktop_set_preferences',{prefs:{...state.prefs,widgetPositions:{},widgetEdge:'left',widgetOffset:210,widgetRightOffset:0},autostart:null});await settings();};
  document.getElementById('desktop-refresh').onclick=async()=>{await sync();settings();};document.getElementById('desktop-stop').onclick=()=>invoke('desktop_stop_audio');body.removeAttribute('aria-busy');
 }


 async function init(){
  if(!available||started)return;started=true;
  try{
   await refresh();
   SETTINGS_TABS.push('desktop');const button=document.createElement('button');button.type='button';button.className='settings-tab';button.dataset.settingsTab='desktop';button.setAttribute('role','tab');button.textContent=text('Windows','ويندوز');button.onclick=()=>setSettingsTab('desktop');document.getElementById('settings-tabs').append(button);
   const render=renderSettingsBody;renderSettingsBody=async()=>_settingsTab==='desktop'?settings():render();
   const removeAudio=clearLocalAdhan;clearLocalAdhan=async kind=>{await removeAudio(kind);if(!await store.getMeta(ADHAN_LOCAL_KEYS[kind])){await invoke('desktop_remove_audio',{kind});imported.delete(kind);}};
   const about=_aboutHTML;_aboutHTML=()=>`<section class="settings-section"><h3>${text('Sahib for Windows · Preview 0.2.2','صاحب لويندوز · نسخة تجريبية 0.2.2')}</h3><p>${text('Native reminders, tray and prayer widget. The website uses its own service worker.','تنبيهات أصلية وعلبة نظام وأداة للصلاة. يستخدم الموقع عامل الخدمة الخاص به.')}</p></section>`+about();
   const alertsHTML=_alertsHTML;_alertsHTML=async()=>{
    const html=await alertsHTML();return html.replace(/<div class="settings-note">\s*<strong>Browser limits:<\/strong>[\s\S]*?<\/div>/,`<div class="settings-note">${text('Windows reminders and audio continue while Sahib stays in the tray. Quit stops them. Sahib does not wake a sleeping PC.','تستمر تنبيهات ويندوز والأذان ما دام صاحب في علبة النظام. الإنهاء يوقفها، ولا يوقظ التطبيق الحاسوب النائم.')}</div>`);
   };
   playPrayerAdhan=preview;stopPrayerAdhan=()=>{invoke('desktop_stop_audio').catch(error);audioPlaying=false;};adhanPreviewPlaying=()=>audioPlaying;
   PrayerAlerts.previewAdhan=preview;PrayerAlerts.stopAdhan=stopPrayerAdhan;PrayerAlerts.adhanPreviewPlaying=adhanPreviewPlaying;
   PrayerAlerts.previewChime=volume=>invoke('desktop_preview_audio',{id:'chime',volume:volume??0.55});
   PrayerAlerts.requestNotificationPermission=async()=>{const value=await invoke('plugin:notification|request_permission');return value==='granted'?'granted':'denied';};
   PrayerAlerts.notificationState=()=>state?.notificationPermission||'default';
   PrayerAlerts.testNotification=()=>invoke('desktop_test_notification');
   await window.__TAURI__.event.listen('sahib:refresh-schedule',queueSync);
   await window.__TAURI__.event.listen('sahib:clock-changed',async()=>{await invalidateAlerts();if(typeof notifyPrayerSurfaces==='function')notifyPrayerSurfaces('clock-or-timezone');});
   await window.__TAURI__.event.listen('sahib:desktop-state',refresh);
   await window.__TAURI__.event.listen('sahib:desktop-error',event=>error(event.payload));
   await window.__TAURI__.event.listen('sahib:desktop-alert',event=>toast(event.payload.body,'bell'));
   await window.__TAURI__.event.listen('sahib:widget-open',event=>event.payload==='settings'?openSettings('desktop'):event.payload==='timetable'?document.querySelector('[data-nav=prayer]').click():openPracticeView('today'));
   for(const event of ['sahib:prayerprefs','sahib:prayerchange','sahib:prayercsv','sahib:practicechange','sahib:themechange','sahib:languagechange'])window.addEventListener(event,()=>{button.textContent=text('Windows','ويندوز');if(event==='sahib:languagechange'&&_settingsTab==='desktop')settings();if(['sahib:prayerprefs','sahib:practicechange'].includes(event))invalidateAlerts();else queueSync();});
   document.addEventListener('click',event=>{const link=event.target.closest('a[href]');if(link&&/^https?:/.test(link.href)&&new URL(link.href).origin!==location.origin){event.preventDefault();invoke('desktop_open_url',{url:link.href}).catch(error);}});
   setInterval(()=>{if(document.visibilityState==='visible'&&(_settingsTab==='desktop'||audioPlaying))refresh().catch(error)},30000);setInterval(queueSync,6*3600000);queueSync();
  }catch(err){error(err);}
 }
 window.addEventListener('sahib:ready',init,{once:true});
 return {available,invoke,init,sync,queueSync,settings,preferences,preview,get state(){return state;},get error(){return lastError;}};
})();
