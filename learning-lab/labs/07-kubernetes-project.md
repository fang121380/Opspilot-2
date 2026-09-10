# 07 Kubernetes 综合实验：从镜像到可验证的服务

上一课把镜像装入 Kind 节点，本课把它变成声明式管理的应用，串起 ConfigMap、Deployment、ReplicaSet、Pod、探针、资源请求、Service 和 EndpointSlice。最后用真实 HTTP 验证一个明确的访问路径，再练习配置更新与副本恢复。

这些操作只在电脑系统终端手工执行。前置条件是 [Kind 综合实验](06-kind-project.md) 已验收，`opspilot-lab-web:1` 已加载，所有节点 Ready。没有实机环境时先做网页模拟。涉及镜像或集群首次准备时仍可能需要网络。

## 先确认范围，再创建文件

在 **Opspilot-2 仓库根目录**运行本课命令。Windows PowerShell 与 macOS/Linux 的单行 `kubectl` 命令一致；HTTP 请求的区别在后文说明。

```text
kubectl --context kind-k8s-lab get nodes
kubectl --context kind-k8s-lab get namespace learning
kubectl --context kind-k8s-lab -n learning get deployment,service,configmap
```

如果 `learning` 不存在，只在明确输出 NotFound 时创建；连接失败或 Forbidden 不能当作不存在：

```text
kubectl --context kind-k8s-lab create namespace learning
```

本课只使用 `study-web` 这个独立应用；不会修改工作台原来的 `hello-web`。若 `study-web` Deployment、Service 或 ConfigMap 已存在，先核对它们是否为自己的前次练习；用途不明时不要 apply 覆盖。

在上一课已有的 `work/study-web` 目录内，用编辑器创建 `study-web.yaml`，完整内容如下（保留缩进，UTF-8 保存）：

```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: study-web
  namespace: learning
  labels:
    app: study-web
data:
  index.html: |
    <!doctype html>
    <html lang="zh-CN">
      <head><meta charset="utf-8"><title>Study web</title></head>
      <body><h1>Opspilot study web config v1</h1></body>
    </html>
---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: study-web
  namespace: learning
  labels:
    app: study-web
spec:
  replicas: 2
  revisionHistoryLimit: 3
  progressDeadlineSeconds: 180
  strategy:
    type: RollingUpdate
    rollingUpdate:
      maxSurge: 1
      maxUnavailable: 0
  selector:
    matchLabels:
      app: study-web
  template:
    metadata:
      labels:
        app: study-web
    spec:
      containers:
        - name: web
          image: opspilot-lab-web:1
          imagePullPolicy: IfNotPresent
          ports:
            - name: http
              containerPort: 80
          resources:
            requests:
              cpu: 50m
              memory: 32Mi
            limits:
              cpu: 250m
              memory: 128Mi
          startupProbe:
            httpGet:
              path: /
              port: http
            periodSeconds: 2
            failureThreshold: 30
          readinessProbe:
            httpGet:
              path: /
              port: http
            periodSeconds: 5
            failureThreshold: 2
          livenessProbe:
            httpGet:
              path: /
              port: http
            periodSeconds: 10
            failureThreshold: 3
          volumeMounts:
            - name: website
              mountPath: /usr/share/nginx/html
              readOnly: true
      volumes:
        - name: website
          configMap:
            name: study-web
---
apiVersion: v1
kind: Service
metadata:
  name: study-web
  namespace: learning
  labels:
    app: study-web
spec:
  type: ClusterIP
  selector:
    app: study-web
  ports:
    - name: http
      port: 80
      targetPort: http
```

先把字段与行为对上：

