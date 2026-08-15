# 重抓 Natural Earth 原始圖資（未進版控，約 11 MB）。
# 抓完跑 `node build/make-map.js` 重新產生 ../map-data.js。
$ErrorActionPreference = 'Stop'
$UA   = 'taihai-history-site/1.0 (https://github.com/rafaelhou/taihai-history)'
$base = 'https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/'
$here = Split-Path -Parent $MyInvocation.MyCommand.Path

foreach ($f in @('ne_10m_land.geojson', 'ne_10m_minor_islands.geojson')) {
  $dest = Join-Path $here $f
  Invoke-WebRequest -Uri ($base + $f) -OutFile $dest -UserAgent $UA
  '{0}  {1:N0} KB' -f $f, ((Get-Item $dest).Length / 1KB)
}
Write-Output 'done. next: node build/make-map.js'
