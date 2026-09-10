# Opspilot 学习工作台 / Learning Workbench

面向初学者的 React 浏览器工作台，覆盖 Docker、Kind、Kubernetes 和证据驱动排障。桌面与 Android 使用同一响应式网页；不提供 APK、离线 PWA 或跨设备进度同步。

A React browser workbench for Docker, Kind, Kubernetes, and evidence-based troubleshooting. Desktop and Android share the responsive website. There is no APK, offline PWA, or cross-device progress sync.

## 两种练习 / Two Ways to Learn

| 入口 / Entry | 数据与行为 / Data and behavior | 依赖 / Dependencies |
| --- | --- | --- |
| 课程与教学案例 / Lessons and case | 固定模拟输出，不执行本机命令或修改集群 / Fixed examples, no host commands or cluster changes | Node.js >=22.18 |
| 学习集群 / Live cluster | 固定目标的只读资源、节点、事件、日志 / Read-only resources, nodes, events, logs | Python >=3.12, kubectl, Docker, Kind, `k8s-lab` |
| 真实事故 / Live incidents | 可选的 Opspilot 事故列表 / Optional Opspilot incident list | 单独启动主 API 及其依赖 / Main API and its dependencies |

课程按“理解概念 → 练习命令 → 判断证据”分为三步，30 课按学习准备、Docker、Kind、Kubernetes、综合排障分章组织，均可直接进入。首页可按章节与学习状态筛选，搜索标题、正文、术语及命令，每课有先修链接。完成课程需要概念阅读、本课命令记录自检和证据小测通过；25 节深入课程还要求填写分析笔记并逐项完成任务自评。页面会保存上次学习的课程与步骤；已完成课程可复习，重新运行正确的模拟命令不会取消完成成绩。模拟版本输出不能证明本机安装成功，模拟完成也不等于实机验收。

Each lesson has three navigable steps: understand concepts, practice commands, and judge evidence. All 30 lessons are available in five ordered chapters with prerequisite links, chapter/status filters, and search across titles, explanations, terminology, and commands. Completion requires reading, verification of that lesson's command records, and its evidence quiz. The 25 extended lessons also require a written reflection and an acceptance checklist; these are self-assessment, not automatic grading. Simulated versions do not prove local installation; simulated completion is separate from real lab acceptance.

## 完整学习链 / Learning Path

| 阶段 | 课数 | 学习内容与交付 |
| --- | --- | --- |
| 学习准备 | 1 | 客户端、引擎与集群连通的边界 |
| Docker | 9 | 生命周期、Dockerfile 与缓存、多阶段构建、仓库与摘要交付、网络、数据卷、Compose、综合验收 |
| Kind | 5 | 架构与节点、集群配置、镜像交付、生命周期和重建边界 |
| Kubernetes | 11 | 声明式对象、发布、Job/CronJob、Service/DNS、配置、存储、StatefulSet、探针、调度资源、权限 |
| 综合排障 | 4 | 状态/事件/日志、启动失败、网络断点、审批与恢复验证 |

每课按“原理 → 具体场景 → 模拟证据 → 判断 → 应用任务”推进。原来 `00`–`04` 的有效成绩继续保留，新课使用独立 ID。笔记和任务自评跟随浏览器进度保存，旧课完成不会自动获得新课成绩。

Each chapter connects concepts, scenarios, simulated evidence, judgment, and applied tasks. Original `00`–`04` lesson credit is preserved; new lessons use independent IDs. Notes and self-assessment remain browser-local.

电脑端课程顶部的 **本章实机手册** 可直接阅读六份完整实验，不必离开工作台。原有四份将同一个小网站从 Docker 镜像逐步部署到 Kind/Kubernetes，再验证故障恢复，包含 Compose、多服务网络、PVC 与最小权限；新增两份独立实验涵盖多阶段镜像与本机仓库交付，以及批处理和工作负载选择。实机命令由学习者在系统终端手工执行，网页不代执行；成功样例和自评不代表真实集群验收。

The desktop course view embeds six hands-on manuals: four connected Docker → Kind → Kubernetes → troubleshooting projects, plus isolated image-delivery and workload-pattern experiments. Commands run only when learners explicitly execute them in their system terminal.

新增两份手册尚未执行真实 Docker/Kubernetes 实验，Go 源码编译和 YAML 解析仅是材料检查；本轮验证见[学习改进记录](../docs/learning-improvements-2026-09-10.md)。后续按 Ingress 入口 → HPA 指标 → NetworkPolicy → Helm/GitOps 的依赖顺序深化。

