# 界面设计 / Interface Design

## 方向 / Direction

工作台采用安静、清晰的技术学习界面。阅读、命令输出和证据判断有明确层级；有限色彩区分模拟、成功、需关注和错误，文字与图标共同表达状态。浅色和深色使用统一语义变量。

The interface prioritizes reading, command output, and evidence interpretation. Restrained semantic colors distinguish simulation, success, attention, and errors, supported by text and icons. Light and dark themes share semantic tokens.

## 信息结构 / Information Architecture

| 视图 / View | 内容 / Content |
| --- | --- |
| 学习首页 / Overview | 继续学习、五课目录、模拟与实机入口 / Resume, five lessons, learning modes |
| 课程练习 / Lessons | 理解概念、练习命令、判断证据 / Concepts, commands, evidence |
| 学习集群 / Cluster | 实机资源、事件、日志，以及节点摘要 / Live resources, events, logs, node summary |
| 故障案例 / Cases | 三阶段模拟就绪探针案例、可选真实事故列表 / Three-stage readiness case, optional live incidents |
| 共享弹窗 / Dialogs | 可搜索术语与资料、重置、手机访问 / Searchable glossary, reset, phone access |

所有课程可进入，完成标记不承担导航锁。课程三步可来回切换，哈希路由保留课程和步骤并支持浏览器返回。主要按钮对应当前步骤的下一项动作；完成按钮仅在阅读、记录自检和小测通过后启用。

All lessons remain navigable regardless of completion. Three lesson steps support backtracking; hash routes preserve the selected lesson and step with browser history. Primary actions follow the current task; completion requires reading, record verification, and the quiz.

## 响应式与可访问性 / Responsive and Accessible Behavior

桌面使用侧栏；800px 及以下改为四项底部导航，通过首页目录选择课程。520px 及以下进一步收紧布局，资源表转为适合竖屏扫描的行布局。命令和证据在受约束区域换行或滚动，避免撑宽页面；正文与输入字号按断点固定，不随视口连续缩放。

Desktop uses a sidebar; at 800px and below, four bottom-navigation items replace it, with lessons available through the overview directory. At 520px and below, layouts tighten and resource rows adapt to portrait scanning. Commands and evidence wrap or scroll within bounded areas. Typography uses fixed breakpoint values rather than continuous viewport scaling.

交互使用语义按钮、单选题、标签页和显式表单标签。共享模态弹窗管理初始焦点、Tab 循环、Escape 关闭和焦点恢复；支持跳转主内容、可见焦点和减少动态效果偏好。需要在 320、390、768、1440px，以及键盘和 Android 浏览器中持续验证布局与流程；这些是验收目标，不是设备测试完成声明。

Controls use semantic buttons, radio groups, tabs, and explicit labels. Shared dialogs manage initial focus, Tab containment, Escape dismissal, and focus restoration. The UI includes a skip link, visible focus, and reduced-motion handling. Validate 320, 390, 768, and 1440px layouts, keyboard flows, and Android browsers; these are acceptance targets, not completed device-test claims.

## 数据状态 / Data States

课程与案例持续显示模拟标签，任何示例输出都不代表当前电脑状态。实机视图首次未读取时显示空状态；读取成功后显示来源和时间。资源、节点、事件、日志独立更新，失败保留原快照、原时间和错误说明，不退回模拟成功。事件为空、筛选无匹配和尚未连接分别处理。

Lessons and cases retain explicit simulation labels. Live views begin empty and display provenance and timestamps after successful reads. Resources, nodes, events, and logs update independently. Failed refreshes retain the previous snapshot and time with an error, without substituting simulated success. Empty events, no filter matches, and no connection have distinct states.

产品行为、进度迁移及范围见 [PRODUCT.md](PRODUCT.md)；网络协议见 [INTEGRATION_PLAN.md](../INTEGRATION_PLAN.md)。

See [PRODUCT.md](PRODUCT.md) for behavior, progress migration, and scope; see [INTEGRATION_PLAN.md](../INTEGRATION_PLAN.md) for the network contract.
