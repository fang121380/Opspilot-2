# 产品行为 / Product Behavior

## 受众与范围 / Audience and Scope

帮助初学者读懂 Docker、Kind、Kubernetes 输出，并用证据区分现象、假设和验证。交付为 React/Vite 响应式浏览器应用，支持桌面和 Android 同一可信 Wi-Fi 访问。Windows 11 有部署脚本，macOS 有源码启动器；不包含 APK、离线 PWA、账号或跨设备同步。

Help beginners interpret Docker, Kind, and Kubernetes output and distinguish symptoms, hypotheses, and verification. The product is a React/Vite responsive browser app for desktop and Android on the same trusted Wi-Fi. Windows 11 has deployment scripts and macOS has a source launcher. APKs, offline PWA support, accounts, and cross-device sync are outside scope.

## 学习闭环 / Learning Flow

26 课按五章排列，原有五课 ID `00` 到 `04` 保留；21 节深入课采用独立语义 ID。目录支持分章、搜索及先修导航，所有课程均可访问。每课三步为理解概念、练习命令、判断证据。模拟器只返回列出的固定示例，不启动进程；`docker run` 也只是模拟。命令输出标明 example，不能证明真实工具安装或集群连通。

The expanded path has 26 lessons in five chapters. Original IDs `00` through `04` remain, alongside 21 stable semantic IDs. All lessons are accessible with chapter filters, search, and prerequisite navigation. Each lesson has concepts, commands, and evidence steps. The simulator returns only listed fixed examples and starts no processes, including for `docker run`. Example output cannot prove real installation or connectivity.

每课保存独立的 `{command, output, ok}` 记录。自检要求当前课程全部命令的最新成功记录，并将每条证据绑定到对应命令；全局历史、其他课程、失败结果不能通过。完成需要概念阅读、记录验证、当前小测通过；深入课程还要求非空分析笔记及全部任务自评。任务自评是学习者声明，不是自动判分或实机证明。成功复习保留已获得成绩；失败或证据错误会使自检和完成状态失效。修改笔记后若不再满足验收条件，完成状态失效。

Each lesson owns `{command, output, ok}` records. Verification requires the latest successful attempts of all its commands and binds each evidence marker to its corresponding command. Global history, other lessons, and failed attempts do not qualify. Completion requires reading, verification and the current quiz; extended lessons also require a nonempty reflection and all self-assessment items. Self-assessment is not automatic grading or live verification. Successful review retains credit; failed evidence or removal of required reflection/checklist items invalidates completion.

存储键继续使用 `opspilot-learning-progress-v3`，每课记录新增 `curriculumVersion: 4`。加载时检查 JSON、字段类型、已知课程与命令；旧记录的有效阅读和命令历史可保留，但没有输出证据的自检/完成无效，非当前版本的小测通过状态会清除。localStorage 不可用时显示提示并维持当前会话操作。

The storage key remains `opspilot-learning-progress-v3`; lesson records now include `curriculumVersion: 4`. Loading validates JSON, field types, known lessons, and commands. Valid older reading/history can survive, but verification/completion without output evidence and quiz credit from another curriculum version cannot. Storage failure displays a notice while allowing the current session to continue.

进度按浏览器和 URL 来源保存；从 localhost 改用电脑 LAN 地址、切换端口或更换设备不会共享进度。重置会清除当前来源的课程进度。故障案例是独立的可重练会话，不保存为课程完成记录。

Progress belongs to one browser and URL origin; localhost, a LAN address, another port, and another device do not share it. Reset clears course progress for the current origin. The case is an independent repeatable session, not persisted course completion.

## 实机手册 / Hands-on Manuals

四份本地 Markdown 实验通过构建导入，在课程弹窗中阅读；渲染器只支持这些手册使用的 Markdown 子集，不执行 HTML、不请求远端内容。Docker → Kind → Kubernetes → 排障共享 `opspilot-lab-web:1` 与独立 `study-web`，并提供 Compose、PVC、RBAC 实机专题。必须由学习者在系统终端手工操作，不将实机修改加入网页命令白名单。

Four bundled Markdown manuals are rendered locally using a limited Markdown subset, without raw HTML execution or remote fetches. They connect a single project and include Compose, PVC and RBAC exercises. All live mutations require manual system-terminal execution by the learner.

## 故障案例 / Troubleshooting Case

就绪探针案例分三阶段：定位故障、选择修复、验证恢复。证据为 Running 但 0/1、`/missing` 返回 404、`/` 返回 200；正确判断探针路径问题，确认合适健康路径，再联合副本就绪、新事件观察和实际请求验证。选择修复不会修改真实 Deployment。Running 是 Pod phase；CrashLoopBackOff 是容器等待原因，不是另一个 phase。就绪探针失败不直接重启容器。

The readiness case has three stages: identify, choose a repair, and verify recovery. Evidence combines Running with 0/1 readiness, `/missing` returning 404, and `/` returning 200. Learners identify the path issue, confirm an appropriate health endpoint, then combine ready replicas, new-event observation, and requests. Repair choices do not modify a real Deployment. Running is a Pod phase; CrashLoopBackOff is a container waiting reason. Readiness failure does not directly restart a container.

## 真实数据 / Live Data

学习桥接固定查询 `kind-k8s-lab`。四个通道独立刷新并维护成功时间、错误、旧快照；部分失败不丢弃其他数据，空事件不代表无故障。Pod 阶段、容器就绪和等待原因分别解析。真实事故列表是可选主服务数据，不是模拟案例记录，不提供调查或执行按钮。

The bridge queries only `kind-k8s-lab`. Four channels track refresh, successful timestamps, errors, and prior snapshots independently. Partial failure preserves other data; no events does not mean no failure. Pod phase, readiness, and waiting reasons are parsed separately. Optional live incidents come from the main service, not simulated-case activity; there are no investigation or execution controls.

## 验收范围 / Acceptance Scope

需验证完整 26 课与案例、先修链、分章筛选、笔记隔离和恢复、旧版和损坏存储、单通道失败保留快照、键盘弹窗、窄屏布局、开发与预览代理，以及实机只读集成。前端命令见 [README](../README.md)。自动化浏览器视口测试不等于真实 Android 或 Mac 设备测试；最终报告应列明实际运行结果和未覆盖设备。

Validate all lessons and the case, old/malformed storage, partial refresh failure, keyboard dialogs, narrow layouts, dev/preview proxies, and live read-only integration. Commands are in the [README](../README.md). Browser viewport automation is not physical Android or Mac testing; final reports must identify actual results and untested devices.
