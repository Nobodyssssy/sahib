import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {setTimeout as sleep} from 'node:timers/promises';
import {buildQA,startQA} from './desktop-qa-session.mjs';
import {fixture} from './compare-widget-memory.mjs';
const output=path.resolve('.qa','fullscreen-live-'+Date.now());
if(!process.argv.includes('--skip-build'))await buildQA(output);
const monitors=JSON.parse(fs.readFileSync('.qa/fullscreen-displays.json','utf8').replace(/^\uFEFF/,''));
const qa=await startQA(output);let main;
const command=path.join(output,'command.json'),response=path.join(output,'response.json'),results=[];
const probe=(...args)=>{const p=spawnSync(path.resolve('.qa/fullscreen-probe.exe'),args.map(String),{encoding:'utf8',windowsHide:true});if(p.status)throw Error(p.stderr);return p.stdout.trim();};
async function until(fn){const end=Date.now()+20000;while(Date.now()<end){const value=await fn();if(value)return value;await sleep(200);}throw Error('Widget visibility did not reach expected state');}
try{
 main=await qa.connect('main');await qa.waitReady(main);
 assert.equal(await main.evaluate('__TAURI__.app.getIdentifier()'),'com.sahib.companion.qa');
 await fixture(main);await main.evaluate(`SahibDesktop.preferences('widgetMonitor','all')`);
 fs.writeFileSync('.qa/fullscreen-live-location.txt',output);
 fs.writeFileSync(path.join(output,'ready.json'),JSON.stringify({ready:true,monitors}));
 console.log('READY '+output);
 let last=0;
 while(true){
  await sleep(200);if(!fs.existsSync(command))continue;
  let request;try{request=JSON.parse(fs.readFileSync(command,'utf8').replace(/^\uFEFF/,''));}catch{continue;}
  if(request.id===last)continue;last=request.id;
  if(request.action==='finish')break;
  await sleep(request.delayMs||0);
  const record={id:request.id,phase:request.phase,foregroundBefore:JSON.parse(probe('--foreground')),renderers:[]};
  try{
   if(request.action==='watch-toggle'){
    await main.evaluate(`SahibDesktop.preferences('widgetRenderer','native')`);
    record.transitions=[];let previous;
    const end=Date.now()+(request.durationMs||30000);
    while(Date.now()<end){
     const state=await main.evaluate(`SahibDesktop.invoke('desktop_state')`);
     const value={expanded:state.widgetExpanded,visible:state.widgetWindows.find(w=>w.label==='widget')?.visible,openId:state.panelTiming.id};
     if(JSON.stringify(value)!==previous){record.transitions.push({at:Date.now(),...value,foreground:JSON.parse(probe('--foreground'))});previous=JSON.stringify(value);}
     await sleep(100);
    }
    record.pass=record.transitions.some((v,i,a)=>v.expanded&&a.slice(i+1).some(w=>!w.expanded&&w.openId===v.openId))&&record.transitions.at(-1)?.expanded===false;
    results.push(record);fs.writeFileSync(path.join(output,'results.json'),JSON.stringify(results,null,2));fs.writeFileSync(response,JSON.stringify(record,null,2));console.log(request.phase+': '+record.pass);continue;
   }
   for(const renderer of ['native','web']){
    await main.evaluate(`SahibDesktop.preferences('widgetRenderer',${JSON.stringify(renderer)})`);
    const views=await until(async()=>{
     const state=await main.evaluate(`SahibDesktop.invoke('desktop_state')`);
     const rows=renderer==='native'?Object.values(state.nativeWidgetViews):Object.entries(state.widgetViews).map(([label,v])=>({...v,visible:state.widgetWindows.find(w=>w.label===label)?.visible}));
     const selected=monitors.map(m=>rows.find(v=>v.monitor===m.name));
     if(selected.some(v=>!v||typeof v.visible!=='boolean'))return false;
     return selected.every((v,i)=>(request.occupied||[]).includes(monitors[i].name)?!v.visible:v.visible)?selected:false;
    });
    const occupancy=monitors.map(m=>({monitor:m.name,fullscreen:probe(m.left,m.top,m.right,m.bottom)==='true'}));
    assert(occupancy.every(v=>v.fullscreen===(request.occupied||[]).includes(v.monitor)),'Shared detector occupancy mismatch');
    record.renderers.push({renderer,views,occupancy,foreground:JSON.parse(probe('--foreground'))});
   }
   record.pass=true;
  }catch(error){record.pass=false;record.error=String(error.stack||error);}
  results.push(record);fs.writeFileSync(path.join(output,'results.json'),JSON.stringify(results,null,2));fs.writeFileSync(response,JSON.stringify(record,null,2));console.log(request.phase+': '+(record.pass?'passed':record.error));
 }
}finally{main?.close();await qa.stop();}
