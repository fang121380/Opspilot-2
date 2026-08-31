# ADR-0021：保护调查状态迁移

## 背景

同步调查、异步 Job、审批执行和验证可能在不同进程中并发访问同一事故。若调查入口使用无条件状态更新，较晚完成的调查能够把 `executing`、`verifying`、`resolved` 或 `closed` 事故回写为早期状态，破坏人工审批边界和审计时间线。

## 决策

- 只有 `received` 事故可以开始同步调查；入口以条件更新原子抢占为 `investigating`。
- 同步调查成功后仅能从 `investigating` 推进到 `awaiting_approval`，无建议或依赖失败时仅能从 `investigating` 回到 `received`。
- 异步 Job 使用相同的条件迁移。初始抢占失败时记录 `StateConflict` 并结束，不调用调查器；最终迁移失败时同样失败且不覆盖当前事故状态。
- 非调查阶段的 Job 请求返回 409。活动 Job 的唯一约束仍负责把对同一调查的重试折叠为同一 Job ID。

## 后果

- 事故状态的每一次调查迁移都可由预期前置状态解释，多副本竞争不会倒退工作流。
- 调查依赖临时失败后可安全重试，不会永久卡在 `investigating`。
- 调用方可能观察到 `StateConflict` 或 HTTP 409；这比静默覆盖状态更适合告警和人工处置。
