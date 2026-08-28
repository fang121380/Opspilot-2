# Opspilot 2 Kind 故障演练

这套资产用于重现项目的主面试场景：`checkout` 服务从正常版本切换到持续返回 500 的错误版本。

## 前置条件

- Docker Desktop 已启动。
- `kind`、`kubectl` 和 Docker CLI 在当前终端可执行。
- 本地 Opspilot 2 API 已启动，例如：

```bash
make run
```

## 启动环境

```bash
./scripts/kind-demo.sh up
```

脚本会创建两节点 Kind 集群、构建演示服务镜像、加载镜像、部署 checkout 和 Prometheus，并等待 Deployment 就绪。

`infra/kind/opspilot-rbac.yaml` 创建了专用 `opspilot-2` ServiceAccount。它只可读取 demo 命名空间中的 Deployment、ReplicaSet、Pod 和 Pod 日志，并且仅能 patch Deployment 用于审批后的回滚；不能读取 Secret、修改 RBAC、执行 Shell 或访问其他命名空间。

## 注入故障

```bash
./scripts/kind-demo.sh inject-failure
```

错误版本通过环境变量让 `/checkout` 持续返回 HTTP 500。脚本会在 Pod 内每秒生成一次、共 20 次请求，以便 Prometheus 在多个抓取周期中观察到错误速率；规则在条件持续 15 秒后触发 `HighErrorRate`。

## 验证告警

在另一个终端中转发 Prometheus 服务，等待约 35 秒后查询告警状态：

```bash
kubectl -n demo port-forward service/prometheus 19090:9090
curl -s http://127.0.0.1:19090/api/v1/alerts
```

结果中应有标签 `alertname=HighErrorRate` 且状态为 `firing`。也可查询错误速率：

```bash
curl -s 'http://127.0.0.1:19090/api/v1/query?query=sum(rate(http_requests_total%7Bservice%3D%22checkout%22%2Ccode%3D~%225..%22%7D%5B1m%5D))'
```

## 恢复和清理

```bash
./scripts/kind-demo.sh recover
./scripts/kind-demo.sh down
```

当前清单已经包含 Prometheus 的 Kubernetes 服务发现和仅限 `demo` 命名空间 Pod 的最小只读 RBAC。Alertmanager 转发到 Opspilot 2 的配置会在 API 端到端集成阶段加入，避免在尚未有可用地址时写死外部 URL。
