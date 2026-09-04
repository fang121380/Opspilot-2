param(
  [switch]$StartUi,
  [switch]$StartApi,
  [switch]$InstallTools
)

$ErrorActionPreference = "Stop"
$LabRoot = Split-Path -Parent $PSScriptRoot
$UiRoot = Join-Path $LabRoot "ui"
$ClusterName = "k8s-lab"
$Context = "kind-$ClusterName"

if ($InstallTools) {
  & (Join-Path $PSScriptRoot "Install-Tools.ps1")
}
& (Join-Path $PSScriptRoot "Check-Prerequisites.ps1")

$clusters = @(kind get clusters 2>$null)
if ($clusters -notcontains $ClusterName) {
  kind create cluster --name $ClusterName --wait 90s
}

kubectl config use-context $Context | Out-Null
kubectl apply -f (Join-Path $LabRoot "manifests/hello-web.yaml")
kubectl -n learning rollout status deployment/hello-web --timeout=120s
Write-Host "学习集群已就绪 / Lab cluster is ready: $ClusterName" -ForegroundColor Green

if ($StartUi) {
  if (-not (Test-Path (Join-Path $UiRoot "node_modules"))) {
    Push-Location $UiRoot
    npm install --registry=https://registry.npmjs.org
    Pop-Location
  }
  Start-Process powershell -ArgumentList @("-NoExit", "-Command", "Set-Location '$UiRoot'; npm run dev -- --host 0.0.0.0")
  Write-Host "前端地址 / UI: http://localhost:5173" -ForegroundColor Cyan
}

if ($StartApi) {
  Start-Process powershell -ArgumentList @("-NoExit", "-Command", "Set-Location '$LabRoot/..'; python learning-lab/scripts/lab-api.py")
  Write-Host "只读 API / Read-only API: http://localhost:8787" -ForegroundColor Cyan
}

Write-Host "完成。运行 Get-LabStatus.ps1 查看状态。" -ForegroundColor Green

