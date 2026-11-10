param([int]$X, [int]$Y, [int]$W, [int]$H, [string]$Out)
Add-Type -AssemblyName System.Drawing
Add-Type @"
using System.Runtime.InteropServices;
public class Dpi { [DllImport("user32.dll")] public static extern bool SetProcessDPIAware(); }
"@
[void][Dpi]::SetProcessDPIAware()
$bmp = New-Object System.Drawing.Bitmap $W, $H
$g = [System.Drawing.Graphics]::FromImage($bmp)
$g.CopyFromScreen($X, $Y, 0, 0, (New-Object System.Drawing.Size $W, $H))
$g.Dispose()
if ($Out) { $bmp.Save($Out, [System.Drawing.Imaging.ImageFormat]::Png) }
$counts = @{}
$yellow = 0
for ($yy = 0; $yy -lt $H; $yy += 2) {
  for ($xx = 0; $xx -lt $W; $xx += 2) {
    $c = $bmp.GetPixel($xx, $yy)
    if ($c.R -gt 225 -and $c.G -gt 175 -and $c.B -lt 100) { $yellow++ }
    $k = "{0},{1},{2}" -f ([int]($c.R / 8) * 8), ([int]($c.G / 8) * 8), ([int]($c.B / 8) * 8)
    if ($counts.ContainsKey($k)) { $counts[$k]++ } else { $counts[$k] = 1 }
  }
}
$top = $counts.GetEnumerator() | Sort-Object Value -Descending | Select-Object -First 1
$dom = $top.Key.Split(',') | ForEach-Object { [int]$_ + 4 }
$bmp.Dispose()
@{ dominant = $dom; yellow = $yellow } | ConvertTo-Json -Compress
