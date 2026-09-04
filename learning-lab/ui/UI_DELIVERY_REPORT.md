# UI 交付报告 / UI Delivery Report

## 已完成 / Delivered

- 新增 Vite + React + TypeScript 工作台，提供学习路径、集群资源、事件、练习和只读终端。
- 增加官方资料抽屉：Kubernetes、Docker、Kind、kubectl 和 Opspilot-2 故障演练。
- 增加本地自检器：检查 context 与镜像拉取证据，给出下一步纠错提示；不执行任意 Shell 或 Kubernetes 写操作。
- 通过 `npm run build`、桌面/移动 Chrome 截图和 `visual-audit.mjs` 检查。

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

