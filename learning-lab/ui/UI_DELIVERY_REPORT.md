# UI 交付报告 / UI Delivery Report

## 本轮交付

- 将五课重构为完整课程数据：学习结果、学习原因、概念、15 条命令、预期输出、证据、常见错误和小测。
- 完成条件改为四步门槛：读懂概念、执行三条命令、自检通过、小测正确。
- 新手首页明确显示唯一下一步，并解释应用、Docker、Kind、Kubernetes、Opspilot 的关系。
- 安全终端支持自由输入、`help`、`clear`、课程白名单查询和危险命令拦截。
- 集群资源页增加通俗说明，以及资源、事件、日志的真实/模拟状态。
- 事故中心字段与 Opspilot API 对齐，并补齐 loading、empty、error、retry 状态。
- 桌面启动器同时启动前端与只读 `lab-api`。
- Opspilot API 只对本机工作台来源开放 GET CORS，不开放浏览器写操作。

## 模式

采用 `vite-shadcn-admin-shell`、`chat-history-runner` 和 `loading-empty-error-set`。详见 `PATTERN_MATCH.md`。

## 验证

- 前端：`npm run build`。
- 后端：`124 passed`，覆盖率 `91.05%`，lint 通过，评测 `4/4`，本地闭环 demo 通过。
- 功能：五课完整走通，详见 `FUNCTIONAL_QA.md`。
- 视觉：2560×1373、1440×1000、1024×820、800×800 和自动响应式审计。
- 自动审计：桌面端无横向滚动、无文字溢出、无小按钮。

## 截图

- `.design/screenshots/beginner-full-final-desktop.png`
- `.design/screenshots/beginner-full-final-mobile.png`
- `.design/screenshots/beginner-desktop-2560.png`
- `.design/screenshots/beginner-desktop-1440.png`
- `.design/screenshots/beginner-desktop-1024.png`
- `.design/screenshots/beginner-desktop-800.png`
- `.design/UI_QA_REPORT.md`

## 保留边界

- 终端是安全模拟器，不是宿主机 Shell。
- 集群实机连接只读固定 `kind-k8s-lab`。
- 事故中心不提供调查、审批、执行或回滚写按钮。
- 局域网访客可以打开前端，但实机桥接与 Opspilot API 默认只允许本机访问。
