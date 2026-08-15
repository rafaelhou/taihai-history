# 第三輪：潮國那一章要用的人物與場景圖。查詢詞一律 ASCII（見 find-portraits.ps1 的說明）。
$ErrorActionPreference = 'Stop'
$UA = 'taihai-history-site/1.0 (https://github.com/rafaelhou/taihai-history; rafaelhou@gmail.com)'

$terms = @(
  'Han Yu portrait', 'Zhao Tuo Nanyue king', 'Nanyue King tomb Guangzhou museum',
  'Xiao Xian Liang', 'Feng Ang', 'Lin Shihong',
  'Hanwengong Temple Chaozhou', 'Guangji Bridge Chaozhou', 'Kaiyuan Temple Chaozhou',
  'Paifang Street Chaozhou', 'Han River Chaozhou Guangdong',
  'Teochew opera', 'Gongfu tea Chaoshan', 'Teochew cuisine',
  'Shantou historic architecture', 'Shantou Xiaogongyuan', 'Mayu Island Shantou',
  'Nanao Island Guangdong', 'Chaozhou ancient city wall', 'Teochew wood carving',
  'Chaozhou porcelain', 'Jieyang Guangdong', 'Wang Han Youshi shanren'
)

foreach ($t in $terms) {
  $q = [uri]::EscapeDataString("$t")
  $url = "https://commons.wikimedia.org/w/api.php?action=query&format=json&generator=search" +
         "&gsrsearch=$q&gsrnamespace=6&gsrlimit=4&prop=imageinfo&iiprop=url|size|extmetadata" +
         "&iiextmetadatafilter=LicenseShortName"
  try { $r = Invoke-RestMethod -Uri $url -UserAgent $UA -TimeoutSec 30 }
  catch { Write-Output "== $t  [FAIL $($_.Exception.Message)]"; continue }
  Write-Output "== $t"
  if (-not $r.query) { Write-Output "   (none)"; Start-Sleep -Seconds 2; continue }
  foreach ($p in $r.query.pages.PSObject.Properties.Value) {
    $ii = $p.imageinfo[0]
    Write-Output ("   {0}`n      {1}x{2}  {3}" -f $p.title, $ii.width, $ii.height, $ii.extmetadata.LicenseShortName.value)
  }
  Start-Sleep -Seconds 2
}
