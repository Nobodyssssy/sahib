import fs from 'node:fs';import path from 'node:path';import {setTimeout as sleep} from 'node:timers/promises';
import {startQA,buildQA} from './desktop-qa-session.mjs';import {fixture,qaControl} from './compare-widget-memory.mjs';import {startWindowFixture} from './qa-window-fixture.mjs';
const out=path.resolve('.qa',`timer-background-${Date.now()}`);fs.mkdirSync(out,{recursive:true});let qa,windows;const report={tests:[],errors:[]};
const check=(name,pass)=>{report.tests.push({name,pass:!!pass});console.log((pass?'PASS ':'FAIL ')+name)};
try{
 if(!process.argv.includes('--skip-build'))await buildQA(out,['native-widget-experiment']);
 qa=await startQA(out,{env:{SAHIB_MEMORY_EXPERIMENT:'native'}});const control=qaControl(qa);let main=await qa.connect('main');await qa.waitReady(main);await fixture(main);
 await main.evaluate(`(async()=>{await SahibDesktop.invoke('desktop_timer',{action:'start',seconds:60,repeat:false,focus:true});await window.__TAURI__.window.getCurrentWindow().close()})()`);main.close();
 for(let i=0;i<100&&(await control('status')).mainExists;i++)await sleep(100);
 await control('alert',{sound:'qatami',prayer:true});await control('alert',{sound:'chime'});
 let status;for(let i=0;i<50;i++){status=await control('status');if(status.audioPlaying&&Object.keys(status.fired).some(k=>k.startsWith('qa-memory:')))break;await sleep(100);}
 check('Focus allows scheduled Adhan with no main WebView',status.audioPlaying&&status.webviews.length===0);
 const disk=JSON.parse(fs.readFileSync(path.join(qa.profile,'desktop-state.json')));check('Competing practice consumed without replay',Object.keys(disk.fired).some(k=>k.startsWith('qa-memory:'))&&Object.keys(disk.fired).some(k=>k.startsWith('prayer:qa:')));
 await control('stop');await control('open');main=await qa.connect('main');await qa.waitReady(main);
 await main.evaluate(`(async()=>{await SahibDesktop.invoke('desktop_timer',{action:'start',seconds:10,repeat:false,focus:true});await window.__TAURI__.window.getCurrentWindow().close()})()`);main.close();
 windows=await startWindowFixture(out);await windows.command({mode:'fullscreen'});await sleep(11500);
 status=await control('status');check('Fullscreen defers timer popup and sound',status.webviews.length===0&&!status.audioPlaying);check('Timer still expires during fullscreen',JSON.parse(fs.readFileSync(path.join(qa.profile,'desktop-state.json'))).timer.finished);
 await windows.command({mode:'normal'});const panel=await qa.connect('desktop-widget.html');await sleep(700);check('Leaving fullscreen reveals completion popup',await panel.evaluate('!document.getElementById("timer-finished").hidden'));
 await panel.evaluate('document.getElementById("timer-stop").click()');await sleep(300);await panel.evaluate('document.getElementById("widget-close").click()');panel.close();
}catch(e){report.errors.push(e.stack);console.error(e.stack)}finally{await windows?.stop();await qa?.stop();report.pass=!report.errors.length&&report.tests.every(t=>t.pass);fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({pass:report.pass,out}));if(!report.pass)process.exitCode=1}
