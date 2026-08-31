# ADR-0020：每个事故只允许一份活动修复提案

English summary: Allow one active remediation proposal per incident and reject competing actions.

## 状态

已接受

## 背景

提案是待审批的变更意图。若事故已经有一份 proposal 仍允许再次创建，调用方可以得到多个相互竞争的审批对象，操作员难以判断哪个动作是当前事实；多副本还可能把同一事故重新推进到待审批状态。

## 决策

- 只有 `received` 状态的事故可以创建第一份提案。
- 进入 `awaiting_approval` 后，重复提案请求返回 409。
- `executing`、`verifying`、`resolved`、`closed` 等状态同样拒绝提案。
- 不为 proposal 额外引入可变的客户端幂等键；事故状态本身是服务端幂等边界。
- SQL Repository 通过 `0005` 的唯一事故外键在跨进程层面落实该边界；迁移遇到历史重复时拒绝自动挑选。

## 结果

优点：

- 一个事故最多暴露一个待审批变更意图，审批对象不会分叉。
- 与原子状态迁移结合后，多个 API 副本不会并发制造提案。

权衡：

- 如果提案内容需要修改，操作员必须先人工处理当前事故，再创建新的事故或后续流程；MVP 不提供静默覆盖。
- Proposal 历史仍保留在关系型表中，后续可增加显式撤销状态和审批轮换。
