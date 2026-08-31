# ADR-0022：显式恢复中断的调查 Job

English summary: Recover confirmed interrupted Jobs explicitly, with dry-run by default and no automatic replay.

## 背景

调查 Job 的可见快照已持久化，但实际执行仍是 API 进程内的 `asyncio` Task。进程异常退出会留下 `queued` 或 `running` 行并占用唯一的 `active_incident_id`，阻止后续调查。直接在任一 API 副本启动时把所有活动 Job 判为失败，会误伤其他仍在运行的副本。

## 决策

- 提供 `python -m app.job_recovery` 维护命令，默认只输出活动 Job ID 的 dry-run 报告。
- 仅在全部 API/worker 已停止且维护者传入 `--confirm` 后，命令才通过条件更新把仍活动的 Job 设为 `failed`、记录 `ProcessRestarted` 并释放活动占用。
- 只有关联事故仍为 `investigating` 时，才条件性退回 `received`；执行、验证、终态和其他工作流已接管的状态保持不变。
- 恢复不创建协程、不重放调查、不触发 Kubernetes 调用或任何修复动作。

## 后果

- 已确认的进程中断不会永久阻塞同一事故的后续调查。
- 多副本环境不会在单个实例重启时自动取消别的实例的任务。
- 这不是持久化队列实现；生产级自动恢复仍需要 worker 标识、租约、心跳、超时和幂等副作用设计。
