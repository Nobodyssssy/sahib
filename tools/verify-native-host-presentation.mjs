import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {setTimeout as sleep} from 'node:timers/promises';
import {startQA} from './desktop-qa-session.mjs';
import {fixture,qaControl} from './compare-widget-memory.mjs';
import {measureDesktop} from './measure-desktop.mjs';
const out=path.resolve('.qa','native-host-presentation-'+Date.now());fs.mkdirSync(out,{recursive:true});
let qa,main;const report={checks:[],errors:[]};
const ps=(file,args)=>{const r=spawnSync('powershell.exe',['-NoProfile','-File','tools/'+file,...args],{encoding:'utf8',windowsHide:true,timeout:20000});if(r.status)throw Error(r.stderr||r.stdout);return JSON.parse(r.stdout.replace(/^\uFEFF/,''));};
async function until(fn){for(let n=0;n<100;n++){const v=await fn();if(v)return v;await sleep(100);}throw Error('Presentation state timeout');}
try{
 qa=await startQA(out);main=await qa.connect('main');await qa.waitReady(main);await fixture(main);
 await main.evaluate('SahibDesktop.preferences("widgetMonitor","all")');const control=qaControl(qa);
 for(const language of ['en','ar'])for(const mode of ['light','dark'])for(const style of ['landmark','minimal','slim','countdown']){
  await main.evaluate(`(async()=>{await SAHIB_I18N.setLanguage(${JSON.stringify(language)});await SahibDesktop.sync();await SahibDesktop.preferences('widgetStyle',${JSON.stringify(style)})})()`);
  await control('preferences',{theme:'catppuccin',language,mode});
  const s=await until(async()=>{const s=await control('status');return Object.keys(s.native).length===2&&Object.values(s.native).every(v=>v.parent&&v.style===style)&&s;});
  await sleep(150);
  for(const [label,v]of Object.entries(s.native)){
   const file=label+'-'+language+'-'+mode+'-'+style+'.png';
   const actual=ps('widget-zorder-probe.ps1',['-TargetProcess',String(qa.app.pid),'-TargetHandle',String(v.handle),'-Capture',path.join(out,file)]);
   const pass=actual.child&&actual.visible&&actual.hitHandle===v.handle&&actual.paintContrast>100&&actual.dpi===Math.round(v.scale*96);
   report.checks.push({name:file,pass,actual});assert.ok(pass,file);console.log('PASS '+file);
  }
 }
 await main.evaluate(`(async()=>{await SAHIB_I18N.setLanguage('en');await SahibDesktop.sync();await SahibDesktop.preferences('widgetStyle','landmark')})()`);
 await control('preferences',{theme:'windows',language:'en'});
 for(const monitor of ['primary','all','primary','all']){
  await control('preferences',{monitor});const count=monitor==='all'?2:1;
  await until(()=>control('status').then(s=>Object.keys(s.native).length===count&&Object.values(s.native).every(v=>v.parent)));
  const actual=ps('inspect-native-surfaces.ps1',['-TargetProcess',String(qa.app.pid)]);
  assert.equal(actual.handles.length,count,'no orphan children after monitor '+monitor);
  report.checks.push({name:'monitor '+monitor+' leaves exactly '+count+' owned surfaces',pass:true,actual});
 }
 const s=await control('status'),v=s.native['native-widget'];
 for(const action of ['settings','f10']){
  ps('native-widget-input.ps1',['-Handle',String(v.handle),'-Action',action]);await sleep(250);
  const actual=ps('inspect-native-menu.ps1',['-TargetProcess',String(qa.app.pid)]);
  assert.ok(actual.found,'native '+action+' popup');report.checks.push({name:action+' shared native menu',pass:true,actual});
  ps('shell-key-probe.ps1',['-Action','escape']);
 }
 await main.evaluate('window.__TAURI__.window.getCurrentWindow().close()');main.close();main=null;
 await until(()=>control('status').then(s=>!s.mainExists&&!s.webviews.length));await sleep(5000);
 report.idle=await measureDesktop(qa.app.pid,30,5);
 assert.ok(report.idle.samples.every(s=>s.processes.every(p=>p.name==='sahib-desktop')),'native-only idle tree');
 report.checks.push({name:'steady idle has no WebView process',pass:true});
 console.log(JSON.stringify({out,checks:report.checks.length}));
}catch(e){report.errors.push(e.stack);console.error(e.stack);process.exitCode=1;}
finally{main?.close();await qa?.stop();report.pass=!report.errors.length;fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2));}
