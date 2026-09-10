# 从服务到任务，再到有状态成员

本手册衔接「工作负载控制器」和「存储与数据生命周期」。你将手动运行一个会结束的任务，从暂停的定时任务模板触发一轮执行，再观察有状态成员替换后如何找回自己的文件。网页模拟终端不会执行下面的命令；这些步骤需要你在电脑系统终端主动操作。预计 60–90 分钟，首次下载镜像可能更久。

验收的重点不是把 YAML 提交成功，而是能回答：什么叫做完、重试会不会重复做事、哪个名字对应哪份数据、什么证据仍不足以证明高可用。

## 1. 准备环境与独立文件

先完成 [Kind 实机链](06-kind-project.md) 与 [Kubernetes 实机链](07-kubernetes-project.md)。要求 Docker 引擎可用，Kind 集群名为 `k8s-lab`，`learning` 命名空间已经存在，节点能拉取 `busybox:1.36.1`。本手册使用 Kubernetes 1.27 及以上的 CronJob `timeZone` 字段。

在项目根目录新建一个空的 `work/workload-patterns` 文件夹；通过编辑器保存下文文件。已有同名文件时先检查内容或另选目录，不覆盖自己旧的练习。以下命令均为单行，适用于 macOS 终端和 Windows PowerShell，无需复制续行符、终端提示符或使用 Bash heredoc。

```text
kubectl config get-contexts kind-k8s-lab
kubectl --context kind-k8s-lab version
kubectl --context kind-k8s-lab get nodes
kubectl --context kind-k8s-lab get namespace learning
kubectl --context kind-k8s-lab get storageclass
kubectl --context kind-k8s-lab -n learning get job,cronjob,statefulset,service,pvc
```

检查存在名为 `standard` 的 StorageClass，再读取它的 provisioner 和绑定策略：

```text
kubectl --context kind-k8s-lab get storageclass standard -o yaml
```

本模板显式使用 `standard`，不依赖默认类的选择。若它不存在或供应程序不可用，先完成存储课排查；不要仅为了使练习通过而修改集群默认类。若有经过验证的其他类，只修改本手册文件里的 `storageClassName`。`WaitForFirstConsumer` 表示通常要等使用它的 Pod 参与调度后才绑定，孤立 PVC Pending 不能立即判定故障。

确认 `study-batch`、`study-clock`、`study-clock-manual`、`study-stateful` 和 `data-study-stateful-0/1` 不是别人的资源。若同名资源已经存在，只在确认是你自己的本手册练习后继续。不要删除命名空间或其他课程中的 `web` 资源。

## 2. Job：从退出码到业务验收

将下面完整内容保存为 `work/workload-patterns/study-batch.yaml`：

```yaml
apiVersion: batch/v1
kind: Job
metadata:
  name: study-batch
  namespace: learning
spec:
  completions: 1
  parallelism: 1
  backoffLimit: 2
  activeDeadlineSeconds: 120
  template:
    metadata:
      labels:
        app: study-batch
    spec:
      restartPolicy: Never
      containers:
        - name: report
          image: busybox:1.36.1
          command: ["sh", "-c"]
          args:
            - |
              set -eu
              printf 'order_id\n101\n102\n103\n' > /tmp/report.csv
              test "$(wc -l < /tmp/report.csv)" -eq 4
              echo 'report sample-orders: 3 rows'
              echo 'report validation passed'
          resources:
            requests:
              cpu: 10m
              memory: 16Mi
            limits:
              cpu: 100m
              memory: 32Mi
```

YAML 内的 `sh` 在 Linux 容器中执行，因此 Windows 用户也原样保存。它生成一份只有表头和三条订单的小文件，检查四行后才返回成功。文件位于容器临时目录，任务清理后不保留；这是练习退出与校验，真实报表应写到合适的持久存储并校验具体内容。

```text
kubectl --context kind-k8s-lab -n learning apply -f work/workload-patterns/study-batch.yaml
kubectl --context kind-k8s-lab -n learning wait --for=condition=complete job/study-batch --timeout=150s
kubectl --context kind-k8s-lab -n learning get job study-batch -o yaml
kubectl --context kind-k8s-lab -n learning get pods -l job-name=study-batch
kubectl --context kind-k8s-lab -n learning logs job/study-batch
```

正常时，Job 的 `status.succeeded` 为 `1`，条件包含 `type: Complete` 和 `status: "True"`，Pod 为 `Completed`，日志包含 `report validation passed`。名称后缀和时间由集群产生，不要求与网页教学快照相同。

如果等待超时，先读 Job、Pod 和事件，不要反复 apply：

