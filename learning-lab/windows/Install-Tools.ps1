$ErrorActionPreference = "Stop"

if (-not (Get-Command winget -ErrorAction SilentlyContinue)) {
  throw "winget is required. Install App Installer from Microsoft Store first."
}

foreach ($package in @("Git.Git", "Kubernetes.kind", "Kubernetes.kubectl", "OpenJS.NodeJS.LTS", "Python.Python.3.12")) {
  winget install --id $package -e --accept-source-agreements --accept-package-agreements
  # UPDATE_NOT_APPLICABLE means the installed package has no applicable upgrade.
  if ($LASTEXITCODE -ne 0 -and $LASTEXITCODE -ne -1978335189) {
    throw "winget failed for $package (exit $LASTEXITCODE)."
  }
}

Write-Host "Tools installed. Reopen PowerShell, then run Check-Prerequisites.ps1." -ForegroundColor Green

