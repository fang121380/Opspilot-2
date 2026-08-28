# Opspilot 2 部署说明

## 本地 Python 模式

这是当前开发和单元测试使用的模式。事故数据保存在内存中，适合离线学习和验证领域逻辑：

```bash
make setup
make test
make run
```

## Docker Compose 模式

Compose 会启动 Opspilot 2、PostgreSQL 和 Prometheus。设置数据库连接后，Incident、Audit、Remediation Proposal 和 Approval 都会使用 SQLAlchemy 持久化存储：

```bash
docker compose up --build
curl http://127.0.0.1:8000/health
```

Compose 会等待 PostgreSQL 健康后启动 API。`GET /health` 是无依赖的进程存活检查；`GET /ready` 只有在调查、异步任务、审批执行器和只读验证器全部装配后才返回 200。Prometheus、Kubernetes 和 LLM 不可用时，调查接口会返回明确错误，不会返回伪造数据。

Prometheus 配置会在构建时写入无隐式数据卷的专用镜像，避免 Docker Desktop 对单文件绑定挂载和匿名卷的兼容性问题。Prometheus 仅在 Compose 内部网络开放 `9090`，宿主机只暴露 Opspilot API 的 `8000`；此模式不保留本地 Prometheus 时序数据，事故、审批和审计数据仍由 PostgreSQL 命名卷持久化。

默认连接信息仅用于本地演示，不能用于生产环境。生产部署必须通过 Secret 管理数据库密码，并替换镜像标签、网络策略、RBAC 和备份策略。

早期开发版数据库曾对 `alert_fingerprint` 创建永久唯一约束。当前模型允许已解决后同一告警再次创建事故，并增加可空、唯一的 `active_fingerprint` 保证活动事故去重；已有开发卷升级时应执行数据库迁移删除旧唯一约束并增加新列，或仅在没有保留价值的本地演示环境重建 Compose 数据卷。生产数据禁止通过删卷迁移。

## Kubernetes/Kind 模式

Kind 演练清单在 `infra/kind/`，脚本说明见 [Kind 故障演练](kind-demo-zh.md)。当前演练验证服务故障、Prometheus 告警、Alertmanager Webhook 和真实 Kubernetes 调查。Kubernetes readinessProbe 使用 `/ready`，livenessProbe 使用 `/health`，避免外部依赖装配失败时仍把 Pod 标记为可接流量。

## 配置项

| 环境变量 | 用途 | 默认值 |
| --- | --- | --- |
| `OPSPILOT_ENVIRONMENT` | 运行环境标识 | `development` |
| `OPSPILOT_DATABASE_URL` | SQLAlchemy PostgreSQL 连接串 | 未设置，使用内存存储 |
| `OPSPILOT_PROMETHEUS_URL` | Prometheus 地址 | 未设置 |

设置 `OPSPILOT_PROMETHEUS_URL` 后，应用启动时先尝试集群内 ServiceAccount 配置，再尝试当前用户 kubeconfig；成功时自动装配 Kubernetes 只读适配器、Prometheus 适配器和调查编排器。关闭应用时会关闭 HTTP 和 Kubernetes 客户端。

没有设置外部依赖时，API 仍可以接收告警和运行离线测试；调查接口会返回 503，而不是伪造诊断结果。
