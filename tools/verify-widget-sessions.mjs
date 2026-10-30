import fs from 'node:fs';import path from 'node:path';import {spawnSync} from 'node:child_process';import {setTimeout as sleep} from 'node:timers/promises';
import {startQA,buildQA} from './desktop-qa-session.mjs';import {fixture,qaControl} from './compare-widget-memory.mjs';
import {measureDesktop} from './measure-desktop.mjs';
const out=path.resolve('.qa',`widget-sessions-${Date.now()}`);fs.mkdirSync(out,{recursive:true});const report={tests:[],errors:[]};let qa;
const record=(name,pass,detail)=>{report.tests.push({name,pass:!!pass,detail});console.log((pass?'PASS ':'FAIL ')+name)};
const ps=(file,args)=>{const p=spawnSync('powershell.exe',['-NoProfile','-File',file,...args],{windowsHide:true,encoding:'utf8'});if(p.status)throw Error(p.stderr||p.stdout);return JSON.parse(p.stdout.replace(/^\uFEFF/,''));};
try{
 if(!process.argv.includes('--skip-build'))await buildQA(out,['native-widget-experiment']);
 qa=await startQA(out,{env:{SAHIB_MEMORY_EXPERIMENT:'native'}});const control=qaControl(qa);let main=await qa.connect('main');await qa.waitReady(main);await fixture(main);
 report.tests.push(...await main.evaluate(fs.readFileSync('tests/desktop-daily-reset.js','utf8')));
 await main.evaluate('SahibDesktop.preferences("widgetShowSeconds",false)');
 for(const style of ['landmark','minimal','ribbon']){
  await main.evaluate(`SahibDesktop.preferences('widgetStyle',${JSON.stringify(style)})`);await sleep(2000);
  record(style+' preference applied',await main.evaluate(`SahibDesktop.invoke('desktop_state').then(s=>s.prefs.widgetStyle===${JSON.stringify(style)})`));
  const state=await control('status'),v=state.native['native-widget'];
  const probe=ps('tools/widget-zorder-probe.ps1',['-TargetProcess',String(qa.app.pid),'-TargetHandle',String(v.handle),'-X',String(v.bounds[0]),'-Y',String(v.bounds[1]),'-Width',String(v.bounds[2]),'-Height',String(v.bounds[3]),'-Capture',path.join(out,`compact-${style}.png`)]);
  record(style+' native design remains visible',probe.visible&&!probe.iconic&&!probe.cloaked&&probe.hitHandle===probe.handle,probe);
 }
 await main.evaluate('SahibDesktop.invoke("desktop_timer",{action:"start",seconds:10,repeat:false,focus:true})');
 await main.evaluate('window.__TAURI__.window.getCurrentWindow().close()');main.close();await sleep(3000);record('Timer runs without a main WebView',(await control('status')).webviews.length===0);
 await sleep(8500);const panel=await qa.connect('desktop-widget.html');await sleep(500);
 record('Timer completion opens widget controls',await panel.evaluate('!document.getElementById("timer-finished").hidden&&document.getElementById("timer-countdown").textContent==="00:00"'));
 record('Hidden seconds uses hh:mm in rich widget',await panel.evaluate('document.getElementById("compact-countdown").textContent.split(":").length===2'));
 await panel.screenshot('timer-finished.png');await panel.evaluate('document.getElementById("timer-restart").click()');await sleep(500);
 record('Restart from popup uses previous duration',await panel.evaluate('window.__TAURI__.core.invoke("desktop_widget_state").then(s=>s.timer.deadline>Date.now()&&!s.timer.finished&&s.timer.seconds===10)'));
 await panel.evaluate('document.getElementById("timer-stop").click()');await sleep(400);
 await panel.evaluate('document.querySelector("[data-timer-minutes]").click();document.getElementById("timer-start").click()');await sleep(500);
 record('Preset starts a five-minute timer',await panel.evaluate('window.__TAURI__.core.invoke("desktop_widget_state").then(s=>s.timer.seconds===300)'));
 await panel.screenshot('timer-running.png');await panel.evaluate('window.__TAURI__.core.invoke("desktop_timer",{action:"stop"})');
 await panel.evaluate('document.getElementById("widget-close").click()');panel.close();await sleep(1600);record('Timer popup retires its WebView',(await control('status')).webviews.length===0);
 report.background=await measureDesktop(qa.app.pid,15,5);
}catch(e){report.errors.push(e.stack);console.error(e.stack)}finally{await qa?.stop();report.pass=!report.errors.length&&report.tests.every(t=>t.pass);fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({pass:report.pass,checks:report.tests.length,out}));if(!report.pass)process.exitCode=1;}
