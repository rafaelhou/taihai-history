# Download the images listed in images.json from Wikimedia Commons into ../img/people/<id>.<ext>
# Also writes ../img/credits.json (author + licence), which build/make-credits.js turns into
# ../data/credits.js for the front end.
#
# THIS FILE MUST STAY PURE ASCII -- COMMENTS INCLUDED.
# PowerShell 5.1 reads a BOM-less UTF-8 script as ANSI. Chinese text in a comment decodes to
# mojibake, and if that mojibake happens to end in a backtick-like byte the NEXT line is
# swallowed as a line continuation. It fails silently: no parse error, the statement just
# never runs. That is exactly how "$have = @{}" disappeared and the skip-existing check
# below appeared to do nothing even though it tested fine in isolation.
# Put anything Chinese in images.json instead and read it with Get-Content -Encoding UTF8.
#
# upload.wikimedia.org returns 429 without an identifiable User-Agent, so send one and
# space real downloads about 2 seconds apart.
$ErrorActionPreference = 'Stop'
$UA   = 'taihai-history-site/1.0 (https://github.com/rafaelhou/taihai-history; rafaelhou@gmail.com)'
$here = Split-Path -Parent $MyInvocation.MyCommand.Path
$dest = Join-Path $here '..\img\people'
New-Item -ItemType Directory -Force $dest | Out-Null

$items = Get-Content (Join-Path $here 'images.json') -Raw -Encoding UTF8 | ConvertFrom-Json
$credits = @()

# Build a map of what is already on disk: id -> filename. Anything present is not re-fetched.
# Keyed on the basename because shrink-images.ps1 may have re-encoded a .png into a .jpg,
# so the extension on disk need not match the one in the thumbnail URL.
$have = @{}
foreach ($f in Get-ChildItem -Path $dest -File -ErrorAction SilentlyContinue) {
  $have[[System.IO.Path]::GetFileNameWithoutExtension($f.Name)] = $f.Name
}
Write-Output ("existing files on disk: {0}" -f $have.Count)

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

  if ($have.ContainsKey($it.id)) {
    $out = Join-Path $dest $have[$it.id]
    $skipped = $true
  } else {
    $out = Join-Path $dest ($it.id + $ext)
    Invoke-WebRequest -Uri $thumb -OutFile $out -UserAgent $UA -TimeoutSec 60
    $skipped = $false
  }

  # The Artist field is HTML; strip it down to plain text.
  $artist = $ii.extmetadata.Artist.value
  if ($artist) {
    $artist = ($artist -replace '<[^>]+>', '') -replace '\s+', ' '
    $artist = [System.Net.WebUtility]::HtmlDecode($artist).Trim()
  } else { $artist = '' }   # empty -> the front end shows "author unknown" in Chinese

  $credits += [pscustomobject]@{
    id      = $it.id
    zh      = $it.zh
    cap     = $it.cap
    # Always take the real filename on disk. Deriving it from the thumbnail URL's extension
    # writes a src pointing at a file that does not exist once shrink-images.ps1 has run.
    src     = [System.IO.Path]::GetFileName($out)
    file    = $it.file
    page    = 'https://commons.wikimedia.org/wiki/' + [uri]::EscapeDataString($it.file)
    artist  = $artist
    license = $ii.extmetadata.LicenseShortName.value
    licurl  = $ii.extmetadata.LicenseUrl.value
  }

  '{0,-16} {1,7:N0} KB  {2,-16} {3}' -f $it.id, ((Get-Item $out).Length / 1KB),
      $ii.extmetadata.LicenseShortName.value, $(if ($skipped) { 'have' } else { 'downloaded' })
  Start-Sleep -Milliseconds $(if ($skipped) { 150 } else { 2000 })
}

$json = $credits | ConvertTo-Json -Depth 4
[System.IO.File]::WriteAllText((Join-Path $here '..\img\credits.json'), $json, (New-Object System.Text.UTF8Encoding($false)))
Write-Output "----"
Write-Output ("{0} images, credits.json written" -f $credits.Count)
