param(
  [string]$HostAlias = "beget-deusgym",
  [string]$RemoteRoot = "/home/h/haiirodw/genesis-calendar",
  [string]$LocalBackupRoot = (Join-Path (Split-Path -Parent $PSScriptRoot) "backups\genesis-calendar")
)

$ErrorActionPreference = "Stop"

if ($RemoteRoot -notmatch '^/home/h/[a-zA-Z0-9_-]+/genesis-calendar$') {
  throw "Unsafe remote path: $RemoteRoot"
}

$ssh = "C:\Windows\System32\OpenSSH\ssh.exe"
$scp = "C:\Windows\System32\OpenSSH\scp.exe"
foreach ($binary in @($ssh, $scp)) {
  if (-not (Get-Command $binary -ErrorAction SilentlyContinue)) {
    throw "Required executable was not found: $binary"
  }
}

# Backs up what git deliberately does not track: server/config.php (secrets)
# and server/var/ (SQLite database + sessions). Read-only against the live
# site — packs a temp archive on the server, downloads it, then deletes the
# remote temp copy so nothing accumulates there.

$stamp = Get-Date -Format "yyyyMMdd-HHmmss"
$remoteArchive = "$RemoteRoot/../codex-tools/genesis-secrets-$stamp.tar.gz"
$localDir = Join-Path $LocalBackupRoot $stamp
$localArchive = Join-Path $localDir "genesis-secrets.tar.gz"

& $ssh -o BatchMode=yes $HostAlias "tar -czf '$remoteArchive' -C '$RemoteRoot/server' config.php var"
if ($LASTEXITCODE -ne 0) { throw "Remote archive failed." }

New-Item -ItemType Directory -Force -Path $localDir | Out-Null
& $scp -q "${HostAlias}:$remoteArchive" $localArchive
if ($LASTEXITCODE -ne 0) {
  & $ssh -o BatchMode=yes $HostAlias "rm -f '$remoteArchive'"
  throw "Download failed."
}

& $ssh -o BatchMode=yes $HostAlias "rm -f '$remoteArchive'"
if ($LASTEXITCODE -ne 0) { throw "Could not remove the remote temp archive." }

Write-Output "Backup saved to $localArchive"
