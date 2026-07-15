<#
.SYNOPSIS
  Adds (or removes) the Explorer context-menu entry "Resolver conflito com MergeScope".

.DESCRIPTION
  Writes HKCU\Software\Classes\*\shell\MergeScope so right-clicking any file
  offers to open it in MergeScope (single-file conflict mode, `--file`).
  Explorer cannot inspect file contents before showing the menu, so the entry
  is always visible; MergeScope checks for conflict markers on launch and
  opens in settings-only mode when the file has none.

  The NSIS installer registers this entry automatically. Use this script for
  portable/dev builds, or with -Uninstall to remove the entry.

.PARAMETER ExePath
  Path to MergeScope.exe. Defaults to the standard install location, falling
  back to the release build inside this repository.

.PARAMETER Uninstall
  Removes the context-menu entry instead of creating it.

.EXAMPLE
  .\setup-context-menu.ps1
  .\setup-context-menu.ps1 -ExePath "D:\tools\MergeScope\MergeScope.exe"
  .\setup-context-menu.ps1 -Uninstall
#>
param(
    [string]$ExePath,
    [switch]$Uninstall
)

$ErrorActionPreference = "Stop"

# -LiteralPath keeps the '*' subkey from being treated as a wildcard.
$keyLiteral = "HKCU:\Software\Classes\*\shell\MergeScope"
$keyReg = "HKCU\Software\Classes\*\shell\MergeScope"

if ($Uninstall) {
    if (-not (Test-Path -LiteralPath $keyLiteral)) {
        Write-Host "Context-menu entry not found; nothing to remove."
        return
    }
    Remove-Item -LiteralPath $keyLiteral -Recurse -Force
    Write-Host "Context-menu entry removed." -ForegroundColor Green
    return
}

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

Write-Host "The following registry entries will be created (current user only):" -ForegroundColor Cyan
Write-Host "  $keyReg          = Resolver conflito com MergeScope"
Write-Host "  $keyReg\Icon     = $ExePath"
Write-Host ('  {0}\command  = "{1}" --file "%1"' -f $keyReg, $ExePath)

# reg.exe writes the values; the \" sequences survive PowerShell's native
# argument quoting so the stored command keeps its embedded quotes.
$command = '\"{0}\" --file \"%1\"' -f $ExePath
reg.exe add $keyReg /ve /d "Resolver conflito com MergeScope" /f | Out-Null
reg.exe add $keyReg /v Icon /d "$ExePath" /f | Out-Null
reg.exe add "$keyReg\command" /ve /d $command /f | Out-Null

Write-Host "`nDone. Right-click any file in Explorer to see the entry." -ForegroundColor Green
Write-Host "Remove it later with: .\setup-context-menu.ps1 -Uninstall"
