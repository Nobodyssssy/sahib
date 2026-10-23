import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {setTimeout as sleep} from 'node:timers/promises';
export async function measureDesktop(pid,seconds=30){
 const sample=()=>{
  const r=spawnSync('powershell.exe',['-NoProfile','-File',fileURLToPath(new URL('./profile-process-tree.ps1',import.meta.url)),'-RootProcess',String(pid)],{encoding:'utf8',windowsHide:true});
  if(r.status!==0)throw Error(r.stderr||'Cannot measure test processes');return JSON.parse(r.stdout);
 };
 const samples=[sample()];for(let i=0;i<seconds/5;i++){await sleep(5000);samples.push(sample());}
 const first=samples[0],last=samples.at(-1),duration=(last.at-first.at)/1000;let cpuSeconds=0;
 for(let i=1;i<samples.length;i++){
  const before=new Map(samples[i-1].processes.map(p=>[p.id+':'+p.created,p.cpu]));
  for(const p of samples[i].processes){const prior=before.get(p.id+':'+p.created);p.intervalCpuSeconds=prior===undefined?0:Math.max(0,p.cpu-prior);p.cpuOneCorePercent=p.intervalCpuSeconds/((samples[i].at-samples[i-1].at)/1000)*100;cpuSeconds+=p.intervalCpuSeconds;}
 }
 const mean=key=>samples.reduce((sum,s)=>sum+s.processes.reduce((n,p)=>n+(p[key]||0),0),0)/samples.length/1048576;
 return {durationSeconds:duration,logicalProcessors:last.cores,cpuSystemPercent:cpuSeconds/duration/last.cores*100,cpuOneCorePercent:cpuSeconds/duration*100,meanWorkingSetMiB:mean('workingSet'),meanPrivateWorkingSetMiB:samples.every(s=>s.processes.every(p=>p.privateWorkingSet!==null))?mean('privateWorkingSet'):null,meanPrivateCommitMiB:mean('privateCommit'),note:'Sahib host plus all descendant WebView2 processes. Summed working sets may double-count shared pages; private commit is not resident RAM. CPU deltas use PID plus creation time; processes that exit between samples are not captured. Debug QA is not a release benchmark.',samples};
}
