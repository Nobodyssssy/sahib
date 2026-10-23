'use strict';
/* Platform adapter. This file is injected only into the packaged desktop entry. */
window.SahibDesktop=(()=>{
 const available=!!window.__TAURI__,invoke=(name,args)=>window.__TAURI__.core.invoke(name,args);
 let started=false,busy=false,again=false,revision=0,timer,state=null,lastError='',audioPlaying=false;
 const imported=new Map(),ar=()=>window.SAHIB_I18N?.language==='ar',text=(en,arabic)=>ar()?arabic:en;
 const nameAR={Fajr:'الفجر',Dhuhr:'الظهر',Asr:'العصر',Maghrib:'المغرب',Isha:'العشاء'};
 function error(err){lastError=String(err?.message||err);console.warn('[desktop]',lastError);if(typeof toast==='function')toast(text('Windows: ','ويندوز: ')+lastError,'alert');}
 async function refresh(){state=await invoke('desktop_state');audioPlaying=state.audioPlaying;if(state.audioError&&lastError!==state.audioError)error(state.audioError);return state;}
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
   try{location=await getLocation();}catch(err){if(err.code!=='NO_LOCATION')throw err;await invoke('desktop_sync_schedule',{schedule:{alerts:[],prayers:[],location:'',language:ar()?'ar':'en',theme:{},validUntil:now}});return;}
   for(let i=0;i<35;i++){
    const date=new Date();date.setHours(12,0,0,0);date.setDate(date.getDate()+i);
    const day=await getPrayerDay(date);if(day)days.push(day);
   }
   if(!days.length)throw Error(text('Set a location and load prayer times first.','اختر موقعك وحمّل مواقيت الصلاة أولاً.'));
   const prayers=[],alerts=[],sounds={};
   if(prefs.alerts.enabled)for(const kind of ['standard','fajr'])sounds[kind]=await sound(kind,prefs);
   for(const day of days)for(const name of Object.keys(nameAR)){
    const date=_pwEventDate(day.date,day.timings[name],day.timezone);if(!date||date.getTime()<=now)continue;
    const at=date.getTime(),label=ar()?nameAR[name]:name,clock=formatPrayerTime(day.timings[name],prefs.timeFormat);
    prayers.push({name,nameAr:nameAR[name],at,clock});
    if(!prefs.alerts.enabled)continue;
    const choice=prefs.alerts.perPrayer[name]||{},mode=choice.mode||(choice.alert===false||choice.sound===false?'off':'chime');if(mode==='off')continue;
    const add=(kind,time)=>{if(time<=now)return;alerts.push({id:`prayer:${day.date}:${name}:${kind}`,at:time,title:`${ar()?'صاحب':'Sahib'} · ${label}`,body:kind==='time'?`${label} · ${clock}`:text(`${label} in ${prefs.alerts.leadMinutes} minutes · ${clock}`,`${label} بعد ${prefs.alerts.leadMinutes} دقيقة · ${clock}`),sound:kind==='lead'?'chime':mode==='adhan'?sounds[name==='Fajr'?'fajr':'standard']:'chime',volume:prefs.alerts.volume,notify:!!prefs.alerts.notify});};
    if(prefs.alerts.atTime)add('time',at);
    add('lead',at-Math.max(1,prefs.alerts.leadMinutes||10)*60000);
   }
   await SahibPractice.init();alerts.push(...SahibPractice.nativeSchedule(days));
   const styles=getComputedStyle(document.documentElement),theme={};
   for(const [widget,app]of Object.entries({'--surface':'--color-surface-raised','--surface-2':'--color-surface','--text':'--color-text-primary','--text-muted':'--color-text-secondary','--border':'--color-border','--accent':'--color-accent','--font-ui':'--font-ui','--font-display':'--font-display'}))theme[widget]=styles.getPropertyValue(app).trim();
   if(buildRevision!==revision)return;
   await invoke('desktop_sync_schedule',{schedule:{alerts,prayers,location:location.label||`${location.lat}, ${location.lng}`,language:ar()?'ar':'en',theme,validUntil:Math.max(...prayers.map(p=>p.at),now)}});
   lastError='';await refresh();
  }catch(err){error(err);}finally{busy=false;if(again){again=false;queueSync();}}
 }
 function queueSync(){revision++;clearTimeout(timer);timer=setTimeout(sync,450);}
 async function invalidateAlerts(){revision++;try{await refresh();await invoke('desktop_sync_schedule',{schedule:{...state.schedule,alerts:[],prayers:state.schedule.prayers.filter(p=>p.at>Date.now())}});}catch(err){error(err);}queueSync();}
 async function preview(kind,volume,prefs){try{prefs=prefs||await getPrayerPrefs();await invoke('desktop_preview_audio',{id:await sound(kind,prefs),volume:Number(volume??prefs.alerts.volume)});audioPlaying=true;return true;}catch(err){error(err);return false;}}
 async function preferences(key,value){try{await refresh();const args={prefs:{...state.prefs},autostart:null};if(key==='autostart')args.autostart=value;else args.prefs[key]=value;await invoke('desktop_set_preferences',args);await refresh();if(_settingsTab==='desktop')await settings();}catch(err){error(err);}}
 async function settings(){
  await refresh();const p=state.prefs,check=(key,en,arabic,value=p[key])=>`<label class="desktop-option"><span>${text(en,arabic)}</span><input type="checkbox" data-desktop-pref="${key}" ${value?'checked':''}></label>`;
  const body=document.getElementById('settings-body');body.innerHTML=`<section class="settings-card"><h3>${text('Sahib on Windows','صاحب على ويندوز')}</h3><p class="settings-note">${text('Reminders continue in the system tray. Quit stops them; Sahib does not wake a sleeping PC.','تستمر التنبيهات في علبة النظام. إنهاء التطبيق يوقفها، ولا يوقظ صاحب الحاسوب النائم.')}</p>${check('closeToTray','Keep running when I close the window','الاستمرار عند إغلاق النافذة')}${check('autostart','Start with Windows','التشغيل مع ويندوز',state.autostart)}${check('startMinimized','Start in the system tray','البدء في علبة النظام')}${check('widgetVisible','Show prayer widget','إظهار أداة الصلاة')}${check('widgetAlwaysOnTop','Keep widget above other windows','إبقاء الأداة فوق النوافذ')}${check('widgetClickThrough','Let clicks pass through the widget','تمرير النقرات عبر الأداة')}<p class="settings-note">${text('Restore widget clicks from the Sahib tray menu. Drag its header to move it.','يمكن إعادة تفاعل الأداة من قائمة صاحب في علبة النظام. اسحب رأسها لتحريكها.')}</p><label class="desktop-option"><span>${text('Widget opacity','عتامة الأداة')}</span><input type="range" min="50" max="100" step="5" value="${Math.round(p.widgetOpacity*100)}" data-desktop-pref="widgetOpacity"></label><p class="settings-note">${text('Scheduled until','المواقيت محفوظة حتى')} ${new Date(state.schedule.validUntil||Date.now()).toLocaleDateString(ar()?'ar':'en-GB')} · ${state.schedule.alerts.length} ${text('enabled alerts','تنبيه مفعّل')}</p><button class="io-btn" id="desktop-refresh">${text('Refresh native schedule','تحديث جدول التنبيهات')}</button><button class="io-btn" id="desktop-stop">${text('Stop audio','إيقاف الصوت')}</button><p class="settings-note">${text('This Windows app has its own private data. Use Data → export/import to bring a browser backup.','بيانات تطبيق ويندوز مستقلة. استخدم البيانات ← التصدير والاستيراد لنقل نسخة المتصفح.')}</p><p id="desktop-error" role="status">${esc(lastError)}</p></section>`;
  body.querySelectorAll('[data-desktop-pref]').forEach(input=>input.onchange=()=>preferences(input.dataset.desktopPref,input.type==='range'?Number(input.value)/100:input.checked));
  document.getElementById('desktop-refresh').onclick=async()=>{await sync();settings();};document.getElementById('desktop-stop').onclick=()=>invoke('desktop_stop_audio');body.removeAttribute('aria-busy');
 }
 async function init(){
  if(!available||started)return;started=true;
  try{
   await refresh();
   SETTINGS_TABS.push('desktop');const button=document.createElement('button');button.type='button';button.className='settings-tab';button.dataset.settingsTab='desktop';button.setAttribute('role','tab');button.textContent=text('Windows','ويندوز');button.onclick=()=>setSettingsTab('desktop');document.getElementById('settings-tabs').append(button);
   const render=renderSettingsBody;renderSettingsBody=async()=>_settingsTab==='desktop'?settings():render();
   const removeAudio=clearLocalAdhan;clearLocalAdhan=async kind=>{await removeAudio(kind);if(!await store.getMeta(ADHAN_LOCAL_KEYS[kind])){await invoke('desktop_remove_audio',{kind});imported.delete(kind);}};
   const about=_aboutHTML;_aboutHTML=()=>`<section class="settings-section"><h3>${text('Sahib for Windows · Preview 0.1.1','صاحب لويندوز · نسخة تجريبية 0.1.1')}</h3><p>${text('Native reminders, tray and prayer widget. The website uses its own service worker.','تنبيهات أصلية وعلبة نظام وأداة للصلاة. يستخدم الموقع عامل الخدمة الخاص به.')}</p></section>`+about();
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
   await window.__TAURI__.event.listen('sahib:desktop-state',refresh);
   await window.__TAURI__.event.listen('sahib:desktop-error',event=>error(event.payload));
   await window.__TAURI__.event.listen('sahib:desktop-alert',event=>toast(event.payload.body,'bell'));
   for(const event of ['sahib:prayerprefs','sahib:prayerchange','sahib:prayercsv','sahib:practicechange','sahib:themechange','sahib:languagechange'])window.addEventListener(event,()=>{button.textContent=text('Windows','ويندوز');if(event==='sahib:languagechange'&&_settingsTab==='desktop')settings();if(['sahib:prayerprefs','sahib:practicechange'].includes(event))invalidateAlerts();else queueSync();});
   document.addEventListener('click',event=>{const link=event.target.closest('a[href]');if(link&&/^https?:/.test(link.href)&&new URL(link.href).origin!==location.origin){event.preventDefault();invoke('desktop_open_url',{url:link.href}).catch(error);}});
   setInterval(()=>refresh().catch(error),5000);setInterval(queueSync,6*3600000);queueSync();
  }catch(err){error(err);}
 }
 window.addEventListener('sahib:ready',init,{once:true});
 return {available,invoke,init,sync,queueSync,settings,preferences,preview,get state(){return state;},get error(){return lastError;}};
})();
