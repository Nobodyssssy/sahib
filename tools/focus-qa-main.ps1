param([Parameter(Mandatory=$true)][int]$TargetProcess)
Add-Type @'
using System;using System.Runtime.InteropServices;
public static class SahibQAFocus {
 [StructLayout(LayoutKind.Sequential)]public struct Rect{public int l,t,r,b;}
 [StructLayout(LayoutKind.Sequential)]public struct Point{public int x,y;}
 [DllImport("user32.dll")]public static extern uint GetWindowThreadProcessId(IntPtr w,out uint id);
 [DllImport("user32.dll")]public static extern bool GetWindowRect(IntPtr w,out Rect r);
 [DllImport("user32.dll")]public static extern bool GetCursorPos(out Point p);
 [DllImport("user32.dll")]public static extern bool SetCursorPos(int x,int y);
 [DllImport("user32.dll")]public static extern bool SetForegroundWindow(IntPtr w);
 [DllImport("user32.dll")]public static extern IntPtr GetForegroundWindow();
 [DllImport("user32.dll")]public static extern bool SetWindowPos(IntPtr w,IntPtr a,int x,int y,int cx,int cy,uint flags);
 [DllImport("user32.dll")]public static extern IntPtr WindowFromPoint(Point p);
 [DllImport("user32.dll")]public static extern IntPtr GetAncestor(IntPtr w,uint flags);
 [DllImport("user32.dll")]public static extern IntPtr SetThreadDpiAwarenessContext(IntPtr c);
 [DllImport("user32.dll")]public static extern void mouse_event(uint f,uint x,uint y,uint data,UIntPtr extra);
}
'@
[void][SahibQAFocus]::SetThreadDpiAwarenessContext([IntPtr](-4))
$p=Get-Process -Id $TargetProcess -ErrorAction Stop;$w=$p.MainWindowHandle
[uint32]$ownerId=0;[void][SahibQAFocus]::GetWindowThreadProcessId($w,[ref]$ownerId)
$r=New-Object SahibQAFocus+Rect
if($ownerId -ne $TargetProcess -or ![SahibQAFocus]::GetWindowRect($w,[ref]$r) -or ($r.r-$r.l) -lt 600){throw 'QA main window not identified safely'}
$point=New-Object SahibQAFocus+Point;[void][SahibQAFocus]::GetCursorPos([ref]$point)
try{
 [void][SahibQAFocus]::SetWindowPos($w,[IntPtr](-1),0,0,0,0,0x13)
 Start-Sleep -Milliseconds 150
 [void][SahibQAFocus]::SetForegroundWindow($w)
 $target=New-Object SahibQAFocus+Point;$target.x=$r.l+100;$target.y=$r.t+12
 if([SahibQAFocus]::GetAncestor([SahibQAFocus]::WindowFromPoint($target),2) -ne $w){throw 'QA caption is not exposed; refusing to click another window'}
 [void][SahibQAFocus]::SetCursorPos($target.x,$target.y)
 [SahibQAFocus]::mouse_event(2,0,0,0,[UIntPtr]::Zero);[SahibQAFocus]::mouse_event(4,0,0,0,[UIntPtr]::Zero)
 Start-Sleep -Milliseconds 150
 $foreground=[SahibQAFocus]::GetForegroundWindow();[uint32]$foregroundOwner=0;[void][SahibQAFocus]::GetWindowThreadProcessId($foreground,[ref]$foregroundOwner)
 if($foregroundOwner -ne $TargetProcess){throw "QA main did not receive foreground: target=$($w.ToInt64()) pid=$TargetProcess foreground=$($foreground.ToInt64()) owner=$foregroundOwner bounds=$($r.l),$($r.t),$($r.r),$($r.b)"}
}finally{[void][SahibQAFocus]::SetWindowPos($w,[IntPtr](-2),0,0,0,0,0x13);[void][SahibQAFocus]::SetCursorPos($point.x,$point.y)}
