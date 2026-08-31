# Opspilot 2 MVP 产品范围

English version: [Product scope](product-scope.md)

## 产品定位

Opspilot 2 是面向 Kubernetes 工作负载的安全优先事故响应服务。它把运维告警转化为有证据支撑的诊断和受控修复提案。任何写操作都必须经人工明确批准，并且只能执行白名单中的动作。

## 目标用户

- 调查 Kubernetes 事故的 SRE 和运维开发人员。
- 构建内部事故响应自动化的云平台工程师。
- 评估 AI Agent 是否足够可靠、能够接近生产环境的工程师。

## MVP 问题

服务在发布后开始报错时，操作员需要关联 Kubernetes 状态、近期日志和时序指标，才能决定是否回滚。该工作重复、时间敏感且容易留下不完整的记录。

## MVP 目标

针对一个服务和一种事故类型，即发布后的高 HTTP 5xx 率，Opspilot 必须：

1. 认证并接收兼容 Prometheus 的告警 Webhook。
2. 创建具有稳定 ID 的标准化事故记录。
3. 从 Kubernetes、Prometheus 和服务日志收集只读证据。
4. 输出带引用证据和置信度的结构化诊断。
5. 以 dry-run 形式提出回滚建议。
6. 在实际执行前要求人工审批。
7. 验证修复后的指标，并保存完整审计链路。

## 范围内

- 单集群、单命名空间的演示环境。
- firing 告警必须提供符合受限 Kubernetes DNS label 规则的 `service` 与 `namespace`；格式错误会在任何集群查询前被拒绝。
- Alertmanager 来源身份与操作员身份使用独立凭据和权限。
- 第一条垂直链路只支持一种事故类型。
- 只读诊断工具。
- 白名单中的 Deployment 回滚作为第一个写操作。
- 用于确定性单元测试的 Fake 适配器。
- 可替换的 LLM 文本接口；测试不依赖在线模型。
- 结构化审计记录和 OpenTelemetry 观测能力。

## MVP 明确不包含

- 任意 Shell 命令或 `kubectl exec`。
- 未经审批的自动生产变更。
- 多集群编排。
- 读取 Secret 或修改 RBAC。
- 微调、向量搜索或通用知识库。
- 完整 Web 控制台；当前 API、OpenAPI 与少量 CLI 已足够。
- GPU 调度和模型服务，这些属于后续 Operator 项目。

## MVP 验收标准

- `make test` 不依赖 Kubernetes 集群或外部 LLM。
- 本地 Kind 演练能注入目标故障并走完事故流程。
- 每一份诊断都列出使用的证据。
- 没有有效且未过期审批的写请求必须被拒绝。
- 未认证的告警 Webhook 不得创建事故。
- 每次工具调用和修复尝试都有关联 ID 与审计记录。
- 新工程师能仅根据仓库文档完成演示。
