# 從 Wikimedia Commons 抓 images.json 列出的圖，存成 ../img/people/<id>.<ext>
# 同時把作者與授權寫成 ../img/credits.json，頁尾與來源頁直接吃這份資料。
#
# 兩個地雷：
#   1. 這個 .ps1 必須維持純 ASCII —— PS 5.1 讀無 BOM 的 UTF-8 指令碼會當成 ANSI，中文全毀。
#      所以檔名與說明一律放在 images.json，用 Get-Content -Encoding UTF8 明確解碼。
#   2. upload.wikimedia.org 會 429，必須帶可識別的 User-Agent，並在檔與檔之間隔 2 秒。
$ErrorActionPreference = 'Stop'
$UA   = 'taihai-history-site/1.0 (https://github.com/rafaelhou/taihai-history; rafaelhou@gmail.com)'
$here = Split-Path -Parent $MyInvocation.MyCommand.Path
$dest = Join-Path $here '..\img\people'
New-Item -ItemType Directory -Force $dest | Out-Null

$items = Get-Content (Join-Path $here 'images.json') -Raw -Encoding UTF8 | ConvertFrom-Json
$credits = @()

foreach ($it in $items) {
  $q = [uri]::EscapeDataString($it.file)
  $api = "https://commons.wikimedia.org/w/api.php?action=query&format=json&titles=$q" +
         "&prop=imageinfo&iiprop=url|extmetadata&iiurlwidth=520" +
         "&iiextmetadatafilter=Artist|LicenseShortName|LicenseUrl|Credit"
  $r = Invoke-RestMethod -Uri $api -UserAgent $UA -TimeoutSec 30
  $page = $r.query.pages.PSObject.Properties.Value | Select-Object -First 1
  if (-not $page.imageinfo) { Write-Output "MISS $($it.id)  $($it.file)"; Start-Sleep -Seconds 2; continue }
  $ii = $page.imageinfo[0]

  $thumb = $ii.thumburl
  if (-not $thumb) { $thumb = $ii.url }
  $ext = [System.IO.Path]::GetExtension(($thumb -split '\?')[0])
  if ($ext -notin @('.jpg', '.jpeg', '.png')) { $ext = '.jpg' }
  $out = Join-Path $dest ($it.id + $ext)

  Invoke-WebRequest -Uri $thumb -OutFile $out -UserAgent $UA -TimeoutSec 60

  # Artist 欄位是 HTML，拔成純文字
  $artist = $ii.extmetadata.Artist.value
  if ($artist) {
    $artist = ($artist -replace '<[^>]+>', '') -replace '\s+', ' '
    $artist = [System.Net.WebUtility]::HtmlDecode($artist).Trim()
  } else { $artist = '' }   # 空字串留給前端顯示「作者不詳」——這個檔必須維持純 ASCII

  $credits += [pscustomobject]@{
    id      = $it.id
    zh      = $it.zh
    cap     = $it.cap
    src     = ($it.id + $ext)
    file    = $it.file
    page    = 'https://commons.wikimedia.org/wiki/' + [uri]::EscapeDataString($it.file)
    artist  = $artist
    license = $ii.extmetadata.LicenseShortName.value
    licurl  = $ii.extmetadata.LicenseUrl.value
  }
  '{0,-16} {1,7:N0} KB  {2}' -f $it.id, ((Get-Item $out).Length / 1KB), $ii.extmetadata.LicenseShortName.value
  Start-Sleep -Seconds 2
}

$json = $credits | ConvertTo-Json -Depth 4
[System.IO.File]::WriteAllText((Join-Path $here '..\img\credits.json'), $json, (New-Object System.Text.UTF8Encoding($false)))
Write-Output "----"
Write-Output ("{0} images, credits.json written" -f $credits.Count)
