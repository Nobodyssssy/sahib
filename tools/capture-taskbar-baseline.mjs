import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {setTimeout as sleep} from 'node:timers/promises';
import {startQA} from './desktop-qa-session.mjs';
import {fixture,qaControl} from './compare-widget-memory.mjs';
import {measureDesktop} from './measure-desktop.mjs';
const out=path.resolve('.qa','taskbar-baseline-'+Date.now());fs.mkdirSync(out,{recursive:true});
let qa,main;
try{
 qa=await startQA(out);main=await qa.connect('main');await qa.waitReady(main);await fixture(main);
 await main.evaluate('SahibDesktop.preferences("widgetMonitor","all")');
 await main.evaluate('window.__TAURI__.window.getCurrentWindow().close()');main.close();main=null;
 const control=qaControl(qa);let status;
 for(let n=0;n<100;n++){status=await control('status');if(!status.mainExists&&Object.keys(status.native).length===2)break;await sleep(100);}
 await sleep(1000);
 const probes=[];
 for(const [label,v]of Object.entries(status.native)){
  const p=spawnSync('powershell.exe',['-NoProfile','-File','tools/widget-zorder-probe.ps1','-TargetProcess',String(qa.app.pid),'-TargetHandle',String(v.handle),'-Capture',path.join(out,label+'.png')],{encoding:'utf8',windowsHide:true,timeout:30000});
  if(p.status)throw Error(p.stderr||p.stdout);probes.push({label,...JSON.parse(p.stdout.replace(/^\uFEFF/,''))});
 }
 const idle=await measureDesktop(qa.app.pid,10,5);
 fs.writeFileSync(path.join(out,'report.json'),JSON.stringify({status,probes,idle},null,2));
 console.log(JSON.stringify({out,probes,workingSetMiB:idle.meanWorkingSetMiB,cpu:idle.cpuSystemPercent}));
 await control('quit');
}finally{main?.close();await qa?.stop();}
