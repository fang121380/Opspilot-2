param(
  [switch]$StartUi,
  [switch]$StartApi,
  [switch]$InstallTools,
  [switch]$Lan
)

$ErrorActionPreference = "Stop"
$LabRoot = Split-Path -Parent $PSScriptRoot
$UiRoot = Join-Path $LabRoot "ui"
$ClusterName = "k8s-lab"
$Context = "kind-$ClusterName"
$LogRoot = Join-Path $LabRoot ".workbench-logs"

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

if ($Lan -and -not $StartUi) { throw "Use -Lan together with -StartUi." }
if ($InstallTools) { & (Join-Path $PSScriptRoot "Install-Tools.ps1") }
& (Join-Path $PSScriptRoot "Check-Prerequisites.ps1")

$clusters = @(kind get clusters 2>$null)
if ($LASTEXITCODE -ne 0) { throw "Cannot list kind clusters. Check Docker and retry." }
if ($clusters -notcontains $ClusterName) {
  kind create cluster --name $ClusterName --wait 90s
  if ($LASTEXITCODE -ne 0) { throw "Failed to create cluster $ClusterName." }
}

kubectl --context $Context apply -f (Join-Path $LabRoot "manifests/hello-web.yaml")
if ($LASTEXITCODE -ne 0) { throw "Failed to apply learning resources in $Context." }
kubectl --context $Context -n learning rollout status deployment/hello-web --timeout=120s
if ($LASTEXITCODE -ne 0) { throw "hello-web is not ready in $Context. Run Get-LabStatus.ps1." }
Write-Host "Lab cluster is ready: $ClusterName" -ForegroundColor Green

if ($StartApi -or $StartUi) { New-Item -ItemType Directory -Force -Path $LogRoot | Out-Null }
if ($StartApi) {
  if (-not (Test-Bridge "http://127.0.0.1:8787/health")) {
    $apiScript = Join-Path $LabRoot "scripts/lab-api.py"
    $apiProcess = Start-Process -FilePath "python" -ArgumentList @('"' + $apiScript + '"') -WindowStyle Hidden -PassThru -RedirectStandardOutput (Join-Path $LogRoot "lab-api.log") -RedirectStandardError (Join-Path $LogRoot "lab-api-error.log")
    Wait-Ready { Test-Bridge "http://127.0.0.1:8787/health" } $apiProcess "Read-only bridge"
  }
  Write-Host "Read-only bridge: http://127.0.0.1:8787 (loopback only)" -ForegroundColor Cyan
}

if ($StartUi) {
  if (-not (Test-Ui)) {
    if (-not (Test-Path (Join-Path $UiRoot "node_modules"))) {
      Push-Location $UiRoot
      try {
        if (Test-Path "package-lock.json") { npm ci } else { npm install }
        if ($LASTEXITCODE -ne 0) { throw "UI dependency installation failed." }
      } finally { Pop-Location }
    }
    $bindAddress = "127.0.0.1"
    if ($Lan) { $bindAddress = "0.0.0.0" }
    $command = "npm run dev -- --host $bindAddress --port 5173 --strictPort; exit `$LASTEXITCODE"
    $encoded = [Convert]::ToBase64String([Text.Encoding]::Unicode.GetBytes($command))
    $uiProcess = Start-Process -FilePath "powershell" -ArgumentList @("-NoProfile", "-NonInteractive", "-EncodedCommand", $encoded) -WorkingDirectory $UiRoot -WindowStyle Hidden -PassThru -RedirectStandardOutput (Join-Path $LogRoot "ui.log") -RedirectStandardError (Join-Path $LogRoot "ui-error.log")
    Wait-Ready { Test-Ui } $uiProcess "Workbench UI"
  }
  if ($StartApi -and -not (Test-Bridge "http://127.0.0.1:5173/lab-api/health")) {
    throw "UI is reachable but its API proxy is unavailable. Restart the UI from this checkout."
  }
  Write-Host "UI: http://127.0.0.1:5173" -ForegroundColor Cyan
  if ($Lan) {
    $listeners = @(Get-NetTCPConnection -LocalPort 5173 -State Listen -ErrorAction SilentlyContinue)
    if (-not ($listeners | Where-Object { $_.LocalAddress -eq "0.0.0.0" -or $_.LocalAddress -eq "::" })) {
      throw "Port 5173 is already local-only. Stop that UI process, then rerun with -StartUi -Lan."
    }
    Write-Host "Android: join the same trusted Wi-Fi, then open http://<PC-Wi-Fi-IPv4>:5173." -ForegroundColor Cyan
    Write-Host "Find the PC Wi-Fi IPv4 with ipconfig. Allow TCP 5173 only on the Windows Private network profile."
    Write-Host "LAN clients can read lab resources and logs. Do not expose ports 8787 or 8000."
  }
}

Write-Host "Done. Run Get-LabStatus.ps1 to inspect the lab." -ForegroundColor Green

