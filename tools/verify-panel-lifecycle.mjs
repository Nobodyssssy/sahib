import fs from 'node:fs';import path from 'node:path';import assert from 'node:assert/strict';import {setTimeout as sleep} from 'node:timers/promises';import {startQA,buildQA} from './desktop-qa-session.mjs';import {qaControl,fixture} from './compare-widget-memory.mjs';import {measureDesktop} from './measure-desktop.mjs';
const out=path.resolve('.qa/panel-lifecycle-'+Date.now()),profile=path.join(out,'data');fs.mkdirSync(out,{recursive:true});let qa,main,widget;const checks=[];
const record=(name,pass,detail)=>{assert.ok(pass,name);checks.push({name,pass,...(detail?{detail}:{})});console.log(name);};
async function until(fn,timeout=25000){const end=Date.now()+timeout;while(Date.now()<end){const value=await fn();if(value)return value;await sleep(200);}throw Error('Wait expired');}
if(!process.argv.includes('--skip-build'))await buildQA(out,['native-widget-rc','brand-preview']);
try{
 qa=await startQA(out,{profile});const control=qaControl(qa);main=await qa.connect('main');await qa.waitReady(main);
 assert.equal(await main.evaluate('window.__TAURI__.app.getIdentifier()'),'com.sahib.companion.qa');await fixture(main);await sleep(500);
 record('Startup keeps the rich panel unloaded',!(await control('status')).webviews.includes('widget'));
 await control('panel');await until(()=>control('panel-timing').then(p=>p.paintedMs&&p.readyMs&&p.navigationFinishedMs));
 const first=await control('panel-timing');record('First open creates the panel on demand',first.firstAfterStartup&&first.kind==='cold',first);
 widget=await qa.connect('desktop-widget');const identity=(await qa.targets()).find(t=>t.url.includes('desktop-widget')).id;
 await control('collapse');await sleep(300);await control('panel');await until(()=>control('panel-timing').then(p=>p.id===2&&p.paintedMs));
 record('Immediate reopen reuses the short warm lease',identity===(await qa.targets()).find(t=>t.url.includes('desktop-widget')).id);
 await widget.evaluate(`window.__TAURI__.core.invoke('desktop_timer_audio',{sound:'off',volume:0})`);
 await widget.evaluate(`window.__TAURI__.core.invoke('desktop_timer',{action:'start',seconds:120,repeat:false,focus:true})`);
 widget.close();widget=null;await control('collapse');await until(()=>control('status').then(s=>s.mainVisible&&!s.webviews.includes('widget')));
 record('Closed panel unloads while the main window remains visible',true);
 await control('panel');await until(()=>control('panel-timing').then(p=>p.id===3&&p.paintedMs));widget=await qa.connect('desktop-widget');
 const restored=await widget.evaluate(`(async()=>{const s=await window.__TAURI__.core.invoke('desktop_widget_state');return {remaining:s.timer.deadline-Date.now(),focus:s.timer.focus,location:s.schedule.location,collapsed:document.getElementById('timer-controls').hidden}})()`);
 record('Cold reopen restores the running timer and authoritative data',restored.remaining>0&&restored.focus&&restored.collapsed&&restored.location==='Zurich memory fixture',restored);
 await widget.evaluate(`window.__TAURI__.core.invoke('desktop_timer',{action:'stop'})`);widget.close();widget=null;
 await control('collapse');await main.evaluate(`SahibDesktop.preferences('widgetRenderer','web')`);widget=await qa.connect('desktop-widget');
 record('Compatibility compact remains live',await until(()=>widget.evaluate(`!document.hidden&&document.body.dataset.mode==='taskbar'&&document.body.dataset.expanded==='false'`)));
 await main.evaluate(`SahibDesktop.preferences('widgetMode','floating')`);record('Floating mode remains visible',await until(()=>widget.evaluate(`!document.hidden&&document.body.dataset.mode==='floating'`)));
 widget.close();widget=null;await main.evaluate(`(async()=>{await SahibDesktop.preferences('widgetMode','taskbar');await SahibDesktop.preferences('widgetRenderer','native');})()`);
 await main.evaluate(`window.__TAURI__.window.getCurrentWindow().close()`).catch(()=>{});main.close();main=null;await control('collapse');await until(()=>control('status').then(s=>!s.mainExists&&!s.webviews.length));
 const idle=await measureDesktop(qa.app.pid,10,5);record('Closed rich windows leave a native-only process tree',idle.samples.at(-1).processes.every(p=>p.name==='sahib-desktop'),{workingSetMiB:idle.meanWorkingSetMiB,cpu:idle.cpuSystemPercent});
 fs.writeFileSync(path.join(out,'results.json'),JSON.stringify({checks,idle},null,2));console.log('Report '+out);
}finally{main?.close();widget?.close();if(qa)await qa.stop();}
