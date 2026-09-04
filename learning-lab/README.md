# Opspilot 学习工作台 / Opspilot Learning Lab

这是一个面向零基础学习者的本地练习区，按 Docker -> Kind -> Kubernetes -> 监控与故障排查递进。它借鉴了 Kubernetes 官方 examples、kind 官方 quick start、`k8slab` 的实验验收标准，以及中文 macOS + Docker Desktop + Kind 教程的分阶段结构。

This is a beginner-friendly local lab that progresses from Docker to Kind, Kubernetes, monitoring, and troubleshooting. It borrows the lab-and-acceptance-criteria pattern from Kubernetes examples, the official kind quick start, `k8slab`, and a Chinese macOS + Docker Desktop + Kind learning guide.

## 安全边界 / Safety boundary

- 学习集群名固定为 `k8s-lab`，不会修改 `opspilot-2`。
- `down` 只删除 `k8s-lab`，不会清理 Docker 全局资源。
- 实验使用本地镜像和 `nginx` 示例，不接触生产集群、云账号或 Secret。

- The lab cluster is always named `k8s-lab` and never changes `opspilot-2`.
- `down` deletes only `k8s-lab`; it does not prune global Docker resources.
- Exercises use local images and an `nginx` sample, with no production cluster, cloud account, or Secret access.

## 开始 / Start

```bash
cd learning-lab
./scripts/check-prerequisites.sh
./scripts/lab.sh up
```

然后按顺序阅读并执行：

Then follow the labs in order:

| 阶段 / Stage | 文档 / Lab | 重点 / Focus |
| --- | --- | --- |
| 00 | [环境检查 / Prerequisites](labs/00-prerequisites.md) | Docker、kubectl、Kind |
| 01 | [Docker 基础 / Docker basics](labs/01-docker-basics.md) | 镜像、容器、端口 |
| 02 | [Kind 集群 / Kind cluster](labs/02-kind-cluster.md) | 节点、上下文、命名空间 |
| 03 | [Kubernetes 应用 / Kubernetes app](labs/03-kubernetes-app.md) | Pod、Deployment、Service |
| 04 | [故障排查 / Troubleshooting](labs/04-troubleshooting.md) | 日志、探针、滚动更新 |

常用命令 / Useful commands:

```bash
./scripts/lab.sh status       # 查看集群和工作负载 / inspect cluster and workloads
./scripts/lab.sh open         # 端口转发 nginx / port-forward nginx
make api                    # 启动只读状态桥接 / start the read-only status bridge
./scripts/lab.sh down         # 删除学习集群 / delete only the lab cluster
```

## 工作台界面 / Workbench UI

前端位于 `ui/`，启动方式：

The React workbench lives in `ui/`:

```bash
cd ui
npm install
npm run dev
```

打开 `http://127.0.0.1:5173`。界面当前使用本地模拟数据，提供官方文档入口、自检纠错和只读命令练习；接入 Opspilot 的边界见 [接入计划 / Integration plan](INTEGRATION_PLAN.md)。

Open `http://127.0.0.1:5173`. The UI currently uses local mock data and provides official docs, self-check feedback, and read-only command exercises. See [INTEGRATION_PLAN.md](INTEGRATION_PLAN.md) for the Opspilot integration boundary.

Windows 用户可直接使用 [Windows 一键部署 / Windows one-click deployment](windows/README.md)，其中的 `Install-All.ps1` 会安装全部工具并启动学习集群。

Windows users can follow [windows/README.md](windows/README.md). `Install-All.ps1` installs the required tools and `Start-LearningLab.ps1` creates the lab cluster and starts the workbench.

## 学习节奏 / Suggested cadence

每次只完成一个实验：先读目标，再执行命令，最后完成验收清单。遇到错误时先记录 `kubectl get pods -A`、`kubectl describe` 和相关日志，再尝试修复。

Complete one lab at a time: read the goal, run the commands, then check every acceptance item. When something fails, capture `kubectl get pods -A`, `kubectl describe`, and the relevant logs before changing anything.

## 参考项目 / References

- [kind 官方仓库 / official repository](https://github.com/kubernetes-sigs/kind)
- [Kubernetes 官方 examples](https://github.com/kubernetes/examples)
- [Azure GBB Kubernetes hands-on lab](https://github.com/palma21/k8slab)
- [KubernetesLabs walkthroughs](https://github.com/nirgeier/KubernetesLabs)
- [macOS + Kind 中文实战指南](https://github.com/bysbsh/k8s-local-learning-guide)
