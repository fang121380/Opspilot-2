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
  -> Webhook 接收和 fingerprint 去重
  -> Incident 持久化
  -> 异步 Investigation Job
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

执行只接收服务端保存的 `proposal_id` 和 `approval_id`。执行器验证动作白名单、命名空间、proposal 匹配和审批过期时间，并且只允许事故从 `awaiting_approval` 进入一次 `executing`。客户端不能重新提交被篡改的 Deployment 名称，也不能重放同一次回滚。

### 4. Kubernetes 回滚如何实现

旧 `DeploymentRollback` API 已不可用。项目读取当前 Deployment 拥有的 ReplicaSet，按 `deployment.kubernetes.io/revision` 选择前一版本模板，再使用 `patch_namespaced_deployment` 回滚。

### 5. 如何观测和复盘

每个事故有结构化 Audit 事件和关联 ID。Webhook、诊断、分析、提案、审批、执行各自留下事件；Prometheus 暴露 API 的告警接收和调查启动指标。

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

- 70 个测试。
- 90% 以上代码覆盖率门槛。
- 4 个离线事故评测样本，其中包含 3 个禁止误回滚的负样本。
- MCP Server 仅公开 3 个只读诊断工具。

## 当前限制和下一步

- 进程内 Job Manager 和内存模式适合 MVP；生产环境应替换为 Redis/队列和持久化 Job。
- `approved_by` 当前是输入字段，生产环境应对接 OIDC/RBAC 证明身份。
- MCP Server 已有工具契约和内存测试，下一步应加入 Streamable HTTP 鉴权网关。
- Kind 中的 Prometheus、Alertmanager、集群内 API、最小 RBAC 与真实调查已经联调；PostgreSQL 生产迁移和多副本执行互斥仍需补齐。

这些限制不是隐藏缺陷。面试时应明确说明：MVP 已将关键安全边界写入代码和测试，下一阶段会把分布式运行时能力替换为持久化、认证和队列组件。
