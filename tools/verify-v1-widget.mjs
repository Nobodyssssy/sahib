import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import assert from 'node:assert/strict';
import {setTimeout as sleep} from 'node:timers/promises';
import {buildQA,startQA} from './desktop-qa-session.mjs';
const output=path.resolve('.qa','widget-v1-'+Date.now());
if(!process.argv.includes('--skip-build'))await buildQA(output,['native-widget-rc','brand-preview']);
const run=await startQA(output);let main,widget;
const results=[];
try{
 main=await run.connect('main');await run.waitReady(main);await sleep(1500);
 const invoke=(name,args)=>main.evaluate(`window.__TAURI__.core.invoke(${JSON.stringify(name)},${JSON.stringify(args)})`);
 for(const family of ['sahib','catppuccin','aura','dracula','tokyo-night','rose-pine']){
  await main.evaluate(`SAHIB_THEME.apply({theme:'${family}',mode:'light',accent:'peach'})`);
  await sleep(150);await main.evaluate('SahibDesktop.sync()');await sleep(150);
  const colors=(await invoke('desktop_state',{})).schedule.theme;
  for(const key of ['--surface','--text','--text-muted','--border','--accent'])assert.match(colors[key],/^#[0-9a-f]{6}$/i,`${family} ${key} must resolve CSS colors for native rendering`);
 }
 results.push({nativeColors:'six themes resolved to RGB'});
 const originalAlerts=await main.evaluate('(async()=>JSON.stringify((await getPrayerPrefs()).alerts))()');
 for(const sound of ['timer-gentle','timer-bell','timer-wood','timer-beep','off']){
  await invoke('desktop_timer_audio',{sound,volume:0});await invoke('desktop_preview_audio',{id:sound,volume:0});await sleep(150);
  const state=await invoke('desktop_state',{});assert.equal(state.prefs.timerSound,sound);assert.equal(state.prefs.timerVolume,0);assert.ok(!state.audioError,state.audioError);results.push({sound,persisted:true});
 }
 const wav=Buffer.alloc(44+8820);wav.write('RIFF');wav.writeUInt32LE(wav.length-8,4);wav.write('WAVEfmt ',8);wav.writeUInt32LE(16,16);wav.writeUInt16LE(1,20);wav.writeUInt16LE(1,22);wav.writeUInt32LE(44100,24);wav.writeUInt32LE(88200,28);wav.writeUInt16LE(2,32);wav.writeUInt16LE(16,34);wav.write('data',36);wav.writeUInt32LE(8820,40);
 for(const [kind,bytes]of [['WAV',wav],['MP3',fs.readFileSync('assets/adhan/nasser-al-qatami.mp3')]]){
  await invoke('desktop_save_audio',{kind:'timer',encoded:bytes.toString('base64')});await invoke('desktop_timer_audio',{sound:'local-timer',volume:0});await invoke('desktop_preview_audio',{id:'local-timer',volume:0});await sleep(200);assert.ok(!(await invoke('desktop_state',{})).audioError);results.push({custom:kind,decoded:true});
 }
 await assert.rejects(invoke('desktop_save_audio',{kind:'timer',encoded:'not audio'}));await assert.rejects(invoke('desktop_timer_audio',{sound:'off',volume:2}));
 assert.equal(await main.evaluate('(async()=>JSON.stringify((await getPrayerPrefs()).alerts))()'),originalAlerts);
 for(const widgetStyle of ['minimal','landmark','slim','countdown']){
  const state=await invoke('desktop_state',{});await invoke('desktop_set_preferences',{prefs:{...state.prefs,widgetVisible:true,widgetMode:'taskbar',widgetRenderer:'native',widgetStyle},autostart:null});assert.equal((await invoke('desktop_state',{})).prefs.widgetStyle,widgetStyle);results.push({widgetStyle,persisted:true});
 }
 const setPrefs=async patch=>{const state=await invoke('desktop_state',{});await invoke('desktop_set_preferences',{prefs:{...state.prefs,...patch},autostart:null});};
 const readClip=()=>{const r=spawnSync('powershell.exe',['-NoProfile','-File','tools/read-native-dpi.ps1','-RootProcess',String(run.app.pid)],{encoding:'utf8',windowsHide:true});assert.equal(r.status,0,r.stderr);return JSON.parse(r.stdout);};
 await setPrefs({widgetVisible:true,widgetStyle:'minimal'});assert.equal(readClip().cornerFilled,true);
 await setPrefs({widgetVisible:false});await setPrefs({widgetStyle:'landmark'});await setPrefs({widgetVisible:true});
 const clip=readClip();assert.equal(clip.cornerFilled,false,'Rounded layout must apply after being selected while hidden');assert.equal(clip.fits,true);
 results.push({hiddenLayoutTransition:true,clipFits:true});
 await invoke('desktop_stop_audio',{});await invoke('desktop_timer_audio',{sound:'timer-bell',volume:0});await invoke('desktop_timer',{action:'start',seconds:10,repeat:false,focus:true});
 await main.evaluate('window.__TAURI__.window.getCurrentWindow().close()').catch(()=>{});await sleep(12000);
 const disk=JSON.parse(fs.readFileSync(path.join(run.profile,'desktop-state.json'),'utf8'));assert.equal(disk.timer.finished,true);assert.equal(disk.timer.deadline,0);assert.equal(disk.prefs.timerSound,'timer-bell');
 assert.ok(!(await run.targets()).some(t=>/\/($|index.html$)/.test(t.url)),'Main WebView should unload during background timer');
 results.push({backgroundTimer:true,mainDestroyed:true,adhanPreferencesUnchanged:true,invalidInputRejected:true});
 fs.writeFileSync(path.join(output,'results.json'),JSON.stringify(results,null,2));console.log(JSON.stringify({output,results}));
}finally{main?.close();widget?.close();await run.stop();}