| 字段 | 在本实验中的作用 |
| --- | --- |
| ConfigMap + volumeMount | 将配置中的网页作为只读文件挂载，遮住镜像在该目录原有的文件，因此页面显示 config v1 |
| Deployment selector 与 Pod labels | 控制器通过标签管理自己的 Pod；Service 用同一标签找到候选后端 |
| replicas: 2 | 期望两个 Pod；不是“这个 Pod 内有两个容器” |
| maxSurge: 1 / maxUnavailable: 0 | 更新时可多一个 Pod，健康旧副本会在新副本可用后才逐步替换 |
| requests / limits | 每容器预留调度需求为 0.05 CPU、32 MiB，限制为 0.25 CPU、128 MiB；CPU 限制可节流，内存超限可能 OOM |
| startup / readiness / liveness | 分别判断启动、是否接流量、是否需要重启；启动探针成功后其他探针才开始 |
| Service port / targetPort | Service 的 80 转到 Pod 名为 http 的端口，即容器 80；不是电脑的 80 |

这是小型静态网页的教学参数，不是生产容量结论；生产请求和限制要根据实际测量调整。探针也应反映应用职责，不能把这里的 `/` 不加判断地复制到所有服务。[Kubernetes 探针说明](https://kubernetes.io/docs/tasks/configure-pod-container/configure-liveness-readiness-probes/)

## 应用清单，逐层验证

仍在仓库根目录，先请求服务端验证，再执行真实写入：

```text
kubectl --context kind-k8s-lab -n learning apply --dry-run=server -f work/study-web/study-web.yaml
kubectl --context kind-k8s-lab -n learning apply -f work/study-web/study-web.yaml
kubectl --context kind-k8s-lab -n learning rollout status deployment/study-web --timeout=180s
kubectl --context kind-k8s-lab -n learning get deployment,replicaset,pods,service -l app=study-web -o wide
kubectl --context kind-k8s-lab -n learning describe deployment study-web
kubectl --context kind-k8s-lab -n learning get endpointslices -l kubernetes.io/service-name=study-web -o yaml
```

dry-run 检查 API 接受程度，不会证明镜像能启动或探针能通过。正常验收是 Deployment 2/2 Ready、两个 Pod 各 1/1 Ready；ReplicaSet 说明谁创建和管理了 Pod。EndpointSlice 中查看 `addresses`、`targetRef.name`、`conditions.ready`，应能和 Pod IP、名称对应，正常后端 ready 为 true。Service 对象存在不表示已找到健康后端。[EndpointSlice 说明](https://kubernetes.io/docs/concepts/services-networking/endpoint-slices/)

## 从电脑访问，并说明验证边界

终端 A：

```text
kubectl --context kind-k8s-lab -n learning port-forward --address 127.0.0.1 service/study-web 8093:80
```

终端保持运行；若 8093 被占用，保留原服务，换空闲端口并同步修改 URL。终端 B 在任意目录请求：

macOS/Linux：

```bash
curl -i http://127.0.0.1:8093/
```

Windows PowerShell：

```powershell
curl.exe -i http://127.0.0.1:8093/
```

预期 HTTP 200，正文包含 `Opspilot study web config v1`。再在终端 B 查询请求日志：

```text
kubectl --context kind-k8s-lab -n learning logs -l app=study-web -c web --tail=20 --prefix=true
```

`port-forward service/...` 会选择一个 Pod 转发，它不走普通 ClusterIP 负载均衡路径。该请求证明一个被选中 Pod 可经 API 转发访问，**没有证明集群 DNS、Service 全部后端、Ingress、跨节点网络或公网可用**。副本重建后转发可能退出，需重新启动；没有错误提示不等于终端仍在转发。

## 配置变更和副本实验

先在终端 A 按 Ctrl+C 停止转发。把本地 `study-web.yaml` 中 ConfigMap 的正文标记从 `config v1` 改为 `config v2`，其余内容保留。执行：

```text
kubectl --context kind-k8s-lab -n learning apply -f work/study-web/study-web.yaml
kubectl --context kind-k8s-lab -n learning get configmap study-web -o yaml
```

这不是改镜像：同一个 v1 镜像可以配上不同配置。整目录挂载的 ConfigMap 文件通常会在一段传播延迟后更新，但更新 ConfigMap 不自动产生 Deployment 新修订；环境变量注入和 subPath 挂载也不能假设会实时刷新。为使本次练习的更新过程可明确等待，手工重启这个专用 Deployment：

```text
kubectl --context kind-k8s-lab -n learning rollout restart deployment/study-web
kubectl --context kind-k8s-lab -n learning rollout status deployment/study-web --timeout=180s
kubectl --context kind-k8s-lab -n learning get pods -l app=study-web
```

重新运行上一节的 port-forward 和 HTTP 请求，预期正文变成 config v2。这证明新 Pod 使用了当前配置；若要同时回退应用和配置，必须分别管理镜像与配置版本，Deployment 历史不会备份 ConfigMap 数据。[ConfigMap 使用说明](https://kubernetes.io/docs/tasks/configure-pod-container/configure-pod-configmap/)

停止转发后练习扩容并恢复（会临时增加一个 Pod，资源不足可跳过并记录原因）：

```text
kubectl --context kind-k8s-lab -n learning scale deployment study-web --replicas=3
kubectl --context kind-k8s-lab -n learning rollout status deployment/study-web --timeout=180s
kubectl --context kind-k8s-lab -n learning get pods -l app=study-web
kubectl --context kind-k8s-lab -n learning apply -f work/study-web/study-web.yaml
kubectl --context kind-k8s-lab -n learning rollout status deployment/study-web --timeout=180s
```

预期先有 3 个 Ready Pod，再由清单的 `replicas: 2` 恢复到 2 个。临时命令改的是运行中状态；保留清单中的期望值，才能解释为什么下一次 apply 会恢复两个副本。

## 存储专题：删除消费者 Pod，数据还能读到吗

这一节把配置文件与业务数据分开。新建独立的 `study-storage` Pod 和 `study-data` PVC，不改 `study-web`。仍在仓库根目录操作，先查集群到底提供了什么存储：

```text
kubectl --context kind-k8s-lab get storageclasses
kubectl --context kind-k8s-lab get storageclass standard -o yaml
kubectl --context kind-k8s-lab -n learning get pvc study-data
kubectl --context kind-k8s-lab -n learning get pod study-storage
```

首次出现 PVC/Pod NotFound 是预期；若名称已存在，先核对是否自己的旧练习，不覆盖未知数据。下面清单使用 `standard`：只有实际存在且供给器可用时才执行。如果实际可用类叫其他名字，先把清单的 `storageClassName` 改为该名字；如果完全没有可用 StorageClass，记录这个缺口，先阅读本节，不自动安装存储插件，也不创建随意指向主机目录的 PV。

从 StorageClass 中记下 `provisioner`、`volumeBindingMode`、`reclaimPolicy`。`WaitForFirstConsumer` 表示通常等消费 Pod 参与调度后才绑定，不能只创建 PVC 然后因它 Pending 就判定损坏。Kind 常见的 local-path 供给器把数据放在节点容器内，PV 的节点约束会影响 Pod 调度；它不是跨节点共享存储，删除 Kind 节点或集群不能指望保住唯一数据副本。[StorageClass 说明](https://kubernetes.io/docs/concepts/storage/storage-classes/)

创建 `work/study-web/study-storage.yaml`，完整内容：

```yaml
apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: study-data
  namespace: learning
  labels:
    app: study-storage
spec:
  accessModes:
    - ReadWriteOnce
  storageClassName: standard
  resources:
    requests:
      storage: 64Mi
---
apiVersion: v1
kind: Pod
metadata:
  name: study-storage
  namespace: learning
  labels:
    app: study-storage
spec:
  automountServiceAccountToken: false
  containers:
    - name: reader
      image: opspilot-lab-web:1
      imagePullPolicy: IfNotPresent
      command: ["sh", "-c"]
      args: ["echo study-storage-ready; exec sleep 86400"]
      resources:
        requests:
          cpu: 10m
          memory: 16Mi
        limits:
          cpu: 100m
          memory: 64Mi
      volumeMounts:
        - name: records
          mountPath: /data
  volumes:
    - name: records
      persistentVolumeClaim:
        claimName: study-data
```

复用前面已经导入的 Alpine Nginx 镜像，覆盖启动命令为一个输出标记后等待的进程，所以这个 Pod 不提供网页。`sh` 和 `sleep` 来自该镜像；不同镜像不保证带有它们。存储供给器可能还会拉取自己的辅助镜像，因此已有应用镜像也不能保证整个步骤离线。该练习 Pod 不需要访问 Kubernetes API，所以不挂载服务账户令牌。

```text
kubectl --context kind-k8s-lab -n learning apply --dry-run=server -f work/study-web/study-storage.yaml
kubectl --context kind-k8s-lab -n learning apply -f work/study-web/study-storage.yaml
kubectl --context kind-k8s-lab -n learning wait --for=condition=Ready pod/study-storage --timeout=180s
kubectl --context kind-k8s-lab -n learning get pvc study-data -o wide
kubectl --context kind-k8s-lab -n learning get pod study-storage -o wide
kubectl --context kind-k8s-lab -n learning logs study-storage -c reader
```

预期 PVC Bound、Pod Ready，日志含 `study-storage-ready`。这个 Pod 没有健康探针，Ready 仅表明容器就绪条件，不证明文件可读写。复制 PVC 输出中的真实 PV 名，把下方 `PV_NAME` 替换后查询：

```text
kubectl --context kind-k8s-lab get pv PV_NAME -o yaml
```

记下 PVC UID、PV 名、回收策略、节点亲和性。64Mi 是请求值，实际容量和是否严格限制目录大小取决于存储实现，不能用本例判断磁盘配额。ReadWriteOnce 限制的是单节点读写挂载，不能直接等同于“最多一个 Pod”。

确认这是自己的新卷后，手工写一份可丢弃的标记。下列命令在 PowerShell 与 macOS/Linux 均可逐行使用；重定向位于传给容器的双引号中，不会在电脑当前目录写文件：

```text
kubectl --context kind-k8s-lab -n learning exec study-storage -c reader -- sh -c "echo study-pvc-survives-pod-recreation > /data/evidence.txt"
kubectl --context kind-k8s-lab -n learning exec study-storage -c reader -- cat /data/evidence.txt
kubectl --context kind-k8s-lab -n learning get pod study-storage -o yaml
```

记录 Pod 的 `metadata.uid` 和读出的正文。接下来会**删除本专题消费者 Pod**，但保留 PVC 和 PV；只在已经确认资源归属并保存证据后执行：

```text
kubectl --context kind-k8s-lab -n learning delete pod study-storage --wait=true
kubectl --context kind-k8s-lab -n learning get pvc study-data
kubectl --context kind-k8s-lab -n learning apply -f work/study-web/study-storage.yaml
kubectl --context kind-k8s-lab -n learning wait --for=condition=Ready pod/study-storage --timeout=180s
kubectl --context kind-k8s-lab -n learning get pod study-storage -o yaml
kubectl --context kind-k8s-lab -n learning exec study-storage -c reader -- cat /data/evidence.txt
```

预期 Pod 名一样但 UID 不同，PVC 仍绑定原 PV，新 Pod 读到同一标记。这组证据证明在**保留此 PVC、PV 和其底层存储**的条件下，Pod 替换后文件保留；没有证明删 PVC 后恢复、跨机器容灾或数据库一致性备份。若改用 emptyDir，Pod 删除会丢失该卷数据，即使新 Pod 名字一样也不会找回。

若 PVC 或 Pod 一直 Pending，分别执行 `kubectl --context kind-k8s-lab -n learning describe pvc study-data` 和 `kubectl --context kind-k8s-lab -n learning describe pod study-storage`：区分等待消费者、没有供给器、辅助镜像下载失败、节点约束与挂载错误。写文件遇到 Permission denied 时，核对容器用户和卷目录权限，不直接改成特权 Pod。不要把删除 PVC 当成第一种排障动作。

## 权限专题：一个账户只读指定 Pod

前面一直使用电脑 kubeconfig 的身份。现在创建独立的 `study-reader` ServiceAccount、Role、RoleBinding，让它只能读取 `study-storage` Pod 及该 Pod 日志；不允许列举全部 Pod、读取 Secret、进入容器或修改 Deployment。

需要当前学习集群身份有创建这些 RBAC 对象的权限，并有 impersonate 服务账户的权限。Kind 默认管理凭据通常具备，但应按实际结果判断；如果提示不能 impersonate 或不能创建角色，请保留错误，不自行扩大到 cluster-admin。这里的 `--as` 是管理身份发起的模拟身份请求，**不等于用该服务账户自己的令牌登录**；本节不生成、不复制令牌。

先检查专用对象是否已经存在，并确认是自己的练习：

```text
kubectl --context kind-k8s-lab -n learning get serviceaccount,role,rolebinding study-reader
```

创建 `work/study-web/study-reader.yaml`，完整内容如下。故意把 Role 和绑定分开列出：只有 Role 而没有绑定，不会把权限授予任何账户。

```yaml
apiVersion: v1
kind: ServiceAccount
metadata:
  name: study-reader
  namespace: learning
automountServiceAccountToken: false
---
apiVersion: rbac.authorization.k8s.io/v1
kind: Role
metadata:
  name: study-reader
  namespace: learning
rules:
  - apiGroups: [""]
    resources: ["pods", "pods/log"]
    resourceNames: ["study-storage"]
    verbs: ["get"]
---
apiVersion: rbac.authorization.k8s.io/v1
kind: RoleBinding
metadata:
  name: study-reader
  namespace: learning
subjects:
  - kind: ServiceAccount
    name: study-reader
    namespace: learning
roleRef:
  apiGroup: rbac.authorization.k8s.io
  kind: Role
  name: study-reader
```

Role 的 `resourceNames` 限定对象名，`verbs` 限定动作；`pods/log` 是独立子资源，读取 Pod 的权限不会自动包含日志。RoleBinding 的 subject 指定谁得到权限，roleRef 指定授予哪份规则。这里通过精确名称避免给诊断助手整个命名空间的访问权。[RBAC 官方说明](https://kubernetes.io/docs/reference/access-authn-authz/rbac/)

```text
kubectl --context kind-k8s-lab -n learning apply --dry-run=server -f work/study-web/study-reader.yaml
kubectl --context kind-k8s-lab -n learning apply -f work/study-web/study-reader.yaml
kubectl --context kind-k8s-lab -n learning auth can-i get pods/study-storage --as=system:serviceaccount:learning:study-reader
kubectl --context kind-k8s-lab -n learning auth can-i list pods --as=system:serviceaccount:learning:study-reader
kubectl --context kind-k8s-lab -n learning auth can-i get secrets --as=system:serviceaccount:learning:study-reader
kubectl --context kind-k8s-lab -n learning auth can-i patch deployments/study-web --as=system:serviceaccount:learning:study-reader
```

预期依次 `yes`、`no`、`no`、`no`。`no` 命令可返回非零退出码，是权限拒绝的预期证据；逐条读取，不要用“遇到非零就停止”的批处理包起来。若拒绝项意外为 yes，检查学习集群是否还有其他 RoleBinding/ClusterRoleBinding 为这个身份或所属组授予权限；RBAC 允许规则会累加，新增一个窄 Role 不会抵消其他宽授权。[can-i 命令说明](https://kubernetes.io/docs/reference/kubectl/generated/kubectl_auth/kubectl_auth_can-i/)

再做一次真正的读取请求，并对照权限自查：

```text
kubectl --context kind-k8s-lab -n learning get pod study-storage --as=system:serviceaccount:learning:study-reader
kubectl --context kind-k8s-lab -n learning logs study-storage -c reader --as=system:serviceaccount:learning:study-reader
kubectl --context kind-k8s-lab -n learning get pods --as=system:serviceaccount:learning:study-reader
```

前两条应成功，日志包含 `study-storage-ready`；最后一条预期 Forbidden，因为它是 `list`，不是对特定名字的 `get`。这里读取集群是真实请求，但认证仍由具有 impersonate 权限的当前用户完成。`can-i` 单独只能回答授权判断，不能证明对象存在、HTTP/日志内容正确、服务账户令牌有效或应用真的在使用该账户。也不要运行真实 patch 来“试试会不会被拒绝”，权限自查已足够验证禁止写入的设计。

如果只能得到 impersonation Forbidden，无法据此断定目标账户本身不能读取 Pod；先分清“调用人能否模拟这个身份”和“这个身份能否执行目标动作”。本节没有把 `study-storage` 绑定到 study-reader，也没有赋予该 Pod API 凭据，这样能保持文件读写与权限实验的边界清楚。

## 失败定位、验收和清理

| 现象 | 首个证据入口 | 如何缩小范围 |
| --- | --- | --- |
| Pending | `kubectl --context kind-k8s-lab -n learning describe pods -l app=study-web` | 看 FailedScheduling、资源不足、挂载失败，不先怀疑网页代码 |
| ImagePullBackOff / ErrImagePull | 同上，查看镜像与事件 | 回第 06 课核对节点镜像和 IfNotPresent；本地标签没有远程仓库可供下载 |
| Running 但 0/1 Ready | 同上，查看探针失败 | 核对路径、端口、配置文件和容器日志 |
| Service 没有 ready 后端 | Service selector、Pod labels 和 EndpointSlice | 先分清标签未匹配还是探针失败 |
| port-forward 退出 | 转发终端输出、Pod 是否被替换 | 重新确认 Ready 后启动转发，不只刷新浏览器 |
| 页面是镜像 v1 而不是 config v1/v2 | Deployment 的 mounts 和 ConfigMap | 检查是否应用了完整清单，是否访问了 Docker 的 8090 |

- [ ] 能按“Deployment → ReplicaSet → Pod”和“Service → 标签 → EndpointSlice”两条关系解释实际输出。
- [ ] 两个 Pod Ready，后端状态对应，HTTP 返回期望配置标记，日志包含请求。
- [ ] 配置修改后重新验证；扩容实验后恢复 2 个副本。
- [ ] 存储专题记录原、新 Pod UID、同一个 PVC/PV 和重建后读回的相同文件；没有可用 StorageClass 时明确记录该专题未实机验收。
- [ ] 权限专题记录指定 Pod 读取成功、列表被拒绝和其他 can-i 拒绝结果，并说明 impersonation 与实际令牌认证的区别。
- [ ] 清楚 ConfigMap 是配置，PVC 提供存储引用；文件保留不等于数据库一致性、备份恢复或跨节点容灾已验证。

下一课要复用这些资源，请先保留。全部实验结束后，如确定不再需要，才在仓库根目录手工执行以下命令删除**本实验三个资源**，清单中没有 Namespace，因而不会删除共享的 `learning` 或 `hello-web`：

```text
kubectl --context kind-k8s-lab -n learning delete -f work/study-web/study-web.yaml
```

专题结束后，仅当确定不再复习时，可以分别移除消费者和本节创建的权限对象，**默认保留 PVC 中的文件**：

```text
kubectl --context kind-k8s-lab -n learning delete pod study-storage
kubectl --context kind-k8s-lab -n learning delete -f work/study-web/study-reader.yaml
kubectl --context kind-k8s-lab -n learning get pvc study-data
```

不要用 `delete -f study-storage.yaml` 代替上述清理，因为该文件包含 PVC。仅在你明确决定丢弃本专题数据、已检查实际 PV 回收策略并接受底层数据可能一起删除后，才单独运行 `kubectl --context kind-k8s-lab -n learning delete pvc study-data`。本节不删除 PV、StorageClass、Namespace、其他应用或整个学习集群。

继续 [排障综合实验](08-troubleshooting-project.md)，把本节健康证据作为基线。
