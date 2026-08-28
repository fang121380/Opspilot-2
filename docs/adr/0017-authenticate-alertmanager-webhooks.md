# ADR-0017：认证 Alertmanager Webhook 来源

## 状态

已接受

## 背景

告警 Webhook 会创建事故并驱动后续调查。若入口只依赖网络可达性，任何能访问 API 的工作负载都可以伪造高危告警、污染审计时间线并消耗调查资源。直接复用操作员令牌又会让监控组件获得审批和执行凭据。

## 决策

- `/webhooks/prometheus` 要求独立的 Alertmanager Bearer Secret。
- 未配置认证时返回 503，缺失或错误凭据返回 401，认证失败发生在载荷处理和事故创建之前。
- Alertmanager Principal 被写入 `alert.received` 审计事件的 `source` 字段。
- Kind 为监控和操作员生成不同的随机令牌与 Kubernetes Secret。
- Alertmanager 只挂载监控令牌文件；API 通过单独 Secret 引用读取两种凭据。
- 从 Secret 文件读取的令牌会规范化末尾换行，但不会写入日志、指标或审计负载。

## 结果

优点：

- 伪造 Webhook 不能创建事故。
- 监控组件泄露不会直接泄露操作员回滚能力。
- `/ready` 只有在告警来源认证和完整工作流依赖都配置后才成功。

权衡：

- 静态监控令牌需要外部轮换流程。
- 生产环境还应配合 NetworkPolicy、服务网格身份或 mTLS；Bearer 认证不是网络隔离的替代品。
