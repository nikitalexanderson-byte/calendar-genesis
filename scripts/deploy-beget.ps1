param(
  [string]$HostAlias = "beget-deusgym",
  [string]$RemoteRoot = "/home/h/haiirodw/genesis-calendar",
  [string]$RemoteBackupRoot = "/home/h/haiirodw/codex-backups",
  [string]$RemoteToolsRoot = "/home/h/haiirodw/codex-tools",
  [switch]$SkipBuild
)

$ErrorActionPreference = "Stop"

foreach ($path in @($RemoteRoot, $RemoteBackupRoot, $RemoteToolsRoot)) {
  if ($path -notmatch '^/home/h/[a-zA-Z0-9_-]+/[a-zA-Z0-9._-]+$') {
    throw "Unsafe remote path: $path"
  }
}

$projectRoot = Split-Path -Parent $PSScriptRoot
$distRoot = Join-Path $projectRoot "dist-beget\public_html"
$serverRoot = Join-Path $projectRoot "server"
$packageRoot = Join-Path $projectRoot "deploy-private\packages"
$backupRoot = Join-Path $projectRoot "deploy-private\backups"
$stamp = Get-Date -Format "yyyyMMdd-HHmmss"
$publicArchive = Join-Path $packageRoot "genesis-root-public-$stamp.tar.gz"
$serverArchive = Join-Path $packageRoot "genesis-server-$stamp.tar.gz"
$localBackup = Join-Path $backupRoot $stamp

$ssh = "C:\Windows\System32\OpenSSH\ssh.exe"
$scp = "C:\Windows\System32\OpenSSH\scp.exe"
foreach ($binary in @($ssh, $scp, "tar.exe")) {
  if (-not (Get-Command $binary -ErrorAction SilentlyContinue)) {
    throw "Required executable was not found: $binary"
  }
}

if (-not $SkipBuild) {
  $packageManager = Get-Command pnpm.cmd -ErrorAction SilentlyContinue
  if (-not $packageManager) {
    $packageManager = Get-Command pnpm -ErrorAction SilentlyContinue
  }
  if (-not $packageManager) {
    throw "pnpm is required. Run this script from a terminal where pnpm is available."
  }

  $previousBase = $env:GENESIS_BASE_PATH
  $previousApi = $env:GENESIS_API_URL
  try {
    $env:GENESIS_BASE_PATH = "/"
    $env:GENESIS_API_URL = "/api"
    Push-Location $projectRoot
    & $packageManager.Source run build:beget
    if ($LASTEXITCODE -ne 0) { throw "The Beget build failed." }
  } finally {
    Pop-Location
    $env:GENESIS_BASE_PATH = $previousBase
    $env:GENESIS_API_URL = $previousApi
  }
}

if (-not (Test-Path -LiteralPath (Join-Path $distRoot "index.html"))) {
  throw "The root Beget build is missing."
}

New-Item -ItemType Directory -Force -Path $packageRoot, (Join-Path $localBackup "server") | Out-Null

& tar.exe -czf $publicArchive -C $distRoot .
if ($LASTEXITCODE -ne 0) { throw "Could not package the public build." }
& tar.exe -czf $serverArchive --exclude='./config.php' --exclude='./config.example.php' --exclude='./var' -C $serverRoot .
if ($LASTEXITCODE -ne 0) { throw "Could not package the server." }

& $ssh -o BatchMode=yes $HostAlias "test -f '$RemoteRoot/server/config.php'"
if ($LASTEXITCODE -eq 0) {
  & $scp -q "${HostAlias}:$RemoteRoot/server/config.php" (Join-Path $localBackup "server\config.php")
  if ($LASTEXITCODE -ne 0) { throw "Could not back up the remote config locally." }
}

$remotePublicArchive = "$RemoteToolsRoot/genesis-root-public-$stamp.tar.gz"
$remoteServerArchive = "$RemoteToolsRoot/genesis-server-$stamp.tar.gz"
& $ssh -o BatchMode=yes $HostAlias "mkdir -p '$RemoteToolsRoot' '$RemoteBackupRoot'"
if ($LASTEXITCODE -ne 0) { throw "Could not prepare remote tool directories." }
& $scp -q $publicArchive $serverArchive "${HostAlias}:$RemoteToolsRoot/"
if ($LASTEXITCODE -ne 0) { throw "Could not upload the release packages." }

$remoteBackup = "$RemoteBackupRoot/genesis-calendar-$stamp"
$deploy = @"
set -e
test -d '$RemoteRoot/public_html'
mkdir -p '$remoteBackup/public_html'
cp -a '$RemoteRoot/public_html/.' '$remoteBackup/public_html/'
if test -d '$RemoteRoot/server'; then cp -a '$RemoteRoot/server' '$remoteBackup/server'; fi
mkdir -p '$remoteBackup/retired-configs'
if test -f '$RemoteRoot/server/config.example.php'; then mv -- '$RemoteRoot/server/config.example.php' '$remoteBackup/retired-configs/config.example.php'; fi
if test -f '$RemoteRoot/server/config.php.bak-20260831-102855'; then mv -- '$RemoteRoot/server/config.php.bak-20260831-102855' '$remoteBackup/retired-configs/config.php.bak-20260831-102855'; fi
if test -f '$RemoteRoot/server/config.php.bak-20260831-144308'; then mv -- '$RemoteRoot/server/config.php.bak-20260831-144308' '$remoteBackup/retired-configs/config.php.bak-20260831-144308'; fi
find '$RemoteRoot/public_html' -mindepth 1 -maxdepth 1 -exec rm -rf -- {} +
tar -xzf '$remotePublicArchive' -C '$RemoteRoot/public_html'
mkdir -p '$RemoteRoot/server'
tar -xzf '$remoteServerArchive' -C '$RemoteRoot/server'
mkdir -p '$RemoteRoot/public_html/api'
cp -a '$RemoteRoot/server/public/api/.' '$RemoteRoot/public_html/api/'
find '$RemoteRoot/public_html' -type d -exec chmod 755 {} +
find '$RemoteRoot/public_html' -type f -exec chmod 644 {} +
chmod 600 '$RemoteRoot/server/config.php'
chmod 700 '$RemoteRoot/server/var' '$RemoteRoot/server/var/sessions'
REQUEST_METHOD=GET PATH_INFO=/health /usr/local/php/cgi/8.3/bin/php '$RemoteRoot/public_html/api/index.php'
"@

& $ssh -o BatchMode=yes $HostAlias $deploy
if ($LASTEXITCODE -ne 0) { throw "Remote deployment failed. Restore from $remoteBackup if needed." }

Write-Output "GENESIS deployed to $RemoteRoot"
Write-Output "Remote backup: $remoteBackup"
Write-Output "Local private backup: $localBackup"
