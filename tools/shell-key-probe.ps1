param([ValidateSet('inspect','start','escape')][string]$Action='inspect')
Add-Type @'
using System;using System.Text;using System.Runtime.InteropServices;
public static class SahibShellKeyProbe{
 [StructLayout(LayoutKind.Sequential)]public struct Rect{public int left,top,right,bottom;}
 [DllImport("user32.dll")]public static extern IntPtr GetForegroundWindow();
 [DllImport("user32.dll")]public static extern int GetClassName(IntPtr w,StringBuilder s,int n);
 [DllImport("user32.dll")]public static extern uint GetWindowThreadProcessId(IntPtr w,out uint id);
 [DllImport("user32.dll")]public static extern bool GetWindowRect(IntPtr w,out Rect r);
 [DllImport("user32.dll")]public static extern void keybd_event(byte key,byte scan,uint flags,UIntPtr extra);
}
'@
if($Action -ne 'inspect'){
 $key=if($Action -eq 'start'){0x5B}else{0x1B}
 [SahibShellKeyProbe]::keybd_event($key,0,0,[UIntPtr]::Zero)
 [SahibShellKeyProbe]::keybd_event($key,0,2,[UIntPtr]::Zero)
 Start-Sleep -Milliseconds 900
}
$w=[SahibShellKeyProbe]::GetForegroundWindow();$name=New-Object Text.StringBuilder 256
[void][SahibShellKeyProbe]::GetClassName($w,$name,256)
[uint32]$processId=0;[void][SahibShellKeyProbe]::GetWindowThreadProcessId($w,[ref]$processId)
$rect=New-Object SahibShellKeyProbe+Rect;[void][SahibShellKeyProbe]::GetWindowRect($w,[ref]$rect)
$process=Get-Process -Id $processId -ErrorAction SilentlyContinue
[pscustomobject]@{handle=$w.ToInt64();class=$name.ToString();process=$process.ProcessName;bounds=$rect}|ConvertTo-Json -Compress
