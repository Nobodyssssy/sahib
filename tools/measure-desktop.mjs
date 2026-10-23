import {spawnSync} from 'node:child_process';
import {setTimeout as sleep} from 'node:timers/promises';
export async function measureDesktop(pid,seconds=30){
 const sample=()=>{
  const command=`$all=Get-CimInstance Win32_Process; $ids=[Collections.Generic.HashSet[int]]::new();[void]$ids.Add(${pid});do{$changed=$false;foreach($p in $all){if($ids.Contains([int]$p.ParentProcessId)-and !$ids.Contains([int]$p.ProcessId)){[void]$ids.Add([int]$p.ProcessId);$changed=$true}}}while($changed);$rows=@(foreach($id in $ids){$p=Get-Process -Id $id -ErrorAction SilentlyContinue;if($p){[pscustomobject]@{id=$id;name=$p.ProcessName;cpu=$p.TotalProcessorTime.TotalSeconds;workingSet=$p.WorkingSet64;privateCommit=$p.PrivateMemorySize64}}});[pscustomobject]@{at=[DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds();cores=[Environment]::ProcessorCount;processes=$rows}|ConvertTo-Json -Depth 4 -Compress`;
  const r=spawnSync('powershell.exe',['-NoProfile','-Command',command],{encoding:'utf8',windowsHide:true});
  if(r.status!==0)throw Error(r.stderr||'Cannot measure test processes');return JSON.parse(r.stdout);
 };
 const samples=[sample()];for(let i=0;i<seconds/5;i++){await sleep(5000);samples.push(sample());}
 const first=samples[0],last=samples.at(-1),before=new Map(first.processes.map(p=>[p.id,p.cpu]));
 const cpuSeconds=last.processes.reduce((sum,p)=>sum+Math.max(0,p.cpu-(before.get(p.id)??p.cpu)),0),duration=(last.at-first.at)/1000;
 return {durationSeconds:duration,logicalProcessors:last.cores,cpuSystemPercent:cpuSeconds/duration/last.cores*100,cpuOneCorePercent:cpuSeconds/duration*100,meanWorkingSetMiB:samples.reduce((sum,s)=>sum+s.processes.reduce((n,p)=>n+p.workingSet,0),0)/samples.length/1048576,meanPrivateCommitMiB:samples.reduce((sum,s)=>sum+s.processes.reduce((n,p)=>n+p.privateCommit,0),0)/samples.length/1048576,note:'Sahib host plus descendant WebView2 processes; summed working sets can count shared pages twice. Private commit is committed memory, not resident RAM.',samples};
}
