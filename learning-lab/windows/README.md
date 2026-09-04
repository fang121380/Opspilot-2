# Windows 部署 / Windows Deployment

## 推荐环境 / Recommended environment

Windows 10 22H2 或 Windows 11 23H2+，启用硬件虚拟化和 WSL2；Docker Desktop 使用 Linux containers。Kind 官方支持 Windows，但要求 Linux 容器运行时。

Use Windows 10 22H2 or Windows 11 23H2+, hardware virtualization, WSL2, and Docker Desktop with Linux containers. kind supports Windows with a Linux container runtime.

## 一键安装 / One-click install

用 PowerShell 进入仓库的 `learning-lab/windows` 目录，执行：

```powershell
Set-ExecutionPolicy -Scope Process Bypass
.\Install-All.ps1
```

脚本会通过 winget 安装 Docker Desktop、Git、Kind、kubectl、Node.js 和 Python，并检查/更新 WSL2。首次启用 WSL2 或安装 Docker Desktop 可能需要管理员确认和重启；重启后重新执行脚本即可。

Run the following from PowerShell in `learning-lab/windows`:

```powershell
Set-ExecutionPolicy -Scope Process Bypass
.\Install-All.ps1
```

It installs Docker Desktop, Git, kind, kubectl, Node.js, and Python through winget, then checks/updates WSL2. Enabling WSL2 or installing Docker Desktop may require administrator approval and a reboot; rerun the script after reboot.

只想安装命令行工具时 / CLI tools only:

```powershell
Set-ExecutionPolicy -Scope Process Bypass
.\Install-Tools.ps1
```

重新打开 PowerShell，创建学习集群并启动 UI/API：

```powershell
.\Start-LearningLab.ps1 -StartUi -StartApi
```

打开 `http://localhost:5173`。

The script creates only `k8s-lab`, applies the sample workload, optionally starts the UI and read-only bridge, and never touches `opspilot-2`.

## 常用命令 / Common commands

```powershell
.\Check-Prerequisites.ps1
.\Get-LabStatus.ps1
.\Stop-LearningLab.ps1
```

PowerShell 脚本不会执行任意命令、读取 Secret 或运行 Kubernetes 写操作；清理脚本只删除 `k8s-lab`。

The PowerShell scripts do not execute arbitrary commands, read Secrets, or perform Kubernetes writes. The cleanup script deletes only `k8s-lab`.

## 发给 Codex 的标准请求 / Prompt for Codex

把下面这段和仓库地址一起发给 Windows 上的 Codex：

```text
请在 Windows 上部署 https://github.com/fang121380/Opspilot-2 的 learning-lab。
先检查 Docker Desktop、WSL2、kind、kubectl、Node.js 和 Python；不要操作任何现有 Kubernetes 集群。
只创建名为 k8s-lab 的 Kind 集群，然后运行 learning-lab/windows/Start-LearningLab.ps1 -StartUi -StartApi。
验证 http://localhost:5173、http://localhost:8787 和 kubectl -n learning get pods。
如果缺少工具，说明缺什么并给出安装命令；不要执行 docker system prune、kind delete cluster（除非我明确要求）。
```

完整的、可直接复制给 Codex 的部署任务见 [CODEX_DEPLOYMENT.md](CODEX_DEPLOYMENT.md)。

For the complete copy-ready Codex deployment task, see [CODEX_DEPLOYMENT.md](CODEX_DEPLOYMENT.md).

## 故障排查 / Troubleshooting

- `Docker daemon is not reachable`：启动 Docker Desktop，确认使用 Linux containers。
- `kind create cluster` 超时：确认 WSL2/虚拟化已启用，并给 Docker Desktop 至少 8GB 内存。
- `ImagePullBackOff`：先运行 `kubectl -n learning describe pod` 和 `kubectl -n learning get events`，再检查网络或镜像源。
- PowerShell 禁止脚本：只对当前窗口运行 `Set-ExecutionPolicy -Scope Process Bypass`，不要修改全局策略。