详细课表、学习顺序与验收见 [课程地图](CURRICULUM.md)。本路径聚焦独立交付与诊断一个容器应用；生产级高可用、服务网格、完整 Helm/GitOps、集群升级与认证备考并未宣称全部覆盖。

## 启动网页 / Start the Website

在仓库根目录执行 / From the repository root:

```bash
cd learning-lab/ui
npm ci
npm run dev
```

访问 [本机工作台](http://127.0.0.1:5173)。只练习课程时不需要 Docker 或 API。实机查询需要另开终端启动桥接：在仓库根目录运行 Windows 的 `python learning-lab/scripts/lab-api.py`，或 macOS 的 `python3 learning-lab/scripts/lab-api.py`。

Open the [local workbench](http://127.0.0.1:5173). Lessons need no Docker or API. For live queries, run the bridge in another terminal from the repository root using `python learning-lab/scripts/lab-api.py` on Windows or `python3 learning-lab/scripts/lab-api.py` on macOS.

Windows 11 的安装、建群和启动见 [Windows 指南](windows/README.md)。macOS 提供源码启动器，先按 [Kind 实验](labs/02-kind-cluster.md)创建学习集群，再从仓库根目录运行：

For Windows 11, follow the [Windows guide](windows/README.md). The macOS source launcher starts the UI and bridge; create the cluster through the [Kind lab](labs/02-kind-cluster.md) first:

```bash
bash learning-lab/scripts/open-workbench-macos.sh
```

日志位于 `learning-lab/.workbench-logs/`。提供 macOS 源码不代表已在 Mac 设备上验证，也不代表已经安装桌面 `.app`。

Logs are under `learning-lab/.workbench-logs/`. Providing macOS source does not claim Mac device validation or an installed desktop `.app`.

## 多电脑更新 / Update Across Computers

在修改代码的电脑上先提交并推送 GitHub；在另一台电脑使用“更新并打开”。此操作同步仓库代码，重新安装前端锁定依赖、构建并重启工作台，不同步浏览器进度或集群数据，也不会代替你提交本地修改。

Commit and push from the computer where you edited the code. On the other computer, use update-and-open to fetch code, install locked frontend dependencies, build, and restart the workbench. Browser progress and cluster data remain separate. The updater never commits or pushes your edits.

macOS 从仓库根目录执行以下命令，即可在桌面创建“Opspilot 更新并打开.app”。双击会打开终端显示更新结果，再打开浏览器。本台 Mac 已于 2026-09-08 验证桌面启动；其他 Mac 安装时会自动记录各自的仓库路径。

On macOS, create a checkout-specific desktop shortcut with the following command. Double-clicking shows the update log in Terminal, then opens the browser. The desktop workflow was verified on this Mac on 2026-09-08; each installation resolves its own checkout path.

```bash
python3 learning-lab/scripts/install-update-shortcut-macos.py
# 需要保留局域网分享时安装 / To keep LAN sharing enabled:
# python3 learning-lab/scripts/install-update-shortcut-macos.py --lan
```

也可以直接运行 / Or run directly:

```bash
bash learning-lab/scripts/update-workbench-macos.sh
```

Windows / On Windows:

```powershell
.\learning-lab\windows\Update-LearningLab.ps1
```

更新仅接受本仓库 `origin/main` 的快进更新。无冲突的本地修改会保留；同文件或目录冲突、本地未推送提交、分叉、其他分支或 GitHub 认证失败都会停止，并保留原始内容。请把错误交给 Codex 处理，不要使用强制覆盖。Git 网络请求最多等待 60 秒；Mac 依赖安装和构建分别最多等待 300/180 秒。依赖失败后代码已经更新但服务可能停止，再次运行即可重试。普通桌面启动图标不会检查更新。

Only fast-forward updates of this repository's `origin/main` are accepted. Unrelated local edits are preserved. File/directory conflicts, unpushed or diverged commits, other branches, and authentication failures stop the update with your files intact. Ask Codex to resolve the reported issue instead of forcing an overwrite. Git requests time out after 60 seconds; Mac installation/build limits are 300/180 seconds. Dependency failures can leave updated code with stopped services; rerun to retry. The ordinary desktop launcher does not check GitHub.

Mac 更新日志：`learning-lab/.workbench-logs/update.log`。意外关机留下 `update.lock` 时，先确认没有更新进程，再请 Codex 清理该锁。Windows 更新脚本本轮仅做静态检查，尚未在 Windows 实机验证。

Mac update log: `learning-lab/.workbench-logs/update.log`. If interruption leaves `update.lock`, confirm no updater is running before asking Codex to remove that lock. The Windows update wrapper has only static review in this delivery; Windows device validation remains outstanding.

## Android 同一 Wi-Fi / Android on the Same Wi-Fi

电脑和手机连接同一可信 Wi-Fi，选择一种启动方式 / Join the same trusted Wi-Fi and choose one launch method:

```bash
# 在 learning-lab/ui / From learning-lab/ui
npm run dev:lan
```

```powershell
# 在仓库根目录 / From the repository root
.\learning-lab\windows\Start-LearningLab.ps1 -StartUi -StartApi -Lan
```

```bash
# 在仓库根目录 / From the repository root
bash learning-lab/scripts/open-workbench-macos.sh --lan
```

Android 浏览器打开 `http://<电脑的 Wi-Fi IPv4>:5173`；Windows 用 `ipconfig` 查地址，macOS 在 Wi-Fi 网络详情中查看。手机上的 `localhost` 指手机自身。默认服务仅绑定 `127.0.0.1`；若 5173 已运行本机模式，先停止该 UI 进程，再用 LAN 模式重启。Windows 防火墙只在私人网络允许 TCP 5173。不要将 8787、8000 或 Kubernetes API 暴露到局域网，也不要转发到公网。

On Android, open `http://<computer-Wi-Fi-IPv4>:5173`. Find the address with Windows `ipconfig` or macOS Wi-Fi details. Phone `localhost` means the phone. The default server binds only to `127.0.0.1`; stop an existing local-only UI process before restarting in LAN mode. Allow TCP 5173 on Windows Private networks only. Keep ports 8787, 8000, and the Kubernetes API local, without public port forwarding.

LAN 访问者可以通过网页代理读取学习资源、日志，以及已启动主服务的允许路由。浏览器请求使用同源 `/lab-api` 和 `/opspilot-api`，不会请求手机自己的 8787 或 8000。

LAN visitors can read lab data and allowed main-service routes through the web proxy. Browser requests use same-origin `/lab-api` and `/opspilot-api`, never the phone's own API ports.

## 数据与边界 / Data and Boundaries

桥接固定访问 `kind-k8s-lab`，工作负载查询固定在 `learning`。资源、事件和节点是结构化 Kubernetes JSON，封装在响应的 `output` 字符串内；日志是文本。四类请求分别保留时间、错误和上次成功快照，单项失败不会丢弃其他成功结果。空事件列表不能证明健康。

The bridge fixes the context to `kind-k8s-lab` and workload namespace to `learning`. Resources, events, and nodes return structured Kubernetes JSON inside the `output` string; logs remain text. Each channel retains its own timestamp, error, and last successful snapshot. One failed request does not discard other results. An empty event list is not proof of health.

进度保存在当前浏览器、当前来源的 localStorage；电脑 localhost、LAN 地址和手机是不同存储空间。旧 `v3` 记录迁移保留有效阅读和命令历史，但无证据的完成状态和旧题目的小测通过状态会重置。新记录含课程版本、上次学习步骤及每课命令输出；存储不可用时只能保留当前会话进度。

可以在课程顶部标记或取消 **稍后复习**，首页显示待复习数量，并按“未开始、学习中、已完成、待复习”筛选。待复习标记与完成成绩独立，不会清除已获得成绩。**导出学习笔记** 生成 Markdown，包含有笔记课程的分析文字、学习状态与任务自评，供个人阅读和备份；它不是完整进度存档，不能导入或跨设备同步。

Mark lessons for later review independently of completion. The overview filters unstarted, in-progress, completed, and review lessons. Markdown export includes written reflections, learning status, and self-assessment for lessons with notes. It is a readable notes backup, not an importable or synchronized progress archive.

错误输入课程命令时，终端会说明可能的拼写、学习集群或命名空间范围，并给出可核对的命令；建议不会自动运行。包含删除、写入、管道、重定向、多行输入或其他 Shell 结构的命令全部不会执行。

真实练习从“学习集群”页面的“第一次做实机练习”展开说明开始：先准备 Docker 和 `k8s-lab`，再读取节点与 `hello-web` 的快照，最后对照资源、事件和日志。页面显示“本次快照就绪”只代表已读取的节点和示例工作负载状态；业务访问验证仍需按页面指引在系统终端单独执行。

Progress is browser-local and origin-specific. Desktop localhost, LAN URLs, and the phone do not share storage. Migration of old `v3` data retains valid reading and command history but clears unsupported completion and obsolete quiz credit. New records include curriculum version and per-lesson output. Unavailable storage limits progress to the current session.

网页终端全部模拟，包括 `docker run`。桥接和代理只允许固定 GET 查询。安装脚本会安装工具；启动脚本会创建 `k8s-lab` 并应用示例；清理脚本会删除该学习集群。手工实验写操作必须显式使用 `--context kind-k8s-lab`，不能操作其他集群，也不执行全局 Docker 清理。

All web terminal commands are simulated, including `docker run`. The bridge and proxies allow only fixed GET queries. Installers install tools; lab startup creates `k8s-lab` and applies the sample; cleanup deletes that cluster. Manual Kubernetes writes must explicitly use `--context kind-k8s-lab`. Do not operate on other clusters or run global Docker cleanup.

可选主服务按[仓库 README](../README.md)安装依赖和数据库后，从仓库根目录运行 `python -m uvicorn app.main:app --host 127.0.0.1 --port 8000`。桥接 8787 与主服务 8000 是两个独立服务；启动桥接不会启动主服务。具体协议见[集成说明](INTEGRATION_PLAN.md)。

For optional live incidents, prepare the dependencies and database in the [repository README](../README.md), then run `python -m uvicorn app.main:app --host 127.0.0.1 --port 8000` from the repository root. The bridge on 8787 and main API on 8000 are separate services. Starting the bridge does not start Opspilot. See the [integration contract](INTEGRATION_PLAN.md).

## 手工实验 / Manual Labs

| 实验 / Lab | 验收重点 / Acceptance focus |
| --- | --- |
| [00 环境检查 / Prerequisites](labs/00-prerequisites.md) | 区分客户端、容器引擎、集群连通 / Client, engine, cluster connectivity |
| [01 Docker 基础 / Docker](labs/01-docker-basics.md) | 容器运行、端口绑定、清理 / Container, port binding, cleanup |
| [02 Kind 集群 / Kind](labs/02-kind-cluster.md) | 固定 context、Ready 节点 / Explicit context, Ready nodes |
| [03 Kubernetes 应用 / Application](labs/03-kubernetes-app.md) | 副本就绪、Service 与实际请求 / Ready replicas, Service, real request |
| [04 故障排查 / Troubleshooting](labs/04-troubleshooting.md) | 就绪探针证据与恢复验证 / Readiness evidence and recovery |
| [05 Docker 综合项目](labs/05-docker-project.md) | 构建网站、数据卷、Compose 与网络 |
| [06 Kind 综合项目](labs/06-kind-project.md) | 复用集群、加载本地镜像、验证节点 |
| [07 Kubernetes 综合项目](labs/07-kubernetes-project.md) | 发布、配置、探针、PVC 数据保留、RBAC |
| [08 排障综合项目](labs/08-troubleshooting-project.md) | 手工注入、证据记录、恢复与复验 |
| [09 镜像交付实验](labs/09-image-delivery.md) | 多阶段非 root 服务、缓存、本机临时仓库、摘要与版本验收 |
| [10 工作负载模式](labs/10-workload-patterns.md) | Job/CronJob、StatefulSet 的稳定身份与存储验收 |

## 前端检查 / Frontend Checks

在 `learning-lab/ui` 执行 / From `learning-lab/ui`:

```bash
npm ci
npm test
npm run build
npx playwright install chromium
npm run test:e2e
```

构建后 `npm run preview` 默认使用 [本机 4173](http://127.0.0.1:4173)；`npm run preview:lan` 使用 LAN 5173。开发和预览均有相同只读代理。静态文件服务器不会自动提供这些代理；实机页面需要代理和本地服务。测试命令是复现步骤，验证结果以本次实际运行记录为准。

After building, `npm run preview` uses [loopback port 4173](http://127.0.0.1:4173); `npm run preview:lan` uses LAN port 5173. Development and preview share read-only proxies. A plain static file server does not provide these proxies. Test commands describe how to reproduce checks, not a claim that every platform or integration has passed.

使用已安装 Chrome 运行浏览器回归（默认仍使用 Playwright Chromium）：

```bash
# macOS/Linux，独立测试端口避免占用正在学习的工作台
WORKBENCH_BROWSER_CHANNEL=chrome WORKBENCH_E2E_PORT=5186 npm run test:e2e
```

```powershell
# Windows PowerShell，在 learning-lab/ui 中
$env:WORKBENCH_BROWSER_CHANNEL = "chrome"
$env:WORKBENCH_E2E_PORT = "5186"
npm run test:e2e
```
