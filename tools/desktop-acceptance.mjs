// Windows acceptance checks against an isolated, packaged Tauri app.
// Uses a different app identity and profile, never the installed Sahib profile.
import fs from 'node:fs';
import path from 'node:path';
import net from 'node:net';
import {spawn,spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {setTimeout as sleep} from 'node:timers/promises';

if(process.platform!=='win32')throw Error('Desktop acceptance requires Windows and WebView2.');
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
process.chdir(root);
const output=path.join(root,'.qa',`windows-acceptance-${Date.now()}`),profile=path.join(output,'data');
fs.mkdirSync(profile,{recursive:true});
const config=path.join(output,'tauri-qa.json');
fs.writeFileSync(config,JSON.stringify({identifier:'com.sahib.companion.qa',productName:'Sahib QA'}));
const report={started:new Date().toISOString(),commit:spawnSync('git',['rev-parse','HEAD'],{encoding:'utf8',windowsHide:true}).stdout?.trim(),dirty:!!spawnSync('git',['status','--porcelain'],{encoding:'utf8',windowsHide:true}).stdout?.trim(),tests:[],errors:[],audioHardware:process.argv.includes('--media')};
let app,session,log;
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
 const port=await freePort();log=fs.openSync(path.join(output,'app.log'),'a');
 app=spawn(path.join(root,'src-tauri','target','debug','sahib-desktop.exe'),[],{
  cwd:root,windowsHide:true,stdio:['ignore',log,log],
  env:{...process.env,SAHIB_TEST_DATA_DIR:profile,WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS:`--remote-debugging-port=${port}`}
 });
 app.on('error',error=>report.errors.push(String(error)));
 let targets;
 for(let i=0;i<150;i++){
  if(app.exitCode!==null)throw Error(`QA app exited during startup (${app.exitCode})`);
  try{targets=await(await fetch(`http://127.0.0.1:${port}/json/list`)).json();if(targets.some(t=>t.url==='https://tauri.localhost/'))break;}catch{}
  await sleep(200);
 }
 const target=targets?.find(t=>t.url==='https://tauri.localhost/');if(!target)throw Error('QA WebView did not start');
 session=await connect(target);
 for(let i=0;i<150;i++){
  if(await session.evaluate('!!window.SahibDesktop?.state'))return {port,targets};
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
 await run(process.execPath,[cli,'build','--debug','--no-bundle','--config',config,'--','--locked']);
 const {port}=await start();
 record('Separate QA identity',await session.evaluate('window.__TAURI__.app.getIdentifier()')==='com.sahib.companion.qa');
 await session.evaluate('(async()=>{await savePrayerPrefs({provider:"local",alerts:{enabled:false,notify:false,volume:0}});await setManualLocation(47.3769,8.5417,"Zurich acceptance fixture");await SahibDesktop.sync();return true})()');
 for(const file of ['tests/desktop-navigation.js','tests/desktop-smoke.js','tests/desktop-cancellation.js','tests/desktop-chime-schedule.js'])await expressionTest(file);
 if(report.audioHardware)await expressionTest('tests/desktop-media.js');
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
  record('Widget cannot invoke main-only commands',await widget.evaluate('window.__TAURI__.core.invoke("desktop_preview_audio",{id:"qatami",volume:0}).then(()=>false,()=>true)'));
  await widget.screenshot('widget.png');
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
 const persisted=JSON.parse(fs.readFileSync(path.join(profile,'desktop-state.json'),'utf8'));
 record('Fired-event ledger survives restart',Object.hasOwn(persisted.fired,eventId));
}catch(error){report.errors.push(error.stack||String(error));process.exitCode=1;
 try{await session?.screenshot('failure.png');}catch{}
}finally{
 await stop();report.finished=new Date().toISOString();report.pass=!report.errors.length&&report.tests.every(test=>test.pass===true);
 fs.writeFileSync(path.join(output,'report.json'),JSON.stringify(report,null,2));
 console.log(JSON.stringify({pass:report.pass,checks:report.tests.length,report:path.join(output,'report.json'),errors:report.errors},null,2));
}
