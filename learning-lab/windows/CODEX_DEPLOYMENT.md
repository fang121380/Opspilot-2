# Codex Windows 部署任务 / Deployment Task

下面的任务区分模拟网页、学习桥接、真实练习集群和可选主服务。部署前阅读 [Windows 指南](README.md)，按实际机器状态执行；没有验证的步骤不能标为成功。

This task separates the simulated website, learning bridge, real lab cluster, and optional main service. Read the [Windows guide](README.md) first and report only observed results.

## 中文任务

```text
目标：在当前 Windows 11 电脑部署本仓库的 learning-lab 响应式网页。
先阅读 learning-lab/README.md 和 learning-lab/windows/README.md。

1. 检查 Node.js >=22.18、Python >=3.12、Docker Desktop Linux containers、WSL2、kind 和 kubectl。
2. 若只需要模拟课程，在 learning-lab/ui 运行 npm ci 与 npm run dev；不需要创建集群。
3. 若需要完整实机学习，安装缺失依赖，按安装器要求处理管理员确认或重启，然后运行 learning-lab/windows/Start-LearningLab.ps1 -StartUi -StartApi。
4. 只允许创建 k8s-lab 集群，并在 kind-k8s-lab 中应用 learning 示例。所有手工 kubectl 资源操作都显式加 --context kind-k8s-lab。不要操作其他集群、读取 Secret 或全局清理 Docker。
5. 默认只绑定本机。需要 Android 同一可信 Wi-Fi 访问时，使用 -StartUi -StartApi -Lan；已有本机模式 UI 必须先停止，再以 LAN 模式重启。
6. 验证 http://127.0.0.1:5173、http://127.0.0.1:8787/health、http://127.0.0.1:5173/lab-api/?query=resources，以及 kubectl --context kind-k8s-lab -n learning get deployment,pods,service。
7. Android 使用 http://<电脑的 Wi-Fi IPv4>:5173。手机 localhost 不是电脑；只在私人网络允许网页 TCP 5173，不开放 8787、8000 或 Kubernetes API。
8. -StartApi 仅启动学习桥接。需要“真实事故”时另按根 README 配置主服务及数据库，绑定 127.0.0.1:8000；不要声称启动桥接即已启动主服务。
9. 在 learning-lab/ui 运行 npm test、npm run build；安装 npx playwright install chromium 后运行 npm run test:e2e。记录实际结果、浏览器/设备和局限，不把浏览器模拟当成设备实测。
10. 不删除集群，除非任务明确要求清理；Stop-LearningLab.ps1 删除 k8s-lab，并不停止 UI/桥接。
```

## English Task

```text
Deploy this repository's responsive learning-lab website on Windows 11.
Read learning-lab/README.md and learning-lab/windows/README.md first.
Check Node >=22.18, Python >=3.12, Docker Desktop Linux containers, WSL2, kind, and kubectl.
For simulation only, run npm ci and npm run dev in learning-lab/ui; no cluster is required.
For live learning, install missing prerequisites and run Start-LearningLab.ps1 -StartUi -StartApi.
Create only k8s-lab. Every manual Kubernetes resource command must specify --context kind-k8s-lab.
Do not operate on other clusters, read Secrets, or run global Docker cleanup.
Keep loopback defaults. For requested Android access, restart the UI with -StartUi -StartApi -Lan.
Verify the UI, bridge health, same-origin resource proxy, and ready hello-web replicas separately.
Use the computer Wi-Fi IPv4 on the phone; keep ports 8787, 8000, and the Kubernetes API local.
The main Opspilot API and database are optional and separate from the bridge. Bind that API to 127.0.0.1:8000.
Run npm test, npm run build, npx playwright install chromium, and npm run test:e2e in learning-lab/ui.
Report observed results and remaining limits. Do not claim physical-device validation from browser emulation.
Delete k8s-lab only when cleanup is explicitly requested; the cleanup script does not stop UI/API processes.
```
