# 开源项目调研与设计决策

English version: [Open-source landscape](open-source-landscape.md)

本文记录为 Opspilot 2 调研过的公开项目。它们是设计参考，不是代码来源；Opspilot 2 保持独立的范围、实现、文档和测试。

## 调研项目

| 项目 | 有用观察 | Opspilot 2 决策 |
| --- | --- | --- |
| [Kubernaut](https://github.com/jordigilh/kubernaut) | 告警接收、调查、工作流选择、执行、验证和审计是独立职责；其架构还区分 API、Agent、Executor 和数据存储。 | 保持 API、诊断适配器、策略、执行器和存储为独立包，不从多服务部署模型起步。 |
| [SRE Agent](https://github.com/alparn/sre-agent) | 显式的 `OBSERVE -> REASON -> ACT -> LEARN` 循环比黑盒 Agent 框架更易检查；观测集成被隔离在适配器之后，风险动作有门控。 | 先实现确定性事故状态机与类型化工具，证据收集可测试后再引入 LLM 推理。 |
| [k8s-aiops-observability](https://github.com/lasmcode/k8s-aiops-observability) | 有说服力的演示需要受控故障注入、被监控的 SLI/SLO、可复现启动命令和能体现修复效果的数据。 | 在加入异常检测前，先围绕一个 Deployment 回归和可测量的 HTTP 5xx SLI 构建 Kind 演练。 |
| [AIOpsLab](https://arxiv.org/abs/2501.06706) | Agent 评测需要能够部署工作负载、注入故障、生成负载、导出遥测并评估结果的环境。 | 把 Kind 演练和回归数据集视为一等产品工作，而不是 README 装饰。 |

## 已采用的模式

1. **对活动告警做 fingerprint 去重。** 相同 firing 告警必须复用活动事故，不能无限创建重复记录。
2. **在边界做标准化。** Alertmanager JSON 立即转换为内部 `Incident`。
3. **使用类型化证据。** 诊断工具返回类型模型，而不是自由文本终端输出。
4. **收窄写操作。** 提案不是可执行代码，只有策略批准的类型化动作才能到达执行器。
5. **验证恢复。** Kubernetes API 调用成功不等于事故已解决，系统必须再次检查受影响 SLI。

## 有意保留的差异

Opspilot 2 不宣称自治式生产修复。第一版需要审批、只支持单集群和一个受控回滚场景，这使安全模型和测试集更容易在面试中被检查。
