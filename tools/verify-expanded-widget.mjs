import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {setTimeout as sleep} from 'node:timers/promises';
import {startQA} from './desktop-qa-session.mjs';
import {fixture,qaControl} from './compare-widget-memory.mjs';
const before=process.argv.includes('--before'),out=path.resolve('.qa',before?'expanded-before':'expanded-after');
fs.mkdirSync(out,{recursive:true});
const qa=await startQA(out,{profile:path.join(out,'data-'+Date.now()),exe:'src-tauri/target/release/sahib-desktop.exe',env:{SAHIB_PANEL_IDLE_MS:'1500'}}),control=qaControl(qa);
let main,panel;const checks=[];
const hold=()=>Promise.race([sleep(600000,undefined,{ref:false}),new Promise(resolve=>qa.app.once('exit',resolve))]);
const check=(name,pass)=>{checks.push({name,pass:!!pass});assert.ok(pass,name);};
try{
 main=await qa.connect('main');await qa.waitReady(main);await fixture(main);
 await main.evaluate(`SAHIB_THEME.apply({theme:'catppuccin',mode:'dark',accent:'peach'});SahibDesktop.preferences('widgetTheme','app')`);
 if(!before)await main.evaluate('(async()=>{await SahibPractice.enableStarter("morning-adhkar");await SahibPractice.enableStarter("evening-adhkar");await SahibPractice.addStarterSet()})()');
 await main.evaluate('SahibDesktop.sync()');await sleep(500);
 const invoke=(name,args={})=>main.evaluate(`window.__TAURI__.core.invoke(${JSON.stringify(name)},${JSON.stringify(args)})`);
 const original=await invoke('desktop_state');fs.writeFileSync(path.join(out,'schedule.json'),JSON.stringify(original.schedule,null,2));
 if(!before)check('Panel loads only on demand',!(await qa.targets()).some(t=>t.url.includes('desktop-widget')));
 await control('panel');panel=await qa.connect('desktop-widget');await sleep(1200);
 await panel.screenshot(before?'before.png':'after.png');
 if(before){console.log(out);await sleep(1000);}else{
  check('Collapsed timer by default',await panel.evaluate('document.getElementById("timer-controls").hidden'));
  check('Daily practice before timer',await panel.evaluate('!!(document.querySelector(".widget-practice").compareDocumentPosition(document.getElementById("widget-timer"))&Node.DOCUMENT_POSITION_FOLLOWING)'));
  check('At least two actual practices visible',await panel.evaluate('document.querySelectorAll(".widget-reminder").length>=2'));
  check('Practice has no nested scroll',await panel.evaluate('getComputedStyle(document.getElementById("widget-reminders")).overflowY==="visible"'));
  const day=original.schedule.widgetDays.find(d=>d.prayers.every(p=>p.at>Date.now()));
  for(const [i,period] of ['night','dawn','morning','afternoon','sunset','evening'].entries()){
   const at=i===0?day.start+1000:day.prayers[i-1].at+1000;
   await control('widget-time',{at});await sleep(400);await control('panel');await sleep(250);
   const state=await panel.evaluate(`(()=>({period:document.body.dataset.period,count:document.querySelectorAll('.prayer-row').length,clock:document.getElementById('widget-clock').textContent,highlight:document.querySelector('.prayer-row.next time')?.textContent,scroll:document.getElementById('widget').scrollWidth<=document.getElementById('widget').clientWidth}))()`);
   check(period+' correct next transition',state.period===period&&state.count===6&&state.clock===state.highlight&&state.scroll);
   await panel.screenshot(period+'.png');
  }
  await control('widget-time',{at:0});
  for(const family of ['sahib','aura','dracula','catppuccin','rose-pine','tokyo-night','windows'])for(const language of ['en','ar'])for(const mode of ['light','dark']){
   await main.evaluate(`(async()=>{await SAHIB_I18N.setLanguage('${language}');await SahibDesktop.sync()})()`);
   await control('preferences',{theme:family,language,mode});await sleep(300);await control('panel');await sleep(200);
   check(family+' '+language+' '+mode+' controls fit',await panel.evaluate(`(()=>{const w=document.getElementById('widget');return w.scrollWidth<=w.clientWidth&&document.querySelectorAll('.prayer-row').length===6&&document.documentElement.dir==='${language==='ar'?'rtl':'ltr'}'})()`));
   await panel.screenshot(family+'-'+language+'-'+mode+'.png');
  }
  await main.evaluate('(async()=>{await SAHIB_I18N.setLanguage("en");await SahibDesktop.sync()})()');
  await control('preferences',{theme:'app',language:'en',mode:'dark'});await control('panel');await sleep(300);
  await panel.evaluate('document.getElementById("timer-toggle").focus()');
  await panel.send('Input.dispatchKeyEvent',{type:'keyDown',key:'Enter',code:'Enter',windowsVirtualKeyCode:13,text:'\r'});await panel.send('Input.dispatchKeyEvent',{type:'keyUp',key:'Enter',code:'Enter',windowsVirtualKeyCode:13});await sleep(300);
  await panel.evaluate('document.getElementById("timer-toggle").focus()');
  check('Keyboard expands timer',await panel.evaluate('!document.getElementById("timer-controls").hidden'));await panel.screenshot('timer-expanded.png');
  await panel.evaluate('document.querySelector("[data-timer-minutes]").click();document.getElementById("timer-repeat").checked=true;document.getElementById("timer-focus").checked=true;document.getElementById("timer-start").click()');await sleep(500);
  let t=await invoke('desktop_state');check('Timer start repeat focus',t.timer.seconds===300&&t.timer.repeat&&t.timer.focus&&t.timer.deadline>Date.now());
  await panel.evaluate('document.getElementById("timer-toggle").click()');await sleep(200);t=await invoke('desktop_state');check('Collapse preserves running timer',t.timer.deadline>Date.now());
  await invoke('desktop_timer',{action:'stop'});await sleep(300);t=await invoke('desktop_state');check('Timer stops',!t.timer.deadline);
  await invoke('desktop_timer_audio',{sound:'off',volume:0});
  await invoke('desktop_timer',{action:'start',seconds:10,repeat:true,focus:true});await sleep(11000);t=await invoke('desktop_state');check('Timer actually repeats',t.timer.deadline>Date.now()&&t.timer.repeat);await invoke('desktop_timer',{action:'stop'});
  await invoke('desktop_timer',{action:'start',seconds:10,repeat:false,focus:false});await sleep(11000);check('Completion reveals essential controls',await panel.evaluate('!document.getElementById("timer-controls").hidden&&!document.getElementById("timer-finished").hidden'));await panel.evaluate('document.getElementById("timer-toggle").click()');await sleep(500);check('Finished form can collapse',await panel.evaluate('document.getElementById("timer-controls").hidden'));await invoke('desktop_timer',{action:'stop'});
  await main.evaluate('(async()=>{await SahibPractice.complete("quran-reading");await SahibDesktop.sync()})()');
  let completed,today;for(let i=0;i<100;i++){completed=await invoke('desktop_state');today=completed.schedule.widgetDays.find(d=>d.start<=Date.now()&&d.end>Date.now());if(!today.reminders.some(r=>r.id==='quran-reading'))break;await sleep(100);}check('Practice completion removes pending preview',!today.reminders.some(r=>r.id==='quran-reading'));
  await main.evaluate('(async()=>{await SahibPractice.undo("quran-reading");await SahibDesktop.sync()})()');
  await panel.evaluate('document.getElementById("practice-all").click()');await sleep(800);check('View all opens actual practice',await main.evaluate('document.getElementById("view-practice").classList.contains("active")'));
  for(const monitor of original.monitors){await control('panel',{monitor});await sleep(500);check('Panel placement '+monitor,await panel.evaluate('document.getElementById("widget").clientWidth>300'));await panel.screenshot('monitor-'+original.monitors.indexOf(monitor)+'.png');}
  await invoke('desktop_timer',{action:'start',seconds:60,repeat:false,focus:true});
  await panel.evaluate('document.getElementById("widget-close").click()');panel.close();panel=null;let lifecycle;for(let i=0;i<60;i++){await sleep(500);lifecycle=await control('status');if(!lifecycle.webviews.includes('widget'))break;}check('Closed panel unloads while main stays open',!lifecycle.webviews.includes('widget'));t=await invoke('desktop_state');check('Timer survives panel unload',t.timer.deadline>Date.now()&&t.timer.focus);
  await control('panel');panel=await qa.connect('desktop-widget');await sleep(500);check('Reopened timer is collapsed and running',await panel.evaluate('document.getElementById("timer-controls").hidden&&document.getElementById("timer-countdown").textContent!=="05:00"'));await panel.evaluate('window.__TAURI__.core.invoke("desktop_timer",{action:"stop"})');
  fs.writeFileSync(path.join(out,'checks.json'),JSON.stringify(checks,null,2));console.log(JSON.stringify({out,checks}));
  if(process.argv.includes('--hold')){fs.writeFileSync(path.join(out,'ready.json'),JSON.stringify({pid:qa.app.pid,port:qa.port,profile:qa.profile}));await hold();}
 }
}catch(error){fs.writeFileSync(path.join(out,'checks.json'),JSON.stringify({checks,error:String(error)},null,2));if(process.argv.includes('--hold')){fs.writeFileSync(path.join(out,'ready.json'),JSON.stringify({pid:qa.app.pid,port:qa.port,profile:qa.profile,error:String(error)}));console.error(String(error));await hold();}throw error;}finally{panel?.close();main?.close();await qa.stop();}
