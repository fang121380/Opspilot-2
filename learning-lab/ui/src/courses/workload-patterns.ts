import type { Lesson } from "../curriculum.ts";

export const workloadLessons: Lesson[] = [
  {
    id: "k8s-jobs",
    module: "kubernetes",
    prerequisites: ["k8s-workloads"],
    title: "一次性任务与定时任务",
    subtitle: "Job 完成条件、失败重试与 CronJob 调度边界",
    duration: "45 分钟",
    outcome:
      "为报表任务选择控制器，区分任务完成、业务成功与重复执行，并设计可验证的重试策略。",
    why: "网站需要持续在线，导出报表却需要执行后结束。控制器选错会把正常退出当成需要反复拉起的服务。本课是固定只读样例；真实创建与清理步骤在实机手册 10。",
    sections: [
      {
        title: "先定义结束，再选择控制器",
        body: "设想一个程序读取当天订单、生成报表，然后以退出码零结束。Deployment 持续维持可运行的副本，更适合提供网站；Job 则围绕成功完成的次数协调 Pod。completions 为一表示需要一次成功，parallelism 为一限制通常同时运行的工作 Pod 数。看到 Pod Completed 后，还要检查 Job 的 Complete 条件以及报表是否存在、行数是否正确：退出码零只说明程序按自己的规则宣布成功，业务验收仍由你定义。",
      },
      {
        title: "重试会重新做事，幂等让它可以安全重复",
        body: "网络断开时，程序可能已经写入结果，却没有及时报告成功；控制器随后仍可能再次启动任务。因此即使 completions 和 parallelism 都是一，也不能据此保证业务只执行一次。restartPolicy: Never 让失败的容器留在原 Pod 中便于查日志，Job 仍可新建 Pod 重试；backoffLimit 约束失败重试，activeDeadlineSeconds 约束总体运行时间。用日期与客户编号组成业务键，并通过唯一约束或事务去重，比简单增加重试次数更能避免重复扣款、重复发信。",
      },
      {
        title: "CronJob 管日程，Job 管这一轮执行",
        body: "CronJob 到计划时间创建 Job，再由 Job 创建 Pod。schedule 的五段依次为分钟、小时、日、月、星期，timeZone: Etc/UTC 明确解释时区；不能假设它跟电脑时区相同。concurrencyPolicy: Forbid 避免同一个 CronJob 的上一轮未结束时再并行启动下一轮，但不是全局锁，也不约束你手动创建的独立 Job。suspend: true 暂停后续调度，不会停止已经运行的 Job；startingDeadlineSeconds 限制迟到多久还可启动。控制器可能漏调或重复调度，所以业务必须能补跑和幂等。本课实机模板默认暂停，由你手动触发一次验收。",
      },
    ],
    concepts: [
      {
        term: "Job",
        plain: "以完成次数为目标的任务控制器",
        detail:
          "结合 completions、失败策略和完成条件判断执行结果；完成后还需检查业务产物。",
      },
      {
        term: "幂等",
        plain: "同一业务操作重做仍得到相同结果",
        detail:
          "用业务键、事务和唯一约束防止重复副作用；只记录一条开始日志并不能完成去重。",
      },
      {
        term: "CronJob",
        plain: "按日程创建 Job 的控制器",
        detail:
          "需要明确时区、并发、迟到与暂停策略，不提供严格恰好一次执行保证。",
      },
    ],
    commands: [
      {
        command:
          "kubectl --context kind-k8s-lab -n learning get job study-batch -o yaml",
        purpose: "对照声明的成功目标和实际完成条件（输出节选）",
        expected: "completions 为 1，succeeded 为 1，Complete 条件为 True",
        output:
          'apiVersion: batch/v1\nkind: Job\nmetadata:\n  name: study-batch\nspec:\n  completions: 1\n  parallelism: 1\n  backoffLimit: 2\n  activeDeadlineSeconds: 120\nstatus:\n  succeeded: 1\n  conditions:\n  - type: Complete\n    status: "True"',
      },
      {
        command:
          "kubectl --context kind-k8s-lab -n learning get cronjob study-clock -o yaml",
        purpose: "检查日程、并发和暂停配置（输出节选）",
        expected: "每五分钟的 UTC 日程已暂停，Forbid 限制同一 CronJob 并行轮次",
        output:
          'apiVersion: batch/v1\nkind: CronJob\nmetadata:\n  name: study-clock\nspec:\n  schedule: "*/5 * * * *"\n  timeZone: Etc/UTC\n  concurrencyPolicy: Forbid\n  suspend: true\n  startingDeadlineSeconds: 60',
      },
      {
        command:
          "kubectl --context kind-k8s-lab -n learning logs job/study-batch",
        purpose: "读取教学任务的业务产物摘要",
        expected: "日志报告样例报表有 3 行；真实业务还应验证产物内容",
        output: "report sample-orders: 3 rows\nreport validation passed",
      },
    ],
    evidence: ["type: Complete", "suspend: true", "report validation passed"],
    commonMistakes: [
      "把一次成功目标理解为任何故障下都只会启动一次程序。",
      "以为 Forbid 能锁住不同 CronJob 或手动创建的任务。",
      "把暂停后续调度当成终止已运行的 Job，或恢复调度前不考虑补跑。",
    ],
    quiz: {
      evidence: "报表已写入数据库，随后网络中断。Job 启动了一个替代 Pod。",
      question: "怎样让这次重试不会重复生成同一天的业务报表？",
      options: [
        "把 parallelism 改成 1 就能保证恰好一次",
        "用报表日期等业务键去重，并验证结果和 Job 条件",
        "只看到 Pod Running 就宣布成功",
      ],
      correct: 1,
      explanation:
        "单并发不能消除故障窗口里的重复执行。幂等写入解决重复副作用，完成条件和业务验收分别说明调度层与业务层是否成功。",
    },
    challenge: {
      task: "为每天 UTC 02:00 生成前一天报表的任务写一份执行与验收方案。",
      steps: [
        "说明选择 CronJob、Job 而非 Deployment 的理由。",
        "给出时间、并发、失败重试、超时和暂停方案。",
        "设计业务键，并写出超时后补跑与检查产物的步骤。",
      ],
      acceptance: [
        "包含 schedule 0 2 * * * 和显式 timeZone。",
        "解释 Forbid、suspend、backoffLimit 的边界。",
        "既检查 Job Complete，又校验报表日期、行数与重复记录。",
      ],
      solution:
        "CronJob 使用 schedule: 0 2 * * *、timeZone: Etc/UTC、concurrencyPolicy: Forbid；测试时 suspend: true，通过手动创建 Job 验证模板。每轮 Job 设置有限 backoffLimit 和 activeDeadlineSeconds。以报表日期与业务范围作为唯一键，在事务中完成写入；补跑沿用同一个业务键。读取 Job 条件与日志，再校验报表日期、行数及唯一性，不能只看 Pod 是否启动。手册 10 用无外部副作用的小任务演示这一过程。",
    },
    references: [
      {
        title: "Kubernetes：Job",
        url: "https://kubernetes.io/docs/concepts/workloads/controllers/job/",
      },
      {
        title: "Kubernetes：CronJob",
        url: "https://kubernetes.io/docs/concepts/workloads/controllers/cron-jobs/",
      },
    ],
  },
  {
    id: "k8s-stateful",
    module: "kubernetes",
    prerequisites: ["k8s-storage"],
    title: "有状态应用与稳定身份",
    subtitle: "StatefulSet、Headless Service、独立 PVC 与更新顺序",
    duration: "50 分钟",
    outcome:
      "追踪一个 Pod 替换前后的名字与存储，解释有序更新为何会停住，并划清持久化与数据库高可用的边界。",
    why: "上一课知道了 PVC 能独立于 Pod 存活；这一课继续追问：多个副本怎样各自找回自己的卷和名字？本课只读样例不重建 Pod，实机手册 10 才提供你可手动执行的独立实验。",
    sections: [
      {
        title: "副本有身份，替换后才能回到自己的位置",
        body: "无状态网站的两个副本通常可以互换，而某些应用需要记住自己是第零个还是第一个成员。StatefulSet 给 Pod 稳定序号，例如 study-stateful-0；替换 Pod 后名字通常相同，但 UID 和 IP 可以改变。serviceName 关联你事先创建的 Headless Service，它不分配普通的服务虚拟 IP，而配合 DNS 提供成员发现。在默认集群域中，成员可使用 study-stateful-0.study-stateful.learning.svc.cluster.local 这样的名称；稳定的是命名关系，并非网络地址永远不变。",
      },
      {
        title: "每个成员各有存储，存储的寿命另算",
        body: "volumeClaimTemplates 是为每个序号生成 PVC 的模板，而不是让所有副本共用一块可写盘。模板名 data 加上 Pod 名，得到 data-study-stateful-0；替换该成员时仍引用这份申请。默认保留策略下，缩容或删除 StatefulSet 不自动删掉这些 PVC，因此缩回零再扩容仍可能读到旧数据。你必须先检查 StorageClass、卷绑定和实际数据，再决定是否复用。Kind 的卷仍依赖本机与节点容器，这种持久化不能替代备份，也不能证明另一个成员已同步数据。",
      },
      {
        title: "顺序能约束变更，却不能代替应用协议",
        body: "默认 OrderedReady 让创建按序号从小到大推进，前一成员 Ready 后才继续；默认 RollingUpdate 更新通常从大序号往小序号进行，并等待被更新成员就绪。如果新镜像无法 Ready，更新可能停住，这是排查镜像、配置、探针和卷挂载的入口，不应直接删 PVC 试运气。数据库复制、主从选举、脑裂防护、备份恢复和客户端连接切换仍需要应用自身或专门的 Operator 来实现。两个运行中的 StatefulSet Pod，仅表示控制器维持了两个成员，不能直接称为数据库高可用。",
      },
    ],
    concepts: [
      {
        term: "StatefulSet",
        plain: "为副本保留序号和身份的控制器",
        detail:
          "稳定 Pod 名不代表 UID、IP 不变；适用于确实依赖成员身份的应用。",
      },
      {
        term: "Headless Service",
        plain: "通过 DNS 发现成员的无虚拟 IP 服务",
        detail:
          "clusterIP: None；selector 与 Pod 标签对应，StatefulSet 的 serviceName 指向该 Service。",
      },
      {
        term: "volumeClaimTemplates",
        plain: "每个成员的存储申请模板",
        detail: "为序号分别生成 PVC；默认保留，删除策略和备份恢复需单独设计。",
      },
    ],
    commands: [
      {
        command:
          "kubectl --context kind-k8s-lab -n learning get statefulset study-stateful -o yaml",
        purpose: "关联服务名称、默认顺序与存储模板（输出节选）",
        expected:
          "serviceName 指向 study-stateful，使用 OrderedReady 和 data 模板",
        output:
          "apiVersion: apps/v1\nkind: StatefulSet\nmetadata:\n  name: study-stateful\nspec:\n  serviceName: study-stateful\n  replicas: 2\n  podManagementPolicy: OrderedReady\n  updateStrategy:\n    type: RollingUpdate\n  volumeClaimTemplates:\n  - metadata:\n      name: data\n    spec:\n      accessModes:\n      - ReadWriteOnce\n      storageClassName: standard\n      resources:\n        requests:\n          storage: 64Mi\nstatus:\n  readyReplicas: 2",
      },
      {
        command:
          "kubectl --context kind-k8s-lab -n learning get service study-stateful",
        purpose: "辨认 Headless Service 的虚拟 IP 字段",
        expected: "CLUSTER-IP 显示 None",
        output:
          "NAME             TYPE        CLUSTER-IP   EXTERNAL-IP   PORT(S)   AGE\nstudy-stateful   ClusterIP   None         <none>        8080/TCP  5m",
      },
      {
        command:
          "kubectl --context kind-k8s-lab -n learning get pvc data-study-stateful-0 data-study-stateful-1",
        purpose: "确认两个序号各自绑定一份卷",
        expected: "两份 PVC 均为 Bound，但这是教学快照，不证明已有备份",
        output:
          "NAME                    STATUS   VOLUME         CAPACITY   ACCESS MODES   STORAGECLASS\ndata-study-stateful-0   Bound    pvc-study-0    64Mi       RWO            standard\ndata-study-stateful-1   Bound    pvc-study-1    64Mi       RWO            standard",
      },
    ],
    evidence: [
      "serviceName: study-stateful",
      "ClusterIP   None",
      "data-study-stateful-1",
    ],
    commonMistakes: [
      "把稳定名字理解为永久固定 IP。",
      "以为两副本自动共用数据或自动组成数据库高可用集群。",
      "为修复更新卡住而删除 PVC，或把 Kind 本地卷当作独立备份。",
    ],
    quiz: {
      evidence:
        "study-stateful-1 更换镜像后一直未 Ready，study-stateful-0 仍运行旧镜像。两份 PVC 都是 Bound。",
      question: "在默认滚动更新策略下，这个现象最合理的下一步是什么？",
      options: [
        "删除两份 PVC 让更新继续",
        "确认更新在等待高序号成员就绪，查该 Pod 的事件、日志与探针",
        "只要 PVC Bound 就证明新镜像没有问题",
      ],
      correct: 1,
      explanation:
        "默认更新从高序号开始并等待 Ready。Bound 只说明存储申请已绑定，不能排除镜像、启动、配置或探针问题；删除数据不应作为推进更新的方法。",
    },
    challenge: {
      task: "给两个有独立数据目录的成员画出身份、服务与卷的对应关系，并制定替换后的验收。",
      steps: [
        "列出两个 Pod 名、对应 PVC 名及 Headless Service。",
        "说明替换 Pod 后哪些标识可变，哪些关系需要保留。",
        "说明 Ready 与文件保留之外，还缺哪些证据才能声称数据库高可用。",
      ],
      acceptance: [
        "每个序号对应独立 PVC，未声称数据自动共享。",
        "包含替换前后 UID 不同、名字相同、数据内容仍一致的检查。",
        "明确复制、选举、备份恢复与故障切换需要应用层验证。",
      ],
      solution:
        "study-stateful-0 对应 data-study-stateful-0，study-stateful-1 对应 data-study-stateful-1，serviceName 都关联 Headless Service study-stateful。替换成员后名字保留而 UID、IP 可变；比较 PVC 名与文件内容确认该成员找回原数据，再观察 Ready。两份独立文件不会自行复制。数据库还需验证复制延迟、选举和故障切换、备份恢复与客户端行为；本课小文件实验只验证身份和存储关系。",
    },
    references: [
      {
        title: "Kubernetes：StatefulSet",
        url: "https://kubernetes.io/docs/concepts/workloads/controllers/statefulset/",
      },
      {
        title: "Kubernetes：StatefulSet 基础实验",
        url: "https://kubernetes.io/docs/tutorials/stateful-application/basic-stateful-set/",
      },
      {
        title: "Kubernetes：持久卷",
        url: "https://kubernetes.io/docs/concepts/storage/persistent-volumes/",
      },
    ],
  },
];
