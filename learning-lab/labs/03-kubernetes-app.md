# 03 Kubernetes 应用 / Kubernetes App

## 目标 / Goal

理解 Deployment 负责期望状态，Pod 是工作负载实例，Service 提供稳定访问入口。

Understand that a Deployment describes desired state, Pods are workload instances, and a Service provides a stable endpoint.

## 操作 / Do

```bash
kubectl -n learning get deployment,pods,service -o wide
kubectl -n learning describe deployment hello-web
kubectl -n learning scale deployment hello-web --replicas=3
kubectl -n learning rollout status deployment/hello-web
kubectl -n learning get pods
```

## 验收 / Acceptance

- [ ] 扩容后有 3 个 Ready Pod / three Pods are Ready after scaling.
- [ ] 删除一个 Pod 后 Deployment 会补回实例 / deleting one Pod causes replacement.
- [ ] 能说出 Deployment、Pod、Service 的职责 / describe each responsibility.

