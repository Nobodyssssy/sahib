import fs from 'node:fs';import path from 'node:path';import assert from 'node:assert/strict';import {setTimeout as sleep} from 'node:timers/promises';import {startQA,buildQA} from './desktop-qa-session.mjs';import {qaControl,fixture} from './compare-widget-memory.mjs';import {measureDesktop} from './measure-desktop.mjs';
const out=path.resolve('.qa/panel-lifecycle-'+Date.now()),profile=path.join(out,'data');fs.mkdirSync(out,{recursive:true});let qa,main,widget;const checks=[];
const record=(name,pass,detail)=>{assert.ok(pass,name+(detail?' ' +JSON.stringify(detail):''));checks.push({name,pass,...(detail?{detail}:{})});console.log(name)};
async function until(fn,timeout=20000){const end=Date.now()+timeout;while(Date.now()<end){const result=await fn();if(result)return result;await sleep(200);}throw Error('Wait expired');}
if(!process.argv.includes('--skip-build'))await buildQA(out,['native-widget-rc','brand-preview']);
try{
 qa=await startQA(out,{profile});const control=qaControl(qa);main=await qa.connect('main');await qa.waitReady(main);if(await main.evaluate('window.__TAURI__.app.getIdentifier()')!=='com.sahib.companion.qa')throw Error('Isolated QA build required');await fixture(main);await sleep(2500);
 const loaded=await until(()=>control('panel-timing').then(p=>p.suspended));record('Opportunistic preload suspends the hidden widget',loaded===true);
 await control('panel');const first=await until(()=>control('panel-timing').then(p=>p.paintedMs?p:false));record('First startup open reuses preloaded panel',first.firstAfterStartup&&first.kind==='warm',first);
 widget=await qa.connect('desktop-widget');const identity=(await qa.targets()).find(t=>t.url.includes('desktop-widget')).id;
 await main.evaluate('document.querySelector("[data-nav=tasbih]").click()');record('Full main remains responsive after panel suspension',await until(()=>main.evaluate('document.querySelector(".view.active").id==="view-tasbih"')));
 await main.evaluate(`(async()=>{await window.__TAURI__.core.invoke('desktop_timer_audio',{sound:'off',volume:0});await window.__TAURI__.core.invoke('desktop_timer',{action:'start',seconds:60,repeat:false,focus:true});await SahibDesktop.preferences('startMinimized',true);})()`);
 widget.close();widget=null;await main.evaluate(`window.__TAURI__.window.getCurrentWindow().close()`).catch(()=>{});main.close();main=null;await until(()=>control('status').then(s=>!s.mainExists));await control('collapse');await sleep(3000);record('Collapsed panel is suspended',await control('panel-timing').then(p=>p.suspended));
 await control('panel');await until(()=>control('panel-timing').then(p=>p.id===2&&p.paintedMs));widget=await qa.connect('desktop-widget');record('Warm reopen keeps the same WebView',identity===(await qa.targets()).find(t=>t.url.includes('desktop-widget')).id);
 const state=await widget.evaluate(`(async()=>{const s=await window.__TAURI__.core.invoke('desktop_widget_state');return {location:s.schedule.location,remaining:Math.ceil((s.timer.deadline-Date.now())/1000),shown:document.getElementById('timer-countdown').textContent,focus:s.timer.focus}})()`);
 record('Warm reopen hydrates current location and running timer',state.location==='Zurich memory fixture'&&state.remaining>0&&state.remaining<58&&state.focus&&Math.abs(state.shown.split(':').reduce((m,n)=>m*60+Number(n),0)-state.remaining)<=1,state);
 await widget.evaluate(`window.__TAURI__.core.invoke('desktop_timer',{action:'stop'})`);widget.close();widget=null;
 await control('collapse');await control('open');main=await qa.connect('main');await qa.waitReady(main);await sleep(500);await main.evaluate(`SahibDesktop.preferences('widgetRenderer','web')`);widget=await qa.connect('desktop-widget');
 record('Compatibility compact resumes from a suspended cached panel',await until(()=>widget.evaluate(`!document.hidden&&document.body.dataset.mode==='taskbar'&&document.body.dataset.expanded==='false'`)));
 await main.evaluate(`SahibDesktop.preferences('widgetMode','floating')`);record('Floating mode remains visible and live',await until(()=>widget.evaluate(`!document.hidden&&document.body.dataset.mode==='floating'`)));
 widget.close();widget=null;await main.evaluate(`(async()=>{await SahibDesktop.preferences('widgetMode','taskbar');await SahibDesktop.preferences('widgetRenderer','native');})()`);

 await main.evaluate(`window.__TAURI__.window.getCurrentWindow().close()`).catch(()=>{});main.close();main=null;await until(()=>control('status').then(s=>!s.mainExists));await control('collapse');await qa.stop();
 fs.rmSync(path.join(profile,'qa-response.json'),{force:true});qa=await startQA(out,{profile,env:{SAHIB_PANEL_IDLE_MS:'5000'}});const secondControl=qaControl(qa);await secondControl('status');
 await secondControl('panel');await until(()=>secondControl('panel-timing').then(p=>p.paintedMs&&p.readyMs&&p.navigationFinishedMs));await secondControl('collapse');await until(()=>secondControl('panel-timing').then(p=>p.suspended));
 await until(()=>secondControl('status').then(s=>!s.webviews.includes('widget')),25000);await sleep(3000);
 const idle=await measureDesktop(qa.app.pid,10,5);record('Idle eviction returns to native-only process tree',idle.samples.at(-1).processes.every(p=>p.name==='sahib-desktop'),{ws:idle.meanWorkingSetMiB,private:idle.meanPrivateWorkingSetMiB,commit:idle.meanPrivateCommitMiB,cpu:idle.cpuSystemPercent});
 await secondControl('panel');const cold=await until(()=>secondControl('panel-timing').then(p=>p.id===2&&p.paintedMs?p:false));record('Panel recreates correctly after idle eviction',cold.kind==='cold',cold);
 widget=await qa.connect('desktop-widget');const text=await widget.evaluate(`({name:document.getElementById('widget-name').textContent,clock:document.getElementById('widget-clock').textContent,location:document.getElementById('widget-location').textContent})`);record('Recreated panel retains authoritative data',text.location==='Zurich memory fixture'&&text.name!=='Sahib'&&text.clock!=='—',text);
 fs.writeFileSync(path.join(out,'results.json'),JSON.stringify({checks,idle},null,2));console.log('Report '+out);
}finally{main?.close();widget?.close();if(qa)await qa.stop();}
