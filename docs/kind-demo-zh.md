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

错误版本通过环境变量让 `/checkout` 持续返回 HTTP 500；Prometheus 每 5 秒抓取指标，规则在 15 秒后触发 `HighErrorRate`。

## 恢复和清理

```bash
./scripts/kind-demo.sh recover
./scripts/kind-demo.sh down
```

当前清单已经包含 Prometheus 的 Kubernetes 服务发现和最小只读 RBAC。Alertmanager 转发到 Opspilot 2 的配置会在 API 端到端集成阶段加入，避免在尚未有可用地址时写死外部 URL。
