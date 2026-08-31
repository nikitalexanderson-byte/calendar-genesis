param(
  [string]$Url = "https://genesiscalendar.ru/"
)

$desktopValue = (Get-ItemProperty "HKCU:\Software\Microsoft\Windows\CurrentVersion\Explorer\User Shell Folders").Desktop
$desktop = [Environment]::ExpandEnvironmentVariables($desktopValue)
if (-not $desktop) {
  throw "Desktop folder was not found."
}

$appFolder = Join-Path $desktop "GENESIS"
New-Item -ItemType Directory -Force -Path $appFolder | Out-Null

$browserCandidates = @(
  (Join-Path $env:LOCALAPPDATA "Google\Chrome\Application\chrome.exe"),
  "C:\Program Files\Google\Chrome\Application\chrome.exe",
  "C:\Program Files (x86)\Google\Chrome\Application\chrome.exe",
  "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe",
  "C:\Program Files\Microsoft\Edge\Application\msedge.exe"
)
$browser = $browserCandidates | Where-Object { Test-Path -LiteralPath $_ } | Select-Object -First 1
if (-not $browser) {
  throw "Google Chrome or Microsoft Edge is required."
}

$projectRoot = Split-Path -Parent $PSScriptRoot
$iconSource = Join-Path $projectRoot "public\icons\icon-source.png"
$iconPath = Join-Path $appFolder "GENESIS.ico"
if (Test-Path -LiteralPath $iconSource) {
  Copy-Item -LiteralPath $iconSource -Destination (Join-Path $appFolder "GENESIS-icon.png") -Force
  Add-Type -AssemblyName System.Drawing
  $sourceImage = [System.Drawing.Image]::FromFile($iconSource)
  $iconBitmap = New-Object System.Drawing.Bitmap(128, 128)
  $iconGraphics = [System.Drawing.Graphics]::FromImage($iconBitmap)
  $iconGraphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
  $iconGraphics.DrawImage($sourceImage, 0, 0, 128, 128)
  $icon = [System.Drawing.Icon]::FromHandle($iconBitmap.GetHicon())
  $stream = [System.IO.File]::Create($iconPath)
  $icon.Save($stream)
  $stream.Dispose()
  $icon.Dispose()
  $iconGraphics.Dispose()
  $iconBitmap.Dispose()
  $sourceImage.Dispose()
}

$shell = New-Object -ComObject WScript.Shell
foreach ($shortcutPath in @(
  (Join-Path $desktop "GENESIS.lnk"),
  (Join-Path $appFolder "Open GENESIS.lnk")
)) {
  $shortcut = $shell.CreateShortcut($shortcutPath)
  $shortcut.TargetPath = $browser
  $shortcut.Arguments = "--app=`"$Url`" --start-maximized"
  $shortcut.WorkingDirectory = $appFolder
  $shortcut.Description = "GENESIS sacred calendar"
  $shortcut.IconLocation = if (Test-Path -LiteralPath $iconPath) { "$iconPath,0" } else { "$browser,0" }
  $shortcut.Save()
}

@"
GENESIS sacred calendar

Launch: double-click "Open GENESIS" in this folder or the GENESIS shortcut on your desktop.
Application URL: $Url

After Google setup, tasks are synchronized between desktop and mobile. An offline copy stays on the trusted device and syncs when the connection returns.

Project source files:
$projectRoot
"@ | Set-Content -LiteralPath (Join-Path $appFolder "ABOUT.txt") -Encoding utf8

Write-Output (Join-Path $desktop "GENESIS.lnk")
