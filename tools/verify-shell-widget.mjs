import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {setTimeout as sleep} from 'node:timers/promises';
export async function verifyShellWidget({pid,state,output,record,report}){
 const ps=(file,args=[])=>{const r=spawnSync('powershell.exe',['-NoProfile','-File',path.resolve(file),...args],{encoding:'utf8',windowsHide:true});if(r.status)throw Error(r.stderr);return JSON.parse(r.stdout);};
 const start=ps('tools/shell-key-probe.ps1',['-Action','start']);await sleep(600);
 try{
  const s=await state(),pixels=[];
  for(const[label,v]of Object.entries(s.widgetViews)){
   const actual=s.widgetWindows.find(w=>w.label===label);if(!actual)continue;
   const [x,y,width,height]=v.bounds,p=ps('tools/widget-zorder-probe.ps1',['-TargetProcess',String(pid),'-X',String(x),'-Y',String(y),'-Width',String(width),'-Height',String(height),'-Capture',path.join(output,label+'-start-menu.png')]);pixels.push(p);
   record(label+' stays visible with Windows Start/Search',p.visible&&!p.coveredByTaskbar&&p.hitHandle===p.handle,JSON.stringify({start,p,lifted:v.shellLifted}));
  }
  report.shellStart={start,pixels};
 }finally{ps('tools/shell-key-probe.ps1',['-Action','escape']);}
}
