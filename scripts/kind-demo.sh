#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
CLUSTER_NAME="opspilot-2"

case "${1:-up}" in
  up)
    kind create cluster --name "$CLUSTER_NAME" --config "$ROOT_DIR/infra/kind/cluster.yaml" || true
    docker build -t opspilot-2/checkout:dev "$ROOT_DIR/demo"
    kind load docker-image --name "$CLUSTER_NAME" opspilot-2/checkout:dev
    kubectl apply -f "$ROOT_DIR/infra/kind/namespace.yaml"
    kubectl apply -f "$ROOT_DIR/infra/kind/checkout-v1.yaml"
    kubectl apply -f "$ROOT_DIR/infra/kind/prometheus.yaml"
    kubectl -n demo rollout status deployment/checkout --timeout=120s
    kubectl -n demo rollout status deployment/prometheus --timeout=120s
    ;;
  inject-failure)
    kubectl -n demo patch deployment checkout --type=strategic \
      -p '{"spec":{"template":{"metadata":{"annotations":{"opspilot.io/failure":"v2"}},"spec":{"containers":[{"name":"checkout","env":[{"name":"CHECKOUT_FAILURE_MODE","value":"always"}]}]}}}}'
    kubectl -n demo rollout status deployment/checkout --timeout=120s
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

