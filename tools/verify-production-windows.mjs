import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {setTimeout as sleep} from 'node:timers/promises';

const config=JSON.parse(fs.readFileSync('src-tauri/tauri.conf.json','utf8'));
assert.equal(config.identifier,'com.sahib.companion');
assert.equal(config.productName,'Sahib');
assert.equal(config.version,'0.2.4');
const defaults=JSON.parse(fs.readFileSync('src-tauri/Cargo.toml','utf8').match(/^default\s*=\s*(\[.*\])/m)[1]);
for(const feature of ['native-widget-rc','brand-preview'])assert(defaults.includes(feature),'Missing default feature '+feature);
for(const icon of ['icon.ico','icon-128.png'])assert(config.bundle.icon.includes('../branding/sahib-0.2.4/'+icon));
for(const field of ['installerIcon','uninstallerIcon'])assert.equal(config.bundle.windows.nsis[field],'../branding/sahib-0.2.4/icon.ico');
for(const file of Object.keys(config.bundle.resources))assert(fs.existsSync(path.resolve('src-tauri',file)));
const hash=file=>createHash('sha256').update(fs.readFileSync(file)).digest('hex');
for(const [source,target]of [['app-icon.svg','icon.svg'],['pwa-192.png','icon-192.png'],['pwa-512.png','icon-512.png']])assert.equal(hash('branding/sahib-0.2.4/'+source),hash('dist/icons/'+target));
for(const file of ['src-tauri/src/experiment.rs','src-tauri/src/lib.rs','src-tauri/src/native_widget.rs','js/desktop.js'])assert(!/Sahib RC|Brand review|Brand Review|Preview 0\.2\.4|نسخة تجريبية/.test(fs.readFileSync(file,'utf8')),'Production status label in '+file);
const settings=fs.readFileSync('js/settings.js','utf8'),start=settings.indexOf('function _aboutHTML(){'),end=settings.indexOf('/* Expose',start);
for(const language of ['en','ar']){
 const context={window:{SAHIB_I18N:{language},SahibDesktop:{available:true}}};
 vm.createContext(context);vm.runInContext(settings.slice(start,end),context);
 const about=vm.runInContext('_aboutHTML()',context);
 assert(about.includes('https://www.youtube.com/watch?v=gNk5LmR9qJM'));
 assert(about.includes('<strong>Version:</strong> 0.2.4<br>'));
 assert(about.includes(language==='ar'?'لا يمنح إذن إعادة التوزيع':'Source credit is not redistribution permission'));
}
console.log('Production identity, native/brand defaults, icon hashes, licence resources and EN/AR reference credit passed');

if(process.argv.includes('--installer')){
 const executable=fs.readFileSync('src-tauri/target/release/sahib-desktop.exe');
 const installer=fs.readFileSync('src-tauri/target/release/bundle/nsis/Sahib_0.2.4_x64-setup.exe');
 const ico=fs.readFileSync('branding/sahib-0.2.4/icon.ico'),frames=ico.readUInt16LE(4);
 assert.equal(installer.readUInt16LE(0),0x5a4d);
 for(let n=0;n<frames;n++){
  const entry=6+n*16,size=ico.readUInt32LE(entry+8),offset=ico.readUInt32LE(entry+12),frame=ico.subarray(offset,offset+size);
  assert(executable.includes(frame),'Approved executable icon frame missing: '+(ico[entry]||256));
  if([16,32].includes(ico[entry]))assert(installer.includes(frame),'Approved installer icon frame missing: '+ico[entry]);
 }
 console.log('Normal installer filename/header and embedded approved icon resources passed ('+frames+' executable resolutions)');
}

if(process.argv.includes('--native')){
 const {buildQA,startQA}=await import('./desktop-qa-session.mjs');
 const {fixture}=await import('./compare-widget-memory.mjs');
 const output=path.resolve('.qa','production-defaults-'+Date.now());
 if(!process.argv.includes('--skip-build'))await buildQA(output);
 const qa=await startQA(output);let main;
 try{
  main=await qa.connect('main');await qa.waitReady(main);
  assert.equal(await main.evaluate('window.__TAURI__.app.getIdentifier()'),'com.sahib.companion.qa');
  assert.equal(await main.evaluate('window.__TAURI__.app.getVersion()'),'0.2.4');
  await fixture(main);await sleep(2500);
  const result=await main.evaluate(`(async()=>{const state=await SahibDesktop.invoke('desktop_state');return {version:await __TAURI__.app.getVersion(),title:await __TAURI__.window.getCurrentWindow().title(),nativeAvailable:state.nativeAvailable,nativeViews:Object.keys(state.nativeWidgetViews||{}).length,about:_aboutHTML()}})()`);
  assert(result.nativeAvailable&&result.nativeViews>0,'Default build must render native compact windows');
  assert(!/RC|Preview|Brand review/.test(result.title));
  assert(result.about.includes('Sahib for Windows · 0.2.4'));
  assert(!result.about.includes('Preview 0.2.4'));
  fs.writeFileSync(path.join(output,'results.json'),JSON.stringify({pass:true,version:result.version,title:result.title,nativeAvailable:result.nativeAvailable,nativeViews:result.nativeViews},null,2));
  console.log('Actual Tauri default-feature production promotion passed',output);
 }finally{main?.close();await qa.stop();}
}
