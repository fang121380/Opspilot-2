# Opspilot 2 学习指南

建议按下面的顺序阅读项目。每一节都对应一个工程概念和一组可以运行的测试。

## 1. 先看事故边界

阅读 [产品范围](product-scope.md) 和 [ADR-0001](adr/0001-mvp-boundary.md)。MVP 只处理一种完整场景：一次错误 Deployment 发布导致 HTTP 5xx 告警。

这个限制是有意的。一个能跑完、能测试、能说明安全边界的生产型流程，比堆积很多未验证的集成更适合作为面试项目。

## 2. 从告警跟踪到事故

阅读 `app/api/prometheus.py` 和 `app/domain/incidents.py`。

- `AlertmanagerWebhook` 接收 Prometheus Alertmanager 兼容格式。
- API 在边界处把供应商 JSON 转成内部 `Incident` 模型。
- 通过告警 fingerprint 对活动告警去重。

这里的核心概念是**幂等性**：监控系统会重复发送告警，接收端不能为同一个活动故障无限创建事故。

## 3. 检查只读适配器

阅读 `app/adapters/prometheus.py` 和 `app/adapters/kubernetes.py`。

- Prometheus 适配器只开放 `GET /api/v1/query`，并把结果转成类型化样本。
- Kubernetes 适配器只读取 Deployment 状态、Pod 摘要和有行数上限的日志。
- 没有适配器接受任意 Shell 命令、读取 Secret 或修改集群。

这里的核心概念是**能力最小化**：Agent 只能得到完成任务所必需的最小 API 表面。

## 4. 理解证据门控分析

阅读 `app/agent/analysis.py` 和 [ADR-0003](adr/0003-evidence-gated-remediation.md)。

初始分析器是确定性的。只有 Deployment 可用副本减少、HTTP 5xx 非零、近期日志包含错误信号这三个条件同时满足时，才建议回滚。

这里的核心概念是**基于证据的推理**：以后可以让 LLM 帮助总结，但模型不能伪造证据，也不能直接授权变更。

## 5. 跟踪审批安全边界

阅读 `app/policy/remediation.py` 和 [ADR-0004](adr/0004-approval-gated-execution.md)。

操作只有同时满足动作白名单、命名空间范围、精确 proposal ID 匹配和审批未过期，才会到达回滚客户端。

这里的核心概念是**纵深防御**：单独的审批不足以防止越权、误绑定和过期重放。

## 6. 理解审计和追踪

阅读 `app/storage/audit.py`、`app/observability/tracing.py` 和 `app/api/prometheus.py`。

- 每次告警接收都会留下结构化审计事件。
- 审计事件包含类型、负载、时间和关联 ID。
- 配置 OpenTelemetry SDK 时，关联 ID 来自活动 Span；没有 Collector 时使用本地唯一 ID，不能把它误称为已导出的分布式 Trace。
- `GET /incidents/{incident_id}/audit` 可以查询事故事件时间线。

这里的核心概念是**可追溯性**：发生误判时，必须知道系统收到了什么、查了什么、为什么做出决定。

## 7. 运行离线评测

阅读 `evals/incidents.json`、`scripts/run-evals.py` 和 [评测基线](evaluation-zh.md)。

评测同时包含应该回滚和绝不能回滚的案例，用来防止后续修改把分析器变得“过于积极”。安全项目必须测误报和危险建议，而不仅是命中率。

## 8. 理解事故调查编排器

阅读 `app/agent/orchestrator.py` 和 [ADR-0006](adr/0006-deterministic-investigation-orchestrator.md)。

调查编排器按固定顺序读取 Deployment、Pod、日志和 Prometheus 指标，然后调用确定性分析器。诊断完成和分析完成分别写入审计事件，因此可以区分“外部数据没拿到”和“分析规则没有命中”。

这里的核心概念是**可重放基线**：在加入 LLM 的自适应工具调用之前，先让同一事故每次都走同一条可测试路径。

## 9. 运行检查

```bash
make test
make coverage
make lint
```

单元测试不依赖 Kubernetes 集群或在线 LLM。Kind 故障演练和真实 Collector 属于后续集成阶段。

## 9. 理解 MCP 只读工具层

阅读 `app/mcp_server.py` 和 [ADR-0011](adr/0011-readonly-mcp-diagnostic-server.md)。

MCP Server 只公布三个工具：Deployment 状态、服务 Pod 摘要和固定模板的 HTTP 5xx 查询。它没有回滚、重启、Shell 或任意 PromQL 工具。`tests/test_mcp_server.py` 使用官方 SDK 的内存 Client 检查工具清单、Schema 和结构化输出。

这里的核心概念是**标准协议不等于无限权限**：MCP 解决发现和调用方式，安全边界仍然由应用明确决定。
