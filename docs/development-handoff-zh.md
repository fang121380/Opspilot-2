# Opspilot 2 开发交接记录 / Development Handoff

> 更新时间 / Updated: 2026-09-08
>
> 本文是跨 Codex 对话的项目状态入口。先阅读本文，再查看 `README.md`、`learning-lab/README.md`、`git status` 和最近提交。
>
> This file is the handoff entry point for a new Codex conversation. Read it before changing code, then inspect `README.md`, `learning-lab/README.md`, `git status`, and recent commits.

## 1. 项目边界 / Scope

- 当前仓库：`fang121380/Opspilot-2`。
- 只操作 Opspilot 2；绝不读取、修改或推送 Opspilot 1。
- 主服务是安全优先的 Kubernetes 事故响应 API；`learning-lab` 是面向零基础用户的学习工作台。
- 生产写操作必须经过服务端保存的提案、人工审批、动作白名单和审计链路。未经明确的人工审批请求，不执行回滚。

## 2. 当前版本 / Current Version

- 当前分支：`main`。
- 当前提交：`526bdd4 feat(workbench): improve beginner guidance and safe updates`。
- `origin/main` 已与本地提交同步。
- 前一阶段提交：`15a24b9`（安全更新并打开工作台）、`bedb68d`（验证记录）、`d5886ed`（响应式工作台）。

## 3. 已完成能力 / Delivered

### Opspilot API

- Alertmanager Webhook 接收、指纹去重、Incident/Audit/Remediation/Approval 持久化。
- Kubernetes 和 Prometheus 只读诊断；固定调查编排与证据分析。
- 只有 HTTP 5xx 与匹配 Pod 错误日志同时成立时才建议回滚。
- 提案、审批、执行 API 分离；审批身份来自服务端凭据映射。
- 动作白名单、命名空间限制、审批匹配和过期检查。
- Kubernetes AppsV1 回滚、只读验证、审计和 OpenTelemetry 关联 ID。
- 异步 Job、SQL 持久化、遗留 Job 恢复 dry-run 和保守失败策略。
- Dockerfile、Compose、Kind 故障演练、离线评测和 GitHub CI。

### 学习工作台 / Learning Workbench

- 五课路径：Docker -> Kind -> Kubernetes -> 故障排查。
- 每课三步：理解概念 -> 练习命令 -> 判断证据。
- 课程命令是固定模拟输出，绝不执行本机 Shell、Docker 或 Kubernetes 写操作。
- 输入 `help` 可查看完整白名单；拼写错误会给建议，但不会自动执行。
- 删除、写入、管道、重定向、多行和 Shell 组合命令会被拦截。
- 完成状态要求概念阅读、当前课程命令证据和小测全部通过。
- 成功复习不会清除成绩；学习页面保存上次课程和步骤，可从上次位置继续。
- 进度按浏览器来源保存：`localhost`、LAN 地址和手机互不共享。
- “学习集群”页面通过同源只读代理读取结构化节点、资源、事件和日志，并明确标注快照是否就绪。
- 桌面和 Android 使用响应式网页；不提供 APK、离线包或跨设备同步。
- 页面底部显示 Git 提交短 hash 和提交时间，便于确认是否为最新构建。

### 跨电脑更新 / Cross-computer Update

- `learning-lab/scripts/update-workbench.py`：只接受 `origin/main` 快进更新，拒绝分叉、未推送提交、同路径冲突和 GitHub 认证失败。
- macOS：`learning-lab/scripts/update-workbench-macos.sh`，有更新锁、Git/依赖/构建超时、项目进程识别和健康检查。
- Windows：`learning-lab/windows/Update-LearningLab.ps1`，使用独占文件锁、进程身份检查、日志和启动健康检查。
- 更新器不会提交或推送用户本地修改；冲突时保留原文件并停止。
- macOS 可用 `install-update-shortcut-macos.py` 创建桌面“更新并打开”快捷方式。

## 4. 运行方式 / Runbook

### 后端质量门禁 / Backend Gates

在仓库根目录执行：

```bash
make setup                 # 首次安装开发依赖
make test                  # Python 测试
make coverage              # 测试 + 覆盖率
make lint                  # Ruff
make eval                  # 离线评测
make demo                  # 本地告警 -> 调查 -> 审批 -> 执行演示
```

主 API：

```bash
python -m uvicorn app.main:app --host 127.0.0.1 --port 8000
```

### 前端工作台 / Frontend Workbench

```bash
cd learning-lab/ui
npm ci
npm test
npm run build
npm run dev
```

访问 `http://127.0.0.1:5173/`。只学习模拟课程不需要 Docker、Kind 或 API。

实机只读桥接服务需另开终端：

```bash
python3 learning-lab/scripts/lab-api.py       # macOS/Linux
python learning-lab/scripts/lab-api.py        # Windows
```

