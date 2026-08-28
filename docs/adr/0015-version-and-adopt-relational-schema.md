# ADR-0015：版本化并安全接管关系型数据库结构

## 状态

已接受

## 背景

`SQLAlchemy.metadata.create_all()` 可以初始化开发库，但不会升级已有列或约束，也没有可审计的版本历史。Opspilot 早期数据库把 `alert_fingerprint` 永久设为唯一；新模型必须迁移为只约束活动事故，同时保留既有事故、审计、提案和审批数据。

## 决策

- 使用 Alembic 管理 `0001_initial_schema -> 0002_active_fingerprint -> 0003_persist_investigation_jobs -> 0004_deduplicate_active_jobs` 版本链。
- Compose 在 Uvicorn 启动前执行迁移，失败即停止 API。
- 空数据库正常升级到 head。
- 没有 Alembic 标记但完整匹配 `0001` 的库先 stamp `0001`，再执行真实升级。
- 没有标记但完整匹配当前模型、唯一约束和索引的开发库直接 stamp head。
- 部分表、未知列组合或约束不匹配时拒绝接管，不删除数据，也不自动重建数据库卷。

## 结果

优点：

- 数据库变化具备可审查、可重复、可在 CI 验证的版本历史。
- 旧开发卷可以保留数据升级，Compose 不再依赖删卷恢复。
- 未知生产结构会在 API 启动前暴露，不会被 `create_all()` 静默掩盖。

权衡：

- 生产迁移仍需先备份并在维护窗口执行。
- 降级回永久唯一 fingerprint 可能与已经产生的重复历史冲突，因此不应作为常规恢复方案。