```text
kubectl --context kind-k8s-lab -n learning describe job study-batch
kubectl --context kind-k8s-lab -n learning describe pods -l job-name=study-batch
kubectl --context kind-k8s-lab -n learning get events --sort-by=.metadata.creationTimestamp
```

`ErrImagePull`/`ImagePullBackOff` 先检查镜像下载；首次拉取超过 120 秒也可能使 Job 达到 `activeDeadlineSeconds`。`Failed` 则结合退出码、日志与条件确认原因。`backoffLimit` 限制失败重试，`activeDeadlineSeconds` 限制总执行时间，两者不是同一件事。Job 终结后重新 apply 同一个文件不会自动再执行一次；更改大部分 Pod 模板字段还可能被拒绝为不可变。

可选的失败观察：复制上述文件为 `study-batch-fail.yaml`，只把资源名改成 `study-batch-fail`，将 args 的整个多行脚本换成 `echo 'intentional failure'; exit 1`，保持有限的重试和总超时；先确认该新名字没有被占用，再 apply 新文件。用 `get job study-batch-fail -o yaml` 和 `get pods -l job-name=study-batch-fail` 观察失败尝试，读取列表中每个失败 Pod 的日志；最终以 `Failed` 条件判断终结，不要求某个版本恰好显示固定数量的 Pod。不要对失败任务等待 Complete。练完只删除自己的 `job/study-batch-fail`。

思考：如果程序在写入结果后、报告成功前中断，重试会发生什么？真实业务应使用如「报表日期＋业务范围」的唯一键与事务来避免重复副作用，不能仅靠 `parallelism: 1` 宣称恰好一次。

## 3. CronJob：先暂停，再手动验证模板

保存为 `work/workload-patterns/study-clock.yaml`：

```yaml
apiVersion: batch/v1
kind: CronJob
metadata:
  name: study-clock
  namespace: learning
spec:
  schedule: "*/5 * * * *"
  timeZone: Etc/UTC
  suspend: true
  concurrencyPolicy: Forbid
  startingDeadlineSeconds: 60
  successfulJobsHistoryLimit: 1
  failedJobsHistoryLimit: 1
  jobTemplate:
    spec:
      backoffLimit: 1
      activeDeadlineSeconds: 120
      template:
        metadata:
          labels:
            app: study-clock
        spec:
          restartPolicy: Never
          containers:
            - name: clock
              image: busybox:1.36.1
              command: ["sh", "-c"]
              args:
                - |
                  set -eu
                  date -u
                  echo 'clock sample completed'
              resources:
                requests:
                  cpu: 10m
                  memory: 16Mi
                limits:
                  cpu: 100m
                  memory: 32Mi
```

`*/5` 在分钟位置表示每五分钟，时区明确为 UTC。这不是从 apply 开始倒数五分钟。默认 `suspend: true` 所以不会按时创建新任务；`startingDeadlineSeconds` 也不是任务运行超时，它规定迟到调度的窗口。历史保留数量限制完成后的 Job 记录，不等同于业务归档。

```text
kubectl --context kind-k8s-lab -n learning apply -f work/workload-patterns/study-clock.yaml
kubectl --context kind-k8s-lab -n learning get cronjob study-clock -o yaml
kubectl --context kind-k8s-lab -n learning create job study-clock-manual --from=cronjob/study-clock
kubectl --context kind-k8s-lab -n learning wait --for=condition=complete job/study-clock-manual --timeout=150s
kubectl --context kind-k8s-lab -n learning logs job/study-clock-manual
```

应出现 UTC 时间和 `clock sample completed`，同时 CronJob 仍为暂停。手动创建独立 Job 是复用模板，它不会证明定时调度已经生效，也不受 CronJob `Forbid` 对其自身调度轮次的并发限制。再次执行同一个 create 会报 AlreadyExists，这是固定名字冲突，并非本轮又执行了一遍。

如要自行观察真正日程，先确认愿意让这份只打印时间的练习运行，然后在文件中把 `suspend` 改成 `false` 并 apply。观察下一次 UTC 五分钟整点后产生的 Job：

```text
kubectl --context kind-k8s-lab -n learning get cronjob study-clock
kubectl --context kind-k8s-lab -n learning get jobs
```

看见新 Job 后记下名称，读取它的日志。恢复调度可能补上窗口内错过的一轮，不能把“立刻产生任务”当成时区错误。验收后马上把文件改回 `suspend: true` 并 apply、重新读取确认。暂停只阻止未来的调度，不会停止已经创建的 Job。CronJob 可能漏调或重复调度，真实业务需要幂等及可追溯补跑方案。

