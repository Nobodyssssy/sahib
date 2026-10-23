import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {setTimeout as sleep} from 'node:timers/promises';

// Promotes the actual Explorer taskbar, not a simulated rectangle. Captures only
// each QA widget's screen region; it never closes/restarts personal applications.
export async function soakWidget({pid,session,output,minutes,record,report}){
 const state=()=>session.evaluate('SahibDesktop.invoke("desktop_state")');
 const invoke=expression=>session.evaluate(expression);
 await invoke('(async()=>{await SahibDesktop.preferences("widgetMode","taskbar");await SahibDesktop.preferences("widgetMonitor","all");await SahibDesktop.preferences("closeToTray",true);await window.__TAURI__.window.getCurrentWindow().close()})()');
 await sleep(1500);
 const start=Date.now(),deadline=start+minutes*60000,samples=[];
 const initial=await state();let cycle=0;
 while(Date.now()<deadline){
  const before=await state(),labels=Object.keys(before.widgetViews),label=labels[cycle%labels.length],v=before.widgetViews[label];
  const [x,y,width,height]=v.bounds;
  const probe=(cover,file)=>{
   const r=spawnSync('powershell.exe',['-NoProfile','-File',path.resolve('tools/widget-zorder-probe.ps1'),'-TargetProcess',String(pid),'-X',String(x),'-Y',String(y),'-Width',String(width),'-Height',String(height),...(cover?['-Cover']:[]),...(file?['-Capture',path.join(output,file)]:[])],{encoding:'utf8',windowsHide:true});
   if(r.status!==0)throw Error(r.stderr);return JSON.parse(r.stdout.replace(/^\uFEFF/,''));
  };
  const promoted=probe(true,cycle<2?`soak-${label}-covered.png`:null);await sleep(350);
  const recovered=probe(false,cycle<2?`soak-${label}-recovered.png`:null);
  const current=await state();
  const logFile=current.widgetLogPath;
  const transitions=fs.existsSync(logFile)?fs.readFileSync(logFile,'utf8').trim().split('\n').map(s=>JSON.parse(s)):[];
  const repair=transitions.find(e=>e.window===label&&e.at>=promoted.actionAt&&e.data.reason==='after-repair');
  const sample={cycle:++cycle,label,promoted,recovered,recoveryLatencyMs:repair?repair.at-promoted.actionAt:null,operations:current.widgetDiagnostics.operations};samples.push(sample);
  report.soak={durationSeconds:(Date.now()-start)/1000,cycles:cycle,initialDiagnostics:initial.widgetDiagnostics,finalDiagnostics:current.widgetDiagnostics,samples};
  if(!recovered.visible||recovered.coveredByTaskbar||recovered.cloaked||recovered.iconic)throw Error('Widget not physically visible after shell promotion: '+JSON.stringify(sample));
  if(promoted.foreground!==recovered.handle&&recovered.foreground===recovered.handle)throw Error('Order recovery changed foreground window: '+JSON.stringify(sample));
  console.log(`Visibility soak: cycle ${cycle}, ${label}, recovery ${sample.recoveryLatencyMs??'no repair needed'} ms, widget did not activate`);
  await sleep(Math.max(0,Math.min(15000,deadline-Date.now())));
 }
 report.soak.durationSeconds=(Date.now()-start)/1000;
 record('Extended physical taskbar visibility and non-activating recovery',samples.length>0&&report.soak.durationSeconds>=minutes*60);

}
