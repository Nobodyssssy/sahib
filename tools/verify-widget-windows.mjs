import fs from 'node:fs';
import path from 'node:path';
import {spawn,spawnSync} from 'node:child_process';
import {setTimeout as sleep} from 'node:timers/promises';
export async function verifyWidgetWindows({session,widget,port,connect,output,record,report}){
 const state=()=>session.evaluate('SahibDesktop.invoke("desktop_state")');
 const set=async(key,value)=>{await session.evaluate('SahibDesktop.preferences('+JSON.stringify(key)+','+JSON.stringify(value)+')');await sleep(400);};
 await set('widgetMode','taskbar');await set('widgetMonitor','all');await sleep(1200);
 let current=await state();report.displays=Object.values(current.widgetViews).map(v=>({monitor:v.monitor,scale:v.scale,work:v.work,bar:v.bar}));
 const targets=await(await fetch('http://127.0.0.1:'+port+'/json/list')).json(),clients=[];
 try{
  for(const target of targets.filter(t=>t.url.includes('desktop-widget.html'))){const client=await connect(target);const label=await client.evaluate('window.__TAURI__.window.getCurrentWindow().label');clients.push({client,label});}
  record('One widget window for each requested display',clients.length===current.monitors.length);
  for(const {client,label}of clients){
   await client.screenshot(label+'-compact-native.png');
   await client.evaluate('document.getElementById("widget-compact").click()');await sleep(800);
   const s=await state(),v=s.widgetViews[label],actual=s.widgetWindows.find(w=>w.label===label),[l,t,r,b]=v.work;
   record(label+' panel stays inside selected monitor work area',actual.position.x>=l&&actual.position.y>=t&&actual.position.x+actual.size.width<=r&&actual.position.y+actual.size.height<=b,JSON.stringify(v));
   record(label+' panel shows full reminder card',await client.evaluate('(()=>{const row=document.querySelector(".widget-reminder"),area=document.getElementById("widget-reminders");return !row||area.clientHeight>=Math.min(row.offsetHeight,144)})()'));
   record(label+' panel has no oversized empty region',await client.evaluate('(()=>{const card=document.getElementById("widget"),footer=card.querySelector("footer");return card.getBoundingClientRect().bottom-footer.getBoundingClientRect().bottom<24})()'));
   await client.screenshot(label+'-panel-native.png');
   record(label+' background is opaque',await client.evaluate('getComputedStyle(document.getElementById("widget")).backgroundColor.match(/rgba/)==null'));
   if(label==='widget'){
    for(const scale of [1.5,2]){
     await client.send('Emulation.setDeviceMetricsOverride',{width:380,height:600,deviceScaleFactor:scale,mobile:false});await sleep(300);
     await client.screenshot('widget-render-'+Math.round(scale*100)+'.png');
    }
    await client.send('Emulation.clearDeviceMetricsOverride');await sleep(400);
   }
   await client.evaluate('document.getElementById("widget-close").click()');await sleep(300);
  }
  for(const edge of ['right','left']){
   await set('widgetEdge',edge);current=await state();
   for(const [label,v]of Object.entries(current.widgetViews)){
    const [x,,width]=v.bounds,[safeLeft,safeRight]=v.safeBounds;
    record(label+' '+edge+' placement avoids notification area',v.fallback||x>=safeLeft&&x+width<=safeRight,JSON.stringify({bounds:v.bounds,safe:v.safeBounds}));
   }
  }
  // Captioned obstruction is a separate WinForms process, not a Sahib window or a browser fixture.
  const commandFile=path.join(output,'window-fixture.json');
  fs.writeFileSync(commandFile,JSON.stringify({mode:'normal'}));
  const fixture=spawn('powershell.exe',['-NoProfile','-STA','-File',path.resolve('tools/windows-window-fixture.ps1'),'-CommandFile',commandFile],{windowsHide:true,stdio:'ignore'});
  let original;
  const command=async value=>{fs.writeFileSync(commandFile,JSON.stringify({...value,sequence:Date.now()}));await sleep(2800);if(value.mode){try{(report.windowFixtures??=[]).push(JSON.parse(fs.readFileSync(commandFile+'.actual.json','utf8').replace(/^\uFEFF/,'')))}catch{}}};
  try{
   for(let i=0;i<100;i++){try{original=JSON.parse(fs.readFileSync(commandFile+'.state.json','utf8').replace(/^\uFEFF/,''));break;}catch{}await sleep(100);}
   if(!original)throw Error('Native window fixture failed to start');
   for(const [label,v]of Object.entries((await state()).widgetViews)){
    await command({mode:'maximized',display:v.monitor});
    record(label+' survives a real maximized window',(await state()).widgetWindows.find(w=>w.label===label)?.visible===true);
    await command({mode:'fullscreen',display:v.monitor});
    record(label+' yields to a real fullscreen window',(await state()).widgetWindows.find(w=>w.label===label)?.visible===false);
    await command({mode:'normal',display:v.monitor});
    record(label+' returns after fullscreen without toggling',(await state()).widgetWindows.find(w=>w.label===label)?.visible===true);
   }
   const v=(await state()).widgetViews.widget;
   const [x,y,width,height]=v.bounds;
   await command({cursorX:x+Math.round(width/2),cursorY:y+Math.round(height/2)});
   await widget.send('Input.dispatchMouseEvent',{type:'mousePressed',x:width/v.scale/2,y:height/v.scale/2,button:'left',buttons:1,clickCount:1});await sleep(200);
   await command({cursorX:x+Math.round(width/2)+45,cursorY:y+Math.round(height/2)});
   await widget.send('Input.dispatchMouseEvent',{type:'mouseMoved',x:width/v.scale/2+45/v.scale,y:height/v.scale/2,buttons:1});await sleep(250);
   await widget.send('Input.dispatchMouseEvent',{type:'mouseReleased',x:width/v.scale/2+45/v.scale,y:height/v.scale/2,button:'left',buttons:0,clickCount:1});await sleep(300);
   const dragged=await state();
   record('Manual taskbar position is saved per display',dragged.prefs.widgetEdge==='manual'&&Object.keys(dragged.prefs.widgetPositions).length===current.monitors.length&&dragged.widgetViews.widget.bounds[0]!==x,JSON.stringify(dragged.prefs.widgetPositions));
   await command({cursorX:original.cursorX,cursorY:original.cursorY});
   // Reversible native auto-hide test. The helper restores the original OS state in finally.
   await command({mode:'normal',display:v.monitor});
   await command({cursorX:600,cursorY:400});
   await command({autoHide:true});await sleep(2500);
   record('Compact widget hides with the auto-hidden taskbar',(await state()).widgetWindows.find(w=>w.label==='widget')?.visible===false);
   await command({cursorX:Math.round((v.bar[0]+v.bar[2])/2),cursorY:v.bar[3]-1});await sleep(1500);
   record('Compact widget returns with taskbar hover',(await state()).widgetWindows.find(w=>w.label==='widget')?.visible===true);
  }finally{
   fs.writeFileSync(commandFile,JSON.stringify({mode:'close'}));await Promise.race([new Promise(r=>fixture.once('exit',r)),sleep(5000)]);
   if(fixture.exitCode===null){if(original)spawnSync('powershell.exe',['-NoProfile','-File',path.resolve('tools/windows-window-fixture.ps1'),'-CommandFile',commandFile,'-RestoreState',String(original.originalTaskbarState)],{windowsHide:true});fixture.kill();}
  }
  const manualPrefs=(await state()).prefs;
  await set('widgetMode','floating');await sleep(600);await widget.screenshot('floating-refined.png');
  await session.evaluate('openSettings("desktop")');await sleep(350);await session.screenshot('windows-settings-refined.png');await session.evaluate('closeSettings()');
  await set('widgetMode','taskbar');await set('widgetMonitor','primary');
  return {widgetMode:'taskbar',widgetMonitor:'all',widgetEdge:'manual',widgetPositions:manualPrefs.widgetPositions};
 }finally{for(const {client}of clients)client.close();}
}
