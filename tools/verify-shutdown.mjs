import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {setTimeout as sleep} from 'node:timers/promises';
import {startQA,buildQA} from './desktop-qa-session.mjs';
import {fixture,qaControl} from './compare-widget-memory.mjs';

const out=path.resolve('.qa',`shutdown-${Date.now()}`);
fs.mkdirSync(out,{recursive:true});
const report={started:new Date().toISOString(),runs:[],errors:[]};
let qa,view;
const message=action=>{
 const p=spawnSync('powershell.exe',['-NoProfile','-File','tools/qa-session-message.ps1','-ProcessId',String(qa.app.pid),'-Action',action],{encoding:'utf8',windowsHide:true,timeout:15000});
 if(p.status)throw Error(p.stderr||p.stdout);
 return Number(p.stdout.trim());
};
try {
 if(!process.argv.includes('--skip-build'))await buildQA(out,['desktop-qa']);
 for(const mode of ['native','unload','keep'])for(const state of ['open','tray','headless'])for(const exit of ['quit','session']) {
  if(state==='headless'&&mode!=='native')continue;
  const folder=path.join(out,`${mode}-${state}-${exit}`);
  fs.mkdirSync(folder,{recursive:true});
  qa=await startQA(folder,{env:{SAHIB_MEMORY_EXPERIMENT:mode}});
  const control=qaControl(qa);
  view=await qa.connect('main');await qa.waitReady(view);await fixture(view);
  if(mode==='unload')await view.evaluate('SahibDesktop.preferences("widgetRenderer","web")');
  if(state==='headless')await view.evaluate('SahibDesktop.preferences("widgetVisible",false)');
  if(state!=='open') {
   await view.evaluate('window.__TAURI__.window.getCurrentWindow().close()');
   await sleep(1500);
   assert.equal(qa.app.exitCode,null,'ordinary close keeps tray alive');
   view.close();view=null;
  }
  assert.equal(message('query'),1,'Windows session query accepted');
  await sleep(300);
  assert.equal(qa.app.exitCode,null,'query does not terminate process');
  message('cancel');
  await control('status');
  assert.equal(qa.app.exitCode,null,'canceled session remains usable');
  view?.close();view=null;
  if(exit==='session') { assert.equal(message('query'),1);message('end'); }
  else {
   const file=path.join(qa.profile,'qa-control.json');
   fs.writeFileSync(file,JSON.stringify({id:10000,action:'quit'}));
  }
  for(let i=0;i<100&&qa.app.exitCode===null;i++)await sleep(100);
  assert.equal(qa.app.exitCode,0,`${mode} ${exit} exits cleanly`);
  report.runs.push({mode,state,exit,exitCode:qa.app.exitCode,pass:true});
  console.log(`PASS ${mode} ${state}: query/cancel, ${exit}`);
  await qa.stop();qa=null;
 }
}catch(e){report.errors.push(e.stack);console.error(e.stack);process.exitCode=1;}
finally {view?.close();await qa?.stop();report.finished=new Date().toISOString();report.pass=!report.errors.length;fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({pass:report.pass,out}));}
