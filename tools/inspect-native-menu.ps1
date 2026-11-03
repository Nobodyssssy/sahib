param([Parameter(Mandatory=$true)][int]$TargetProcess)
Add-Type @'
using System;using System.Runtime.InteropServices;
public static class SahibMenuProbe {
 [DllImport("user32.dll",CharSet=CharSet.Unicode)]public static extern IntPtr FindWindowEx(IntPtr p,IntPtr a,string c,string t);
 [DllImport("user32.dll")]public static extern uint GetWindowThreadProcessId(IntPtr w,out uint id);
 [DllImport("user32.dll")]public static extern bool IsWindowVisible(IntPtr w);
}
'@
$window=[IntPtr]::Zero;$found=[IntPtr]::Zero
while(($window=[SahibMenuProbe]::FindWindowEx([IntPtr]::Zero,$window,'#32768',$null)) -ne [IntPtr]::Zero){
 [uint32]$ownerId=0;[void][SahibMenuProbe]::GetWindowThreadProcessId($window,[ref]$ownerId)
 if($ownerId -eq $TargetProcess -and [SahibMenuProbe]::IsWindowVisible($window)){$found=$window;break}
}
[pscustomobject]@{found=($found -ne [IntPtr]::Zero);handle=$found.ToInt64()}|ConvertTo-Json -Compress
