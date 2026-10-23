import fs from 'node:fs';
import path from 'node:path';
import {setTimeout as sleep} from 'node:timers/promises';
import {startQA,buildQA} from './desktop-qa-session.mjs';
import {measureDesktop} from './measure-desktop.mjs';
const output=path.resolve('.qa',`memory-baseline-${Date.now()}`);fs.mkdirSync(output,{recursive:true});
const report={started:new Date().toISOString(),configurations:[],errors:[]};let qa;
try{
 if(!process.argv.includes('--skip-build'))await buildQA(output);
 qa=await startQA(output,{env:{SAHIB_MEMORY_EXPERIMENT:process.argv.includes('--unload')?'unload':'keep'}});const main=await qa.connect('main');await qa.waitReady(main);report.startupMs=Date.now()-qa.start;
 if(await main.evaluate('window.__TAURI__.app.getIdentifier()')!=='com.sahib.companion.qa')throw Error('Not isolated QA');
 await main.evaluate('(async()=>{await savePrayerPrefs({provider:"local",alerts:{enabled:false,notify:false,volume:0}});await setManualLocation(47.3769,8.5417,"Zurich memory fixture");await SahibDesktop.sync();await SahibDesktop.preferences("widgetMode","taskbar");await SahibDesktop.preferences("widgetVisible",true);await SahibDesktop.preferences("closeToTray",true);showView("view-home")})()');
 const unload=process.argv.includes('--unload');
 await main.evaluate('(async()=>{await store.setMeta("memoryFixture",{text:"IndexedDB survives",blob:new Blob(["persistent blob"])});localStorage.setItem("memory-fixture","persistent setting")})()');
 for(const mode of ['main-open',unload?'main-destroyed':'main-hidden']){
  if(mode!=='main-open'){
   await main.evaluate('openCat("sabah");window.__TAURI__.window.getCurrentWindow().close()');
   if(unload){for(let i=0;i<150&&(await qa.targets()).some(t=>/\/(index.html)?$/.test(t.url));i++)await sleep(200);}
  }
  await sleep(10000);const measure=await measureDesktop(qa.app.pid,30);report.configurations.push({mode,...measure,targets:(await qa.targets()).map(t=>t.url)});console.log(JSON.stringify({mode,...measure,samples:undefined}));
 }
 if(unload){
  const widget=await qa.connect('desktop-widget.html'),start=Date.now();await widget.evaluate('window.__TAURI__.core.invoke("desktop_show_main")');const restored=await qa.connect('main');await qa.waitReady(restored);await sleep(2000);
  report.restoreMs=Date.now()-start;report.persistence=await restored.evaluate('(async()=>{const m=await store.getMeta("memoryFixture"),p=await getPrayerPrefs();return {idb:m?.text==="IndexedDB survives"&&await m.blob.text()==="persistent blob",localStorage:localStorage.getItem("memory-fixture")==="persistent setting",category:currentCat,view:document.querySelector(".view.active")?.id,provider:p.provider,location:(await getLocation()).label,futureSchedule:(await SahibDesktop.invoke("desktop_state")).schedule.validUntil>Date.now()+30*86400000}})()');
  restored.close();widget.close();if(!report.persistence.idb||report.persistence.category!=='sabah'||!report.persistence.futureSchedule)throw Error('Restored main state differs');
 }
 main.close();
}catch(e){report.errors.push(e.stack);process.exitCode=1;}finally{await qa?.stop();report.finished=new Date().toISOString();fs.writeFileSync(path.join(output,'report.json'),JSON.stringify(report,null,2));console.log(output);}
