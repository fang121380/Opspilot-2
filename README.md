# Opspilot 2

Opspilot 2 是一个面向 Kubernetes 工作负载的安全优先事故响应服务。它把运维告警转化为带证据的诊断、受控修复提案和可审计执行链路。本仓库与其他名为 `Opspilot 1` 的项目完全独立。

> 这是一个用于展示 AI Agent、SRE、云原生和安全工程能力的作品集项目。它不宣称可以在没有人工确认的情况下自动修改生产环境。

## 核心流程

```text
Alertmanager Webhook
        |
        v
标准化 Incident + fingerprint 去重
        |
        v
只读证据：Kubernetes + Prometheus + 日志
        |
        v
确定性证据分析 + 修复提案
        |
        v
动作白名单 + 精确、过期的人工审批
        |
        v
Kubernetes AppsV1 回滚执行 + 审计和追踪
        |
        v
只读指标验证 -> resolved 或保持 verifying
```

文档入口 / Documentation: [双语索引 / Bilingual index](docs/README.md)、[产品范围 / Product scope](docs/product-scope.md)、[架构 / Architecture](docs/architecture.md)、[演示场景 / Demo scenario](docs/demo-scenario.md)、[部署说明（中文）](docs/deployment-zh.md) / [Deployment (EN)](docs/deployment-en.md)、[Kind 故障演练（中文）](docs/kind-demo-zh.md) / [Kind drill (EN)](docs/kind-demo-en.md)、[学习指南（中文）](docs/learning-guide.md) / [Learning guide (EN)](docs/learning-guide-en.md)、[评测基线（中文）](docs/evaluation-zh.md) / [Evaluation (EN)](docs/evaluation-en.md)、[面试讲解提纲（中文）](docs/interview-zh.md) / [Interview guide (EN)](docs/interview-en.md)、[ADR](docs/adr/) 和 [开源项目调研 / Open-source research](docs/research/open-source-landscape.md)。

## 本地开发

```bash
make setup
make test
make coverage
make lint
make eval
make demo
make run
```

默认健康检查：`http://127.0.0.1:8000/health`。OpenAPI：`http://127.0.0.1:8000/docs`。Prometheus 指标：`http://127.0.0.1:8000/metrics`。Compose 可通过 `OPSPILOT_HOST_PORT` 改用未占用的宿主机端口。

## 已完成能力

- 独立 Bearer 认证的 Prometheus Alertmanager Webhook，按活动 alert fingerprint 去重。
- Incident、Audit、Remediation Proposal 和 Approval 的 SQLAlchemy 持久化；未配置数据库时使用内存模式。
- Alembic 版本化迁移；可无损接管已知旧开发库，未知部分结构拒绝自动修改。
- 类型化、受边界约束的 Prometheus 查询与 Kubernetes Deployment/Pod/日志只读诊断。
- 固定调查编排：Deployment → Pod → 日志 → HTTP 5xx → 证据分析。
- 只有 HTTP 5xx 非零且匹配 Pod 的错误日志同时出现时才建议回滚；Pod Ready 不等于业务健康。
- 独立的提案、审批和执行 API；执行阶段只接受服务端保存的 proposal/approval ID。
- 审批和执行 Bearer 认证；`approved_by` 只能来自服务端凭据映射，不能由请求伪造。
- Alertmanager 与操作员使用隔离 Secret，监控组件不能取得审批或回滚权限。
- 动作白名单、命名空间范围、审批匹配、审批过期四层防护。
- 使用当前 Kubernetes AppsV1 API 从前一 ReplicaSet 模板回滚 Deployment。
- OpenTelemetry 关联 ID、结构化审计时间线和 Prometheus 服务指标。
- OpenAI-compatible LLM 文本层；模型没有工具或变更权限。
- MCP v2 只读诊断服务器，仅提供 Deployment、Pod 和固定 HTTP 5xx 查询工具。
- 异步调查 Job API，可轮询 queued/running/succeeded/failed 状态；SQL 模式持久化快照，并原子去重同一事故的活动任务。
- 遗留异步 Job 恢复命令默认 dry-run，显式确认后才释放中断任务，不会重新执行调查或 Kubernetes 写操作。
- received → investigating → awaiting_approval → executing → verifying → resolved 状态持久化。
- 数据库原子执行权抢占、只读修复验证、防审批重放、运行时失败脱敏和未知写结果的保守停留策略。
- Dockerfile、Docker Compose、Kind 演练清单、故障注入器和离线评测集。
- GitHub CI 同时验证 Python 质量门禁与 Compose 运行时迁移、健康检查、恢复命令 dry-run。
- Kind 中的专用 ServiceAccount 和最小 RBAC：没有 Secret、Shell、RBAC 修改或跨命名空间权限。
- `make demo` 可以无 Docker 演示告警、调查、审批、执行和审计的完整 API 闭环。

## 当前验证

```text
120 个单元/集成测试通过
代码覆盖率 91.04%
Ruff 静态检查通过
离线评测 4/4 通过
kubectl v1.37.0 和 kind v0.33.0 已验证
Docker Engine 29.7.2 与 Docker Desktop 4.88.1 已验证
Kind 中 Prometheus -> Alertmanager -> Opspilot API -> 调查建议已实机验证
2026-08-31 实机闭环在人工审批门前停止，未执行回滚
```

## Kind 实机演练

```bash
./scripts/kind-demo.sh up
./scripts/kind-demo.sh inject-failure
```

脚本会部署 checkout、Prometheus、Alertmanager 和集群内 Opspilot API。当前已验证告警创建事故、同步/异步真实调查、最小 RBAC 和人工审批前阻断；实际回滚必须由操作员通过审批 API 明确授权，不在自动脚本中执行。完整步骤见 [Kind 故障演练](docs/kind-demo-zh.md)。
