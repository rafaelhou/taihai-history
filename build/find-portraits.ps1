# 在 Wikimedia Commons 找人物與場景圖的候選，只列出檔名、尺寸與授權，不下載。
# 挑好之後把檔名填進 images.json，再跑 get-images.ps1 下載。
#
# 查詢詞全部用 ASCII（羅馬字）—— PS 5.1 讀無 BOM 的 UTF-8 指令碼會當成 ANSI，
# 中文查詢詞會變成亂碼送出去，然後靜靜地查不到東西。
$ErrorActionPreference = 'Stop'
$UA = 'taihai-history-site/1.0 (https://github.com/rafaelhou; rafaelhou@gmail.com)'

$terms = @(
  'Lien Heng historian Taiwan', 'Lien Heng General History of Taiwan',
  'Sword of Goujian', 'Minyue Chengcun city ruins', 'Wuyi Minyue royal city',
  'Kaiyuan Temple Quanzhou pagoda', 'Qingjing Mosque Quanzhou',
  'Quanzhou ship Song dynasty wreck', 'Luoyang Bridge Quanzhou',
  'Liusheng Pagoda Shihu', 'Mazu statue Meizhou',
  'Longshan Temple Lukang', 'Bangka Lungshan Temple Taipei',
  'Xiahai City God Temple Dadaocheng', 'Qingshui Temple Bangka',
  'Fort Zeelandia Anping', 'Koxinga Shrine Tainan',
  'Zhang Zhen Fujian warlord', 'Shihjing Shijing Nanan',
  'Erkunshen Luermen', 'Hanjiang Shihu Shijing port',
  'Chen Zhen Taiwan Lianzhen', 'Taiwan Nichinichi Shinpo newspaper'
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
