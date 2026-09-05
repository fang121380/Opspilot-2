# Windows 部署 / Windows Deployment

## 环境 / Environment

目标平台为 Windows 11、PowerShell 5.1+、WSL2 和启用硬件虚拟化的 Docker Desktop，使用 Linux containers。网页需要 Node.js >=22.18；只读桥接需要 Python >=3.12；真实集群还需要 kind 和 kubectl。仅使用模拟课程时，无需先安装 Docker 或创建集群，直接按[网页启动说明](../README.md)运行 UI 即可。

The Windows target is Windows 11 with PowerShell 5.1+, WSL2, hardware virtualization, and Docker Desktop using Linux containers. The website needs Node.js >=22.18; the bridge needs Python >=3.12; live practice also needs kind and kubectl. For simulated lessons alone, follow the [UI startup instructions](../README.md) without installing Docker or creating a cluster.

## 安装与启动 / Install and Start

在 `learning-lab/windows` 的 PowerShell 中执行 / From PowerShell in `learning-lab/windows`:

```powershell
Set-ExecutionPolicy -Scope Process Bypass
.\Install-All.ps1
```

此脚本通过 winget 安装 Docker Desktop、Git、kind、kubectl、Node.js 和 Python，并尝试安装或更新 WSL。它会修改本机软件，不会自动完成后续建群。按安装器要求处理管理员确认或重启，启动 Docker Desktop，再打开新的 PowerShell 窗口以刷新 PATH。

This script installs Docker Desktop, Git, kind, kubectl, Node.js, and Python through winget, and attempts WSL installation or updates. It changes host software; cluster creation is a separate step. Follow installer elevation or reboot requirements, start Docker Desktop, then reopen PowerShell to refresh PATH.

```powershell
.\Check-Prerequisites.ps1
.\Start-LearningLab.ps1 -StartUi -StartApi
```

启动脚本仅创建缺失的 `k8s-lab` 集群，并向 `kind-k8s-lab` 应用 `learning/hello-web` 示例，等待部署就绪，然后启动或复用 UI 与桥接。它包含真实 Kubernetes 写操作。访问 [工作台](http://127.0.0.1:5173)，日志位于 `learning-lab/.workbench-logs/`。

Startup creates `k8s-lab` when missing, applies the `learning/hello-web` sample to `kind-k8s-lab`, waits for readiness, then starts or reuses the UI and bridge. These are real Kubernetes writes. Open the [workbench](http://127.0.0.1:5173); logs are under `learning-lab/.workbench-logs/`.

## Android 访问 / Android Access

电脑和 Android 接入同一可信 Wi-Fi，从 `learning-lab/windows` 执行 / Join the same trusted Wi-Fi, then run from `learning-lab/windows`:

```powershell
.\Start-LearningLab.ps1 -StartUi -StartApi -Lan
ipconfig
```

从 `ipconfig` 找到正在使用的 Wi-Fi IPv4，在手机浏览器打开 `http://<电脑的 Wi-Fi IPv4>:5173`。手机 `localhost` 是手机自身。Windows 防火墙只在私人网络允许 TCP 5173；8787 桥接、8000 主服务及 Kubernetes API 保持本机访问。LAN 用户可以通过 UI 的只读代理访问学习资源和日志。

Find the active Wi-Fi IPv4 with `ipconfig`, then open `http://<PC-Wi-Fi-IPv4>:5173` on Android. Phone `localhost` is the phone. Allow TCP 5173 only on Windows Private networks; keep bridge 8787, main API 8000, and the Kubernetes API local. LAN users can read lab resources and logs through the UI proxy.

若提示 5173 已为 local-only，先停止当前 UI 进程，再以 `-Lan` 重启；重新运行脚本不会把已存在进程的监听地址自动更改。手工 UI 可在其终端按 Ctrl+C 停止，再进入 `learning-lab/ui` 执行 `npm run dev:lan`。后台进程应先根据监听端口和命令行确认身份，仅停止该 UI，避免误停其他服务。

If port 5173 is already local-only, stop that UI process before restarting with `-Lan`; rerunning cannot change an existing process's bind address. For a terminal-started UI, press Ctrl+C and run `npm run dev:lan` from `learning-lab/ui`. For a background UI, identify its listening port and command line before stopping only that process.

## 验证与清理 / Verify and Clean Up

```powershell
.\Get-LabStatus.ps1
kubectl --context kind-k8s-lab -n learning get deployment,pods,service
Invoke-RestMethod http://127.0.0.1:8787/health
Invoke-RestMethod http://127.0.0.1:5173/lab-api/?query=resources
```

8787 `/health` 只证明桥接运行，资源查询成功才证明该次集群读取成功。主 Opspilot API 是独立的可选服务，默认 `127.0.0.1:8000`，需要仓库主服务依赖和数据库；`-StartApi` 只启动学习桥接。

Bridge `/health` proves liveness only; a successful resource query proves that particular cluster read. The optional main Opspilot API is separate on `127.0.0.1:8000` and needs its own dependencies and database. `-StartApi` starts only the learning bridge.

明确要删除学习集群时，执行 `./Stop-LearningLab.ps1`。此脚本删除 `k8s-lab`，不是停止 UI/桥接的命令。不要执行全局 Docker 清理或操作其他集群。

When you intend to delete the learning cluster, run `./Stop-LearningLab.ps1`. It deletes `k8s-lab`; it does not stop the UI or bridge. Do not run global Docker cleanup or operate on other clusters.

## 排错 / Troubleshooting

| 现象 / Symptom | 下一步 / Next step |
| --- | --- |
| Docker daemon 不可达 / Unreachable | 启动 Docker Desktop，检查 Linux containers、WSL2 和虚拟化 / Check Docker, WSL2, virtualization |
| 本机可访问、手机不行 / Desktop works, phone fails | 检查 LAN 监听、正确 IPv4、私人网络防火墙和 Wi-Fi 客户端隔离 / Check LAN binding, address, firewall, AP isolation |
| 集群页面报错 / Live query error | 检查桥接日志、`kind-k8s-lab` 和 Docker / Check bridge logs, context, Docker |
| `ImagePullBackOff` | 执行 `kubectl --context kind-k8s-lab -n learning describe pod -l app=hello-web`，查看镜像拉取证据 / Inspect image-pull evidence |
| 真实事故无法连接 / Incidents unavailable | 单独配置并启动主 API；模拟案例仍可使用 / Start the separate main API; simulated case remains available |

前端检查命令及跨平台说明见 [README](../README.md)；自动部署任务见 [CODEX_DEPLOYMENT.md](CODEX_DEPLOYMENT.md)。

See the [README](../README.md) for frontend checks and platform scope, or [CODEX_DEPLOYMENT.md](CODEX_DEPLOYMENT.md) for a deployment task.
