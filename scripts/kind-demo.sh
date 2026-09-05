#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
CLUSTER_NAME="opspilot-2"
CONTEXT="kind-${CLUSTER_NAME}"
SECRETS_DIR="$ROOT_DIR/.secrets"
OPERATOR_TOKEN_FILE="$SECRETS_DIR/opspilot-kind-token"
ALERTMANAGER_TOKEN_FILE="$SECRETS_DIR/opspilot-kind-alertmanager-token"

# Docker Desktop 首次安装时可能尚未创建 /usr/local/bin/docker 软链接。
# 只在 macOS 官方安装位置存在 CLI 时补充当前脚本的 PATH，不影响其他环境。
if ! command -v docker >/dev/null 2>&1 && [[ -x /Applications/Docker.app/Contents/Resources/bin/docker ]]; then
  export PATH="/Applications/Docker.app/Contents/Resources/bin:$PATH"
fi

# Never rely on the caller's current kubectl context. The learning lab uses a
# separate Kind cluster, so every demo command must target Opspilot explicitly.
k() {
  kubectl --context "$CONTEXT" "$@"
}

case "${1:-up}" in
  up)
    if ! kind get clusters | grep -Fx "$CLUSTER_NAME" >/dev/null; then
      kind create cluster --name "$CLUSTER_NAME" --config "$ROOT_DIR/infra/kind/cluster.yaml"
    fi
    docker build -t opspilot-2/api:dev "$ROOT_DIR"
    docker build -t opspilot-2/checkout:dev "$ROOT_DIR/demo"
    kind load docker-image --name "$CLUSTER_NAME" opspilot-2/api:dev
    kind load docker-image --name "$CLUSTER_NAME" opspilot-2/checkout:dev
    k apply -f "$ROOT_DIR/infra/kind/namespace.yaml"
    mkdir -p "$SECRETS_DIR"
    if [[ ! -s "$OPERATOR_TOKEN_FILE" ]]; then
      umask 077
      openssl rand -hex 32 >"$OPERATOR_TOKEN_FILE"
    fi
    if [[ ! -s "$ALERTMANAGER_TOKEN_FILE" ]]; then
      umask 077
      openssl rand -hex 32 >"$ALERTMANAGER_TOKEN_FILE"
    fi
    k -n demo create secret generic opspilot-2-operator-auth \
      --from-literal=token="$(<"$OPERATOR_TOKEN_FILE")" \
      --from-literal=operator-id="kind-operator" \
      --dry-run=client -o yaml | k apply -f -
    k -n demo create secret generic opspilot-2-alertmanager-auth \
      --from-literal=token="$(<"$ALERTMANAGER_TOKEN_FILE")" \
      --dry-run=client -o yaml | k apply -f -
    k apply -f "$ROOT_DIR/infra/kind/opspilot-rbac.yaml"
    k apply -f "$ROOT_DIR/infra/kind/checkout-v1.yaml"
    # 旧版演练曾创建集群级 Prometheus RBAC；仅清理本项目的已知旧对象。
    k delete clusterrole opspilot-2-prometheus --ignore-not-found
    k delete clusterrolebinding opspilot-2-prometheus --ignore-not-found
    k apply -f "$ROOT_DIR/infra/kind/prometheus.yaml"
    k apply -f "$ROOT_DIR/infra/kind/opspilot.yaml"
    k -n demo rollout restart deployment/prometheus
    k -n demo rollout restart deployment/opspilot-2
    k -n demo rollout restart deployment/alertmanager
    k -n demo rollout status deployment/checkout --timeout=120s
    k -n demo rollout status deployment/prometheus --timeout=120s
    k -n demo rollout status deployment/opspilot-2 --timeout=120s
    k -n demo rollout status deployment/alertmanager --timeout=120s
    ;;
  inject-failure)
    k -n demo patch deployment checkout --type=strategic \
      -p '{"spec":{"template":{"metadata":{"annotations":{"opspilot.io/failure":"v2"}},"spec":{"containers":[{"name":"checkout","env":[{"name":"CHECKOUT_FAILURE_MODE","value":"always"}]}]}}}}'
    k -n demo rollout status deployment/checkout --timeout=120s
    # 在服务进程内部生成请求，避免额外依赖本机端口转发或临时镜像。
    # HTTP 500 会被服务自身的 Prometheus Counter 记录，供告警规则验证。
    k -n demo exec -i deployment/checkout -- python - <<'PY'
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
    k -n demo patch deployment checkout --type=strategic \
      -p '{"spec":{"template":{"metadata":{"annotations":{"opspilot.io/failure":"v1"}},"spec":{"containers":[{"name":"checkout","env":[{"name":"CHECKOUT_FAILURE_MODE","value":"none"}]}]}}}}'
    k -n demo rollout status deployment/checkout --timeout=120s
    ;;
  down)
    kind delete cluster --name "$CLUSTER_NAME"
    ;;
  *)
    echo "用法: $0 {up|inject-failure|recover|down}" >&2
    exit 2
    ;;
esac
