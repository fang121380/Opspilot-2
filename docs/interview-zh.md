# Opspilot 2 面试讲解提纲

## 一句话介绍

Opspilot 2 是一个面向 Kubernetes 的安全优先事故响应平台：它接收告警、收集 Kubernetes/指标/日志证据、生成可解释的根因结论、提出回滚建议，并要求人工审批后才执行受限变更。

## 为什么做它

常见 AI Demo 只展示“模型回答问题”。真实运维场景更难的部分是：

- 如何保证 Agent 查询到的是受限、结构化、可追踪的真实系统数据。
- 如何把诊断和变更权限分离。
- 如何避免重复告警、错误回滚和审批重放。
- 如何在失败后复盘每一步证据、决策和执行记录。

## 事故路径

```text
Alertmanager
  -> 独立 Bearer 认证、Webhook 接收和 fingerprint 去重
  -> Incident 持久化
  -> 异步 Investigation Job（条件状态抢占）
  -> Deployment / Pod / 日志 / Prometheus 证据
  -> 确定性分析器
  -> Remediation Proposal
  -> Approval
  -> AppsV1 patch 回滚
  -> Audit / Trace / Metrics
```

## 可以重点讲的工程决策

### 1. 为什么分析器先是确定性的

回滚是高风险动作。MVP 只有在 HTTP 5xx 非零且匹配 Pod 出现错误日志时才建议回滚。Deployment 可用性仍作为证据，但应用层错误可能在全部 Pod Ready 时发生。LLM 只生成说明文本，不能直接调用工具或修改集群。

### 2. 为什么不使用任意 Shell 或 kubectl exec

诊断工具被设计为小型类型化接口：读取 Deployment、读取 Pod、限长读取日志、固定 PromQL 查询。这样 Agent 不会拥有一个可以组合越权的通用命令执行器。

### 3. 审批如何防止重放

审批和执行必须携带 Bearer 凭据，`approved_by` 来自服务端映射身份而不是请求正文；执行者还必须与审批者一致。执行器验证动作白名单、命名空间、proposal 匹配和审批过期时间，并通过数据库条件更新只允许一个请求把事故从 `awaiting_approval` 抢占为 `executing`。执行中、验证中和终态事故不能重新创建提案，客户端既不能篡改 Deployment 名称，也不能重放同一次回滚。

### 4. Kubernetes 回滚如何实现

旧 `DeploymentRollback` API 已不可用。项目读取当前 Deployment 拥有的 ReplicaSet，按 `deployment.kubernetes.io/revision` 选择前一版本模板，再使用 `patch_namespaced_deployment` 回滚。

### 5. 如何观测和复盘

每个事故有结构化 Audit 事件和关联 ID。Webhook、诊断、分析、提案、审批、执行各自留下事件；Prometheus 暴露告警、去重、事故创建、调查、修复和验证结果指标。所有 outcome label 都是固定低基数枚举，不使用事故 ID、服务名或错误正文作为指标标签。

### 6. 为什么监控和操作员使用不同令牌

Alertmanager 只需要创建事故，操作员才允许审批和执行。Kind 把两份随机凭据放在不同 Secret 中，Alertmanager Pod 只挂载监控令牌；即使监控组件被攻破，也不能直接取得回滚审批能力。

## 可演示命令

```bash
# 无 Docker 的完整 API 闭环
make demo

# 质量与安全回归
make test
make coverage
make eval

# Docker Desktop 启动后，真实 Kind 演练
./scripts/kind-demo.sh up
./scripts/kind-demo.sh inject-failure
```

## 当前量化结果

- 116 个单元/集成测试。
- 91.21% 代码覆盖率，质量门槛为 85%。
- 4 个离线事故评测样本，其中包含 3 个禁止误回滚的负样本。
- MCP Server 仅公开 3 个只读诊断工具。

## 当前限制和下一步

- Job 状态和分析结果已在 SQL 模式持久化，但执行协程仍在进程内；生产环境应替换为带租约和重试语义的持久化队列 worker。
- 数据库唯一活动 Job 约束可阻止多副本为同一事故重复调查；完成或失败后允许显式重新调查。
- 调查入口只接受 `received`，开始与结束均使用条件状态迁移；竞争中的旧任务会以 `StateConflict` 失败，不能把执行中或终态事故回写到早期状态。
- 当前 Bearer 认证适合单操作员演示；生产环境应替换为 OIDC/JWT 验签和 RBAC。
- MCP Server 已有工具契约和内存测试，下一步应加入 Streamable HTTP 鉴权网关。
- Kind 中的 Prometheus、Alertmanager、集群内 API、最小 RBAC 与真实调查已经联调；PostgreSQL 多副本执行互斥、Job 快照和 Alembic 安全迁移已覆盖，生产 OIDC/RBAC 与持久化任务执行队列仍需补齐。

这些限制不是隐藏缺陷。面试时应明确说明：MVP 已将关键安全边界和持久化状态写入代码与测试，下一阶段会把进程内执行替换为带租约的分布式队列。
