# 工作台模式匹配 / Pattern Match

## 产品与用户 / Product and user

产品类型是“学习型运维工作台”，核心对象是课程、命令证据、学习进度和集群只读状态。主要用户是第一次接触 Docker、Kind、Kubernetes 的学习者，首要任务不是管理集群，而是知道下一步做什么并完成可验证练习。

## 采用模式 / Selected patterns

- `app-shell/vite-shadcn-admin-shell`：采用稳定侧栏、顶部环境上下文和独立页面内容区；1024px 以下侧栏收为抽屉。
- `ai-workbench/chat-history-runner`：只采用“输入 → 运行 → 输出 → 人工确认”的终端闭环，不采用聊天界面和模型概念。
- `states/loading-empty-error-set`：为实机连接、事故中心、无事件、筛选无结果、禁用课程和完成态提供明确状态与下一步。

## 未采用模式 / Deliberately excluded

不采用营销 Hero、CRM、KPI 图表和复杂表格筛选。课程学习是主路径，集群资源和事故中心是完成基础课程后的进阶区域。

## 对象映射 / Object mapping

`LessonNav` 对应导航对象；`LessonView` 对应主任务；`CommandList + TerminalPanel` 对应 runner；`ClusterView` 和 `IncidentView` 对应进阶只读状态页；人工审批边界对应 `needs-review`。

## 来源与许可 / Sources and license

仅借鉴 MIT 许可的 `satnaing/shadcn-admin` 布局模式，以及 UI Designer Kit 的内部状态和 runner 模式。没有复制外部仓库代码、品牌素材或登录后页面。