## 4. StatefulSet：为每个成员生成自己的 PVC

这一步才需要可用的 StorageClass。保存为 `work/workload-patterns/study-stateful.yaml`：

```yaml
apiVersion: v1
kind: Service
metadata:
  name: study-stateful
  namespace: learning
spec:
  clusterIP: None
  selector:
    app: study-stateful
  ports:
    - name: http
      port: 8080
      targetPort: http
---
apiVersion: apps/v1
kind: StatefulSet
metadata:
  name: study-stateful
  namespace: learning
spec:
  serviceName: study-stateful
  replicas: 2
  podManagementPolicy: OrderedReady
  updateStrategy:
    type: RollingUpdate
  selector:
    matchLabels:
      app: study-stateful
  template:
    metadata:
      labels:
        app: study-stateful
    spec:
      terminationGracePeriodSeconds: 10
      containers:
        - name: member
          image: busybox:1.36.1
          command: ["sh", "-c"]
          args:
            - |
              set -eu
              if [ ! -f /data/index.html ]; then
                hostname > /data/index.html
                date -u >> /data/index.html
              fi
              cat /data/index.html
              exec httpd -f -p 8080 -h /data
          ports:
            - name: http
              containerPort: 8080
          readinessProbe:
            httpGet:
              path: /
              port: http
            initialDelaySeconds: 1
            periodSeconds: 2
          resources:
            requests:
              cpu: 10m
              memory: 16Mi
            limits:
              cpu: 100m
              memory: 32Mi
          volumeMounts:
            - name: data
              mountPath: /data
  volumeClaimTemplates:
    - metadata:
        name: data
      spec:
        accessModes:
          - ReadWriteOnce
        storageClassName: standard
        resources:
          requests:
            storage: 64Mi
```

`volumeClaimTemplates` 已经是完整的 PVC 申请模板，控制器会生成 `data-study-stateful-0` 和 `data-study-stateful-1`，不需要再手工创建同名 PVC。两份卷相互独立。程序只在首次发现文件不存在时写入成员名和时间，以后启动只读取旧内容；因此时间不变才能用作本次持久化证据。

```text
kubectl --context kind-k8s-lab -n learning apply -f work/workload-patterns/study-stateful.yaml
kubectl --context kind-k8s-lab -n learning rollout status statefulset/study-stateful --timeout=180s
kubectl --context kind-k8s-lab -n learning get pods -l app=study-stateful -o wide
kubectl --context kind-k8s-lab -n learning get pvc data-study-stateful-0 data-study-stateful-1
kubectl --context kind-k8s-lab -n learning get service study-stateful
kubectl --context kind-k8s-lab -n learning logs study-stateful-0
kubectl --context kind-k8s-lab -n learning logs study-stateful-1
```

应看到两个 Ready 成员、两份 Bound PVC，Service 的 CLUSTER-IP 是 `None`。分别保存两条日志里的名字和首次写入时间；它们不会自动互相同步。若 Pod Pending，先看对应 PVC 与 Pod 的 describe、事件和 StorageClass。若有 0 没有 1，检查 0 是否 Ready：默认 OrderedReady 会等待它就绪。

下面从成员容器内验证集群 DNS，查询输出的 IP 可能与你的环境不同。默认集群域为 `cluster.local`，自定义过集群域时需使用自己的配置。

```text
kubectl --context kind-k8s-lab -n learning exec study-stateful-0 -- nslookup study-stateful-1.study-stateful.learning.svc.cluster.local
```

在真实系统终端中，`exec` 会在容器内启动只读查询程序；不要把它与网页的固定模拟命令混淆。若刚启动时查询不到，先确认成员 Ready，再等待 DNS 缓存失效重试；不能据此立即删卷。

## 5. 替换成员，验证“同名、不同对象、同数据”

先记录 Pod 的 UID 与日志：

```text
kubectl --context kind-k8s-lab -n learning get pod study-stateful-0 -o custom-columns=NAME:.metadata.name,UID:.metadata.uid
kubectl --context kind-k8s-lab -n learning logs study-stateful-0
```

以下删除只针对本手册的一个教学 Pod，控制器会创建替代成员；不删除 PVC。执行前确认刚才看到的名字正确：

```text
kubectl --context kind-k8s-lab -n learning delete pod study-stateful-0 --wait=true
kubectl --context kind-k8s-lab -n learning get pods -l app=study-stateful
```

重复读取直到 `study-stateful-0` 重新出现，再执行等待；若尚未出现时直接 wait，可能得到 NotFound，等待新对象出现后再运行即可。

