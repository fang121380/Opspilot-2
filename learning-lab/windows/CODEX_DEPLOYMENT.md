# Codex Windows 部署任务 / Codex Windows Deployment Task

将本仓库地址交给 Codex 后，直接使用下面的任务说明。Codex 应先阅读本文件，再执行脚本；不要自行猜测目录或操作其他 Kubernetes 集群。

## 任务提示词 / Task prompt

```text
目标：在当前 Windows 电脑部署 Opspilot-2 的 learning-lab，并让用户能打开本地学习工作台。

安全边界：
1. 只允许创建名为 k8s-lab 的 Kind 集群和 learning 命名空间。
2. 禁止操作、删除或重置名为 opspilot-2 的集群；禁止执行 docker system prune、kind delete cluster（除非用户明确要求）。
3. 禁止读取或输出任何 Token、Secret、凭据和内部地址。
4. 前端和 lab-api 只做本地模拟/只读查询，不执行 Kubernetes 回滚、删除或任意 Shell。

执行顺序：
1. 阅读 learning-lab/README.md 和 learning-lab/windows/README.md。
2. 检查 Docker Desktop（Linux containers）、WSL2、Git、Node.js、Python、kind 和 kubectl。
3. 缺少工具时运行 learning-lab/windows/Install-All.ps1；如果 WSL2 或 Docker Desktop 要求管理员确认/重启，暂停并清楚说明原因。
4. 重新打开 PowerShell 后运行 learning-lab/windows/Start-LearningLab.ps1 -StartUi -StartApi。
5. 验证：kubectl --context kind-k8s-lab -n learning get deploy,pods,svc；HTTP 访问 http://localhost:5173；只读 API 访问 http://localhost:8787/?query=resources。
6. 汇报实际结果、版本和任何阻塞，不要把未验证的步骤说成成功。
```

## 预期结果 / Expected result

- 浏览器：`http://localhost:5173`
- 只读桥接：`http://localhost:8787`
- 集群：`kind-k8s-lab`
- 命名空间：`learning`
- 示例应用：`hello-web`，2 个 Running/Ready Pod

