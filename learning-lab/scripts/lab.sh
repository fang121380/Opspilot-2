#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
CLUSTER_NAME="k8s-lab"
CONTEXT="kind-$CLUSTER_NAME"
NAMESPACE="learning"
MANIFEST="$ROOT_DIR/manifests/hello-web.yaml"

require_tools() {
  "$ROOT_DIR/scripts/check-prerequisites.sh" >/dev/null
}

cluster_exists() {
  kind get clusters 2>/dev/null | grep -Fx "$CLUSTER_NAME" >/dev/null
}

case "${1:-status}" in
  up)
    require_tools
    if ! cluster_exists; then
      kind create cluster --name "$CLUSTER_NAME" --wait 90s
    fi
    kubectl --context "$CONTEXT" apply -f "$MANIFEST"
    kubectl --context "$CONTEXT" -n "$NAMESPACE" rollout status deployment/hello-web --timeout=90s
    echo "学习集群已就绪 / Lab cluster is ready: $CLUSTER_NAME"
    ;;
  status)
    require_tools
    if ! cluster_exists; then
      echo "学习集群不存在 / Lab cluster does not exist: $CLUSTER_NAME"
      exit 0
    fi
    kubectl --context "$CONTEXT" get nodes
    kubectl --context "$CONTEXT" -n "$NAMESPACE" get deploy,pods,svc -o wide
    ;;
  open)
    require_tools
    cluster_exists || { echo "先运行 ./scripts/lab.sh up / run up first" >&2; exit 1; }
    echo '访问 http://127.0.0.1:8088，按 Ctrl-C 结束 / Open http://127.0.0.1:8088, press Ctrl-C to stop'
    exec kubectl --context "$CONTEXT" -n "$NAMESPACE" port-forward svc/hello-web 8088:80
    ;;
  down)
    if command -v kind >/dev/null 2>&1 && cluster_exists; then
      kind delete cluster --name "$CLUSTER_NAME"
    else
      echo "学习集群不存在 / Lab cluster does not exist: $CLUSTER_NAME"
    fi
    ;;
  *)
    echo "用法 / Usage: $0 {up|status|open|down}" >&2
    exit 2
    ;;
esac

