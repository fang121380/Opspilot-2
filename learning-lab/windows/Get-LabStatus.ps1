$ErrorActionPreference = "Stop"
$LabRoot = Split-Path -Parent $PSScriptRoot
kubectl config use-context "kind-k8s-lab" | Out-Null
kubectl get nodes
kubectl -n learning get deploy,pods,svc -o wide

