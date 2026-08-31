# Opspilot 2 MVP 架构说明

English version: [Architecture](architecture.md)

## 设计原则

1. **先读后写。** 诊断只读，写操作被隔离在策略和审批检查之后。
2. **证据优先。** Agent 可以总结证据，但不能虚构观测结果。
3. **集成可替换。** Kubernetes、指标、日志和 LLM 均通过适配器隔离。
4. **测试确定性。** Fake 适配器和 Fake LLM 使核心流程可离线验证。
5. **每次操作可观测。** 事故、工具、模型、审批和执行记录共享关联 ID。

## 组件关系

```text
Prometheus 告警 Webhook
        |
        v
FastAPI API ------> 事故存储（PostgreSQL）
        |
        v
事故调查编排器
        +---- Kubernetes 诊断适配器（只读）
        +---- Prometheus 诊断适配器（只读）
        +---- 日志诊断适配器（只读）
        |
        v
证据集 -> 分析服务 -> LLM 文本提供方（可替换）
        |
        v
修复提案 -> 策略引擎 -> 审批服务
                              |
                              v
                     白名单执行器（回滚）
                              |
                              v
                     只读验证 + 审计记录
```

OpenTelemetry Span 跨越每一个边界。

## 包边界

```text
app/
├── api/          # HTTP 路由和请求/响应模型
├── domain/       # Incident、证据、提案、审批模型
├── adapters/     # Kubernetes、指标、日志、LLM 集成
├── agent/        # 状态机和证据驱动分析
├── policy/       # 白名单、授权和审批校验
├── executor/     # 窄范围写操作
└── storage/      # Repository 和数据库映射
```

## 数据流约束

- Alertmanager 与操作员使用不同 Bearer 身份和 Secret。
- 诊断适配器返回类型化 `ToolResult`，不返回原始子进程输出。
- 分析服务接收不可变证据集。
- 修复提案是数据而不是可执行代码。
- 执行器只接收 `RollbackDeployment` 这类类型化动作。
- 策略引擎验证命名空间、资源、操作者、审批和过期时间。

## 事故状态流

```text
received -> investigating -> awaiting_approval -> executing -> verifying -> resolved
    ^             |
    |             +-- 无建议或调查失败（仅条件迁移）
    +-- 后续显式调查请求
```

只有 `received` 事故可以被调查路径抢占。调查开始和结束均使用条件更新，因此延迟完成的同步请求或异步 Job 不能覆盖正在执行、验证或终态的事故。缺失、不匹配或过期的审批不能推进写操作状态。

执行器在调用 Kubernetes 前，以数据库条件更新原子抢占 `awaiting_approval -> executing`。共享 PostgreSQL 的多个 API 副本因此不能并发执行同一事故。事故进入 `executing`、`verifying` 或终态后，新提案不能将它重置为 `awaiting_approval`。

## 初始技术选型

- Python 3.12+、FastAPI、Pydantic。
- SQLAlchemy 和 PostgreSQL 持久化。
- `pytest` 与 CI 中强制执行的 linter/formatter。
- Docker Compose 本地依赖与 Kind 故障演练。
- OpenTelemetry SDK，后续可接入 OTLP Collector。
