// Windows acceptance checks against an isolated, packaged Tauri app.
// Uses a different app identity and profile, never the installed Sahib profile.
import fs from 'node:fs';
import path from 'node:path';
import net from 'node:net';
import {spawn,spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {setTimeout as sleep} from 'node:timers/promises';
import {measureDesktop} from './measure-desktop.mjs';
import {verifyWidgetWindows} from './verify-widget-windows.mjs';
import {soakWidget} from './widget-soak.mjs';

if(process.platform!=='win32')throw Error('Desktop acceptance requires Windows and WebView2.');
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
process.chdir(root);
const output=path.join(root,'.qa',`windows-acceptance-${Date.now()}`),profile=path.join(output,'data');
fs.mkdirSync(profile,{recursive:true});
const config=path.join(output,'tauri-qa.json');
fs.writeFileSync(config,JSON.stringify({identifier:'com.sahib.companion.qa',productName:'Sahib QA'}));
const report={started:new Date().toISOString(),commit:spawnSync('git',['rev-parse','HEAD'],{encoding:'utf8',windowsHide:true}).stdout?.trim(),dirty:!!spawnSync('git',['status','--porcelain'],{encoding:'utf8',windowsHide:true}).stdout?.trim(),tests:[],errors:[],audioHardware:process.argv.includes('--media')};
let app,session,log,manualPreferences;
function run(binary,args){return new Promise((resolve,reject)=>{
 const child=spawn(binary,args,{cwd:root,stdio:'inherit',windowsHide:true});
 child.once('error',reject);child.once('exit',code=>code===0?resolve():reject(Error(`Build exited ${code}`)));
});}
async function freePort(){return new Promise((resolve,reject)=>{
 const server=net.createServer();server.once('error',reject);server.listen(0,'127.0.0.1',()=>{
  const port=server.address().port;server.close(error=>error?reject(error):resolve(port));
 });
});}
async function connect(target){
 const socket=new WebSocket(target.webSocketDebuggerUrl);let id=0;const pending=new Map();
 await new Promise((resolve,reject)=>{socket.onopen=resolve;socket.onerror=reject;});
 socket.onmessage=event=>{const message=JSON.parse(event.data);if(message.id&&pending.has(message.id)){
  const entry=pending.get(message.id);pending.delete(message.id);clearTimeout(entry.timer);
  message.error?entry.reject(Error(message.error.message)):entry.resolve(message.result);
 }};
 socket.onclose=()=>{for(const entry of pending.values()){clearTimeout(entry.timer);entry.reject(Error('WebView closed'));}pending.clear();};
 function send(method,params={}){return new Promise((resolve,reject)=>{
  const request=++id,timer=setTimeout(()=>{pending.delete(request);reject(Error(`${method} timed out`));},60000);
  pending.set(request,{resolve,reject,timer});socket.send(JSON.stringify({id:request,method,params}));
 });}
 await send('Runtime.enable');await send('Page.enable');
 return {
  send,
  async evaluate(expression){const response=await send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});
   if(response.exceptionDetails)throw Error(response.exceptionDetails.exception?.description||response.exceptionDetails.text);
   return response.result?.value;
  },
  async screenshot(name){const {data}=await send('Page.captureScreenshot',{format:'png'});fs.writeFileSync(path.join(output,name),Buffer.from(data,'base64'));},
  close(){socket.close();}
 };
}
async function start(){
 const startupAt=Date.now();
 const port=await freePort();log=fs.openSync(path.join(output,'app.log'),'a');
 app=spawn(path.join(root,'src-tauri','target','debug','sahib-desktop.exe'),[],{
  cwd:root,windowsHide:true,stdio:['ignore',log,log],
  env:{...process.env,SAHIB_TEST_DATA_DIR:profile,SAHIB_TEST_CDP_PORT:String(port)}
 });
 app.on('error',error=>report.errors.push(String(error)));
 let targets,lastError;const startupDeadline=Date.now()+90000;
 while(Date.now()<startupDeadline){
  if(app.exitCode!==null)throw Error(`QA app exited during startup (${app.exitCode})`);
  try{targets=await(await fetch(`http://127.0.0.1:${port}/json/list`,{signal:AbortSignal.timeout(1000)})).json();if(targets.some(t=>t.url==='https://tauri.localhost/'||t.url==='https://tauri.localhost/index.html'))break;}catch(error){lastError=String(error);}
  await sleep(200);
 }
 const target=targets?.find(t=>t.url==='https://tauri.localhost/'||t.url==='https://tauri.localhost/index.html');
 if(!target){
  report.startupDiagnostics={targets:targets?.map(t=>({type:t.type,url:t.url})),lastError,
   processes:spawnSync('powershell.exe',['-NoProfile','-Command',"Get-Process sahib-desktop,msedgewebview2 -ErrorAction SilentlyContinue | Select-Object ProcessName,Id,SessionId,Responding | ConvertTo-Json -Compress"],{encoding:'utf8',windowsHide:true}).stdout?.trim()};
  console.error(JSON.stringify(report.startupDiagnostics));throw Error('QA WebView did not start within 90 seconds');
 }
 session=await connect(target);
 for(let i=0;i<150;i++){
  if(await session.evaluate('!!window.SahibDesktop?.state')){(report.startupSamplesMs??=[]).push(Date.now()-startupAt);return {port,targets};}
  await sleep(200);
 }
 throw Error('Desktop adapter did not become ready');
}
async function stop(){
 if(session){
  try{await session.evaluate('(async()=>{await SahibDesktop.preferences("closeToTray",false);setTimeout(()=>window.__TAURI__.window.getCurrentWindow().close(),100);return true})()');}catch{}
  session.close();session=null;
 }
 if(app&&app.exitCode===null){await Promise.race([new Promise(resolve=>app.once('exit',resolve)),sleep(5000)]);if(app.exitCode===null)app.kill();}
 if(log!==undefined){fs.closeSync(log);log=undefined;}
}
function record(name,pass,detail){report.tests.push({name,pass:!!pass,...(detail?{detail}: {})});if(!pass)throw Error(name);}
async function expressionTest(file){
 const checks=await session.evaluate(fs.readFileSync(path.join(root,file),'utf8'));
 if(!Array.isArray(checks)||!checks.length)throw Error(`${file} returned no checks`);
 report.tests.push(...checks.map(check=>({...check,suite:file})));
 console.log(`${file}: ${checks.filter(c=>c.pass).length}/${checks.length}`);
 if(checks.some(check=>check.pass!==true))throw Error(`${file} failed`);
}
try{
 const cli=path.join(root,'node_modules','@tauri-apps','cli','tauri.js');
 if(!process.argv.includes('--skip-build'))await run(process.execPath,[cli,'build','--debug','--no-bundle','--config',config,'--','--locked']);
 const {port}=await start();
 record('Separate QA identity',await session.evaluate('window.__TAURI__.app.getIdentifier()')==='com.sahib.companion.qa');
 await session.evaluate('(async()=>{await savePrayerPrefs({provider:"local",alerts:{enabled:false,notify:false,volume:0}});await setManualLocation(47.3769,8.5417,"Zurich acceptance fixture");await SahibDesktop.sync();return true})()');
 for(const file of ['tests/desktop-navigation.js','tests/desktop-smoke.js','tests/desktop-cancellation.js','tests/desktop-chime-schedule.js','tests/desktop-widget-reminders.js'])await expressionTest(file);
 if(report.audioHardware){await expressionTest('tests/desktop-media.js');await expressionTest('tests/desktop-scheduled-audio.js');}
 await session.evaluate('(async()=>{document.querySelector("[data-nav=home]").click();await SahibDesktop.preferences("widgetVisible",true);return true})()');
 await sleep(500);await session.screenshot('main.png');
 const current=await(await fetch(`http://127.0.0.1:${port}/json/list`)).json();
 const widget=await connect(current.find(t=>t.url.includes('desktop-widget.html')));
 try{
  let widgetReady=false;
  for(let i=0;i<50;i++){
   widgetReady=await widget.evaluate('(async()=>{const state=await window.__TAURI__.core.invoke("desktop_state"),next=state.schedule.prayers.filter(p=>p.at>Date.now()).sort((a,b)=>a.at-b.at)[0];return !!next&&document.getElementById("widget-clock")?.textContent===next.clock&&document.getElementById("widget-name")?.textContent===(state.schedule.language==="ar"?next.nameAr:next.name)})()');
   if(widgetReady)break;await sleep(100);
  }
  record('Widget uses the shared next prayer',widgetReady);
  const payload=await widget.evaluate('(async()=>{const i=window.__TAURI__.core.invoke;return {full:JSON.stringify(await i("desktop_state")).length,widget:JSON.stringify(await i("desktop_widget_state")).length}})()');
  record('Widget receives a small presentation packet',payload.widget<payload.full,JSON.stringify(payload));
  await widget.evaluate('window.qaReminderNode=document.getElementById("widget-reminders").firstChild;window.qaPrayerNode=document.getElementById("widget-timetable").firstChild');await sleep(2200);
  record('Countdown ticks retain prayer and reminder elements',await widget.evaluate('qaReminderNode===document.getElementById("widget-reminders").firstChild&&qaPrayerNode===document.getElementById("widget-timetable").firstChild'));
  await session.evaluate('(async()=>{const s=await SahibDesktop.invoke("desktop_state");await SahibDesktop.invoke("desktop_sync_schedule",{schedule:{...s.schedule,alerts:[],prayers:[],widgetDays:[],validUntil:Date.now()-1}})})()');await sleep(300);
  record('Expired timetable asks to refresh instead of showing stale prayers',await widget.evaluate('document.getElementById("widget-status").textContent==="Open Sahib to refresh"&&document.getElementById("widget-countdown").textContent==="—"'));
  await session.evaluate('window.__TAURI__.event.emitTo("main","sahib:clock-changed")');
  let rebuilt=false;for(let i=0;i<100;i++){rebuilt=await session.evaluate('SahibDesktop.invoke("desktop_state").then(s=>s.schedule.validUntil>Date.now()+30*86400000)');if(rebuilt)break;await sleep(100);}
  record('Native clock-change event rebuilds the shared timetable',rebuilt);await sleep(300);
  record('Widget cannot invoke main-only commands',await widget.evaluate('window.__TAURI__.core.invoke("desktop_preview_audio",{id:"qatami",volume:0}).then(()=>false,()=>true)'));
  await widget.screenshot('widget.png');
  if(report.audioHardware){
   await session.evaluate('SahibDesktop.invoke("desktop_preview_audio",{id:"qatami",volume:0})');await sleep(350);
   await widget.evaluate('document.getElementById("widget-stop").click()');await sleep(350);
   record('Widget stop button stops native adhan',await session.evaluate('SahibDesktop.invoke("desktop_state").then(s=>!s.audioPlaying)'));
  }
  const savedPresentation=await session.evaluate('window.__TAURI__.core.invoke("desktop_state")');
  if(process.argv.includes('--baseline-probe')||process.argv.includes('--reliability')){
   await session.evaluate('SahibDesktop.preferences("widgetMode","taskbar")');await sleep(800);
   const s=await session.evaluate('SahibDesktop.invoke("desktop_state")'),[x,y,width,height]=s.widgetViews.widget.bounds;
   const probe=(cover,file)=>{const r=spawnSync('powershell.exe',['-NoProfile','-File',path.join(root,'tools/widget-zorder-probe.ps1'),'-TargetProcess',String(app.pid),'-X',String(x),'-Y',String(y),'-Width',String(width),'-Height',String(height),...(cover?['-Cover']:[]),'-Capture',path.join(output,file)],{encoding:'utf8',windowsHide:true});if(r.status)throw Error(r.stderr);return JSON.parse(r.stdout.replace(/^\uFEFF/,''));};
   report.zorderProbe=[probe(false,'zorder-before.png'),probe(true,'zorder-covered.png')];await sleep(6500);report.zorderProbe.push(probe(false,'zorder-after-watchdog.png'));console.log(JSON.stringify(report.zorderProbe));
   if(process.argv.includes('--baseline-probe'))record('Baseline reproduces visible-but-covered widget',report.zorderProbe.at(-1).coveredByTaskbar);else {record('Taskbar z-order recovery without a visibility toggle',!report.zorderProbe.at(-1).coveredByTaskbar&&report.zorderProbe.at(-1).visible&&report.zorderProbe.at(-1).handle===report.zorderProbe[0].handle);report.widgetDiagnostics=await session.evaluate('SahibDesktop.invoke("desktop_state").then(s=>s.widgetDiagnostics)');}
   await session.evaluate('SahibDesktop.preferences("widgetMode",'+JSON.stringify(savedPresentation.prefs.widgetMode)+')');await sleep(400);
  }
  for(const theme of ['sahib','aura','dracula','catppuccin','rose-pine','tokyo-night','windows']){
   for(const mode of ['light','dark']){
   await session.evaluate(`(async()=>{const s=await SahibDesktop.invoke('desktop_state');s.schedule.theme.mode=${JSON.stringify(mode)};await SahibDesktop.invoke('desktop_sync_schedule',{schedule:s.schedule})})()`);
   await session.evaluate(`SahibDesktop.preferences('widgetTheme',${JSON.stringify(theme)})`);await sleep(350);
   record(`Widget ${theme} ${mode} appearance`,await widget.evaluate(`document.documentElement.dataset.theme===${JSON.stringify(theme==='windows'?'sahib':theme)}&&getComputedStyle(document.getElementById('widget-stop')).color!==getComputedStyle(document.getElementById('widget-stop')).backgroundColor`));
   await widget.screenshot(`widget-${theme}-${mode}.png`);
   }
  }
  await session.evaluate(`(async()=>{await SahibDesktop.preferences('widgetMode','taskbar');await SahibDesktop.preferences('widgetTheme','windows')})()`);await sleep(350);
  const geometry=await session.evaluate('SahibDesktop.invoke("desktop_state")');
  const fallback=geometry.widgetViews?.widget?.fallback;
  record(fallback?'Floating fallback when Explorer has no usable taskbar':'Taskbar compact view',await widget.evaluate(fallback?'getComputedStyle(document.getElementById("widget")).display==="flex"':'getComputedStyle(document.getElementById("widget-compact")).display==="grid"'));
  if(geometry.taskbarBounds){const [left,top,right,bottom]=geometry.taskbarBounds,[x,y,width,height]=geometry.widgetBounds;record('Native widget sits inside the primary taskbar',x>=left&&x+width<=right&&y===top&&height===bottom-top,JSON.stringify({taskbar:geometry.taskbarBounds,widget:geometry.widgetBounds}));}
  else report.tests.push({name:'Native taskbar geometry',pass:true,skipped:true,detail:'No Explorer taskbar on this test host; compact and panel UI still tested.'});
  record('Taskbar reminder fits without clipping',await widget.evaluate('document.getElementById("widget-compact").scrollHeight<=innerHeight'));
  await widget.screenshot('taskbar-compact.png');
  await widget.evaluate('document.getElementById("widget-compact").click()');await sleep(350);
  record('Click opens full taskbar timetable',await widget.evaluate('document.body.dataset.expanded==="true"&&document.querySelectorAll(".prayer-row").length===6'));
  await widget.screenshot('taskbar-panel.png');
  await widget.evaluate('document.getElementById("widget-close").click()');await sleep(250);
  record('Taskbar close collapses without hiding',await widget.evaluate('(async()=>{const s=await window.__TAURI__.core.invoke("desktop_state");return !s.widgetExpanded&&s.prefs.widgetVisible})()'));
  // Staged reminder previews use the actual calendar helper with a Sunday fixture.
  await session.evaluate(`(async()=>{const s=await SahibDesktop.invoke('desktop_state'),d=s.schedule.widgetDays.find(d=>d.start<=Date.now()&&d.end>Date.now());d.reminders=SahibPractice.widgetReminders(new Date(2026,9,25,12));d.label='Sunday · reminder preview';await SahibDesktop.invoke('desktop_sync_schedule',{schedule:s.schedule});await SahibDesktop.preferences('widgetTheme','sahib');await SahibDesktop.invoke('desktop_widget_action',{action:'toggle'})})()`);await sleep(350);await widget.screenshot('taskbar-sunday-preview.png');
  await session.evaluate(`(async()=>{const s=await SahibDesktop.invoke('desktop_state');s.schedule.language='ar';const d=s.schedule.widgetDays.find(d=>d.start<=Date.now()&&d.end>Date.now());d.reminders=[{id:'preview',title:'غداً الاثنين · صيام الاثنين والخميس',detail:'صيام تطوع · حسب التقويم الهجري المختار',kind:'tomorrow'}];d.label='الأحد · معاينة التذكير';d.hijri=new Intl.DateTimeFormat('ar-u-ca-islamic-umalqura',{day:'numeric',month:'long',year:'numeric'}).format(new Date(2026,9,25,12));s.schedule.location='زيورخ · معاينة';await SahibDesktop.invoke('desktop_sync_schedule',{schedule:s.schedule})})()`);await sleep(350);
  if(await widget.evaluate('document.body.dataset.expanded!=="true"')){await widget.evaluate('document.getElementById("widget-compact").click()');await sleep(350);}
  record('Arabic taskbar panel uses RTL',await widget.evaluate('document.body.dataset.expanded==="true"&&document.documentElement.dir==="rtl"&&document.getElementById("widget-label").textContent==="الصلاة القادمة"'));
  await widget.screenshot('taskbar-arabic-preview.png');
  await widget.evaluate('document.getElementById("widget-settings").click()');await sleep(350);
  record('Widget settings button opens native controls',await session.evaluate('!!document.querySelector("#settings-body [data-desktop-pref=widgetMode]")'));
  await session.evaluate('closeSettings()');
  if(process.argv.includes('--windows')){manualPreferences=await verifyWidgetWindows({session,widget,port,connect,output,record,report});Object.assign(savedPresentation.prefs,manualPreferences);}
  await session.evaluate(`(async()=>{await SahibDesktop.invoke('desktop_set_preferences',{prefs:${JSON.stringify(savedPresentation.prefs)},autostart:null});await SahibDesktop.invoke('desktop_sync_schedule',{schedule:${JSON.stringify(savedPresentation.schedule)}});await SahibDesktop.invoke('desktop_widget_action',{action:'collapse'})})()`);
  const soakMinutes=Number(process.argv.find(a=>a.startsWith('--soak-minutes='))?.split('=')[1]||0);
  if(soakMinutes>0)await soakWidget({pid:app.pid,session,output,minutes:soakMinutes,record,report});
 }finally{widget.close();}
 const eventId=`acceptance:hidden:${Date.now()}`;
 record('Main window closes to tray',await session.evaluate(`(async()=>{const invoke=window.__TAURI__.core.invoke,state=await invoke('desktop_state');await invoke('desktop_set_preferences',{prefs:{...state.prefs,closeToTray:true,startMinimized:true,widgetOpacity:0.8},autostart:null});await invoke('desktop_sync_schedule',{schedule:{...state.schedule,alerts:[{id:${JSON.stringify(eventId)},at:Date.now()+1500,title:'Silent acceptance test',body:'',sound:'off',volume:0,notify:false}]}});await window.__TAURI__.window.getCurrentWindow().close();return !await window.__TAURI__.window.getCurrentWindow().isVisible()})()`));
 let fired=false;
 for(let i=0;i<80;i++){
  try{fired=Object.hasOwn(JSON.parse(fs.readFileSync(path.join(profile,'desktop-state.json'),'utf8')).fired,eventId);}catch{}
  if(fired)break;await sleep(500);
 }
 record('Native event fires while the main window is hidden',fired);
 await stop();await start();
 const restarted=await session.evaluate('(async()=>{const state=await window.__TAURI__.core.invoke("desktop_state");return {hidden:!await window.__TAURI__.window.getCurrentWindow().isVisible(),prefs:state.prefs}})()');
 record('Start minimized survives restart',restarted.hidden&&restarted.prefs.startMinimized);
 record('Widget preferences survive restart',restarted.prefs.widgetVisible&&restarted.prefs.widgetOpacity===0.8);
 if(manualPreferences){await sleep(2500);record('Both displays and manual positions survive restart',restarted.prefs.widgetMonitor==='all'&&restarted.prefs.widgetEdge==='manual'&&Object.keys(restarted.prefs.widgetPositions).length===Object.keys(manualPreferences.widgetPositions).length&&Object.entries(manualPreferences.widgetPositions).every(([name,x])=>restarted.prefs.widgetPositions[name]===x)&&await session.evaluate('SahibDesktop.invoke("desktop_state").then(s=>s.widgetWindows.length===s.monitors.length)'));}
 const persisted=JSON.parse(fs.readFileSync(path.join(profile,'desktop-state.json'),'utf8'));
 record('Fired-event ledger survives restart',Object.hasOwn(persisted.fired,eventId));
 if(process.argv.includes('--measure')){
  await session.evaluate(`(async()=>{await SahibDesktop.preferences('widgetMode','taskbar');await SahibDesktop.preferences('widgetTheme','sahib');await SahibDesktop.preferences('widgetMonitor','primary')})()`);
  await sleep(5000);console.log('Measuring isolated app idle usage with the main window hidden…');
  const savedAt=fs.statSync(path.join(profile,'desktop-state.json')).mtimeMs;
  report.idle=await measureDesktop(app.pid);console.log(JSON.stringify({...report.idle,samples:undefined}));
  record('Idle countdown does not rewrite native settings or schedules',fs.statSync(path.join(profile,'desktop-state.json')).mtimeMs===savedAt);
 }
}catch(error){report.errors.push(error.stack||String(error));process.exitCode=1;
 try{await session?.screenshot('failure.png');}catch{}
}finally{
 await stop();report.finished=new Date().toISOString();report.pass=!report.errors.length&&report.tests.every(test=>test.pass===true);
 fs.writeFileSync(path.join(output,'report.json'),JSON.stringify(report,null,2));
 console.log(JSON.stringify({pass:report.pass,checks:report.tests.length,report:path.join(output,'report.json'),errors:report.errors},null,2));
}
