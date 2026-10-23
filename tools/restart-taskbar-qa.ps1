# Explicit local reliability test: restart only the actual Windows Explorer shell.
# Do not run in CI or a non-interactive session.
Add-Type @'
using System;using System.Runtime.InteropServices;
public static class SahibShellRestart {
 [DllImport("user32.dll",CharSet=CharSet.Unicode)]public static extern IntPtr FindWindow(string c,string t);
 [DllImport("user32.dll")]public static extern uint GetWindowThreadProcessId(IntPtr w,out uint id);
}
'@
$bar=[SahibShellRestart]::FindWindow('Shell_TrayWnd',$null)
if($bar -eq [IntPtr]::Zero){throw 'No active Explorer taskbar'}
[uint32]$taskbarOwnerId=0;[void][SahibShellRestart]::GetWindowThreadProcessId($bar,[ref]$taskbarOwnerId)
$taskbarOwner=Get-Process -Id $taskbarOwnerId -ErrorAction Stop
$expected=Join-Path $env:WINDIR 'explorer.exe'
if($taskbarOwner.Path -ine $expected){throw 'Taskbar owner is not Windows Explorer'}
$started=[DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()
try{
 Stop-Process -Id $taskbarOwnerId -Force -ErrorAction Stop
 for($n=0;$n -lt 100;$n++){
  Start-Sleep -Milliseconds 200
  $newBar=[SahibShellRestart]::FindWindow('Shell_TrayWnd',$null)
  if($newBar -ne [IntPtr]::Zero){
   [uint32]$newId=0;[void][SahibShellRestart]::GetWindowThreadProcessId($newBar,[ref]$newId)
   if($newId -ne $taskbarOwnerId){[pscustomobject]@{oldShell=$taskbarOwnerId;newShell=$newId;elapsedMs=[DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()-$started}|ConvertTo-Json -Compress;exit}
  }
  if($n -eq 49){Start-Process -FilePath $expected -WindowStyle Hidden}
 }
 throw 'Explorer taskbar did not return within 20 seconds'
}finally{
 if([SahibShellRestart]::FindWindow('Shell_TrayWnd',$null) -eq [IntPtr]::Zero){Start-Process -FilePath $expected -WindowStyle Hidden}
}
