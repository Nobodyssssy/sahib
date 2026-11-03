param([Parameter(Mandatory=$true)][int]$TargetProcess)
Add-Type @'
using System;using System.Collections.Generic;using System.Runtime.InteropServices;
public static class SahibSurfaceProbe {
 delegate bool Visit(IntPtr w,IntPtr p);
 [DllImport("user32.dll",CharSet=CharSet.Unicode)]static extern IntPtr FindWindow(string c,string t);
 [DllImport("user32.dll",CharSet=CharSet.Unicode)]static extern IntPtr FindWindowEx(IntPtr p,IntPtr a,string c,string t);
 [DllImport("user32.dll")]static extern uint GetWindowThreadProcessId(IntPtr w,out uint id);
 [DllImport("user32.dll")]static extern bool EnumChildWindows(IntPtr w,Visit callback,IntPtr p);
 public static long[] Children(uint pid){
  var result=new List<long>();var primary=FindWindow("Shell_TrayWnd",null);var bar=primary;
  while(bar!=IntPtr.Zero){EnumChildWindows(bar,(w,p)=>{uint id;GetWindowThreadProcessId(w,out id);if(id==pid)result.Add(w.ToInt64());return true;},IntPtr.Zero);
   bar=FindWindowEx(IntPtr.Zero,bar==primary?IntPtr.Zero:bar,"Shell_SecondaryTrayWnd",null);}
  return result.ToArray();
 }
}
'@
[pscustomobject]@{handles=@([SahibSurfaceProbe]::Children([uint32]$TargetProcess))}|ConvertTo-Json -Compress
