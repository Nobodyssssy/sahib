import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {setTimeout as sleep} from 'node:timers/promises';
import {startQA,buildQA} from './desktop-qa-session.mjs';
import {fixture,qaControl} from './compare-widget-memory.mjs';
import {startWindowFixture} from './qa-window-fixture.mjs';
import {measureDesktop} from './measure-desktop.mjs';

const out=path.resolve('.qa','taskbar-widget-'+Date.now());fs.mkdirSync(out,{recursive:true});
const report={checks:[],errors:[]};let qa,windows,main,control;
const record=(name,pass,detail)=>{report.checks.push({name,pass,detail});assert.ok(pass,name);console.log('PASS '+name);};
const ps=(file,args=[])=>{
 const p=spawnSync('powershell.exe',['-NoProfile','-File',path.resolve('tools',file),...args],{encoding:'utf8',windowsHide:true,timeout:30000});
 if(p.status!==0)throw Error(p.stderr||p.stdout||String(p.error));
 return JSON.parse(p.stdout.replace(/^\uFEFF/,''));
};
async function until(fn){for(let i=0;i<100;i++){const v=await fn();if(v)return v;await sleep(100);}throw Error('Native state timeout');}
const visible=async(label,value)=>until(async()=>{const v=(await control('status')).native[label];return v&&v.visible===value&&v;});
const capture=(label,v,suffix)=>ps('widget-zorder-probe.ps1',['-TargetProcess',String(qa.app.pid),'-TargetHandle',String(v.handle),'-X',String(v.bounds[0]),'-Y',String(v.bounds[1]),'-Width',String(v.bounds[2]),'-Height',String(v.bounds[3]),'-Capture',path.join(out,label+'-'+suffix+'.png')]);
try{
 if(!process.argv.includes('--skip-build'))await buildQA(out,['desktop-qa']);
 windows=await startWindowFixture(out);qa=await startQA(out);control=qaControl(qa);
 main=await qa.connect('main');await qa.waitReady(main);await fixture(main);
 await main.evaluate('SahibDesktop.preferences("widgetMonitor","all")');
 await main.evaluate('window.__TAURI__.window.getCurrentWindow().close()');main.close();main=null;
 await until(async()=>!(await control('status')).mainExists);await windows.command({mode:'normal'});
 const initial=await until(async()=>{const s=await control('status');return Object.keys(s.native).length===windows.original.displays.length&&Object.values(s.native).every(v=>v.parent)&&s;});report.initial=initial;
 record('Native compact exists on every physical display',Object.keys(initial.native).length===windows.original.displays.length);
 record('Background has no rich WebView',initial.webviews.length===0);
 for(const [label,v]of Object.entries(initial.native)){
  const actual=capture(label,await visible(label,true),'initial');
  record(label+' physically visible at '+v.scale*100+'%',actual.visible&&!actual.coveredByTaskbar&&actual.hitHandle===actual.handle,actual);
  record(label+' actually paints visible content',actual.paintContrast>100,actual);
  record(label+' physical compact width follows monitor scale',v.bounds[2]===Math.round(240*v.scale));
  record(label+' is a real child of its Explorer taskbar',actual.child&&actual.parent===v.parent&&!actual.topmost,actual);
  record(label+' HWND DPI follows the physical display',actual.dpi===Math.round(96*v.scale),actual);
  for(const mode of ['maximized','fullscreen','borderless-maximized','normal']){
   const actual=await windows.command({mode,display:v.monitor});
   const fullscreen=mode==='fullscreen'||mode==='borderless-maximized'&&actual.bounds.Bottom>=v.bar[3]&&actual.bounds.Top<=v.work[1];
   const current=await visible(label,!fullscreen);record(label+' '+mode,current.visible===!fullscreen,{actual,current});
   if(fullscreen)for(const [other]of Object.entries(initial.native).filter(([key])=>key!==label))record(other+' remains visible during fullscreen elsewhere',(await visible(other,true)).visible);
  }
 }
 const first=Object.entries(initial.native)[0];
 ps('native-widget-input.ps1',['-Handle',String(first[1].handle),'-Action','click']);
 let panel=await qa.connect('desktop-widget');
 await until(()=>panel.evaluate('document.body.dataset.expanded==="true"'));
 await panel.screenshot('native-click-panel.png');
 record('Real native child click opens the existing rich panel',true);
 ps('native-widget-input.ps1',['-Handle',String(first[1].handle),'-Action','space']);
 await until(()=>control('status').then(s=>!s.prefs.widgetExpanded&&!s.webviews.length).catch(()=>false));
 panel.close();
 record('Native child Space closes and evicts the panel',true);
 await windows.command({mode:'normal'});
 const beforeStart=(await control('status')).native;
 const start=ps('shell-key-probe.ps1',['-Action','start']);
 try{
  record('Start menu opened',['StartMenuExperienceHost','SearchHost','SearchApp'].includes(start.process),start);
  for(const [label]of Object.entries(initial.native)){
   const v=await visible(label,true),actual=capture(label,v,'start');
   record(label+' remains accessible during Start',actual.visible&&!actual.coveredByTaskbar&&actual.hitHandle===actual.handle,actual);
   record(label+' stays in exactly the same taskbar slot during Start',v.parent===beforeStart[label].parent&&!v.shellLifted&&JSON.stringify(v.bounds)===JSON.stringify(beforeStart[label].bounds),{before:beforeStart[label],after:v});
  }
 }finally{ps('shell-key-probe.ps1',['-Action','escape']);}
 await windows.command({mode:'normal'});
 const primary=Object.entries(initial.native).find(([label])=>label==='native-widget');
 await windows.command({autoHide:true});await windows.command({mode:'normal'});await windows.command({cursorX:600,cursorY:400});
 record('Compact follows actual taskbar auto-hide',!(await visible(primary[0],false)).visible);
 await windows.command({cursorX:Math.round((primary[1].bar[0]+primary[1].bar[2])/2),cursorY:primary[1].bar[3]-1});
 record('Compact returns on taskbar hover',(await visible(primary[0],true)).visible);
 await windows.command({autoHide:false});await windows.command({mode:'normal'});
 await windows.command({crowded:true});
 try{
  for(const [label]of Object.entries(initial.native)){
   const v=await until(async()=>{const v=(await control('status')).native[label];return v&&v.visible&&v.parent===0&&v.reason==='floating-compact-fallback'&&v;});
   record(label+' crowded taskbar uses a clear fallback above the bar',v.bounds[1]+v.bounds[3]<=v.work[3],v);
  }
 }finally{await windows.command({crowded:false});}
 for(const [label]of Object.entries(initial.native))record(label+' re-embeds after space returns',!!(await until(async()=>{const v=(await control('status')).native[label];return v&&v.visible&&v.parent&&v;})));
 if(process.argv.includes('--restart-explorer')){
  report.explorer=ps('restart-taskbar-qa.ps1');await sleep(3000);
  for(const [label,v]of Object.entries(initial.native)){
   const current=await visible(label,true),actual=capture(label,current,'recovered');
   record(label+' recovers after actual Explorer restart',current.hostProcess!==v.hostProcess&&current.parent!==0&&actual.child&&actual.parent===current.parent&&actual.visible&&!actual.coveredByTaskbar&&actual.hitHandle===actual.handle,{current,actual});
  }
 }
 await windows.command({mode:'normal'});report.idle=await measureDesktop(qa.app.pid,10,5);
 record('Idle process tree contains only native Sahib',report.idle.samples.every(s=>s.processes.every(p=>p.name==='sahib-desktop')),report.idle);
 fs.writeFileSync(path.join(qa.profile,'qa-control.json'),JSON.stringify({id:10000,action:'quit'}));
 await until(()=>qa.app.exitCode!==null);record('Native background Quit exits with code zero',qa.app.exitCode===0,qa.app.exitCode);
}catch(e){report.errors.push(e.stack);console.error(e.stack);process.exitCode=1;}
finally{main?.close();await qa?.stop();await windows?.stop();report.pass=!report.errors.length;fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({pass:report.pass,checks:report.checks.length,out}));}
