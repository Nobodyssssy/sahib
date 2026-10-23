param([Parameter(Mandatory=$true)][int]$RootProcess,[switch]$ClickOpen)
Add-Type @'
using System;using System.Text;using System.Runtime.InteropServices;
public static class SahibTrayProbe {
 public delegate bool EnumProc(IntPtr w,IntPtr p);
 [StructLayout(LayoutKind.Sequential)]public struct Rect{public int left,top,right,bottom;}
 [StructLayout(LayoutKind.Sequential)]public struct IconId{public uint cbSize;public IntPtr hwnd;public uint id;public Guid guid;}
 [DllImport("user32.dll")]public static extern bool EnumWindows(EnumProc p,IntPtr v);
 [DllImport("user32.dll")]public static extern uint GetWindowThreadProcessId(IntPtr w,out uint p);
 [DllImport("user32.dll")]public static extern int GetClassName(IntPtr w,StringBuilder s,int n);
 [DllImport("user32.dll")]public static extern IntPtr SendMessage(IntPtr w,uint m,IntPtr a,IntPtr b);
 [DllImport("shell32.dll")]public static extern int Shell_NotifyIconGetRect(ref IconId id,out Rect r);
 public static IntPtr Find(int pid){var found=IntPtr.Zero;EnumWindows((w,v)=>{uint id;GetWindowThreadProcessId(w,out id);var s=new StringBuilder(256);GetClassName(w,s,256);if(id==pid&&s.ToString()=="tray_icon_app"){found=w;return false;}return true;},IntPtr.Zero);return found;}
 public static string Inspect(int pid,bool click){var w=Find(pid);for(uint n=1;n<=16;n++){var id=new IconId{cbSize=(uint)Marshal.SizeOf(typeof(IconId)),hwnd=w,id=n};Rect r;if(w!=IntPtr.Zero&&Shell_NotifyIconGetRect(ref id,out r)==0){if(click)SendMessage(w,6002,IntPtr.Zero,new IntPtr(0x202));return "{\"registered\":true,\"id\":"+n+",\"clicked\":"+(click?"true":"false")+"}";}}return "{\"registered\":false}";}
}
'@
[SahibTrayProbe]::Inspect($RootProcess,$ClickOpen.IsPresent)
