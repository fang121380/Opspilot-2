# 06 Kind 综合实验：让集群使用自己构建的镜像

上一课把网页变成了 Docker 镜像。本课把这份镜像送入 Kind 节点，为下一课部署应用建立可验证的基础：Docker 引擎可达 → 学习集群存在 → API 可达 → 节点 Ready → 节点运行时获得镜像。

以下都是系统终端手工操作，不会由网页自动执行。需要 Docker、Kind、kubectl，以及 [上一课](05-docker-project.md) 的 `opspilot-lab-web:1`。首次创建可能下载较大的 Kind 节点镜像；网络或资源不足时先完成模拟课程，不能把模拟 Ready 当作实机成功。

## 固定目标与工作目录

在 **Opspilot-2 仓库根目录**运行本课命令。如果终端还在上课的 `work/study-web`，macOS/Linux 用 `cd ../..`，Windows PowerShell 用 `Set-Location ../..`。其余单行命令两种系统一致。

目标集群只有 `k8s-lab`，对应 kubeconfig context `kind-k8s-lab`。不会删除现有集群，不把本课多节点扩展练习套到已有集群上。

```text
docker info
kind version
kubectl version --client
kind get clusters
kubectl config get-contexts
```

看 `kind get clusters` 输出：

- 已经有本项目的 `k8s-lab`：复用它，**跳过创建**。
- 没有 `k8s-lab`：执行下面的创建命令一次。
- 同名集群用途不明：先确认归属，不要删除重建，也不要向其中加载或部署。

```text
kind create cluster --name k8s-lab --wait 120s
```

创建会写入 kubeconfig，也可能改变默认 context；后续所有集群查询和写入都显式传 `--context kind-k8s-lab`，不依赖默认值。不必为了本课修改其他 context。

## 区分配置存在和连接成功

```text
kubectl --context kind-k8s-lab cluster-info
kubectl --context kind-k8s-lab get nodes -o wide
kubectl --context kind-k8s-lab wait --for=condition=Ready nodes --all --timeout=120s
kubectl --context kind-k8s-lab -n kube-system get pods -o wide
```

`get-contexts` 是本地文件中的连接配置；`cluster-info` 才联系 API。Kind 节点实际上是 Docker 容器，节点内部还有运行应用容器的运行时，因此电脑 Docker 的镜像列表并不等于节点镜像列表。

预期所有节点 Ready；核心系统 Pod 随初始化最终进入健康状态。刚创建时短暂 Pending 不一定故障；等待超时要查看事件和资源，不能忽略失败继续部署。默认新集群通常只有一个 control-plane 节点；复用集群可能有多个，不能把“必须有三个节点”作为验收条件。

## 加载镜像并在节点确认

```text
docker image inspect opspilot-lab-web:1
kind load docker-image opspilot-lab-web:1 --name k8s-lab
kind get nodes --name k8s-lab
```

镜像名必须与上一课一致；`--name` 选择 Kind 集群，不是 Kubernetes context。加载命令把镜像提供给该集群的节点。下一课明确设置 `imagePullPolicy: IfNotPresent`，避免为这个本地标签强制访问不存在的远端仓库。[Kind 官方快速入门](https://kind.sigs.k8s.io/docs/user/quick-start/)

为了亲眼看见运行时边界，可从 `kind get nodes` 的输出复制一个节点名，将下面的 `NODE_NAME` 替换为它（默认通常是 `k8s-lab-control-plane`）：

```text
docker exec NODE_NAME crictl images
```

这是对刚确认的学习节点的只读检查。找到 `opspilot-lab-web` 的标签 `1`；若有多个节点，可以逐一检查。宿主机镜像 ID 与运行时展示的标识格式可能不同，不要求文本完全一样。本课仅加载，没有创建应用 Pod，应用运行成功的证据要到下一课获取。

## 保留现场的诊断路线

| 现象 | 诊断命令 | 判断与处理 |
| --- | --- | --- |
| Kind 找不到 Docker | `docker info` | 先恢复引擎；客户端版本存在不能替代引擎可达 |
| 有 context，但 API connection refused | `kind get clusters`、`docker ps -a` | 判断集群是否实际存在、节点容器是否运行；不要重复 create |
| `kind-k8s-lab` context 丢失，但集群确实存在 | `kind get clusters` | 确认归属后可运行下方 export 命令恢复本机连接配置 |
| Node NotReady | `kubectl --context kind-k8s-lab describe nodes` | 看 Conditions、容量和事件，再看 kube-system Pod 状态 |
| 系统 Pod Pending | `kubectl --context kind-k8s-lab -n kube-system get events --sort-by=.lastTimestamp` | 检查调度和资源证据；不要只等待或反复重建 |
| 本地镜像不存在 | `docker image inspect opspilot-lab-web:1` | 回上一课完成 build，检查是否切换了 Docker 引擎/context |
| load 成功但下课 ImagePullBackOff | Pod 的 describe 输出和镜像字段 | 核对集群名、标签、拉取策略和节点镜像；不要改为随意拉取 latest |

恢复 kubeconfig 的命令只在上述特定场景使用，会写入本机配置，不会新建集群：

```text
kind export kubeconfig --name k8s-lab
```

需要保存集群诊断包时，先选择不存在的新目录，例如 `work/kind-diagnostics-01`，手工运行：

```text
kind export logs work/kind-diagnostics-01 --name k8s-lab
```

日志可能含本机地址、应用日志等信息，先在本地阅读，分享前检查内容；不用把整个 kubeconfig 上传。

## 验收、边界和下一步

- [ ] 记录集群名、context、实际节点数量，并说明三者区别。
- [ ] API 查询成功，所有节点 Ready，核心系统 Pod 状态已检查。
- [ ] 加载 v1 镜像成功，并在至少一个节点运行时中找到它。
- [ ] 知道本课尚未证明应用 Ready、Service 可用或 HTTP 成功。

保留 `k8s-lab` 和镜像用于 [Kubernetes 综合实验](07-kubernetes-project.md)，本课无需清理集群。Kind 适合本机练习，单机上的多个节点容器不等于多台物理机器的容灾；本课也没有安装 Ingress、生产存储或监控系统。
