# 08 排障综合实验：一次就绪探针发布失败的完整闭环

本课将上一课健康的 `study-web` 作为基线，手工把新版本的 readiness 路径改错，然后从更新状态、Pod、事件、日志和 EndpointSlice 判断原因，最后恢复清单并验证。目标是形成“观察 → 假设 → 补证据 → 最小修复 → 恢复验证 → 复盘”的完整过程。

这是**自愿执行的实机故障实验**：只在确认属于自己的 `kind-k8s-lab` / `learning` / `study-web` 上运行。跳过故障注入也可以先阅读和练习模拟。以下写操作只由你在系统终端逐条执行；网页不会代执行，不调用 Opspilot 审批、执行或回滚 API，不操作原来的 `hello-web`。

## 前置基线和工作目录

先完整完成 [Kubernetes 综合实验](07-kubernetes-project.md)，保留 `work/study-web/study-web.yaml`。本课从 **Opspilot-2 仓库根目录**开始；Windows PowerShell 与 macOS/Linux 使用相同单行 kubectl 命令。需要 Docker 引擎和学习集群继续运行，首次准备镜像等步骤可能联网；没有这些条件就先做网页模拟。

```text
kubectl --context kind-k8s-lab -n learning rollout status deployment/study-web --timeout=180s
kubectl --context kind-k8s-lab -n learning get deployment,replicaset,pods -l app=study-web -o wide
kubectl --context kind-k8s-lab -n learning get endpointslices -l kubernetes.io/service-name=study-web -o yaml
kubectl --context kind-k8s-lab -n learning get deployment study-web -o yaml
```

先确认两个 Pod 各 1/1 Ready、Deployment 两个可用副本、实际 readiness 路径 `/`，并检查策略确实是 `maxSurge: 1`、`maxUnavailable: 0`。如果基线不健康，先回上一课排查，不叠加故障。

按上一课启动本机 8093 的 port-forward，访问应返回 HTTP 200 和 config v1 或你已更新的 config v2；记录你自己的实际基线。停止转发后再继续。用编辑器在 `work/study-web/evidence.md` 建立记录，写上时间、context、部署名、正常 Pod 名和页面标记。

## 只改变一个变量

使用编辑器创建新文件 `work/study-web/bad-readiness.yaml`，完整内容如下。不编辑原来的健康清单，这样恢复来源始终清楚：

```yaml
spec:
  template:
    spec:
      containers:
        - name: web
          readinessProbe:
            httpGet:
              path: /this-path-does-not-exist
              port: http
```

这是一份 **strategic merge patch**，不是可独立 apply 的完整 Deployment；按容器名 `web` 合并，只改变该探针路径。它不会修改 startup 或 liveness，因而不要把预期现象写成“容器一定重启”。文件方式避免 PowerShell 与 Bash 的内嵌 JSON 引号差异。

只有决定开始本次故障注入时才手工运行：

```text
kubectl --context kind-k8s-lab -n learning patch deployment study-web --type=strategic --patch-file work/study-web/bad-readiness.yaml
kubectl --context kind-k8s-lab -n learning rollout status deployment/study-web --timeout=45s
```

在其他条件正常且新 Pod 已启动时，第二条预期等待超时：新副本一直无法 Ready。超时是本次观察结果，不要接着反复 patch，也不要删除旧 Pod。45 秒的客户端等待超时不等于 Deployment 已达到清单里的 180 秒进度期限。

## 从症状追到原因

按下面顺序取证，写下输出中的实际名字和时间，不把示例当作真实结果：

```text
kubectl --context kind-k8s-lab -n learning get deployment,replicaset,pods -l app=study-web -o wide
kubectl --context kind-k8s-lab -n learning describe deployment study-web
kubectl --context kind-k8s-lab -n learning describe pods -l app=study-web
kubectl --context kind-k8s-lab -n learning get events --sort-by=.lastTimestamp
kubectl --context kind-k8s-lab -n learning logs -l app=study-web -c web --tail=30 --prefix=true
kubectl --context kind-k8s-lab -n learning get endpointslices -l kubernetes.io/service-name=study-web -o yaml
```

