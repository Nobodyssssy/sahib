import fs from 'node:fs';
import path from 'node:path';
import {spawn,spawnSync} from 'node:child_process';
import {setTimeout as sleep} from 'node:timers/promises';
export async function startWindowFixture(output){
 const file=path.join(output,'window-command.json');let sequence=0;
 const p=spawn('powershell.exe',['-NoProfile','-File',path.resolve('tools/windows-window-fixture.ps1'),'-CommandFile',file],{windowsHide:true,stdio:'ignore'});
 const json=file=>JSON.parse(fs.readFileSync(file,'utf8').replace(/^\uFEFF/,''));
 for(let n=0;n<100&&!fs.existsSync(file+'.state.json');n++)await sleep(100);
 const original=json(file+'.state.json');
 const command=async value=>{fs.writeFileSync(file,JSON.stringify({...value,sequence:++sequence}));await sleep(650);return fs.existsSync(file+'.actual.json')?json(file+'.actual.json'):null;};
 return {original,command,async stop(){fs.writeFileSync(file,JSON.stringify({mode:'close'}));await Promise.race([new Promise(r=>p.once('exit',r)),sleep(5000)]);if(p.exitCode===null){spawnSync('powershell.exe',['-NoProfile','-File',path.resolve('tools/windows-window-fixture.ps1'),'-CommandFile',file,'-RestoreState',String(original.originalTaskbarState)],{windowsHide:true});p.kill();}}};
}
