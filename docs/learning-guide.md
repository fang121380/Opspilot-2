# Opspilot 2 学习指南

English version: [Learning guide](learning-guide-en.md)

建议按下面的顺序阅读项目。每一节都对应一个工程概念和一组可以运行的测试。

## 1. 先看事故边界

阅读 [产品范围](product-scope-zh.md) 和 [ADR-0001](adr/0001-mvp-boundary-zh.md)。MVP 只处理一种完整场景：一次错误 Deployment 发布导致 HTTP 5xx 告警。

这个限制是有意的。一个能跑完、能测试、能说明安全边界的生产型流程，比堆积很多未验证的集成更适合作为面试项目。

## 2. 从告警跟踪到事故

阅读 `app/api/prometheus.py` 和 `app/domain/incidents.py`。

- `AlertmanagerWebhook` 接收 Prometheus Alertmanager 兼容格式。
- API 在边界处把供应商 JSON 转成内部 `Incident` 模型。
- Webhook 先验证独立 Alertmanager Bearer 凭据，未认证请求不能创建事故。
- 通过告警 fingerprint 对活动告警去重。
- `service` 和 `namespace` 在入口处按有界 Kubernetes DNS label 校验，避免恶意 label selector 扩大只读查询范围。

这里的核心概念是**幂等性**：监控系统会重复发送告警，接收端不能为同一个活动故障无限创建事故。

去重只针对活动事故。事故进入 `resolved` 或 `closed` 后会释放 fingerprint；同一告警以后再次发生时必须创建新事故，保留两次独立的时间线。SQL 模型用普通 `alert_fingerprint` 保存历史值，并用可空、唯一的 `active_fingerprint` 保证每个 fingerprint 最多只有一个活动事故；终态记录把后者置空。并发请求同时插入时由数据库唯一约束选择一个胜者，竞争失败的事务回读胜者并按去重成功返回。

Alertmanager 认证和操作员认证复用同一个最小 Bearer 校验器，但使用不同 Principal 和不同 Secret。前者只能通过告警路由，后者只保护审批与执行，避免监控组件继承写权限。设计见 [ADR-0017](adr/0017-authenticate-alertmanager-webhooks.md)。

## 3. 检查只读适配器

阅读 `app/adapters/prometheus.py` 和 `app/adapters/kubernetes.py`。

- Prometheus 适配器只开放 `GET /api/v1/query`，并把结果转成类型化样本。
- Kubernetes 适配器只读取 Deployment 状态、Pod 摘要和有行数上限的日志。
- 没有适配器接受任意 Shell 命令、读取 Secret 或修改集群。

这里的核心概念是**能力最小化**：Agent 只能得到完成任务所必需的最小 API 表面。

## 4. 理解证据门控分析

阅读 `app/agent/analysis.py` 和 [ADR-0003](adr/0003-evidence-gated-remediation.md)。

初始分析器是确定性的。只有 HTTP 5xx 非零且匹配 Pod 的近期日志包含错误信号时，才建议回滚。Deployment 可用性仍作为证据展示，但应用层回归可能在所有 Pod 都 Ready 时持续返回 500，因此不能把副本健康误当成业务健康。

这里的核心概念是**基于证据的推理**：以后可以让 LLM 帮助总结，但模型不能伪造证据，也不能直接授权变更。

## 5. 跟踪审批安全边界

阅读 `app/policy/remediation.py` 和 [ADR-0004](adr/0004-approval-gated-execution.md)。

操作只有同时满足动作白名单、命名空间范围、精确 proposal ID 匹配和审批未过期，才会到达回滚客户端。

提案创建时还会把 `namespace` 和 `deployment` 与原始事故的作用域精确匹配，并再次执行 Kubernetes DNS-label 校验；只有 `received` 事故能创建第一份提案。进入 `awaiting_approval` 后重复创建会返回 409，避免同一事故出现多个待审批动作。这样即使调用方能创建请求，也不能把 checkout 事故改写成同一命名空间内 payments 服务的回滚。

这里的核心概念是**纵深防御**：单独的审批不足以防止越权、误绑定和过期重放。

审批 API 在 `app/api/remediation.py`：提案、审批和执行是三个独立操作。审批和执行还要求 `app/security/auth.py` 验证 Bearer 凭据；`approved_by` 只取服务端映射身份，客户端多传该字段会被拒绝。默认应用既没有执行器也没有认证器，写路径保持关闭；只有两者都显式配置、执行者与审批者相同且请求带有匹配审批，才可能触达 Kubernetes 客户端。设计见 [ADR-0016](adr/0016-authenticate-privileged-operator-actions.md)。

Kubernetes 写调用抛出异常时，系统不能判断请求是否已被集群部分接受，因此事故保守停留在 `executing`，返回脱敏 503 并记录 `remediation.failed`。它不会自动重试或把状态退回审批阶段，必须由操作员核对 Deployment 和审计记录。

