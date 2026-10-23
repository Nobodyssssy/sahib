param([int]$TargetProcess,[int]$X,[int]$Y,[int]$Width,[int]$Height,[switch]$Cover,[string]$Capture)
Add-Type -AssemblyName System.Drawing
Add-Type @'
using System;using System.Runtime.InteropServices;using System.Text;
public static class SahibZProbe{
 [StructLayout(LayoutKind.Sequential)]public struct Rect{public int l,t,r,b;}
 [StructLayout(LayoutKind.Sequential)]public struct Point{public int x,y;}
 public delegate bool EnumProc(IntPtr w,IntPtr p);
 [DllImport("user32.dll")]public static extern bool EnumWindows(EnumProc p,IntPtr x);
 [DllImport("user32.dll")]public static extern uint GetWindowThreadProcessId(IntPtr w,out uint p);
 [DllImport("user32.dll")]public static extern bool GetWindowRect(IntPtr w,out Rect r);
 [DllImport("user32.dll")]public static extern bool IsWindowVisible(IntPtr w);
 [DllImport("user32.dll")]public static extern bool IsIconic(IntPtr w);
 [DllImport("user32.dll")]public static extern IntPtr GetWindowLongPtr(IntPtr w,int n);
 [DllImport("user32.dll")]public static extern IntPtr GetWindow(IntPtr w,uint n);
 [DllImport("user32.dll")]public static extern IntPtr GetTopWindow(IntPtr w);
 [DllImport("user32.dll")]public static extern IntPtr GetAncestor(IntPtr w,uint n);
 [DllImport("user32.dll")]public static extern IntPtr WindowFromPoint(Point p);
 [DllImport("user32.dll")]public static extern int GetClassName(IntPtr w,StringBuilder s,int n);
 [DllImport("user32.dll")]public static extern IntPtr GetForegroundWindow();
 [DllImport("user32.dll")]public static extern bool SetWindowPos(IntPtr w,IntPtr a,int x,int y,int cx,int cy,uint f);
 [DllImport("user32.dll")]public static extern IntPtr SetThreadDpiAwarenessContext(IntPtr p);
 [DllImport("dwmapi.dll")]public static extern int DwmGetWindowAttribute(IntPtr w,uint a,out int value,int n);
 public static string Class(IntPtr w){var s=new StringBuilder(256);GetClassName(w,s,256);return s.ToString();}
 public static IntPtr Find(int pid,int x,int y){IntPtr found=IntPtr.Zero;EnumWindows((w,p)=>{uint id;GetWindowThreadProcessId(w,out id);Rect r;GetWindowRect(w,out r);if(id==pid&&r.l==x&&r.t==y){found=w;return false;}return true;},IntPtr.Zero);return found;}
 public static IntPtr Bar(int x,int y){IntPtr found=IntPtr.Zero;EnumWindows((w,p)=>{var c=Class(w);Rect r;GetWindowRect(w,out r);if((c=="Shell_TrayWnd"||c=="Shell_SecondaryTrayWnd")&&x>=r.l&&x<r.r&&y>=r.t&&y<r.b){found=w;return false;}return true;},IntPtr.Zero);return found;}
 public static int Rank(IntPtr target){var w=GetTopWindow(IntPtr.Zero);for(int n=0;n<4096&&w!=IntPtr.Zero;n++,w=GetWindow(w,2)){if(w==target)return n;}return -1;}
}
'@
[void][SahibZProbe]::SetThreadDpiAwarenessContext([IntPtr](-4))
$handle=[SahibZProbe]::Find($TargetProcess,$X,$Y)
if($handle -eq [IntPtr]::Zero){throw 'QA widget not found'}
$bar=[SahibZProbe]::Bar(($X+$Width/2),($Y+$Height/2))
$actionAt=[DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()
if($Cover){if($bar -eq [IntPtr]::Zero){throw 'Taskbar not found'};[void][SahibZProbe]::SetWindowPos($bar,[IntPtr](-1),0,0,0,0,0x213)}
$point=New-Object SahibZProbe+Point;$point.x=$X+[int]($Width/2);$point.y=$Y+[int]($Height/2)
$hit=[SahibZProbe]::GetAncestor([SahibZProbe]::WindowFromPoint($point),2)
$cloaked=0;[void][SahibZProbe]::DwmGetWindowAttribute($handle,14,[ref]$cloaked,4)
if($Capture){$bitmap=New-Object Drawing.Bitmap($Width,$Height);$graphics=[Drawing.Graphics]::FromImage($bitmap);try{$graphics.CopyFromScreen($X,$Y,0,0,$bitmap.Size);$bitmap.Save($Capture,[Drawing.Imaging.ImageFormat]::Png)}finally{$graphics.Dispose();$bitmap.Dispose()}}
[pscustomobject]@{actionAt=$actionAt;observedAt=[DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds();foreground=[SahibZProbe]::GetForegroundWindow().ToInt64();visible=[SahibZProbe]::IsWindowVisible($handle);iconic=[SahibZProbe]::IsIconic($handle);cloaked=$cloaked;topmost=(([SahibZProbe]::GetWindowLongPtr($handle,-20).ToInt64()-band 8)-ne 0);widgetRank=[SahibZProbe]::Rank($handle);taskbarRank=[SahibZProbe]::Rank($bar);hitClass=[SahibZProbe]::Class($hit);coveredByTaskbar=($hit -eq $bar);foregroundClass=[SahibZProbe]::Class([SahibZProbe]::GetForegroundWindow());handle=$handle.ToInt64()}|ConvertTo-Json -Compress
