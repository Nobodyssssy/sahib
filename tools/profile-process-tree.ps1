param([Parameter(Mandatory=$true)][int]$RootProcess)
$all=Get-CimInstance Win32_Process
$ids=[Collections.Generic.HashSet[int]]::new()
[void]$ids.Add($RootProcess)
do {
 $changed=$false
 foreach($item in $all){
  if($ids.Contains([int]$item.ParentProcessId) -and !$ids.Contains([int]$item.ProcessId)){
   [void]$ids.Add([int]$item.ProcessId);$changed=$true
  }
 }
}while($changed)
$private=@{}
Get-CimInstance Win32_PerfFormattedData_PerfProc_Process | ForEach-Object {$private[[int]$_.IDProcess]=[long]$_.WorkingSetPrivate}
$rows=@(foreach($id in $ids){
 $process=Get-Process -Id $id -ErrorAction SilentlyContinue
 $metadata=$all | Where-Object ProcessId -eq $id
 if($process){
  $role=if($id -eq $RootProcess){'host'}elseif($metadata.CommandLine -match '--type=([^ ]+)'){$Matches[1]}else{'browser'}
  [pscustomobject]@{id=$id;parentId=[int]$metadata.ParentProcessId;created=$process.StartTime.ToUniversalTime().Ticks.ToString();name=$process.ProcessName;role=$role;cpu=$process.TotalProcessorTime.TotalSeconds;workingSet=$process.WorkingSet64;privateWorkingSet=$private[$id];privateCommit=$process.PrivateMemorySize64}
 }
})
[pscustomobject]@{at=[DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds();cores=[Environment]::ProcessorCount;processes=$rows} | ConvertTo-Json -Depth 4 -Compress
