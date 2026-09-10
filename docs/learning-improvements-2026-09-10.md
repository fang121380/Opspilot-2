# 电脑端学习深化与复习工具验证（2026-09-10）

## 本轮交付

课程由 26 节扩为 30 节：准备 1、Docker 9、Kind 5、Kubernetes 11、综合排障 4，共 90 段讲解与 70 条固定模拟命令。新增多阶段构建、镜像仓库交付、Job/CronJob、StatefulSet；均有先修关系、证据小测、应用任务、分析笔记、逐项自评和官方参考。

实机手册由 4 份扩为 6 份，新增完整 Go HTTP 服务到本机仓库的交付实验，以及 Job/CronJob/StatefulSet 实验。它们供用户在系统终端手工操作；网页不执行部署。CronJob 默认暂停，StatefulSet 清理保留 PVC，仓库只绑定回环地址。

首页增加待复习队列、学习状态筛选、正文/代码示例/术语/命令/任务内容搜索和全部笔记 Markdown 下载。待复习独立于完成成绩；导出仅备份个人笔记和自评，不导入或同步进度。旧课程有效学习记录保留。

修复手册 HTTP 地址被拼为 GitHub 链接、已有访问记录但零完成时首页仍显示“开始第一课”、切换步骤后键盘焦点丢失。复审补齐搜索遗漏的代码示例。

手册按需加载，加载失败显示错误并提供刷新入口。开发服务器使用动态加载的 TypeScript 包装模块导入 Markdown，避免直接动态导入原始 Markdown 返回错误 MIME 类型。生产首屏 JS 为 409.47 kB（gzip 136.52 kB）；同轮全部手册直接内置时约 504.52 kB。每份手册单独加载，生产构建不再触发 500 kB 警告。

## 验证结果

- `npm test`：43/43 通过，包括学习状态、搜索、待复习存储、笔记原文导出、手册链接及全部课程证据与先修关系。
- `WORKBENCH_BROWSER_CHANNEL=chrome WORKBENCH_E2E_PORT=5186 npm run test:e2e -- --workers=2`：19/19 通过，含完整 30 课、进度恢复、筛选、真实下载文件内容、焦点、手册按需加载与断网后恢复。
- `npm run build`：通过；Vite 和 Playwright 配置的独立 TypeScript 检查通过。
- 生产预览端口 5187 的 Chrome 冒烟：六份手册全部加载成功，页面异常为 0；临时预览服务已关闭。
- 桌面浅色课程页、深色手册截图已人工查看；相关 axe WCAG 自动检查通过。自动可访问性检查不能代替完整辅助技术验收。
- 新手册四个 YAML 文档通过 Ruby YAML 解析；Go 示例源码在临时目录实际编译通过。课程模拟命令的输出和证据匹配通过。
- `git diff --check`：通过。

可复用命令：

```bash
cd learning-lab/ui
npm test
npm run build
npx tsc --noEmit --target ES2022 --module ESNext --moduleResolution bundler --types node --skipLibCheck vite.config.ts playwright.config.ts
WORKBENCH_BROWSER_CHANNEL=chrome WORKBENCH_E2E_PORT=5186 npm run test:e2e -- --workers=2
```

## 验证边界与后续内容

本轮只修改学习工作台和文档，未重新运行后端全量测试，也未执行新增手册中的 Docker 仓库或 Kubernetes 部署。此前后端、Compose 与 Windows CI 结果见 [全量验证记录](full-validation-2026-09-10.md)，不能将历史结果当作本轮新增实验已经实测。手机工作按用户要求暂缓。

下一步优先实际走通六份手册并记录环境和验收证据，再按依赖补齐 Ingress/入口与 TLS、metrics-server/HPA、NetworkPolicy/CNI、Helm 与 GitOps。每个专题应包括完整配置、操作前提、失败场景、业务验收和局部清理，而不只是术语介绍。课程地图中的后续计划尚不是已交付内容。
