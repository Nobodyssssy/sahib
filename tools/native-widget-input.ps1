param([Parameter(Mandatory=$true)][long]$Handle,[ValidateSet('click','settings','drag')][string]$Action='click')
Add-Type @'
using System;using System.Runtime.InteropServices;
public static class SahibNativeInput {
 [StructLayout(LayoutKind.Sequential)]public struct Point{public int x,y;}
 [DllImport("user32.dll")]public static extern IntPtr SendMessage(IntPtr w,uint m,IntPtr a,IntPtr b);
 [DllImport("user32.dll")]public static extern bool GetCursorPos(out Point p);
 [DllImport("user32.dll")]public static extern bool SetCursorPos(int x,int y);
}
'@
$point=New-Object SahibNativeInput+Point;[void][SahibNativeInput]::GetCursorPos([ref]$point)
try{
 if($Action -eq 'settings'){[void][SahibNativeInput]::SendMessage([IntPtr]$Handle,0x205,[IntPtr]::Zero,[IntPtr]::Zero)}
 else{
  [void][SahibNativeInput]::SendMessage([IntPtr]$Handle,0x201,[IntPtr]1,[IntPtr]::Zero)
  if($Action -eq 'drag'){[void][SahibNativeInput]::SetCursorPos(($point.x+45),$point.y)}
  [void][SahibNativeInput]::SendMessage([IntPtr]$Handle,0x202,[IntPtr]::Zero,[IntPtr]::Zero)
 }
 [pscustomobject]@{action=$Action;sent=$true}|ConvertTo-Json -Compress
}finally{[void][SahibNativeInput]::SetCursorPos($point.x,$point.y)}
