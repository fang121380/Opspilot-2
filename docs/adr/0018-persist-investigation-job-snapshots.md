# ADR-0018：持久化调查 Job 快照

English summary: Persist visible Job snapshots while keeping in-process execution explicitly non-durable.

## 状态

已接受

## 背景

异步调查最初把 Job 保存在管理器字典中，API 重启后即使任务已经完成，调用方也无法再查询 Job ID、状态或分析结果。直接声称使用“异步任务”却没有持久化可见状态，会让接口契约与运行事实不一致。

## 决策

- 把 Job 模型移到领域层，并为管理器注入 `InvestigationJobRepository`。
- 内存模式使用带锁的快照 Repository，保持离线测试和 Kind 演练轻量。
- SQL 模式通过 `investigation_jobs` 表持久化状态、结构化分析 JSON、脱敏错误和完成时间。
- Manager 在 queued、running 和最终状态写入 Repository；GET API 总是从 Repository 读取。
- Alembic `0003` 创建 Job 表，现有 `0002` 数据库在线升级时保留全部既有数据。
- ADR-0019 在此快照模型上增加活动 Job 原子去重。

## 结果

优点：

- 已完成或失败任务在 API 重启后仍可按原 Job ID 查询。
- HTTP 契约不依赖具体存储实现，后续队列 worker 可以复用模型。
- 分析结果以结构化 Pydantic JSON 保存，避免不可验证的任意对象序列化。

权衡：

- 当前 `asyncio` 执行本身仍不持久；进程崩溃时 running Job 只保留最后快照，不会自动续跑。ADR-0022 提供停机维护时的显式释放工具，但不重放执行。
- 多 worker 生产运行仍需要租约、领取超时、幂等重试、取消和死信队列。本 ADR 只解决可见状态持久化，不把它描述为完整队列系统。
