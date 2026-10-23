// Isolated local QA only. Never connects to the installed Sahib profile.
import fs from 'node:fs';
import path from 'node:path';
import net from 'node:net';
import {spawn} from 'node:child_process';
import {setTimeout as sleep} from 'node:timers/promises';
export async function buildQA(output,features=[]){
 fs.mkdirSync(output,{recursive:true});const config=path.join(output,'tauri-qa.json');
 fs.writeFileSync(config,JSON.stringify({identifier:'com.sahib.companion.qa',productName:'Sahib QA'}));
 await new Promise((resolve,reject)=>{const p=spawn(process.execPath,['node_modules/@tauri-apps/cli/tauri.js','build','--debug','--no-bundle','--config',config,...(features.length?['--features',features.join(',')]:[]),'--','--locked'],{stdio:'inherit',windowsHide:true});p.on('error',reject);p.on('exit',c=>c===0?resolve():reject(Error(`Build failed ${c}`)));});
}
export async function connectQA(target,output){
 const ws=new WebSocket(target.webSocketDebuggerUrl);let id=0;const pending=new Map();
 await new Promise((resolve,reject)=>{ws.onopen=resolve;ws.onerror=reject;});
 ws.onmessage=e=>{const m=JSON.parse(e.data),p=pending.get(m.id);if(p){pending.delete(m.id);clearTimeout(p.timer);m.error?p.reject(Error(m.error.message)):p.resolve(m.result);}};
 ws.onclose=()=>{for(const p of pending.values()){clearTimeout(p.timer);p.reject(Error('QA view closed'));}pending.clear();};
 const send=(method,params={})=>new Promise((resolve,reject)=>{const n=++id,timer=setTimeout(()=>{pending.delete(n);reject(Error(method+' timeout'));},30000);pending.set(n,{resolve,reject,timer});ws.send(JSON.stringify({id:n,method,params}));});
 return {send,async evaluate(expression){const r=await send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(r.exceptionDetails)throw Error(r.exceptionDetails.exception?.description||r.exceptionDetails.text);return r.result?.value;},async screenshot(name){const {data}=await send('Page.captureScreenshot',{format:'png'});fs.writeFileSync(path.join(output,name),Buffer.from(data,'base64'));},close(){ws.close();}};
}
export async function startQA(output,{profile=path.join(output,'data'),env={},exe='src-tauri/target/debug/sahib-desktop.exe'}={}){
 fs.mkdirSync(profile,{recursive:true});const port=await new Promise(resolve=>{const s=net.createServer();s.listen(0,'127.0.0.1',()=>{const p=s.address().port;s.close(()=>resolve(p));});});
 const log=fs.openSync(path.join(output,'app.log'),'a'),start=Date.now();
 const app=spawn(path.resolve(exe),[],{windowsHide:true,stdio:['ignore',log,log],env:{...process.env,SAHIB_TEST_DATA_DIR:profile,SAHIB_TEST_CDP_PORT:String(port),...env}});
 const targets=async()=>{try{return await (await fetch(`http://127.0.0.1:${port}/json/list`,{signal:AbortSignal.timeout(1000)})).json();}catch{return [];}};
 const connect=async needle=>{for(let n=0;n<300;n++){if(app.exitCode!==null)throw Error('QA process exited '+app.exitCode);const t=(await targets()).find(t=>needle==='main'?/\/($|index.html$)/.test(t.url):t.url.includes(needle));if(t)return connectQA(t,output);await sleep(100);}throw Error('No QA target '+needle);};
 const waitReady=async view=>{for(let n=0;n<300;n++){if(await view.evaluate('!!window.SahibDesktop?.state'))return;await sleep(100);}throw Error('QA adapter not ready');};
 return {app,profile,port,start,targets,connect,waitReady,async stop(){if(app.exitCode===null){app.kill();await Promise.race([new Promise(r=>app.once('exit',r)),sleep(5000)]);}fs.closeSync(log);}};
}
