# ADR-0014：用数据库比较并交换抢占修复执行权

English summary: Use conditional database transitions to atomically claim remediation execution.

## 状态

已接受

## 背景

仅在应用代码中先读取事故状态、再写入 `executing`，无法阻止两个 API 副本同时看到 `awaiting_approval` 并执行同一次回滚。执行完成后如果允许新提案把事故重新改回 `awaiting_approval`，也会绕过防重放边界。

## 决策

Incident Repository 提供原子状态迁移：只有数据库中的当前状态等于调用方声明的期望状态时，才更新为目标状态。

- 执行接口使用 `awaiting_approval -> executing` 抢占唯一执行权。
- 写操作成功后仅允许 `executing -> verifying`。
- 审批策略拒绝时仅允许 `executing -> awaiting_approval`。
- `executing`、`verifying` 和终态事故拒绝创建新提案。
- SQLAlchemy 实现使用带状态条件的单条 `UPDATE`；内存实现使用进程锁保持相同契约。

## 结果

优点：

- 多个共享 PostgreSQL 的 API 副本中，只有一个请求能够取得执行权。
- 重放请求和执行后重新提案都不能触发第二次 Kubernetes 写操作。
- 状态迁移契约可以在 SQLite 并发测试和内存测试中离线验证。

权衡：

- 状态抢占和 Kubernetes 写操作仍不是同一个分布式事务。写调用结果未知时事故必须停留在 `executing`，由操作员人工核对。
- 提案、审批和事故记录的跨表原子事务仍应在后续 Repository 工作单元中完善。