### Kind 实机演练 / Kind Drill

仅在需要真实闭环复验时执行：

```bash
./scripts/kind-demo.sh up
./scripts/kind-demo.sh inject-failure
```

验证告警、事故、调查和审批前阻断后，停止在人工审批门前。没有明确审批接口请求时不得执行回滚。

学习工作台使用独立 `k8s-lab` 集群；主项目使用 `opspilot-2` 集群。不要混用 context，也不要执行全局 Docker 清理。

### Windows 一键部署 / Windows Setup

从仓库根目录运行：

```powershell
.\learning-lab\windows\Install-All.ps1
.\learning-lab\windows\Start-LearningLab.ps1 -StartUi -StartApi
```

更新并打开：

```powershell
.\learning-lab\windows\Update-LearningLab.ps1
```

局域网访问使用 `-Lan`，只开放 TCP 5173；不要把 8787、8000 或 Kubernetes API 暴露到局域网或公网。

### macOS 桌面快捷方式 / macOS Desktop Shortcut

```bash
python3 learning-lab/scripts/install-update-shortcut-macos.py
# 需要局域网访问时：
python3 learning-lab/scripts/install-update-shortcut-macos.py --lan
```

## 5. 最近验证结果 / Latest Validation

最近一轮验证（2026-09-08）：

- `make test`：173 passed，34 skipped。
- `make coverage`：总覆盖率 91.05%，超过 85% 门槛。
- `make lint`：通过。
- `make eval`：4/4 通过。
- `make demo`：本地完整闭环通过。
- 前端 `npm test`：35/35 通过。
- 前端 `npm run build`：通过。
- `git diff --check`：通过。
- Chrome 视觉审计：桌面和移动端均无空白风险、横向溢出或文本溢出。

此前 GitHub CI 已验证 Python 质量、Compose 运行时、前端构建和工作台流程。新增 Windows 更新测试会在 Windows runner 上执行；本机 macOS 仅做静态覆盖和 Python 跳过验证。

## 6. 已知限制 / Known Limits

- 浏览器终端是教学模拟器，不是本机 Shell；真实命令请在系统终端按实验文档执行。
- 实机桥接只读，固定 context `kind-k8s-lab` 和 namespace `learning`。
- 浏览器进度不跨电脑、跨来源或跨手机同步；Git 同步只同步代码，不同步集群和 localStorage。
- Mac 真机、Android 实体机、Windows 实体机和真实 Kubernetes 回滚需要在目标设备分别验证。
- 本机 Docker Hub 曾出现连接超时；镜像构建以 GitHub CI 结果为准。
- 本机 Playwright Chromium 下载曾因网络停在 0%；已有单元测试、构建、Chrome 视觉审计和 CI 检查覆盖主要风险。
- 不要把 `.workbench-logs/`、浏览器缓存、简历导出文件或个人材料加入提交，除非任务明确要求。

## 7. 下一步建议 / Next Steps

按优先级继续：

1. 在一台 Windows 电脑上实际执行 `Install-All.ps1`、`Start-LearningLab.ps1` 和 `Update-LearningLab.ps1`，记录真实版本和端口结果。
2. 在另一台设备验证 LAN 访问、断开 API 后的错误提示，以及进度按来源隔离。
3. 若需要更真实的练习，增加“系统终端复制命令”入口，但继续保持网页终端只读模拟边界。
4. 完善中文/英文实验文档的术语一致性，并为每课增加“完成后你应该看到什么”的截图或验收表。
5. 如需修改主 API，先运行全套 `make` 门禁，再更新本文、提交和推送。

## 8. 新对话启动模板 / Prompt for a New Conversation

复制以下内容给 Codex：

```text
继续开发 Opspilot-2。
仓库：fang121380/Opspilot-2
先阅读 docs/development-handoff-zh.md、README.md、learning-lab/README.md、git status 和最近 10 条提交。
只操作 Opspilot-2，绝不接触 Opspilot-1。
当前目标：<填写一个明确目标>
完成后运行与改动相关的测试，更新交接文档，创建本地 Git 提交，并在网络允许时有界超时推送 origin main。
```

## 9. 提交纪律 / Change Discipline

- 开始前检查 `git status`，保留不属于当前任务的用户修改。
- 只暂存本任务文件；不要使用强制覆盖、硬重置或删除整个仓库。
- 每个完整阶段创建一个清晰的本地提交。
- 推送前确认远端为 `git@github.com:fang121380/Opspilot-2.git` 或等价的 HTTPS 地址。
- 推送后用 `git rev-parse HEAD` 与 `git ls-remote origin refs/heads/main` 核对一致。
- 网络或 GitHub 凭据失败时记录原因，保留本地提交并继续可执行的本地验证。