事故状态会随流程持久化：接收告警后为 `received`，调查时为 `investigating`，出现修复建议后为 `awaiting_approval`，执行期间为 `executing`，写操作成功后进入 `verifying`。执行权通过 `awaiting_approval -> executing` 的数据库比较并交换原子抢占，多副本并发请求只有一个能继续；进入执行、验证或终态后也不能用新提案把状态退回。缺少、过期或不匹配的审批会把状态保持在 `awaiting_approval`，不会调用 Kubernetes 写接口。设计取舍见 [ADR-0014](adr/0014-atomic-remediation-state-transitions.md)。

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

Kubernetes 或 Prometheus 调查失败时，同步接口返回经过清理的 HTTP 503，并记录只包含异常类型的 `diagnostic.failed` 事件；不会把上游 URL、响应正文或凭据细节回传给调用方。失败会由原子比较并交换把事故从 `investigating` 退回 `received`，从而允许依赖恢复后由操作员重新发起调查；若期间已有其他流程接管状态，清理操作不会覆盖它。

这里的核心概念是**可重放基线**：在加入 LLM 的自适应工具调用之前，先让同一事故每次都走同一条可测试路径。

## 9. 理解异步调查任务

阅读 `app/agent/jobs.py`、`app/api/jobs.py` 和 [ADR-0013](adr/0013-async-investigation-jobs.md)。

长调查通过 `POST /incidents/{incident_id}/investigate/jobs` 返回 Job ID，再用 `GET /investigation/jobs/{job_id}` 查询状态。应用成功装配 Kubernetes 和 Prometheus 调查依赖时会自动创建任务管理器；任务先原子抢占 `received -> investigating`，再在有建议时推进到 `awaiting_approval`，无建议时回到 `received`。若任务尚未开始就发现事故已被别的流程抢占，它以 `StateConflict` 失败且不会执行任何调查或覆盖状态。其他失败任务只暴露异常类型，并写入带 Job ID 的 `diagnostic.failed` 审计事件，不泄露上游错误正文。

任务执行仍由当前进程的 `asyncio` Task 完成，但 Job 的每次可见快照通过 Repository 保存；SQL 模式会持久化 queued/running/succeeded/failed、脱敏错误和结构化分析结果，API 重启后仍可查询已完成任务。`active_incident_id` 的可空唯一约束保证一个事故最多有一个 queued/running Job；并发请求的竞争失败方回读同一 Job ID，任务结束后释放占用，后续可以重新调查。状态抢占与最终迁移均使用条件更新，避免异步任务把执行中、验证中或终态事故回写为早期状态。进程崩溃时正在运行的协程不会自动恢复；项目提供默认 dry-run 的 `python -m app.job_recovery` 维护命令，只有在所有 API/worker 停止并传入 `--confirm` 后，才把遗留 Job 标记为 `ProcessRestarted` 并条件性释放事故。它不是自动重试或持久化执行器。生产环境仍需 Redis/消息队列、租约和 worker 重试语义；持久化元数据不能被夸大成持久化执行。设计见 [ADR-0018](adr/0018-persist-investigation-job-snapshots.md)、[ADR-0019](adr/0019-deduplicate-active-investigation-jobs.md)、[ADR-0021](adr/0021-guard-investigation-state-transitions.md) 和 [ADR-0022](adr/0022-explicit-interrupted-job-recovery.md)。

## 10. 理解部署边界

阅读 `Dockerfile`、`docker-compose.yml` 和 [部署说明](deployment-zh.md)。

Docker 镜像只复制运行所需的应用代码和 Alembic 版本链，Compose 提供 PostgreSQL 和 Prometheus。本地无外部依赖时仍使用内存 Repository 做单元测试；设置 `OPSPILOT_DATABASE_URL` 后切换到 SQLAlchemy 持久化。Compose 在 API 启动前运行安全迁移：已知旧结构升级、已知当前结构接管，未知部分结构拒绝运行。迁移策略见 [ADR-0015](adr/0015-version-and-adopt-relational-schema.md)。

## 11. 运行检查

```bash
make test
make coverage
make lint
make eval
make demo
```

单元测试不依赖 Kubernetes 集群或在线 LLM。Kind 故障演练已经覆盖 Prometheus、Alertmanager、集群内 API 和真实只读调查；真实 OpenTelemetry Collector 仍属于后续集成阶段。

## 12. 理解 MCP 只读工具层

阅读 `app/mcp_server.py` 和 [ADR-0011](adr/0011-readonly-mcp-diagnostic-server.md)。

MCP Server 只公布三个工具：Deployment 状态、服务 Pod 摘要和固定模板的 HTTP 5xx 查询。它没有回滚、重启、Shell 或任意 PromQL 工具。`tests/test_mcp_server.py` 使用官方 SDK 的内存 Client 检查工具清单、Schema 和结构化输出。

这里的核心概念是**标准协议不等于无限权限**：MCP 解决发现和调用方式，安全边界仍然由应用明确决定。
