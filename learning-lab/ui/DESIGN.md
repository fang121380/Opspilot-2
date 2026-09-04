# 工作台设计 / Design

## 结构 / Structure

`AppShell` 包含 `TopBar`、`LabNav` 和 `Workspace`。Workspace 依次放置状态概览、资源清单、事件时间线、练习检查器和终端。

## 交互 / Interaction

- 阶段导航只允许进入已完成或当前阶段；未解锁阶段显示 disabled。
- “重试镜像”是本地模拟恢复，改变资源状态，不调用 Kubernetes。
- 命令下拉框只运行预置只读命令，输出固定且可复现。
- 帮助按钮打开当前阶段目标和验收标准；后续将增加官方文档链接抽屉。

## 状态 / States

默认状态展示镜像拉取告警；成功状态展示 2/2 副本；清空终端为空状态；未解锁实验为 disabled；错误提示提供重试入口。

## 响应式 / Responsive

桌面使用侧栏 + 双列资源区；平板资源区单列；移动端阶段导航横向滚动、练习卡片单列、表格在容器内滚动。

顶部提供明亮/深色主题切换，默认使用明亮主题以降低长时间学习时的视觉负担；切换不会改变集群状态或练习数据。

The top bar provides a light/dark theme toggle. Light is the default for comfortable long study sessions; switching themes never changes cluster state or exercise data.

## 风险控制 / Risk controls

模拟层不读取 Secret、不执行任意 Shell、不修改 `opspilot-2`。接入真实 API 时使用 allowlist context、只读默认权限和人工审批门。
