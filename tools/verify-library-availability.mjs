import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {buildQA,startQA} from './desktop-qa-session.mjs';
const output=path.resolve('.qa','library-availability-'+Date.now());
if(!process.argv.includes('--skip-build'))await buildQA(output);
const reports=[];
for(let phase=0;phase<2;phase++){
 const qa=await startQA(output);let main;
 try{
  main=await qa.connect('main');await qa.waitReady(main);
  assert.equal(await main.evaluate('__TAURI__.app.getIdentifier()'),'com.sahib.companion.qa');
  const checks=await main.evaluate(fs.readFileSync('tests/desktop-library-availability.js','utf8'));
  assert(checks.length&&checks.every(c=>c.pass));reports.push({phase,checks});
  await main.screenshot('library-'+phase+'.png');
  fs.writeFileSync(path.join(output,'results.json'),JSON.stringify(reports,null,2));
  console.log('Library availability phase '+phase+': '+checks.length+' checks passed');
 }finally{main?.close();await qa.stop();}
}
console.log('Report '+output);
