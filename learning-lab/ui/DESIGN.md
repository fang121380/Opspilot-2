# 工作台设计 / Design

## 结构 / Structure

`AppShell` 包含 `TopBar`、模块导航和 `Workspace`。Workspace 提供概览、学习路径、集群资源（资源/事件/日志标签页）和事故中心；学习阶段、终端输出和实机连接状态都在本地工作台内闭环。

## 交互 / Interaction

- 阶段导航只允许进入已完成或当前阶段；未解锁阶段显示 disabled。
- 首屏提供“第一次使用？从这里开始”新手入口，按 Docker、Kind、kubectl 三个基础词解释，再引导进入阶段 00。
- 每个学习阶段先显示“概念地图”，按“看懂 → 执行 → 检查 → 完成”的顺序组织内容。
- 实机连接只调用 `lab-api.py` 的 `context`、`nodes`、`resources`、`events`、`logs` allowlist，不接受任意 Shell。
- 命令下拉框只运行预置只读命令，输出固定且可复现；资源表支持“只看异常”筛选。
- 事故中心只读调用 Opspilot `/health` 和 `/incidents`；提案、审批、执行和回滚不在前端自动触发。
- 官方文档抽屉可从每个模块打开，学习进度可持久化并支持从阶段 00 重置。

## 状态 / States

默认状态从 0/5 阶段开始，展示安全的模拟资源和镜像拉取告警；连接实机后展示真实 2/2 副本、事件和日志；清空终端为空状态；未解锁实验为 disabled；API 断开时提供明确错误提示并保留模拟数据。

## 响应式 / Responsive

桌面使用侧栏 + 双列资源区；平板资源区单列；移动端阶段导航横向滚动、练习卡片单列、表格在容器内滚动。

顶部提供明亮/深色主题切换，默认使用明亮主题以降低长时间学习时的视觉负担；切换不会改变集群状态或练习数据。

The top bar provides a light/dark theme toggle. Light is the default for comfortable long study sessions; switching themes never changes cluster state or exercise data.

## 风险控制 / Risk controls

模拟层不读取 Secret、不执行任意 Shell、不修改 `opspilot-2`。接入真实 API 时使用 allowlist context、只读默认权限和人工审批门。
