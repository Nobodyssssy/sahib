import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {spawn,spawnSync} from 'node:child_process';
import {setTimeout as sleep} from 'node:timers/promises';
import {startWindowFixture} from './qa-window-fixture.mjs';

const out=path.resolve('.qa','taskbar-fullscreen-'+Date.now());fs.mkdirSync(out,{recursive:true});
const report={checks:[],errors:[]};let windows,child;
const run=(exe,args)=>{
 const r=spawnSync(exe,args,{encoding:'utf8',windowsHide:true,timeout:120000});
 if(r.status!==0)throw Error(r.stderr||r.stdout||String(r.error));
 return r.stdout.trim();
};
const record=(name,pass,detail)=>{report.checks.push({name,pass,detail});assert.ok(pass,name);console.log('PASS '+name);};
const exe=path.join(out,'probe.exe'),baseline=path.join(out,'baseline-probe.exe');
const check=(binary,b)=>run(binary,['check',String(b.X),String(b.Y),String(b.X+b.Width),String(b.Y+b.Height)])==='true';
async function closeFixture(){
 if(!child)return;
 const p=child;child=null;p.stdin.end('\n');
 for(let n=0;n<50&&p.exitCode===null;n++)await sleep(100);
 if(p.exitCode===null){p.kill();throw Error('Fixture did not close gracefully');}
 assert.equal(p.exitCode,0,'fixture exit');
}
async function fixture(className,b,overlay=false){
 child=spawn(exe,['fixture',className,String(b.X),String(b.Y),String(b.X+b.Width),String(b.Y+b.Height),...(overlay?['overlay']:[])],{stdio:['pipe','pipe','pipe'],windowsHide:true});
 let output='',error='';child.stdout.on('data',d=>output+=d);child.stderr.on('data',d=>error+=d);
 for(let n=0;n<100;n++){if(output.includes('ready'))return;if(child.exitCode!==null)throw Error(error||'Fixture exited');await sleep(50);}
 throw Error('Native fixture startup timeout');
}
try{
 run('rustc',['--edition','2021','tools/taskbar-fullscreen-probe.rs','-o',exe]);
 fs.writeFileSync(path.join(out,'baseline-taskbar.rs'),run('git',['show','9fad2c6:src-tauri/src/taskbar.rs']));
 fs.writeFileSync(path.join(out,'baseline-probe.rs'),fs.readFileSync('tools/taskbar-fullscreen-probe.rs','utf8').replace('../src-tauri/src/taskbar.rs','baseline-taskbar.rs'));
 run('rustc',['--edition','2021',path.join(out,'baseline-probe.rs'),'-o',baseline]);
 windows=await startWindowFixture(out);await windows.command({mode:'normal'});
 const screens=windows.original.displays;report.displays=screens;
 for(const screen of screens){
  const b=screen.Bounds;record(screen.DeviceName+' initial desktop',!check(exe,b));
  for(const className of ['WorkerW','Progman','XamlExplorerHostIslandWindow','Windows.UI.Core.CoreWindow','SahibFullscreenFixture']){
   try{
    await fixture(className,b);
    const actual=check(exe,b),before=check(baseline,b);
    record(screen.DeviceName+' fullscreen '+className,actual,{baseline:before,candidate:actual});
    if(['WorkerW','Progman'].includes(className))record(screen.DeviceName+' reproduced old class-name bypass '+className,!before&&actual);
    for(const other of screens.filter(s=>s.DeviceName!==screen.DeviceName))record('Fullscreen remains local to '+screen.DeviceName,!check(exe,other.Bounds));
   }finally{await closeFixture();}
  }
  try{await fixture('SahibFullscreenFixture',b,true);record(screen.DeviceName+' click-through overlay does not hide widget',!check(exe,b));}finally{await closeFixture();}
  try{await fixture('SahibFullscreenFixture',{...b,Height:b.Height-1});record(screen.DeviceName+' partial monitor coverage is not fullscreen',!check(exe,b));}finally{await closeFixture();}
  await windows.command({mode:'maximized',display:screen.DeviceName});record(screen.DeviceName+' ordinary maximized window is not fullscreen',!check(exe,b));
  await windows.command({mode:'normal'});
 }
}catch(e){report.errors.push(e.stack);console.error(e.stack);process.exitCode=1;}
finally{await closeFixture();await windows?.stop();report.pass=!report.errors.length;fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({pass:report.pass,checks:report.checks.length,out}));}
