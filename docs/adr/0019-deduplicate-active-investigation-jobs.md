# ADR-0019：原子去重活动调查 Job

## 状态

已接受

## 背景

客户端重试或多个 API 副本同时收到 enqueue 请求时，如果每次都创建新任务，同一事故会并发读取 Kubernetes、日志和 Prometheus，浪费资源并竞争修改事故状态。只在应用内先查询再插入不能解决跨进程竞态。

## 决策

- Job 表增加可空且唯一的 `active_incident_id`。
- queued/running Job 保存 incident ID；succeeded/failed Job 把该列清空。
- Repository 提供 `create_or_get_active_job`，竞争失败的事务回读数据库选出的同一 Job。
- 内存 Repository 用锁和活动事故索引实现相同契约。
- Manager 仅为真正新建的 Job 启动协程；去重请求直接返回现有 Job ID。
- Alembic `0004` 在添加唯一约束前检查历史重复；发现歧义时停止迁移，不猜测删除任务。

## 结果

优点：

- 多副本或客户端重试不会为同一事故启动重复调查。
- 完成或失败会释放活动槽位，允许操作员后续重新调查。
- API 不需要新增响应类型，调用方通过稳定 Job ID 自然获得幂等行为。

权衡：

- 崩溃后遗留 running 快照会继续占用活动槽位，直到后续租约/超时机制或人工处理把它转为失败。
- 完整生产队列仍需要 worker 领取租约、心跳、超时回收和幂等副作用设计。
