// Repeatable comparison of the same experimental binary/profile fixture.
import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {setTimeout as sleep} from 'node:timers/promises';
import {startQA,buildQA} from './desktop-qa-session.mjs';
import {measureDesktop} from './measure-desktop.mjs';
import {startWindowFixture} from './qa-window-fixture.mjs';
export function qaControl(qa){let id=0;return async(action,values={})=>{
 const request={...values,id:++id,action},file=path.join(qa.profile,'qa-control.json'),tmp=file+'.tmp';fs.writeFileSync(tmp,JSON.stringify(request));fs.renameSync(tmp,file);
 for(let n=0;n<300;n++){try{const r=JSON.parse(fs.readFileSync(path.join(qa.profile,'qa-response.json'),'utf8'));if(r.id===id){if(r.error)throw Error(r.error);return r.result;}}catch(e){if(!['ENOENT'].includes(e.code)&&!(e instanceof SyntaxError))throw e;}await sleep(100);}throw Error('QA control timeout '+action);
};}
export async function fixture(main){
 await main.evaluate('(async()=>{await savePrayerPrefs({provider:"local",alerts:{enabled:false,notify:false,volume:0}});await setManualLocation(47.3769,8.5417,"Zurich memory fixture");await SahibDesktop.sync();await SahibDesktop.preferences("widgetMode","taskbar");await SahibDesktop.preferences("widgetTheme","windows");await SahibDesktop.preferences("widgetEdge","right");await SahibDesktop.preferences("widgetVisible",true);await SahibDesktop.preferences("closeToTray",true);await store.setMeta("memoryFixture",{text:"IndexedDB survives",blob:new Blob(["persistent blob"])});localStorage.setItem("memory-fixture","persistent setting");showView("view-home")})()');
}
// Importable helpers do not launch an experiment by themselves.
if(process.argv[1]&&path.resolve(process.argv[1])===path.resolve(new URL(import.meta.url).pathname.replace(/^\/(.:)/,'$1'))){await compare();}
async function compare(){
 const output=path.resolve('.qa',`widget-memory-comparison-${Date.now()}`);fs.mkdirSync(output,{recursive:true});
 const report={started:new Date().toISOString(),runs:[],errors:[]};let qa,fixtureWindow;
 try{
  if(!process.argv.includes('--skip-build'))await buildQA(output,['native-widget-experiment']);
  fixtureWindow=await startWindowFixture(output);
  const rounds=Number(process.argv.find(a=>a.startsWith('--rounds='))?.split('=')[1]||2);
  for(let round=1;round<=rounds;round++)for(const mode of round%2?['keep','unload','native']:['native','unload','keep']){
   const folder=path.join(output,`${round}-${mode}`);fs.mkdirSync(folder,{recursive:true});qa=await startQA(folder,{env:{SAHIB_MEMORY_EXPERIMENT:mode}});const control=qaControl(qa),main=await qa.connect('main');await qa.waitReady(main);const startupMs=Date.now()-qa.start;
   if(await main.evaluate('window.__TAURI__.app.getIdentifier()')!=='com.sahib.companion.qa')throw Error('Not QA');await fixture(main);await control('reveal');
   if(!(await control('status')).mainVisible)throw Error('Main window is not actually visible');
   await sleep(10000);const open=await measureDesktop(qa.app.pid,30);console.log(JSON.stringify({round,mode,state:'open',...open,samples:undefined}));
   await main.evaluate('openCat("sabah");window.__TAURI__.window.getCurrentWindow().close()');
   if(mode!=='keep'){let gone=false;for(let i=0;i<100;i++){if(!(await control('status')).mainExists){gone=true;break;}await sleep(200);}if(!gone)throw Error('Main window did not unload');}
   await fixtureWindow.command({mode:'normal'});
   const snapshot=await control('status');let views;
   if(mode==='native')views=Object.values(snapshot.native);
   else{const widget=await qa.connect('desktop-widget.html');views=await widget.evaluate('window.__TAURI__.core.invoke("desktop_state").then(s=>Object.values(s.widgetViews))');widget.close();}
   const visibility=[];
   for(const v of views){const [x,y,width,height]=v.bounds;const r=spawnSync('powershell.exe',['-NoProfile','-File',path.resolve('tools/widget-zorder-probe.ps1'),'-TargetProcess',String(qa.app.pid),'-X',String(x),'-Y',String(y),'-Width',String(width),'-Height',String(height)],{encoding:'utf8',windowsHide:true});if(r.status)throw Error(r.stderr);const probe=JSON.parse(r.stdout);visibility.push(probe);if(!probe.visible||probe.hitClass!=='Tauri Window'||probe.hitHandle!==probe.handle)throw Error('Compact widget not physically visible for measurement');}
   await sleep(10000);const background=await measureDesktop(qa.app.pid,30);console.log(JSON.stringify({round,mode,state:'background',...background,samples:undefined}));
   const status=await control('status');const restoreAt=Date.now();await control('open');const restored=mode==='keep'?main:await qa.connect('main');await qa.waitReady(restored);await sleep(300);
   const persistence=await restored.evaluate('(async()=>{const m=await store.getMeta("memoryFixture"),p=await getPrayerPrefs();return {idb:m?.text==="IndexedDB survives"&&await m.blob.text()==="persistent blob",setting:localStorage.getItem("memory-fixture")==="persistent setting",category:currentCat,view:document.querySelector(".view.active")?.id,provider:p.provider,location:(await getLocation()).label,futureSchedule:(await SahibDesktop.invoke("desktop_state")).schedule.validUntil>Date.now()+30*86400000}})()');
   if(!persistence.idb||!persistence.setting||persistence.category!=='sabah'||!persistence.futureSchedule)throw Error('Persistence regression '+mode);
   report.runs.push({round,mode,startupMs,restoreMs:Date.now()-restoreAt,open,background,status,persistence,visibility});fs.writeFileSync(path.join(output,'report.json'),JSON.stringify(report,null,2));
   restored.close();main.close();await qa.stop();qa=null;
  }
 }catch(e){report.errors.push(e.stack);process.exitCode=1;}finally{await qa?.stop();await fixtureWindow?.stop();report.finished=new Date().toISOString();report.pass=!report.errors.length;fs.writeFileSync(path.join(output,'report.json'),JSON.stringify(report,null,2));console.log(output);}
}