| 证据 | 本次通常看到什么 | 它支持的结论 |
| --- | --- | --- |
| Pod 列表 | 两个旧 Pod 1/1，新 Pod Running 但 0/1 | 运行中不等于就绪；更新未完成 |
| ReplicaSet | 旧修订仍有副本，新修订出现一个副本 | 变更 Pod template 触发新修订，旧版本受更新策略保护 |
| describe 新 Pod | Readiness probe failed，HTTP 404 | 探针访问的地址存在响应，但路径不存在 |
| 应用日志 | 对 `/this-path-does-not-exist` 的 404 请求 | 应用层日志与 kubelet 事件相互印证 |
| Restart Count | 可以仍为 0 | readiness 失败本身不负责重启容器 |
| EndpointSlice | 旧 Pod ready true，新 Pod ready false（在控制器收敛后） | 不就绪新副本不作为普通就绪后端 |

实际节点压力或镜像问题可能使新 Pod Pending，届时先解决对应证据，不能硬套“404 根因”。事件可能聚合或过期，空事件列表不能证明未发生故障。[探针行为说明](https://kubernetes.io/docs/tasks/configure-pod-container/configure-liveness-readiness-probes/)

本实验的关键是：**坏发布可能卡住，而旧版本仍在提供服务**。`maxUnavailable: 0` 留住两个健康旧 Pod，所以不能预言 Service 一定没有后端或用户请求一定失败。要在 EndpointSlice 内按 `targetRef.name` 逐个对应 Pod，不能只看资源数量；未就绪端点可能仍列在 Slice 中，只是 `ready: false`。[EndpointSlice 状态说明](https://kubernetes.io/docs/concepts/services-networking/endpoint-slices/)

把根因写成具体链条：“我改变了新模板的 readiness 路径 → Nginx 对该路径返回 404 → 新 Pod 未 Ready → 更新无法推进；健康旧副本仍保留。”不要写成“网络坏了”或“重启就能好”。

## 修复并验证恢复

确认原始 `study-web.yaml` 仍然是健康配置：readiness `/`，replicas 2，保留你上一课使用的 ConfigMap 版本。手工重新应用它，将错误路径恢复成声明值：

```text
kubectl --context kind-k8s-lab -n learning apply -f work/study-web/study-web.yaml
kubectl --context kind-k8s-lab -n learning rollout status deployment/study-web --timeout=180s
kubectl --context kind-k8s-lab -n learning get deployment,replicaset,pods -l app=study-web -o wide
kubectl --context kind-k8s-lab -n learning get endpointslices -l kubernetes.io/service-name=study-web -o yaml
```

预期更新完成、两个所需副本 Ready，错误修订缩到 0，新的就绪后端与当前 Pod 对应。原有 Warning 事件可能仍保留，这是历史记录；应根据当前 Ready、更新状态、新日志判断恢复，而不是要求历史事件消失。

终端 A 重新运行：

```text
kubectl --context kind-k8s-lab -n learning port-forward --address 127.0.0.1 service/study-web 8093:80
```

终端 B：macOS/Linux 用 `curl -i http://127.0.0.1:8093/`，Windows PowerShell 用 `curl.exe -i http://127.0.0.1:8093/`。记录 HTTP 200 和预期正文标记，再取一次请求日志：

```text
kubectl --context kind-k8s-lab -n learning logs -l app=study-web -c web --tail=20 --prefix=true
```

HTTP 成功仍只验证被 port-forward 选中的一个 Pod 路径，不能代替全部副本、集群 DNS 或生产流量验证。若恢复超时，从新事件重新取证；不要叠加不相关修改。

## 写出可以复查的复盘

把下列问题的答案写入自己的 `evidence.md`：

1. 正常基线是什么，故障注入精确改了哪一个字段？
2. 第一个症状是什么；哪两条独立证据支持根因？
3. 哪些证据排除了“进程退出”和“所有后端都失效”的过度判断？
4. 修复使用哪份健康来源，为什么仅重启不会修好错误模板？
5. 恢复后哪些检查通过；哪些访问路径和风险仍没有验证？

验收必须同时包含：实际错误 Pod 的 0/1、readiness 404 证据、旧副本保留的解释、恢复后的 2/2 与 HTTP 正文。只记“命令运行了”不算排障完成。

最后在转发终端按 Ctrl+C。保留学习集群和健康 `study-web` 供复习；若决定结束全部实机实验，按 [上一课的局部清理](07-kubernetes-project.md) 删除本实验资源。不要删除整个 `learning`、整个 Kind 集群、全部 Pod 或 Docker 数据。故障补丁文件可以保留作笔记，它不会自动再次执行。
