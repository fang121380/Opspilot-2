$ErrorActionPreference = "Stop"
$clusters = @(kind get clusters 2>$null)
if ($clusters -contains "k8s-lab") {
  kind delete cluster --name k8s-lab
  Write-Host "已删除学习集群 k8s-lab / deleted lab cluster k8s-lab" -ForegroundColor Green
} else {
  Write-Host "学习集群不存在 / lab cluster does not exist"
}

