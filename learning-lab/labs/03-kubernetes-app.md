# 03 Kubernetes 应用 / Kubernetes Application

## 目标与模式 / Goal and Mode

Deployment 通过 ReplicaSet 维持期望 Pod 副本；Pod 包含运行中的容器；Service 提供稳定网络入口。网页课程只读模拟部署结果。下面的手工实验会扩容真实 `kind-k8s-lab` 中的 hello-web，完成后恢复两个副本。

A Deployment uses ReplicaSets to maintain desired Pod replicas; Pods contain containers; a Service provides a stable network entry. The web lesson only simulates inspection. This manual lab scales the real hello-web in `kind-k8s-lab`, then restores two replicas.

## 操作 / Practice

先完成第 02 课 / Complete lab 02 first:

```text
kubectl --context kind-k8s-lab -n learning get deployment,pods,service -o wide
kubectl --context kind-k8s-lab -n learning describe deployment hello-web
kubectl --context kind-k8s-lab -n learning scale deployment hello-web --replicas=3
kubectl --context kind-k8s-lab -n learning rollout status deployment/hello-web --timeout=120s
kubectl --context kind-k8s-lab -n learning get deployment,pods
kubectl --context kind-k8s-lab -n learning port-forward service/hello-web 8088:80
```

保持转发终端运行。另开终端，在 macOS 用 `curl -I http://127.0.0.1:8088`，Windows 用 `curl.exe -I http://127.0.0.1:8088`。这条请求验证一个转发路径，不等于已测试 Service 所有后端、集群 DNS 或公网连通。ClusterIP 默认仅供集群内部访问。

Keep port-forward running. In another terminal, use `curl -I http://127.0.0.1:8088` on macOS or `curl.exe -I http://127.0.0.1:8088` on Windows. This verifies one forwarded path, not every Service backend, cluster DNS, or public reachability. ClusterIP is normally internal to the cluster.

按 Ctrl+C 结束转发，恢复副本数 / Stop forwarding with Ctrl+C and restore replicas:

```text
kubectl --context kind-k8s-lab -n learning scale deployment hello-web --replicas=2
kubectl --context kind-k8s-lab -n learning rollout status deployment/hello-web --timeout=120s
kubectl --context kind-k8s-lab -n learning get deployment,pods
```

## 验收 / Acceptance

- [ ] 扩容后 Deployment 为 3/3，三个 Pod 的容器就绪为 1/1 / Observe three ready replicas and 1/1 containers.
- [ ] 本次转发请求成功，能说明这个证据的访问范围 / Verify the forwarded request and explain its limits.
- [ ] 实验结束恢复 2/2；没有删除其他 Pod 或资源 / Restore two replicas without deleting other resources.
- [ ] 能解释 Running 不保证 Ready，Service 存在不保证全部业务健康 / Explain Running versus Ready and Service versus business health.
