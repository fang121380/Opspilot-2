# 工作台模式匹配 / Pattern Match

## 产品类型与业务对象 / Product type and object

这是一个 SaaS/内部运维学习工作台。核心业务对象是“学习实验”和“集群资源”，主任务是完成实验并根据证据定位问题。

This is an internal SaaS-style learning workbench. Its main objects are labs and cluster resources; the primary task is to complete a lab and troubleshoot from evidence.

## 选用模式 / Selected patterns

- `app-shell/vite-shadcn-admin-shell`：借鉴固定侧栏、顶部上下文和页面级工作区，适合多实验阶段。
- `data-table/faceted-filter-table`：借鉴资源列表的字段优先级、行状态和详情入口。
- `states/loading-empty-error-set`：借鉴镜像拉取失败、只读状态和可恢复操作的状态表达。

## 有意不选 / Deliberately not selected

不使用 AI 聊天页面、营销 Hero、客户 CRM 和复杂图表。学习任务的关键是资源证据与命令反馈，不是聊天或 KPI 装饰。

## 目标映射 / Mapping

`LabNav` 对应阶段导航；`ResourcePanel` 对应数据表；`EventTimeline` 对应事件详情；`ExerciseInspector` 对应任务状态；`TerminalPanel` 对应可复现命令输出。

## 借鉴与不照搬 / Adaptation

只借鉴布局、状态矩阵和信息密度，所有文案、资源名和数据均为本项目学习场景。没有复制任何外部仓库代码或品牌素材。

## 许可证与人工确认 / License and review

参考来源包含 MIT 许可的 shadcn-admin 与 OpenStatus data-table；本实现为独立代码。后续接入真实 Opspilot API、Token 或集群写操作前，必须由人工确认权限、目标 context 和审批边界。

