param([switch]$Lan)

$ErrorActionPreference = "Stop"
$LabRoot = Split-Path -Parent $PSScriptRoot
$UiRoot = Join-Path $LabRoot "ui"
$Updater = Join-Path $LabRoot "scripts/update-workbench.py"
$ApiScript = Join-Path $LabRoot "scripts/lab-api.py"
$ViteScript = Join-Path $UiRoot "node_modules/vite/bin/vite.js"

function Test-CommandPath([string]$CommandLine, [string]$ExpectedPath) {
  $normalized = $CommandLine.Replace('/', '\')
  $expected = [IO.Path]::GetFullPath($ExpectedPath).Replace('/', '\')
  $pattern = '(?i)(?:^|[\s"''])' + [regex]::Escape($expected) + '(?=$|[\s"''])'
  return ($normalized -match $pattern)
}

function Get-OwnedListeners([int]$Port, [string]$ScriptPath, [string]$ProcessPattern) {
  # Validate every owner first: a different checkout must never be stopped.
  $listeners = @(Get-NetTCPConnection -State Listen -ErrorAction Stop | Where-Object { $_.LocalPort -eq $Port })
  foreach ($ownerId in @($listeners.OwningProcess | Select-Object -Unique)) {
    $owner = Get-CimInstance Win32_Process -Filter "ProcessId = $ownerId"
    if (-not $owner -or $owner.Name -notmatch $ProcessPattern -or
        -not (Test-CommandPath $owner.CommandLine $ScriptPath)) {
      throw "Port $Port belongs to an unrecognized process ($ownerId). Close it yourself, then retry. No unknown process will be stopped."
    }
    $owner
  }
}

Get-Command git -ErrorAction Stop | Out-Null
Get-Command python -ErrorAction Stop | Out-Null
Get-Command npm.cmd -ErrorAction Stop | Out-Null

Write-Host "Fetching and safely updating this checkout..." -ForegroundColor Cyan
& python $Updater
if ($LASTEXITCODE -ne 0) { throw "Repository update failed. Read the message above; services were not stopped." }

$owned = @()
$owned += @(Get-OwnedListeners 5173 $ViteScript '^node(?:\.exe)?$')
$owned += @(Get-OwnedListeners 8787 $ApiScript '^python(?:w|\d+(?:\.\d+)*)?(?:\.exe)?$')
foreach ($owner in $owned) {
  $current = Get-CimInstance Win32_Process -Filter "ProcessId = $($owner.ProcessId)"
  if (-not $current) { continue }
  if ($current.CreationDate -ne $owner.CreationDate -or $current.CommandLine -ne $owner.CommandLine) {
    throw "Process identity changed on PID $($owner.ProcessId). Retry the update."
  }
  Stop-Process -Id $owner.ProcessId -ErrorAction Stop
}

Push-Location $UiRoot
try {
  Write-Host "Installing the locked UI dependencies..." -ForegroundColor Cyan
  & npm.cmd ci
  if ($LASTEXITCODE -ne 0) { throw "npm ci failed. Services remain stopped; resolve the reported dependency error and retry." }
  & npm.cmd run build
  if ($LASTEXITCODE -ne 0) { throw "UI build failed. Services remain stopped; resolve the build error and retry." }
} finally { Pop-Location }

Write-Host "Starting the updated workbench and learning cluster..." -ForegroundColor Cyan
& (Join-Path $PSScriptRoot "Start-LearningLab.ps1") -StartUi -StartApi -Lan:$Lan
$page = Invoke-WebRequest -Uri "http://127.0.0.1:5173/" -UseBasicParsing -TimeoutSec 5
$bridge = Invoke-RestMethod -Uri "http://127.0.0.1:5173/lab-api/health" -TimeoutSec 5
if ($page.StatusCode -ne 200 -or $page.Content -notmatch "OpsPilot" -or
    $bridge.ok -ne $true -or $bridge.service -ne "learning-lab-bridge") {
  throw "Startup verification failed. Check learning-lab/.workbench-logs before retrying."
}
Start-Process "http://127.0.0.1:5173/"
Write-Host "Updated workbench is ready." -ForegroundColor Green
