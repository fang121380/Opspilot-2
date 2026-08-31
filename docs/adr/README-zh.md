# Opspilot 2 架构决策记录

English index: [Architecture Decision Records](README.md)。编号 ADR 是项目的正式设计历史；以下中文摘要便于快速学习，点击编号可阅读完整记录。

| 编号 | 中文摘要 | 原文 |
| --- | --- | --- |
| ADR-0001 | 第一版只实现一条完整事故链路 | [原文](0001-mvp-boundary.md) |
| ADR-0002 | 第一阶段诊断适配器保持只读 | [原文](0002-readonly-diagnostic-adapters.md) |
| ADR-0003 | 只有收敛证据才允许提出修复 | [原文](0003-evidence-gated-remediation.md) |
| ADR-0004 | 每次修复都需要可过期人工审批 | [原文](0004-approval-gated-execution.md) |
| ADR-0005 | 审计事件关联 OpenTelemetry Trace ID | [原文](0005-audit-and-trace-correlation.md) |
| ADR-0006 | 在 LLM 自治前使用确定性调查编排器 | [原文](0006-deterministic-investigation-orchestrator.md) |
| ADR-0007 | LLM 只做叙述者，不做执行器 | [原文](0007-llm-as-narrator-only.md) |
| ADR-0008 | 把调查暴露为显式 API 操作 | [原文](0008-expose-investigation-as-explicit-api.md) |
| ADR-0009 | 直接使用 Kubernetes Python 客户端 | [原文](0009-use-kubernetes-client-directly.md) |
| ADR-0010 | 区分离线开发依赖和运行时依赖 | [原文](0010-runtime-packaging-and-dependencies.md) |
| ADR-0011 | 通过 MCP 暴露只读诊断工具 | [原文](0011-readonly-mcp-diagnostic-server.md) |
| ADR-0012 | 分离提案、审批和执行 API | [原文](0012-explicit-remediation-api.md) |
| ADR-0013 | 用 Job 表示长时间调查 | [原文](0013-async-investigation-jobs.md) |
| ADR-0014 | 使用原子修复状态迁移 | [原文](0014-atomic-remediation-state-transitions.md) |
| ADR-0015 | 版本化并安全接管关系型数据库结构 | [原文](0015-version-and-adopt-relational-schema.md) |
| ADR-0016 | 认证高权限操作员操作 | [原文](0016-authenticate-privileged-operator-actions.md) |
| ADR-0017 | 认证 Alertmanager Webhook | [原文](0017-authenticate-alertmanager-webhooks.md) |
| ADR-0018 | 持久化调查 Job 快照 | [原文](0018-persist-investigation-job-snapshots.md) |
| ADR-0019 | 去重活动调查 Job | [原文](0019-deduplicate-active-investigation-jobs.md) |
| ADR-0020 | 每个事故只允许一份活动修复提案 | [原文](0020-single-active-remediation-proposal.md) |
| ADR-0021 | 保护调查状态迁移 | [原文](0021-guard-investigation-state-transitions.md) |
| ADR-0022 | 显式恢复中断的调查 Job | [原文](0022-explicit-interrupted-job-recovery.md) |

ADR-0001 至 ADR-0013 的完整正文保留英文工程记录；从 ADR-0014 起正文以中文为主。中文摘要覆盖全部决策，避免读者只能看到英文目录而无法理解设计目的。
