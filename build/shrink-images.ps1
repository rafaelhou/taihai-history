# 把 img/people 裡偏大的圖重新編碼成 JPEG q82，並同步更新 credits.json 的檔名。
# 幾張公有領域畫像原檔是 PNG 或高品質 JPEG，單張就上看 1.5 MB，
# ch7 那頁一次載 10 張會到 3.5 MB，太重。
# 可重複執行：已經夠小的檔會跳過。
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing

$here    = Split-Path -Parent $MyInvocation.MyCommand.Path
$dir     = Join-Path $here '..\img\people'
$credits = Join-Path $here '..\img\credits.json'
$LIMIT   = 300KB
$QUALITY = 82

$enc = [System.Drawing.Imaging.ImageCodecInfo]::GetImageEncoders() | Where-Object { $_.MimeType -eq 'image/jpeg' }
$prm = New-Object System.Drawing.Imaging.EncoderParameters(1)
$prm.Param[0] = New-Object System.Drawing.Imaging.EncoderParameter(
                  [System.Drawing.Imaging.Encoder]::Quality, [int64]$QUALITY)

$renames = @{}

foreach ($f in Get-ChildItem $dir -File) {
  if ($f.Length -le $LIMIT) { continue }
  $target = [System.IO.Path]::ChangeExtension($f.FullName, '.jpg')
  $tmp    = $target + '.tmp'

  $img = [System.Drawing.Image]::FromFile($f.FullName)
  try {
    # 白底攤平，免得 PNG 的透明區塊在 JPEG 變成黑塊
    $bmp = New-Object System.Drawing.Bitmap($img.Width, $img.Height)
    $g   = [System.Drawing.Graphics]::FromImage($bmp)
    $g.Clear([System.Drawing.Color]::White)
    $g.DrawImage($img, 0, 0, $img.Width, $img.Height)
    $g.Dispose()
    $bmp.Save($tmp, $enc, $prm)
    $bmp.Dispose()
  } finally { $img.Dispose() }

  $before = $f.Length
  if ($f.FullName -ne $target) { Remove-Item $f.FullName -Force }
  Move-Item $tmp $target -Force
  $after = (Get-Item $target).Length

  if ($f.Name -ne [System.IO.Path]::GetFileName($target)) {
    $renames[$f.Name] = [System.IO.Path]::GetFileName($target)
  }
  '{0,-18} {1,7:N0} KB -> {2,6:N0} KB' -f $f.Name, ($before/1KB), ($after/1KB)
}

# 同步 credits.json 的 src
if ($renames.Count) {
  $json = Get-Content $credits -Raw -Encoding UTF8 | ConvertFrom-Json
  foreach ($c in $json) { if ($renames.ContainsKey($c.src)) { $c.src = $renames[$c.src] } }
  $out = $json | ConvertTo-Json -Depth 4
  [System.IO.File]::WriteAllText($credits, $out, (New-Object System.Text.UTF8Encoding($false)))
  Write-Output ("credits.json: {0} filename(s) updated" -f $renames.Count)
}
