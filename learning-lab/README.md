# Opspilot 学习工作台 / Learning Workbench

面向初学者的 React 浏览器工作台，覆盖 Docker、Kind、Kubernetes 和证据驱动排障。桌面与 Android 使用同一响应式网页；不提供 APK、离线 PWA 或跨设备进度同步。

A React browser workbench for Docker, Kind, Kubernetes, and evidence-based troubleshooting. Desktop and Android share the responsive website. There is no APK, offline PWA, or cross-device progress sync.

## 两种练习 / Two Ways to Learn

| 入口 / Entry | 数据与行为 / Data and behavior | 依赖 / Dependencies |
| --- | --- | --- |
| 课程与教学案例 / Lessons and case | 固定模拟输出，不执行本机命令或修改集群 / Fixed examples, no host commands or cluster changes | Node.js >=22.18 |
| 学习集群 / Live cluster | 固定目标的只读资源、节点、事件、日志 / Read-only resources, nodes, events, logs | Python >=3.12, kubectl, Docker, Kind, `k8s-lab` |
| 真实事故 / Live incidents | 可选的 Opspilot 事故列表 / Optional Opspilot incident list | 单独启动主 API 及其依赖 / Main API and its dependencies |

课程按“理解概念 → 练习命令 → 判断证据”分为三步，五课均可直接进入。完成课程需要概念阅读、本课命令记录自检和证据小测通过。模拟版本输出不能证明本机安装成功，模拟完成也不等于实机验收。

Each lesson has three navigable steps: understand concepts, practice commands, and judge evidence. All five lessons are available. Completion requires reading, verification of that lesson's command records, and its evidence quiz. Simulated versions do not prove local installation; simulated completion is separate from real lab acceptance.

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

进度保存在当前浏览器、当前来源的 localStorage；电脑 localhost、LAN 地址和手机是不同存储空间。旧 `v3` 记录迁移保留有效阅读和命令历史，但无证据的完成状态和旧题目的小测通过状态会重置。新记录含课程版本及每课命令输出；存储不可用时只能保留当前会话进度。

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
