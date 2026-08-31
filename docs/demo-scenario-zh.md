# MVP 演示场景：Deployment 回归

English version: [Demo scenario](demo-scenario.md)

## 环境准备

- Kind 集群在 `demo` 命名空间部署 `checkout` 服务。
- `v1` 版本健康。
- Prometheus 抓取服务并评估高 5xx 率告警。
- Opspilot 对诊断资源只有只读权限，对 Deployment 回滚只有窄范围权限。

## 故障注入

部署带有确定性应用错误的 `v2`。服务开始返回 HTTP 500，告警转为 firing。

## 预期流程

1. Alertmanager 使用独立 Bearer 凭据向 `POST /webhooks/prometheus` 发送告警。
2. Opspilot 创建事故 `inc-<id>` 并记录接收时间。
3. 编排器查询发布状态、Pod 状态、近期事件、错误率和近期日志。
4. 分析输出把 `checkout v2` 作为主要假设，并引用 HTTP 5xx 信号和匹配的应用错误日志。该场景中 Pod 仍 Ready，说明副本就绪不等于业务健康。
5. Opspilot 为 `rollback_deployment(checkout, demo)` 创建 dry-run 修复提案。
6. API 将事故暴露为 `awaiting_approval`。
7. 操作员审批；过期或不匹配的审批必须被拒绝。
8. 执行器实施白名单中的回滚。
9. Opspilot 轮询错误率，只有满足验证条件后才把事故标记为 resolved。
10. 事故视图展示时间线、证据、工具调用、审批、执行结果和 trace ID。

## 应演示的失败情形

- Kubernetes API 不可用：事故保持开放，并记录类型化诊断错误。
- 没有匹配的发布回归：Agent 报告证据不足，不提出写操作。
- 审批过期：执行器拒绝运行。
- 动作不在白名单：策略拒绝创建可执行请求。
- 回滚未改善指标：事故保持未解决，系统不会自动尝试第二次写操作。
