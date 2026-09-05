# 04 故障排查 / Troubleshooting

## 目标与模式 / Goal and Mode

用状态、事件、日志和配置建立故障假设，再验证恢复。网页“故障案例”是定位、修复选择、恢复验证三阶段模拟，不会修改集群。以下手工实验真实修改 `kind-k8s-lab` 的 hello-web 就绪探针，只能在该学习集群执行。

Build a hypothesis from state, events, logs, and configuration, then verify recovery. The website case simulates identification, repair choice, and recovery without changing a cluster. This manual lab changes hello-web's readiness probe only in `kind-k8s-lab`.

## 记录基线 / Capture the Baseline

先完成前面的实验，在仓库根目录应用已知示例配置并检查两个副本就绪。此操作会重置该示例的配置，不能用于其他工作负载。

Complete earlier labs. From the repository root, apply the known sample configuration and verify two ready replicas. This resets this example's configuration and must not target other workloads.

```text
kubectl --context kind-k8s-lab apply -f learning-lab/manifests/hello-web.yaml
kubectl --context kind-k8s-lab -n learning rollout status deployment/hello-web --timeout=120s
kubectl --context kind-k8s-lab -n learning get deployment,pods
kubectl --context kind-k8s-lab -n learning get events --sort-by=.lastTimestamp
kubectl --context kind-k8s-lab -n learning logs deployment/hello-web --tail=20
kubectl --context kind-k8s-lab -n learning rollout history deployment/hello-web
```

`logs deployment/...` 默认选择一个 Pod，不是所有副本的日志。若事件为空，只说明目前没有保留的事件。保留基线时间、修订号和输出。

Deployment logs select one Pod by default, not every replica. Empty events only mean none are currently retained. Record the baseline time, revision, and output.

## 注入与观察 / Introduce and Observe

执行下列 edit 命令，在编辑器中仅将 `spec.template.spec.containers` 下 nginx 的 `readinessProbe.httpGet.path` 从 `/` 改为 `/missing`。不要修改端口、镜像或其他字段。确认保存后观察新 Pod；出现 0/1 后按 Ctrl+C 结束 watch，再读取详情和事件。

Run edit below. In the editor, change only nginx's `readinessProbe.httpGet.path` under `spec.template.spec.containers` from `/` to `/missing`. Keep the port, image, and other fields unchanged. After applying the edit, watch new Pods; stop watch with Ctrl+C after observing 0/1, then inspect details and events.

```text
kubectl --context kind-k8s-lab -n learning edit deployment hello-web
kubectl --context kind-k8s-lab -n learning get pods -w
kubectl --context kind-k8s-lab -n learning describe pod -l app=hello-web
kubectl --context kind-k8s-lab -n learning get events --sort-by=.lastTimestamp
```

寻找新 Pod 的 Running、0/1 和探针 HTTP 404 证据。就绪探针失败不会直接重启容器；滚动更新可能保留旧的就绪副本，因此不能推断整个 Service 已中断。`CrashLoopBackOff` 是容器等待原因，不是 Pod 生命周期 phase。

Look for Running, 0/1, and probe HTTP 404 on new Pods. Readiness failure does not directly restart a container. A rolling update may retain old ready replicas, so do not infer a complete Service outage. CrashLoopBackOff is a container waiting reason, not a Pod lifecycle phase.

## 恢复与验收 / Restore and Verify

未进行其他部署修改时，撤销本次探针变更 / If no other deployment changes occurred, undo this probe change:

```text
kubectl --context kind-k8s-lab -n learning rollout undo deployment/hello-web
kubectl --context kind-k8s-lab -n learning rollout status deployment/hello-web --timeout=120s
kubectl --context kind-k8s-lab -n learning get deployment,pods
kubectl --context kind-k8s-lab -n learning describe pod -l app=hello-web
kubectl --context kind-k8s-lab -n learning get events --sort-by=.lastTimestamp
```

若中途有其他改动，先核对 rollout history 与基线修订，不要盲目撤销。恢复后重复第 03 课的端口转发请求，在至少几个探针周期内观察是否出现新的 Unhealthy；旧 Warning 可以仍在列表中。

If other edits occurred, compare rollout history with the baseline before undoing. After recovery, repeat lab 03's forwarded request and observe several probe periods for new Unhealthy events. Historical warnings may remain.

- [ ] 用配置、0/1 和 404 共同解释假设，不凭 Running 判定健康 / Explain the hypothesis using configuration, readiness, and 404.
- [ ] 修复后 Deployment 2/2、Pod 容器 1/1，观察窗口没有新增探针失败 / Verify ready replicas and no new probe failures during observation.
- [ ] 实际转发请求返回 200，并记录该验证不覆盖全部服务路径 / Record HTTP 200 and its limited scope.
- [ ] 保留修复前后输出和时间，没有操作其他集群 / Keep before/after evidence without touching other clusters.
