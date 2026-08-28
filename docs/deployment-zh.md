# Opspilot 2 部署说明

## 本地 Python 模式

这是当前开发和单元测试使用的模式。事故数据保存在内存中，适合离线学习和验证领域逻辑：

```bash
make setup
make test
make run
```

## Docker Compose 模式

Compose 会启动 Opspilot 2、PostgreSQL 和 Prometheus。设置数据库连接后，Incident 和 Audit 会使用 SQLAlchemy 持久化存储：

```bash
docker compose up --build
curl http://127.0.0.1:8000/health
```

默认连接信息仅用于本地演示，不能用于生产环境。生产部署必须通过 Secret 管理数据库密码，并替换镜像标签、网络策略、RBAC 和备份策略。

## Kubernetes/Kind 模式

Kind 演练清单在 `infra/kind/`，脚本说明见 [Kind 故障演练](kind-demo-zh.md)。当前演练验证服务故障和 Prometheus 告警；Opspilot 2 的真实 Kubernetes 客户端需要将 kubeconfig 或 ServiceAccount 注入运行环境。

## 配置项

| 环境变量 | 用途 | 默认值 |
| --- | --- | --- |
| `OPSPILOT_ENVIRONMENT` | 运行环境标识 | `development` |
| `OPSPILOT_DATABASE_URL` | SQLAlchemy PostgreSQL 连接串 | 未设置，使用内存存储 |
| `OPSPILOT_PROMETHEUS_URL` | Prometheus 地址 | 未设置 |

没有设置外部依赖时，API 仍可以接收告警和运行离线测试；调查接口会返回 503，而不是伪造诊断结果。
