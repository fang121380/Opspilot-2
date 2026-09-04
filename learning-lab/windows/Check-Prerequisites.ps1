$ErrorActionPreference = "Stop"

function Test-Tool([string]$Name, [string]$Hint) {
  $command = Get-Command $Name -ErrorAction SilentlyContinue
  if ($null -eq $command) {
    Write-Host ("MISS {0}: {1}" -f $Name, $Hint) -ForegroundColor Yellow
    return $false
  }
  $version = & $Name --version 2>$null | Select-Object -First 1
  Write-Host ("OK   {0}: {1}" -f $Name, $version)
  return $true
}

$missing = $false
$missing = !(Test-Tool "docker" "Start Docker Desktop with Linux containers") -or $missing
$missing = !(Test-Tool "kind" "Install with winget install Kubernetes.kind") -or $missing
$missing = !(Test-Tool "kubectl" "Install with winget install Kubernetes.kubectl") -or $missing
$missing = !(Test-Tool "node" "Install Node.js 20+ from https://nodejs.org/") -or $missing
$missing = !(Test-Tool "npm" "Install Node.js 20+") -or $missing
$missing = !(Test-Tool "python" "Install Python 3.11+ from https://www.python.org/") -or $missing

if (Get-Command docker -ErrorAction SilentlyContinue) {
  docker info *> $null
  if ($LASTEXITCODE -ne 0) {
    Write-Host "Docker daemon is not reachable. Start Docker Desktop and retry." -ForegroundColor Yellow
    $missing = $true
  }
}

if ($missing) {
  Write-Host "Prerequisites are incomplete / 前置环境未完成" -ForegroundColor Red
  exit 1
}
Write-Host "Prerequisites ready / 前置环境已就绪" -ForegroundColor Green

