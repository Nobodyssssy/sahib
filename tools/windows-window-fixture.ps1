param([Parameter(Mandatory=$true)][string]$CommandFile,[long]$RestoreState=-1)
Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing
Add-Type @'
using System;
using System.Runtime.InteropServices;
public static class SahibWindowFixture {
 [DllImport("user32.dll")] public static extern IntPtr SetThreadDpiAwarenessContext(IntPtr value);
 [DllImport("user32.dll")] public static extern bool SetCursorPos(int x,int y);
 [DllImport("user32.dll")] public static extern void mouse_event(uint flags,uint x,uint y,uint data,UIntPtr extra);
 [DllImport("user32.dll")] public static extern IntPtr GetForegroundWindow();
 [DllImport("user32.dll")] public static extern bool IsZoomed(IntPtr window);
 [StructLayout(LayoutKind.Sequential)] public struct Rect{public int left,top,right,bottom;}
 [StructLayout(LayoutKind.Sequential)] public struct Appbar{public uint size;public IntPtr window;public uint callback,edge;public Rect bounds;public IntPtr state;}
 [DllImport("shell32.dll")] public static extern UIntPtr SHAppBarMessage(uint message,ref Appbar data);
 public static ulong TaskbarState(){var d=new Appbar();d.size=(uint)Marshal.SizeOf(d);return SHAppBarMessage(4,ref d).ToUInt64();}
 public static void TaskbarState(ulong state){var d=new Appbar();d.size=(uint)Marshal.SizeOf(d);d.state=new IntPtr((long)state);SHAppBarMessage(10,ref d);}
}
'@
[void][SahibWindowFixture]::SetThreadDpiAwarenessContext([IntPtr](-4))
if($RestoreState -ge 0){[SahibWindowFixture]::TaskbarState([uint64]$RestoreState);exit}
$form=New-Object System.Windows.Forms.Form
$form.Text='Sahib QA — window recovery test'
$form.BackColor=[Drawing.Color]::FromArgb(30,36,42)
$form.StartPosition='Manual'
$form.Size=New-Object Drawing.Size(720,480)
$label=New-Object Windows.Forms.Label
$label.Text="Sahib QA`nMaximized / fullscreen / recovery verification`nThis fixture does not alter your personal windows."
$label.ForeColor=[Drawing.Color]::White
$label.AutoSize=$true
$label.Location=New-Object Drawing.Point(40,60)
$label.Font=New-Object Drawing.Font('Segoe UI',14)
$form.Controls.Add($label)
$originalState=[SahibWindowFixture]::TaskbarState()
$originalCursor=[Windows.Forms.Cursor]::Position
[pscustomobject]@{originalTaskbarState=$originalState;displays=@([Windows.Forms.Screen]::AllScreens|Select-Object DeviceName,Primary,Bounds,WorkingArea);cursorX=[Windows.Forms.Cursor]::Position.X;cursorY=[Windows.Forms.Cursor]::Position.Y}|ConvertTo-Json -Depth 5|Set-Content -LiteralPath ($CommandFile+'.state.json') -Encoding UTF8
$script:last=''
$timer=New-Object Windows.Forms.Timer
$timer.Interval=100
$timer.Add_Tick({
 try {
  $raw=Get-Content -LiteralPath $CommandFile -Raw -ErrorAction Stop
  if($raw -eq $script:last){return};$script:last=$raw;$command=$raw|ConvertFrom-Json
  if($command.mode -eq 'close'){$form.Close();return}
  if($null -ne $command.autoHide){$value=if($command.autoHide){$originalState-bor 1}else{$originalState-band (-bnot 1)};[SahibWindowFixture]::TaskbarState([uint64]$value);return}
  if($null -ne $command.cursorX){[void][SahibWindowFixture]::SetCursorPos($command.cursorX,$command.cursorY);return}
  $screen=[Windows.Forms.Screen]::AllScreens | Where-Object DeviceName -eq $command.display | Select-Object -First 1
  if(!$screen){$screen=[Windows.Forms.Screen]::PrimaryScreen}
  $form.WindowState='Normal';$form.FormBorderStyle='Sizable'
  $form.Location=New-Object Drawing.Point(($screen.Bounds.Left+80),($screen.Bounds.Top+60))
  $form.Size=New-Object Drawing.Size(720,480)
  if($command.mode -eq 'maximized'){$form.WindowState='Maximized'}
  if($command.mode -eq 'fullscreen'){$form.FormBorderStyle='None';$form.Bounds=$screen.Bounds}
  $form.TopMost=$true;$form.Show();$form.Activate()
  [void][SahibWindowFixture]::SetCursorPos(($form.Bounds.Left+100),($form.Bounds.Top+110))
  [SahibWindowFixture]::mouse_event(2,0,0,0,[UIntPtr]::Zero);[SahibWindowFixture]::mouse_event(4,0,0,0,[UIntPtr]::Zero)
  $form.TopMost=$false;$form.Activate()
  [pscustomobject]@{mode=$command.mode;bounds=$form.Bounds;maximized=[SahibWindowFixture]::IsZoomed($form.Handle);foreground=([SahibWindowFixture]::GetForegroundWindow() -eq $form.Handle);handle=$form.Handle.ToInt64()}|ConvertTo-Json -Depth 3|Set-Content -LiteralPath ($CommandFile+'.actual.json') -Encoding UTF8
 } catch { $_|Out-String|Add-Content -LiteralPath ($CommandFile+'.errors.log') }
})
try{$timer.Start();[Windows.Forms.Application]::Run($form)}finally{[SahibWindowFixture]::TaskbarState($originalState);[void][SahibWindowFixture]::SetCursorPos($originalCursor.X,$originalCursor.Y);$timer.Dispose();$form.Dispose()}
