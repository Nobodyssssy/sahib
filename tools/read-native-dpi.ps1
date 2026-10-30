param([Parameter(Mandatory=$true)][int]$RootProcess)
Add-Type @'
using System;using System.Text;using System.Runtime.InteropServices;
public static class SahibDpiAudit {
 public delegate bool EnumProc(IntPtr w,IntPtr p);
 [StructLayout(LayoutKind.Sequential)]public struct Rect{public int left,top,right,bottom;}
 [DllImport("user32.dll")]public static extern bool EnumWindows(EnumProc p,IntPtr v);
 [DllImport("user32.dll")]public static extern uint GetWindowThreadProcessId(IntPtr w,out uint p);
 [DllImport("user32.dll",CharSet=CharSet.Unicode)]public static extern int GetWindowText(IntPtr w,StringBuilder text,int length);
 [DllImport("user32.dll")]public static extern bool GetClientRect(IntPtr w,out Rect r);
 [DllImport("user32.dll")]public static extern uint GetDpiForWindow(IntPtr w);
 [DllImport("user32.dll")]public static extern IntPtr SetThreadDpiAwarenessContext(IntPtr context);
 [DllImport("user32.dll")]public static extern int GetWindowRgn(IntPtr w,IntPtr region);
 [DllImport("gdi32.dll")]public static extern IntPtr CreateRectRgn(int l,int t,int r,int b);
 [DllImport("gdi32.dll")]public static extern int GetRgnBox(IntPtr region,out Rect r);
 [DllImport("gdi32.dll")]public static extern bool DeleteObject(IntPtr o);
 public static string Read(int pid){string result="{}";var prior=SetThreadDpiAwarenessContext(new IntPtr(-4));try{EnumWindows((w,v)=>{uint p;GetWindowThreadProcessId(w,out p);var title=new StringBuilder(256);GetWindowText(w,title,256);if(p!=(uint)pid||!title.ToString().Contains("Prayer companion"))return true;Rect client,clip;GetClientRect(w,out client);var region=CreateRectRgn(0,0,0,0);try{var kind=GetWindowRgn(w,region);GetRgnBox(region,out clip);result="{\"dpi\":"+GetDpiForWindow(w)+",\"clientWidth\":"+client.right+",\"clientHeight\":"+client.bottom+",\"clipRight\":"+clip.right+",\"clipBottom\":"+clip.bottom+",\"regionKind\":"+kind+",\"fits\":"+((kind==0||(clip.right>=client.right&&clip.bottom>=client.bottom))?"true":"false")+"}";}finally{DeleteObject(region);}return false;},IntPtr.Zero);}finally{SetThreadDpiAwarenessContext(prior);}return result;}
}
'@
[SahibDpiAudit]::Read($RootProcess)
