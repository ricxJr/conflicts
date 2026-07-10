<#
.SYNOPSIS
  Configures MergeScope as the global Git merge tool (spec §17.1 / §30.2).

.PARAMETER ExePath
  Path to MergeScope.exe. Defaults to the standard install location, falling
  back to the release build inside this repository.

.PARAMETER DisableOrigBackups
  Also sets mergetool.keepBackup=false so Git stops leaving .orig files.

.EXAMPLE
  .\setup-git-mergetool.ps1
  .\setup-git-mergetool.ps1 -ExePath "D:\tools\MergeScope\MergeScope.exe" -DisableOrigBackups
#>
param(
    [string]$ExePath,
    [switch]$DisableOrigBackups
)

$ErrorActionPreference = "Stop"

if (-not $ExePath) {
    $candidates = @(
        "$env:LOCALAPPDATA\Programs\MergeScope\MergeScope.exe",
        "C:\Program Files\MergeScope\MergeScope.exe",
        (Join-Path $PSScriptRoot "..\apps\desktop\src-tauri\target\release\mergescope.exe")
    )
    $ExePath = $candidates | Where-Object { Test-Path $_ } | Select-Object -First 1
    if (-not $ExePath) {
        Write-Error "MergeScope.exe not found. Pass -ExePath explicitly."
    }
}

$ExePath = (Resolve-Path $ExePath).Path
$gitPath = $ExePath -replace "\\", "/"
$cmd = "`"$gitPath`" --base `"`$BASE`" --current `"`$LOCAL`" --incoming `"`$REMOTE`" --result `"`$MERGED`" --wait"

Write-Host "The following global Git configuration will be applied:" -ForegroundColor Cyan
Write-Host "  merge.tool                        = mergescope"
Write-Host "  mergetool.mergescope.cmd          = $cmd"
Write-Host "  mergetool.mergescope.trustExitCode = true"
Write-Host "  mergetool.prompt                  = false"
if ($DisableOrigBackups) {
    Write-Host "  mergetool.keepBackup              = false"
}

git config --global merge.tool mergescope
git config --global mergetool.mergescope.cmd $cmd
git config --global mergetool.mergescope.trustExitCode true
git config --global mergetool.prompt false
if ($DisableOrigBackups) {
    git config --global mergetool.keepBackup false
}

Write-Host "`nDone. Test it with: git mergetool (inside a repo with conflicts)" -ForegroundColor Green
Write-Host "Diagnostics:        `"$ExePath`" doctor"
