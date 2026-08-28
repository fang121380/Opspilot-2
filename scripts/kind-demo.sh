#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
CLUSTER_NAME="opspilot-2"

# Docker Desktop 首次安装时可能尚未创建 /usr/local/bin/docker 软链接。
# 只在 macOS 官方安装位置存在 CLI 时补充当前脚本的 PATH，不影响其他环境。
if ! command -v docker >/dev/null 2>&1 && [[ -x /Applications/Docker.app/Contents/Resources/bin/docker ]]; then
  export PATH="/Applications/Docker.app/Contents/Resources/bin:$PATH"
fi

case "${1:-up}" in
  up)
    if ! kind get clusters | grep -Fx "$CLUSTER_NAME" >/dev/null; then
      kind create cluster --name "$CLUSTER_NAME" --config "$ROOT_DIR/infra/kind/cluster.yaml"
    fi
    docker build -t opspilot-2/checkout:dev "$ROOT_DIR/demo"
    kind load docker-image --name "$CLUSTER_NAME" opspilot-2/checkout:dev
    kubectl apply -f "$ROOT_DIR/infra/kind/namespace.yaml"
    kubectl apply -f "$ROOT_DIR/infra/kind/opspilot-rbac.yaml"
    kubectl apply -f "$ROOT_DIR/infra/kind/checkout-v1.yaml"
    # 旧版演练曾创建集群级 Prometheus RBAC；仅清理本项目的已知旧对象。
    kubectl delete clusterrole opspilot-2-prometheus --ignore-not-found
    kubectl delete clusterrolebinding opspilot-2-prometheus --ignore-not-found
    kubectl apply -f "$ROOT_DIR/infra/kind/prometheus.yaml"
    kubectl -n demo rollout restart deployment/prometheus
    kubectl -n demo rollout status deployment/checkout --timeout=120s
    kubectl -n demo rollout status deployment/prometheus --timeout=120s
    ;;
  inject-failure)
    kubectl -n demo patch deployment checkout --type=strategic \
      -p '{"spec":{"template":{"metadata":{"annotations":{"opspilot.io/failure":"v2"}},"spec":{"containers":[{"name":"checkout","env":[{"name":"CHECKOUT_FAILURE_MODE","value":"always"}]}]}}}}'
    kubectl -n demo rollout status deployment/checkout --timeout=120s
    # 在服务进程内部生成请求，避免额外依赖本机端口转发或临时镜像。
    # HTTP 500 会被服务自身的 Prometheus Counter 记录，供告警规则验证。
    kubectl -n demo exec -i deployment/checkout -- python - <<'PY'
from urllib.error import HTTPError
from urllib.request import urlopen
from time import sleep

for _ in range(20):
    try:
        urlopen("http://127.0.0.1:8080/checkout", timeout=2)
    except HTTPError as error:
        if error.code != 500:
            raise
    sleep(1)
PY
    ;;
  recover)
    kubectl -n demo patch deployment checkout --type=strategic \
      -p '{"spec":{"template":{"metadata":{"annotations":{"opspilot.io/failure":"v1"}},"spec":{"containers":[{"name":"checkout","env":[{"name":"CHECKOUT_FAILURE_MODE","value":"none"}]}]}}}}'
    kubectl -n demo rollout status deployment/checkout --timeout=120s
    ;;
  down)
    kind delete cluster --name "$CLUSTER_NAME"
    ;;
  *)
    echo "用法: $0 {up|inject-failure|recover|down}" >&2
    exit 2
    ;;
esac
