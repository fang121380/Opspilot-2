$ErrorActionPreference = "Stop"

if (-not (Get-Command winget -ErrorAction SilentlyContinue)) {
  throw "winget is required. Install App Installer from Microsoft Store first."
}

winget install --id Git.Git -e --accept-source-agreements --accept-package-agreements
winget install --id Kubernetes.kind -e --accept-source-agreements --accept-package-agreements
winget install --id Kubernetes.kubectl -e --accept-source-agreements --accept-package-agreements
winget install --id OpenJS.NodeJS.LTS -e --accept-source-agreements --accept-package-agreements
winget install --id Python.Python.3.12 -e --accept-source-agreements --accept-package-agreements

Write-Host "工具安装完成。请关闭并重新打开 PowerShell，再运行 Check-Prerequisites.ps1。" -ForegroundColor Green

