# Opspilot 接入计划 / Opspilot Integration Plan

## 第一阶段：只读集成 / Phase 1: Read-only

前端通过一个本地 BFF 访问 Opspilot API，不直接读取浏览器环境变量中的 Token。只接入：健康检查、事故列表、调查 Job 状态、Deployment/Pod 摘要和审计时间线。

The UI should call Opspilot through a local BFF instead of exposing tokens in browser environment variables. Start with health, incidents, investigation job state, Deployment/Pod summaries, and the audit timeline.

建议接口映射 / Suggested mapping:

| UI 区域 / UI area | Opspilot API | 失败处理 / Failure |
| --- | --- | --- |
| 集群状态 / cluster status | `/health` | 保留 shell，显示数据源错误和重试 |
| 资源清单 / resources | Kubernetes read-only adapters | 显示上次成功快照和时间 |
| 事件时间线 / timeline | `GET /incidents/{id}/audit` | 显示权限/连接错误，不伪造成功 |
| 练习自检 / self-check | 本地规则 + `GET` 查询 | 无 API 时回退本地模拟 |

## 第二阶段：事故练习 / Phase 2: Incident labs

在 UI 中增加“创建练习事故”按钮，但只调用受限演示端点或本地 fixture。接入 `scripts/kind-demo.sh inject-failure` 前，必须显式选择 `kind-opspilot-2` context 并显示确认对话框；学习集群默认仍为 `kind-k8s-lab`。

Add a “create practice incident” action backed by a demo endpoint or local fixture. Before calling `scripts/kind-demo.sh inject-failure`, require an explicit `kind-opspilot-2` context selection and confirmation; the lab defaults to `kind-k8s-lab`.

## 第三阶段：人工审批 / Phase 3: Human approval

提案、审批、执行必须是三个独立页面状态。UI 只能展示 proposal/approval ID，不能生成或猜测 ID；执行按钮在没有服务端批准、过期或作用域不匹配时保持 disabled。任何回滚动作都保留现有 Opspilot-2 的人工审批门。

Proposal, approval, and execution remain three distinct states. The UI may display server-issued IDs but cannot invent them. Execution stays disabled without a valid, unexpired, scope-matched approval, preserving Opspilot-2's human approval gate.

