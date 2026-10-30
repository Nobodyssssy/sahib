param([string]$Executable,[string]$Shortcut,[string]$Output)
Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing
Add-Type @'
using System;using System.Runtime.InteropServices;
public static class SahibIconCapture{
 [StructLayout(LayoutKind.Sequential)]public struct Rect{public int l,t,r,b;}
 [StructLayout(LayoutKind.Sequential)]public struct Point{public int x,y;}
 [DllImport("user32.dll",CharSet=CharSet.Unicode)]public static extern uint PrivateExtractIcons(string file,int index,int width,int height,IntPtr[] icons,uint[] ids,uint count,uint flags);
 [DllImport("user32.dll")]public static extern bool DestroyIcon(IntPtr icon);
 [DllImport("user32.dll")]public static extern bool SetForegroundWindow(IntPtr w);
 [DllImport("user32.dll")]public static extern bool ShowWindow(IntPtr w,int mode);
 [DllImport("user32.dll")]public static extern bool SetWindowPos(IntPtr w,IntPtr after,int x,int y,int cx,int cy,uint flags);
 [DllImport("user32.dll")]public static extern bool GetClientRect(IntPtr w,out Rect r);
 [DllImport("user32.dll")]public static extern bool ClientToScreen(IntPtr w,ref Point p);
 [DllImport("user32.dll")]public static extern IntPtr WindowFromPoint(Point p);
 [DllImport("user32.dll")]public static extern IntPtr GetAncestor(IntPtr w,uint flags);
 [DllImport("user32.dll")]public static extern bool IsWindowVisible(IntPtr w);
 [DllImport("dwmapi.dll")]public static extern int DwmGetWindowAttribute(IntPtr w,uint a,out int value,int size);
 [DllImport("user32.dll")]public static extern IntPtr GetWindowLongPtr(IntPtr w,int index);
 [DllImport("user32.dll",CharSet=CharSet.Unicode)]public static extern int GetClassName(IntPtr w,System.Text.StringBuilder s,int n);
 [DllImport("user32.dll")]public static extern IntPtr SetThreadDpiAwarenessContext(IntPtr context);
}
'@
[void][SahibIconCapture]::SetThreadDpiAwarenessContext([IntPtr](-4))
$form=New-Object Windows.Forms.Form
$form.Text='Sahib RC - installed icon review'
$form.ClientSize=New-Object Drawing.Size(1000,420)
$form.StartPosition='Manual';$form.Location=New-Object Drawing.Point(80,80);$form.TopMost=$true
$form.AutoScaleMode='None'
$form.FormBorderStyle='FixedDialog';$form.MaximizeBox=$false;$form.MinimizeBox=$false
$form.add_Paint({param($sender,$event)
 $g=$event.Graphics;$font=New-Object Drawing.Font('Segoe UI',11)
 for($row=0;$row -lt 2;$row++){
  $y=$row*210
  $bg=if($row -eq 0){'#f5f1e9'}else{'#111c1a'}
  $ink=if($row -eq 0){[Drawing.Brushes]::Black}else{[Drawing.Brushes]::White}
  $brush=New-Object Drawing.SolidBrush([Drawing.ColorTranslator]::FromHtml($bg))
  $g.FillRectangle($brush,0,$y,1000,210);$brush.Dispose()
  $g.DrawString('Installed executable resource icons - native sizes',$font,$ink,20,($y+16))
  $x=20
  foreach($n in @(16,20,24,32,40,48,64,128)){
   $icons=New-Object IntPtr[] 1;$ids=New-Object uint32[] 1
   [void][SahibIconCapture]::PrivateExtractIcons($Executable,0,$n,$n,$icons,$ids,1,0)
   if($icons[0] -ne [IntPtr]::Zero){
    $icon=[Drawing.Icon]::FromHandle($icons[0]);$bitmap=$icon.ToBitmap()
    $g.DrawImageUnscaled($bitmap,$x,($y+52))
    $bitmap.Dispose();$icon.Dispose();[void][SahibIconCapture]::DestroyIcon($icons[0])
   }
   $g.DrawString([string]$n,$font,$ink,$x,($y+183));$x+=$n+36
  }
  $g.DrawString('Installed Start menu shortcut',$font,$ink,710,($y+16))
  $icon=[Drawing.Icon]::ExtractAssociatedIcon($Shortcut)
  if($icon){$g.DrawIconUnstretched($icon,(New-Object Drawing.Rectangle(760,($y+70),$icon.Width,$icon.Height)));$icon.Dispose()}
 }
 $font.Dispose()
})
$form.Show();[void][SahibIconCapture]::ShowWindow($form.Handle,5)
[void][SahibIconCapture]::SetWindowPos($form.Handle,[IntPtr](-1),0,0,0,0,0x43)
[void][SahibIconCapture]::SetForegroundWindow($form.Handle)
for($i=0;$i -lt 15;$i++){[Windows.Forms.Application]::DoEvents();Start-Sleep -Milliseconds 60}
$form.TopMost=$true
[void][SahibIconCapture]::ShowWindow($form.Handle,9)
[void][SahibIconCapture]::SetWindowPos($form.Handle,[IntPtr](-1),80,80,0,0,0x41)
[void][SahibIconCapture]::SetForegroundWindow($form.Handle)
[Windows.Forms.Application]::DoEvents();Start-Sleep -Milliseconds 150
$r=New-Object SahibIconCapture+Rect;[void][SahibIconCapture]::GetClientRect($form.Handle,[ref]$r)
$origin=New-Object SahibIconCapture+Point;[void][SahibIconCapture]::ClientToScreen($form.Handle,[ref]$origin)
$point=New-Object SahibIconCapture+Point;$point.x=$origin.x+[int](($r.r-$r.l)/2);$point.y=$origin.y+[int](($r.b-$r.t)/2)
$hit=[SahibIconCapture]::GetAncestor([SahibIconCapture]::WindowFromPoint($point),2)
if($hit -ne $form.Handle){$cloaked=0;[void][SahibIconCapture]::DwmGetWindowAttribute($form.Handle,14,[ref]$cloaked,4);$class=New-Object Text.StringBuilder 128;[void][SahibIconCapture]::GetClassName($hit,$class,128);[pscustomobject]@{form=$form.Handle.ToInt64();hit=$hit.ToInt64();hitClass=$class.ToString();topmost=(([SahibIconCapture]::GetWindowLongPtr($form.Handle,-20).ToInt64()-band 8)-ne 0);visible=[SahibIconCapture]::IsWindowVisible($form.Handle);cloaked=$cloaked;origin=$origin;rect=$r}|ConvertTo-Json -Compress;$form.Close();throw 'Icon review window is covered; no screenshot saved'}
$bitmap=New-Object Drawing.Bitmap(($r.r-$r.l),($r.b-$r.t));$g=[Drawing.Graphics]::FromImage($bitmap)
try{$g.CopyFromScreen($origin.x,$origin.y,0,0,$bitmap.Size);$bitmap.Save($Output,[Drawing.Imaging.ImageFormat]::Png)}finally{$g.Dispose();$bitmap.Dispose();$form.Close();$form.Dispose()}
[pscustomobject]@{executable=$Executable;shortcut=$Shortcut;output=$Output;capture='Real Windows form showing installed resource and shortcut icons';sizes=@(16,20,24,32,40,48,64,128)}|ConvertTo-Json -Compress
