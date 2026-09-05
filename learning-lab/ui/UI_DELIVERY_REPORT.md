# UI 交付报告 / UI Delivery Report

## 已完成 / Delivered

- 新增 Vite + React + TypeScript 工作台，提供学习路径、集群资源、事件、练习和只读终端。
- 增加官方资料抽屉：Kubernetes、Docker、Kind、kubectl 和 Opspilot-2 故障演练。
- 增加本地自检器：检查 context 与镜像拉取证据，给出下一步纠错提示；不执行任意 Shell 或 Kubernetes 写操作。
- 增加明亮/深色主题切换，默认明亮主题，并保持终端区域高对比。
- 将原型扩展为完整本地工作台：概览、学习路径、资源/事件/日志、Opspilot 事故中心、进度重置和实机只读连接。
- `lab-api.py` 增加固定的 `logs` 查询和 localhost CORS，前端可一次刷新资源、事件和容器日志。
- 事故中心接入 Opspilot `/health` 与 `/incidents` 只读接口；写操作仍由人工审批门保护。
- 增加零基础首屏引导和阶段“概念地图”，每阶段按“看懂 → 执行 → 检查 → 完成”推进。
- 五个阶段使用各自的预置命令：先验证工具版本，再学习 Docker 容器，最后进入 Kind、应用部署与排障。
- 实验终端支持回车输入自定义查询；通过安全模拟器返回白名单结果并拦截未知/写操作命令，保持本地学习环境安全。
- 通过 `npm run build`、桌面/移动 Chrome 截图和 `visual-audit.mjs` 检查。
- 已验证主题切换不会丢失练习状态，连接实机只读状态仍可用。

## 采用模式 / Patterns

参考 `vite-shadcn-admin-shell`、`faceted-filter-table` 和 `loading-empty-error-set`，详见 `PATTERN_MATCH.md`。

## 截图 / Screenshots

- `.design/screenshots/learning-lab-desktop.png`
- `.design/screenshots/learning-lab-mobile.png`
- `.design/UI_QA_REPORT.md`

## 剩余风险 / Remaining risks

- 当前数据是本地模拟数据；集群镜像拉取失败需要在真实 API/集群适配层中展示。
- 资源“重试镜像”目前只改变模拟状态，未执行 Kubernetes 写操作。
- 真实 Token、Secret、回滚和权限变更必须通过人工确认后再接入。
