$ErrorActionPreference = "Stop"

function Test-Tool([string]$Name, [string]$Hint) {
  $command = Get-Command $Name -ErrorAction SilentlyContinue
  if ($null -eq $command) {
    Write-Host ("MISS {0}: {1}" -f $Name, $Hint) -ForegroundColor Yellow
    return $false
  }
  $versionArgs = @("--version")
  if ($Name -eq "kubectl") { $versionArgs = @("version", "--client") }
  $versionOutput = & $Name @versionArgs 2>&1
  if ($LASTEXITCODE -ne 0) {
    Write-Host ("FAIL {0}: version check failed. {1}" -f $Name, $Hint) -ForegroundColor Yellow
    return $false
  }
  $version = $versionOutput | Select-Object -First 1
  Write-Host ("OK   {0}: {1}" -f $Name, $version)
  return $true
}

$missing = $false
$missing = !(Test-Tool "docker" "Start Docker Desktop with Linux containers") -or $missing
$missing = !(Test-Tool "kind" "Install with winget install Kubernetes.kind") -or $missing
$missing = !(Test-Tool "kubectl" "Install with winget install Kubernetes.kubectl") -or $missing
$missing = !(Test-Tool "node" "Install Node.js 22.18+ from https://nodejs.org/") -or $missing
$missing = !(Test-Tool "npm" "Install Node.js 22.18+") -or $missing
$missing = !(Test-Tool "python" "Install Python 3.12+ from https://www.python.org/") -or $missing

if (Get-Command docker -ErrorAction SilentlyContinue) {
  docker info *> $null
  if ($LASTEXITCODE -ne 0) {
    Write-Host "Docker daemon is not reachable. Start Docker Desktop and retry." -ForegroundColor Yellow
    $missing = $true
  }
}

if ($missing) {
  throw "Prerequisites are incomplete. Resolve the failed checks and retry."
}
Write-Host "Prerequisites ready" -ForegroundColor Green

