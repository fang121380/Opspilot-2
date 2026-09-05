param(
  [switch]$SkipDocker,
  [switch]$SkipWsl,
  [switch]$SkipTools
)

$ErrorActionPreference = "Stop"

function Install-WingetPackage([string]$Id) {
  Write-Host "Installing $Id ..." -ForegroundColor Cyan
  winget install --id $Id -e --silent --accept-source-agreements --accept-package-agreements
  # UPDATE_NOT_APPLICABLE means the installed package has no applicable upgrade.
  if ($LASTEXITCODE -ne 0 -and $LASTEXITCODE -ne -1978335189) {
    throw "winget failed for $Id (exit $LASTEXITCODE)."
  }
}

if (-not (Get-Command winget -ErrorAction SilentlyContinue)) {
  throw "winget is missing. Install App Installer from Microsoft Store, then rerun this script."
}

if (-not $SkipWsl) {
  $wsl = Get-Command wsl -ErrorAction SilentlyContinue
  if ($null -eq $wsl) {
    Write-Host "WSL2 is not installed. The next command may require Administrator permission and a reboot." -ForegroundColor Yellow
    wsl --install --no-distribution
    if ($LASTEXITCODE -ne 0) { throw "WSL installation failed (exit $LASTEXITCODE)." }
    Write-Host "Restart Windows if requested, then rerun Install-All.ps1." -ForegroundColor Yellow
  } else {
    wsl --update
    if ($LASTEXITCODE -ne 0) { throw "WSL update failed (exit $LASTEXITCODE)." }
  }
}

if (-not $SkipDocker) {
  Install-WingetPackage "Docker.DockerDesktop"
}

if (-not $SkipTools) {
  Install-WingetPackage "Git.Git"
  Install-WingetPackage "Kubernetes.kind"
  Install-WingetPackage "Kubernetes.kubectl"
  Install-WingetPackage "OpenJS.NodeJS.LTS"
  Install-WingetPackage "Python.Python.3.12"
}

Write-Host "Installation complete. Start Docker Desktop with Linux containers, reopen PowerShell, then run:" -ForegroundColor Green
Write-Host ".\Start-LearningLab.ps1 -StartUi -StartApi" -ForegroundColor Cyan

