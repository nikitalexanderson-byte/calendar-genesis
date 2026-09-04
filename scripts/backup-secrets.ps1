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

# Creates a consistent SQLite snapshot on the server and downloads only the
# server-only state that Git deliberately does not track. Sessions are omitted.
$remoteCommand = @"
'/usr/local/php/cgi/8.3/bin/php' '$RemoteRoot/ops/backup-runtime.php' --server-root='$RemoteRoot/server' --backup-root='$RemoteRoot/backups' --retain=20
"@.Trim()

$remoteOutput = & $ssh -o BatchMode=yes $HostAlias $remoteCommand
if ($LASTEXITCODE -ne 0) { throw "Remote runtime backup failed." }

$backupLine = $remoteOutput | Where-Object { $_ -match '^BACKUP_PATH=' } | Select-Object -Last 1
if (-not $backupLine) { throw "The remote backup path was not returned." }
$remoteBackup = $backupLine.Substring('BACKUP_PATH='.Length).Trim()
if ($remoteBackup -notmatch '^/home/h/[a-zA-Z0-9_-]+/genesis-calendar/backups/runtime-[0-9TZ-]+$') {
  throw "Unsafe remote backup path: $remoteBackup"
}

New-Item -ItemType Directory -Force -Path $LocalBackupRoot | Out-Null
& $scp -q -r "${HostAlias}:$remoteBackup" $LocalBackupRoot
if ($LASTEXITCODE -ne 0) { throw "Download failed." }

$localBackup = Join-Path $LocalBackupRoot (Split-Path -Leaf $remoteBackup)
Write-Output "Backup saved to $localBackup"
