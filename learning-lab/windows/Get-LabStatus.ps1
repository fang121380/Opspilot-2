$ErrorActionPreference = "Stop"
kubectl --context kind-k8s-lab get nodes
if ($LASTEXITCODE -ne 0) { throw "Cannot read nodes in kind-k8s-lab. Check Docker and the lab cluster." }
kubectl --context kind-k8s-lab -n learning get deploy,pods,svc -o wide
if ($LASTEXITCODE -ne 0) { throw "Cannot read learning resources. Run Start-LearningLab.ps1." }

