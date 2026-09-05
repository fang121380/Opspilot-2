# 02 Kind 集群 / Kind Cluster

## 目标与模式 / Goal and Mode

理解节点、context、命名空间。网页课程模拟一个已经存在的学习集群；下面在电脑真实创建并部署。工作目标固定为 `k8s-lab` / `kind-k8s-lab`，工作负载在 `learning`。

Understand nodes, contexts, and namespaces. The website simulates an existing lab; the following steps create and deploy a real one on the computer. The fixed cluster/context is `k8s-lab` / `kind-k8s-lab`, with workloads in `learning`.

## 操作 / Practice

先完成第 00 课，在仓库根目录执行 `kind get clusters`。若已经有本项目的 `k8s-lab`，跳过创建；否则执行：

Complete lab 00, then run `kind get clusters` from the repository root. Skip creation if this project's `k8s-lab` already exists; otherwise run:

```text
kind create cluster --name k8s-lab --wait 90s
```

创建会增加 kubeconfig 条目，也可能改变默认 context。接下来每条资源命令都显式选择学习目标，不依赖默认值。应用清单会创建或更新命名空间、Deployment 和 Service。

Creation adds kubeconfig entries and may change the default context. Every resource command below explicitly selects the learning target. Applying the manifest creates or updates the namespace, Deployment, and Service.

```text
kubectl config current-context
kubectl --context kind-k8s-lab apply -f learning-lab/manifests/hello-web.yaml
kubectl --context kind-k8s-lab -n learning rollout status deployment/hello-web --timeout=120s
kubectl --context kind-k8s-lab get nodes
kubectl --context kind-k8s-lab get namespaces
kubectl --context kind-k8s-lab -n learning get deployment,pods,service
```

Windows 也可使用 `learning-lab/windows/Start-LearningLab.ps1 -StartUi -StartApi` 完成创建和部署。`current-context` 读取 kubeconfig 默认值，不证明连通；`--context` 仅覆盖本次查询目标，不会改写默认值。

On Windows, `learning-lab/windows/Start-LearningLab.ps1 -StartUi -StartApi` also creates and deploys the lab. `current-context` reads the saved default and does not prove connectivity. `--context` overrides the target for one command without changing that default.

## 验收 / Acceptance

- [ ] 显式目标查询成功，学习节点显示 Ready / The explicit query succeeds and lab nodes are Ready.
- [ ] `learning` 存在，hello-web 为 2/2 Ready、AVAILABLE 2 / Namespace and two ready/available replicas are present.
- [ ] 能解释 namespace 是逻辑分区，node 是计算节点，Pod 是运行单元 / Explain namespace, node, and Pod.
- [ ] 将本机实测结果与网页固定示例分别保存 / Keep real results separate from fixed web examples.
