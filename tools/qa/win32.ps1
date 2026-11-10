param([int]$ProcessId, [string]$Mode = "windows")
Add-Type @"
using System; using System.Text; using System.Runtime.InteropServices; using System.Collections.Generic;
public class W {
  public delegate bool EnumProc(IntPtr h, IntPtr l);
  [DllImport("user32.dll")] public static extern bool SetProcessDPIAware();
  [DllImport("user32.dll")] public static extern bool SetProcessDpiAwarenessContext(IntPtr v);
  [DllImport("user32.dll")] public static extern uint GetDpiForWindow(IntPtr h);
  [DllImport("user32.dll")] public static extern bool EnumWindows(EnumProc p, IntPtr l);
  [DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr h, out uint pid);
  [DllImport("user32.dll")] public static extern bool IsWindowVisible(IntPtr h);
  [DllImport("user32.dll")] public static extern bool GetWindowRect(IntPtr h, out RECT r);
  [DllImport("user32.dll", CharSet=CharSet.Unicode)] public static extern int GetWindowText(IntPtr h, StringBuilder s, int n);
  [DllImport("user32.dll", CharSet=CharSet.Unicode)] public static extern int GetClassName(IntPtr h, StringBuilder s, int n);
  [DllImport("user32.dll")] public static extern IntPtr MonitorFromWindow(IntPtr h, uint f);
  [DllImport("user32.dll")] public static extern bool GetMonitorInfo(IntPtr m, ref MONITORINFO i);
  [DllImport("user32.dll")] public static extern IntPtr GetForegroundWindow();
  [DllImport("user32.dll")] public static extern bool PostMessage(IntPtr h, uint m, IntPtr w, IntPtr l);
  [DllImport("user32.dll")] public static extern bool GetCursorPos(out POINT p);
  [DllImport("user32.dll")] public static extern IntPtr MonitorFromPoint(POINT p, uint f);
  [StructLayout(LayoutKind.Sequential)] public struct RECT { public int L, T, R, B; }
  [StructLayout(LayoutKind.Sequential)] public struct POINT { public int X, Y; }
  [StructLayout(LayoutKind.Sequential)] public struct MONITORINFO { public int cb; public RECT mon; public RECT work; public uint flags; }
  public static List<IntPtr> ForPid(uint pid){ var l=new List<IntPtr>(); EnumWindows((h,_)=>{ uint p; GetWindowThreadProcessId(h,out p); if(p==pid) l.Add(h); return true;}, IntPtr.Zero); return l; }
}
"@
[W]::SetProcessDpiAwarenessContext([IntPtr](-4)) | Out-Null
function Describe($h) {
  $r = New-Object W+RECT; [W]::GetWindowRect($h, [ref]$r) | Out-Null
  $t = New-Object System.Text.StringBuilder 256; [W]::GetWindowText($h, $t, 256) | Out-Null
  $c = New-Object System.Text.StringBuilder 256; [W]::GetClassName($h, $c, 256) | Out-Null
  $m = [W]::MonitorFromWindow($h, 2); $mi = New-Object W+MONITORINFO; $mi.cb = [System.Runtime.InteropServices.Marshal]::SizeOf($mi); [W]::GetMonitorInfo($m, [ref]$mi) | Out-Null
  [pscustomobject]@{
    hwnd = $h.ToInt64(); title = $t.ToString(); cls = $c.ToString(); visible = [W]::IsWindowVisible($h)
    dpi = [W]::GetDpiForWindow($h)
    rect = @($r.L, $r.T, ($r.R - $r.L), ($r.B - $r.T))
    work = @($mi.work.L, $mi.work.T, ($mi.work.R - $mi.work.L), ($mi.work.B - $mi.work.T))
    mon = @($mi.mon.L, $mi.mon.T, ($mi.mon.R - $mi.mon.L), ($mi.mon.B - $mi.mon.T))
  }
}
if ($Mode -eq "windows") {
  $out = foreach ($h in [W]::ForPid($ProcessId)) { $d = Describe $h; if ($d.visible -and $d.rect[2] -gt 100) { $d } }
  $out | ConvertTo-Json -Compress
} elseif ($Mode -eq "foreground") {
  $h = [W]::GetForegroundWindow(); $pid2 = 0; [W]::GetWindowThreadProcessId($h, [ref]$pid2) | Out-Null
  $t = New-Object System.Text.StringBuilder 256; [W]::GetWindowText($h, $t, 256) | Out-Null
  [pscustomobject]@{ hwnd = $h.ToInt64(); pid = $pid2; title = $t.ToString() } | ConvertTo-Json -Compress
} elseif ($Mode -eq "cursor") {
  $p = New-Object W+POINT; [W]::GetCursorPos([ref]$p) | Out-Null
  $m = [W]::MonitorFromPoint($p, 2); $mi = New-Object W+MONITORINFO; $mi.cb = [System.Runtime.InteropServices.Marshal]::SizeOf($mi); [W]::GetMonitorInfo($m, [ref]$mi) | Out-Null
  [pscustomobject]@{ cursor = @($p.X, $p.Y); work = @($mi.work.L, $mi.work.T, ($mi.work.R - $mi.work.L), ($mi.work.B - $mi.work.T)) } | ConvertTo-Json -Compress
} elseif ($Mode -eq "close") {
  foreach ($h in [W]::ForPid($ProcessId)) { $d = Describe $h; if ($d.visible -and $d.rect[2] -gt 400) { [W]::PostMessage($h, 0x10, [IntPtr]::Zero, [IntPtr]::Zero) | Out-Null; "closed $($d.hwnd)" } }
}
