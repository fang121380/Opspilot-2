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
```

文档入口：[产品范围](docs/product-scope.md)、[架构](docs/architecture.md)、[演示场景](docs/demo-scenario.md)、[部署说明](docs/deployment-zh.md)、[Kind 故障演练](docs/kind-demo-zh.md)、[中文学习指南](docs/learning-guide.md)、[评测基线](docs/evaluation-zh.md)、[ADR](docs/adr/) 和 [开源项目调研](docs/research/open-source-landscape.md)。

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

健康检查：`http://127.0.0.1:8000/health`。OpenAPI：`http://127.0.0.1:8000/docs`。Prometheus 指标：`http://127.0.0.1:8000/metrics`。

## 已完成能力

- Prometheus Alertmanager 兼容 Webhook，按活动 alert fingerprint 去重。
- Incident、Audit、Remediation Proposal 和 Approval 的 SQLAlchemy 持久化；未配置数据库时使用内存模式。
- 类型化、受边界约束的 Prometheus 查询与 Kubernetes Deployment/Pod/日志只读诊断。
- 固定调查编排：Deployment → Pod → 日志 → HTTP 5xx → 证据分析。
- 只有 Deployment 可用副本下降、5xx 非零、错误日志同时出现时才建议回滚。
- 独立的提案、审批和执行 API；执行阶段只接受服务端保存的 proposal/approval ID。
- 动作白名单、命名空间范围、审批匹配、审批过期四层防护。
- 使用当前 Kubernetes AppsV1 API 从前一 ReplicaSet 模板回滚 Deployment。
- OpenTelemetry 关联 ID、结构化审计时间线和 Prometheus 服务指标。
- OpenAI-compatible LLM 文本层；模型没有工具或变更权限。
- MCP v2 只读诊断服务器，仅提供 Deployment、Pod 和固定 HTTP 5xx 查询工具。
- 异步调查 Job API，可轮询 queued/running/succeeded/failed 状态。
- Dockerfile、Docker Compose、Kind 演练清单、故障注入器和离线评测集。
- Kind 中的专用 ServiceAccount 和最小 RBAC：没有 Secret、Shell、RBAC 修改或跨命名空间权限。
- `make demo` 可以无 Docker 演示告警、调查、审批、执行和审计的完整 API 闭环。

## 当前验证

```text
48 个单元/集成测试通过
代码覆盖率 90%+
Ruff 静态检查通过
离线评测 4/4 通过
kubectl v1.37.0 和 kind v0.33.0 已验证
```

## 仍待实机验证

Docker Desktop 是本机唯一缺少的依赖。安装并启动后可执行：

```bash
./scripts/kind-demo.sh up
./scripts/kind-demo.sh inject-failure
```

随后验证 Prometheus 告警、真实 Kubernetes 调查和审批回滚闭环。Docker 官方安装包的断点下载文件不会进入 Git 仓库。