```text
kubectl --context kind-k8s-lab -n learning wait --for=condition=Ready pod/study-stateful-0 --timeout=180s
kubectl --context kind-k8s-lab -n learning get pod study-stateful-0 -o custom-columns=NAME:.metadata.name,UID:.metadata.uid
kubectl --context kind-k8s-lab -n learning logs study-stateful-0
kubectl --context kind-k8s-lab -n learning get pvc data-study-stateful-0 data-study-stateful-1
```

验收：名字相同，UID 改变，挂载同一份 PVC，日志中首次写入的时间没有改变。IP 是否改变都不影响结论。仅凭名字相同不能证明文件没丢，仅凭 PVC Bound 也不能证明文件正确。

需要理解更新顺序时，可手动执行 `kubectl --context kind-k8s-lab -n learning rollout restart statefulset/study-stateful`，再用 `get pods -l app=study-stateful -w` 观察，完成后按 Ctrl+C 结束观察。它会重建本手册成员，默认从高序号开始等待就绪；这只是重启练习，不是新镜像兼容性测试。如果更新等待某个 Pod Ready，先调查该 Pod 的事件、日志与探针，保留数据。

本实验没有数据库、复制协议或选举机制。两个独立文件与两个 Ready Pod 不能证明数据库高可用；后续还需学习复制延迟、主从切换、备份恢复和故障条件下的数据一致性。

## 6. 局部收尾，默认保留 PVC

把 `study-clock.yaml` 的 `suspend` 确认改回 `true`，apply 后再检查。保存本次 Job 条件、日志和成员 UID 对比后，仅清理本手册资源：

```text
kubectl --context kind-k8s-lab -n learning apply -f work/workload-patterns/study-clock.yaml
kubectl --context kind-k8s-lab -n learning get cronjob study-clock
kubectl --context kind-k8s-lab -n learning delete cronjob study-clock --ignore-not-found
kubectl --context kind-k8s-lab -n learning delete job study-batch study-clock-manual study-batch-fail --ignore-not-found
kubectl --context kind-k8s-lab -n learning scale statefulset study-stateful --replicas=0
kubectl --context kind-k8s-lab -n learning wait --for=delete pod -l app=study-stateful --timeout=180s
kubectl --context kind-k8s-lab -n learning delete statefulset study-stateful
kubectl --context kind-k8s-lab -n learning delete service study-stateful
kubectl --context kind-k8s-lab -n learning get pvc data-study-stateful-0 data-study-stateful-1
```

仅当对应资源确由本次创建才执行其删除命令。删除 CronJob 通常会级联清理它所拥有的 Job；手动创建的 Job 单独清理。StatefulSet 先缩为零再等待 Pod 删除，有助于按序停止；如果等待超时先调查，不要强制删除。

默认保留两份 PVC，便于你重新部署验证数据仍在。不要为了“清理干净”删除整个 `learning` 命名空间。若今后确认这些只有教学文件的卷不再需要，先读取对应 PV 回收策略、确认不含其他数据与备份需求，再由你单独决定删除这两个明确命名的 PVC；`Delete` 策略可能同时删除底层数据。删除 Kind 集群也可能令节点内卷丢失，保留 PVC 不等于拥有独立备份。

## 7. 最终自测

不看上面的解释，用自己的话回答并附对应输出：

1. 为什么一个正确结束的报表程序应使用 Job？Job Complete 与报表内容正确分别由什么证据说明？
2. 网络中断后重试为什么可能重复写入？`Forbid` 为什么不能代替业务唯一键？
3. `suspend`、`startingDeadlineSeconds`、`activeDeadlineSeconds` 分别影响哪一段时间？
4. 为什么成员被替换后 UID 不同，名字与原文件还能保留？两份 PVC 为什么不表示数据已经复制？
5. 若某个成员一直未 Ready，应先查哪些证据？为什么不能删 PVC 来推进更新？

机制参考已按官方文档核对：[Job](https://kubernetes.io/docs/concepts/workloads/controllers/job/)、[CronJob](https://kubernetes.io/docs/concepts/workloads/controllers/cron-jobs/)、[StatefulSet](https://kubernetes.io/docs/concepts/workloads/controllers/statefulset/)、[StatefulSet 基础实验](https://kubernetes.io/docs/tutorials/stateful-application/basic-stateful-set/)、[持久卷](https://kubernetes.io/docs/concepts/storage/persistent-volumes/)。本手册提供可手动执行的模板，当前内容编写并不代表已在你的真实集群中部署验证。
