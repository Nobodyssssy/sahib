param([Parameter(Mandatory=$true)][int]$ProcessId, [ValidateSet('query','cancel','end')][string]$Action)
Add-Type @'
using System;
using System.Runtime.InteropServices;
public static class SessionProbe {
 [DllImport("user32.dll", CharSet=CharSet.Unicode)] static extern IntPtr FindWindowEx(IntPtr parent, IntPtr after, string cls, string title);
 [DllImport("user32.dll")] static extern uint GetWindowThreadProcessId(IntPtr hwnd, out uint pid);
 [DllImport("user32.dll", SetLastError=true)] static extern IntPtr SendMessageTimeout(IntPtr hwnd, uint msg, UIntPtr wp, IntPtr lp, uint flags, uint timeout, out UIntPtr result);
 public static ulong Send(uint pid, uint msg, uint wp) {
  IntPtr hwnd=IntPtr.Zero;
  while ((hwnd=FindWindowEx(IntPtr.Zero,hwnd,"Tao Thread Event Target",null))!=IntPtr.Zero) {
   uint owner; GetWindowThreadProcessId(hwnd,out owner); if(owner!=pid)continue;
   UIntPtr result; var sent=SendMessageTimeout(hwnd,msg,new UIntPtr(wp),IntPtr.Zero,2,5000,out result);
   if(sent==IntPtr.Zero && msg!=22)throw new Exception("Session message failed: "+Marshal.GetLastWin32Error());
   return result.ToUInt64();
  }
  throw new Exception("No Tao session window for isolated QA process");
 }
}
'@
switch($Action) {
 'query' { [SessionProbe]::Send($ProcessId,17,0) }
 'cancel' { [SessionProbe]::Send($ProcessId,22,0) }
 'end' { [SessionProbe]::Send($ProcessId,22,1) }
}
