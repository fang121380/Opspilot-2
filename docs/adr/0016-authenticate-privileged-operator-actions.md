# ADR-0016：认证高权限操作员动作

## 状态

已接受

## 背景

把 `approved_by` 当作请求字段只能记录调用方的自报身份，不能证明是谁批准了回滚。即使审批记录正确，匿名执行端点也会让拿到 approval ID 的调用方触发写操作。

## 决策

- 审批和执行端点都要求 `Authorization: Bearer <token>`。
- 部署 Secret 同时配置随机令牌和它映射的操作员 ID；缺少任意一项时写路径拒绝启用。
- 令牌使用常量时间比较，日志和审计不保存令牌正文。
- Approval 的 `approved_by` 只取服务端 Principal；请求体多传该字段返回 422。
- 执行请求的认证 Principal 必须与 Approval 的 `approved_by` 相同。
- `/ready` 把认证器纳入完整工作流依赖。

## 结果

优点：

- 客户端不能伪造审批人，也不能匿名消费已签发审批。
- 默认未配置状态保持 fail closed，不会因为开发配置缺失开放写操作。
- Kind 令牌在启动时随机生成到 Git 忽略目录，再注入 Kubernetes Secret。

权衡：

- 单静态令牌不提供轮换、签发方验证、多角色或撤销列表。
- 生产平台应把相同 Principal 契约替换为 OIDC/JWT 验签和 RBAC；本 ADR 不把演示共享秘密描述成完整企业身份系统。
