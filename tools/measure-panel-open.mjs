import fs from 'node:fs';import path from 'node:path';import {setTimeout as sleep} from 'node:timers/promises';import {startQA,buildQA} from './desktop-qa-session.mjs';import {qaControl,fixture} from './compare-widget-memory.mjs';import {measureDesktop} from './measure-desktop.mjs';
const label=process.argv.find(a=>a.startsWith('--label='))?.slice(8)||'current',out=path.resolve('.qa/panel-'+label+'-'+Date.now()),profile=path.join(out,'data');fs.mkdirSync(out,{recursive:true});let qa,main;
const report={label,runs:[]};
if(!process.argv.includes('--skip-build'))await buildQA(out,['native-widget-rc','brand-preview']);
try{
 qa=await startQA(out,{profile});main=await qa.connect('main');await qa.waitReady(main);if(await main.evaluate('window.__TAURI__.app.getIdentifier()')!=='com.sahib.companion.qa')throw Error('Isolated QA build required');await fixture(main);await main.evaluate(`SahibDesktop.preferences('startMinimized',true)`);main.close();await qa.stop();await sleep(2000);
 fs.rmSync(path.join(profile,'qa-response.json'),{force:true});qa=await startQA(out,{profile});const control=qaControl(qa);await control('status');await sleep(3000);
 report.baseline=await measureDesktop(qa.app.pid,10,5);
 for(let i=0;i<5;i++){
  await control('panel');let timing;
  for(let n=0;n<100;n++){timing=await control('panel-timing');if(timing.id===i+1&&timing.paintedMs!==undefined)break;await sleep(100);}
  if(!timing?.paintedMs)throw Error('Panel failed to paint: '+JSON.stringify(timing));
  report.runs.push(timing);console.log(JSON.stringify(timing));await control('collapse');await sleep(1000);
 }
 report.hiddenTiming=await control('panel-timing');
 report.hidden=await measureDesktop(qa.app.pid,15,5);fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2));console.log('Report '+path.join(out,'report.json'));
}finally{main?.close();if(qa)await qa.stop();}
