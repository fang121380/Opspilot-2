param([switch]$Lan)

$ErrorActionPreference = "Stop"
$LabRoot = Split-Path -Parent $PSScriptRoot
$UiRoot = Join-Path $LabRoot "ui"
$Updater = Join-Path $LabRoot "scripts/update-workbench.py"
$ApiScript = Join-Path $LabRoot "scripts/lab-api.py"
$ViteScript = Join-Path $UiRoot "node_modules/vite/bin/vite.js"
$LogRoot = Join-Path $LabRoot ".workbench-logs"

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

function Test-Bridge([string]$Url) {
  try {
    $health = Invoke-RestMethod -Uri $Url -TimeoutSec 2
    return ($health.ok -eq $true -and $health.service -eq "learning-lab-bridge")
  } catch { return $false }
}

function Test-Ui {
  try {
    $page = Invoke-WebRequest -Uri "http://127.0.0.1:5173/" -UseBasicParsing -TimeoutSec 2
    return ($page.StatusCode -eq 200 -and $page.Content -match "OpsPilot")
  } catch { return $false }
}

function Wait-Ready([scriptblock]$Check, $Process, [string]$Name) {
  for ($attempt = 0; $attempt -lt 30; $attempt++) {
    if ($Process.HasExited) { throw "$Name exited. Check logs in $LogRoot." }
    if (& $Check) { return }
    Start-Sleep -Seconds 1
  }
  throw "$Name did not become ready. Check logs in $LogRoot."
}

# An exclusive handle covers fetch, dependencies, and restart, including other
# Windows sessions. Keep the file: only the open handle represents ownership.
New-Item -ItemType Directory -Force -Path $LogRoot | Out-Null
$lockPath = Join-Path $LogRoot "update.lock"
$updateLock = $null
try {
  try {
    $updateLock = [IO.File]::Open($lockPath, [IO.FileMode]::OpenOrCreate, [IO.FileAccess]::ReadWrite, [IO.FileShare]::None)
  } catch [IO.IOException] {
    throw "Cannot acquire the update lock. Another update may be running for this checkout; wait for it to finish and retry."
  }

  Get-Command git -ErrorAction Stop | Out-Null
  Get-Command python -ErrorAction Stop | Out-Null
  Get-Command node -ErrorAction Stop | Out-Null
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

  Write-Host "Starting the updated workbench and read-only bridge..." -ForegroundColor Cyan
  $apiProcess = Start-Process -FilePath "python" -ArgumentList @('"' + $ApiScript + '"') -WindowStyle Hidden -PassThru -RedirectStandardOutput (Join-Path $LogRoot "lab-api.log") -RedirectStandardError (Join-Path $LogRoot "lab-api-error.log")
  Wait-Ready { Test-Bridge "http://127.0.0.1:8787/health" } $apiProcess "Read-only bridge"

  $bindAddress = "127.0.0.1"
  if ($Lan) { $bindAddress = "0.0.0.0" }
  $uiProcess = Start-Process -FilePath "node" -ArgumentList @(('"' + $ViteScript + '"'), "--host", $bindAddress, "--port", "5173", "--strictPort") -WorkingDirectory $UiRoot -WindowStyle Hidden -PassThru -RedirectStandardOutput (Join-Path $LogRoot "ui.log") -RedirectStandardError (Join-Path $LogRoot "ui-error.log")
  Wait-Ready { Test-Ui } $uiProcess "Workbench UI"
  if (-not (Test-Bridge "http://127.0.0.1:5173/lab-api/health")) {
    throw "Startup verification failed. Check learning-lab/.workbench-logs before retrying."
  }
  Start-Process "http://127.0.0.1:5173/"
  Write-Host "Updated workbench is ready. Simulation lessons work without Docker; existing clusters were left unchanged." -ForegroundColor Green
  if ($Lan) {
    Write-Host "LAN access: http://<PC-Wi-Fi-IPv4>:5173. The read-only bridge remains on loopback." -ForegroundColor Cyan
  }
} finally {
  if ($null -ne $updateLock) { $updateLock.Dispose() }
}
