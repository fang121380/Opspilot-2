# 02 Kind 集群 / Kind Cluster

## 目标 / Goal

理解 Kind 节点、kubectl context、Namespace 的关系。

Understand the relationship between Kind nodes, the kubectl context, and namespaces.

## 操作 / Do

```bash
cd learning-lab
make up
kubectl config current-context
kubectl get nodes
kubectl get namespaces
kubectl -n learning get all
```

工作台使用 `kind-k8s-lab` context 和 `learning` namespace。切换 context 前先确认名称，避免误操作其他集群。

The lab uses the `kind-k8s-lab` context and `learning` namespace. Confirm the context name before switching so other clusters are not changed accidentally.

## 验收 / Acceptance

- [ ] `kubectl get nodes` 显示 Ready / nodes are Ready.
- [ ] `hello-web` Deployment 有 2 个可用副本 / Deployment has two available replicas.
- [ ] 能解释 node、namespace、pod 的区别 / explain node, namespace, and pod.

