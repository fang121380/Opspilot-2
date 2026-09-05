$ErrorActionPreference = "Stop"
$clusters = @(kind get clusters 2>$null)
if ($LASTEXITCODE -ne 0) { throw "Cannot list kind clusters. Check Docker and retry." }
if ($clusters -contains "k8s-lab") {
  kind delete cluster --name k8s-lab
  if ($LASTEXITCODE -ne 0) { throw "Failed to delete lab cluster k8s-lab." }
  Write-Host "Deleted lab cluster k8s-lab" -ForegroundColor Green
} else {
  Write-Host "Lab cluster does not exist"
}

