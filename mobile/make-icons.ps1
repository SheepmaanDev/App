# Genere les icones de l'app a partir du logo source.
# Usage : powershell -ExecutionPolicy Bypass -File make-icons.ps1 -Source <chemin-du-logo.(png|jpg)>
# Le logo est mis a l'echelle en NearestNeighbor (ideal pour du pixel art).
param([Parameter(Mandatory = $true)][string]$Source)

Add-Type -AssemblyName System.Drawing
$src = [System.Drawing.Image]::FromFile($Source)
Write-Output "Source : $Source ($($src.Width) x $($src.Height))"

function Resize-Icon([System.Drawing.Image]$img, [int]$size, [string]$dest) {
  $bmp = New-Object System.Drawing.Bitmap($size, $size)
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::NearestNeighbor
  $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::Half
  $g.DrawImage($img, 0, 0, $size, $size)
  $g.Dispose()
  $bmp.Save($dest, [System.Drawing.Imaging.ImageFormat]::Png)
  $bmp.Dispose()
  Write-Output "OK $dest ($size x $size)"
}

$images = Join-Path $PSScriptRoot 'assets\images'
Resize-Icon $src 1024 (Join-Path $images 'icon.png')
Resize-Icon $src 1024 (Join-Path $images 'android-icon-foreground.png')
Resize-Icon $src 512 (Join-Path $images 'splash-icon.png')
Resize-Icon $src 48 (Join-Path $images 'favicon.png')
$src.Dispose()
Write-Output 'Icones generees.'