import type { Lesson } from "../curriculum";

// Every output is a separate teaching snapshot, not a mutable or live cluster.
export const kubernetesLessons: Lesson[] = [
  {
    id: "k8s-declarative",
    module: "kubernetes",
    prerequisites: ["03"],
    title: "声明式部署与协调循环",
    subtitle: "从一份清单理解期望、实际和控制器",
    duration: "40 分钟",
    outcome:
      "读懂 Deployment 清单，区分 spec 与 status，解释副本暂时不一致的原因。",
    why: "先知道 Kubernetes 在努力实现什么，才能判断应用为何没有达到目标。本课查询的是预设的部署中快照，不会真的创建资源。",
    sections: [
      {
        title: "先写目标，再观察结果",
        body: "假设网站需要两个副本。声明式清单写的是“希望存在两个使用指定镜像的实例”，不是逐条描述启动进程的过程。API 接收配置后，控制器持续比较期望与实际，再创建或替换对象。因此提交成功只表示请求被接受，不能证明两个副本已经启动、就绪或能够处理请求。",
        example:
          "# 手工实验阅读示例：先理解清单；模拟终端不会应用它。\napiVersion: apps/v1\nkind: Deployment\nmetadata:\n  name: hello-web\n  namespace: learning\nspec:\n  replicas: 2\n  selector:\n    matchLabels:\n      app: hello-web\n  template:\n    metadata:\n      labels:\n        app: hello-web\n    spec:\n      containers:\n        - name: web\n          image: nginx:1.27\n          ports:\n            - containerPort: 80",
      },
      {
        title: "清单从身份读到运行模板",
        body: "apiVersion 和 kind 决定对象类型，metadata 给出名称和命名空间，spec 是你的目标。Deployment 的 template 描述以后创建的 Pod；selector 必须匹配模板标签。容器的 containerPort 只是声明端口信息，不会自动发布到电脑或公网。应用的实际监听端口仍由程序配置决定。",
      },
      {
        title: "协调不是瞬间完成",
        body: "本课中 spec.replicas 为 2，status.readyReplicas 为 1，说明还有一个副本没有就绪。控制器可能正在处理镜像拉取或探针失败，应继续检查 Pod 和事件。generation 代表期望配置的代次，observedGeneration 表示控制器已经看到哪一代；两者相等也只证明配置已被观察，不能代替健康验证。",
      },
    ],
    concepts: [
      {
        term: "spec",
        plain: "你声明的目标",
        detail: "例如期望副本数、Pod 模板与镜像；由资源类型决定可配置字段。",
      },
      {
        term: "status",
        plain: "系统观察到的结果",
        detail: "由控制器更新；需要结合就绪副本、条件和事件解释。",
      },
      {
        term: "协调循环",
        plain: "持续让实际接近期望",
        detail:
          "控制器反复比较状态并采取动作；它无法自动修复所有应用逻辑错误。",
      },
    ],
    commands: [
      {
        command:
          "kubectl --context kind-k8s-lab -n learning get deployment hello-web -o yaml",
        purpose: "对照预设快照的 spec 与 status",
        expected: "目标为 2，已就绪为 1",
        output:
          "apiVersion: apps/v1\nkind: Deployment\nmetadata:\n  name: hello-web\n  generation: 3\nspec:\n  replicas: 2\nstatus:\n  observedGeneration: 3\n  replicas: 2\n  readyReplicas: 1\n  availableReplicas: 1",
      },
      {
        command:
          "kubectl --context kind-k8s-lab -n learning get pods -l app=hello-web -o wide",
        purpose: "查看未就绪副本的位置和状态",
        expected: "第二个 Pod 正在创建容器",
        output:
          "NAME          READY   STATUS              RESTARTS   IP           NODE\nhello-web-6d7f8c9b5-k2m9x   1/1     Running             0          10.244.0.5   k8s-lab-control-plane\nhello-web-6d7f8c9b5-p4q7r   0/1     ContainerCreating   0          <none>       k8s-lab-control-plane",
      },
    ],
    evidence: ["readyReplicas: 1", "ContainerCreating"],
    commonMistakes: [
      "把配置提交成功当作部署完成。",
      "直接修改 status 来“修复”副本数。",
      "以为 containerPort 等于对外开放端口。",
    ],
    quiz: {
      evidence:
        "spec.replicas: 2\nstatus.readyReplicas: 1\nobservedGeneration 与 generation 均为 3",
      question: "现在能确认什么？",
      options: [
        "控制器已观察新配置，但仍有副本未就绪",
        "两个副本已经对外服务",
        "应该手动把 readyReplicas 改为 2",
      ],
      correct: 0,
      explanation:
        "代次一致不等于健康。就绪副本只有一个，应沿 Pod 状态、事件与探针继续调查。",
    },
    challenge: {
      task: "为这次部署写一份三句状态报告。",
      steps: [
        "找出目标副本和就绪副本。",
        "说明哪个证据支持部署未完成。",
        "列出下一项只读检查。",
      ],
      acceptance: [
        "明确区分期望 2 与就绪 1。",
        "不把代次一致写成健康。",
        "下一步包含未就绪 Pod 的详情或事件。",
      ],
      solution:
        "目标为两个副本，当前只有一个就绪。控制器已观察第 3 代配置，但第二个 Pod 为 ContainerCreating。下一步检查该 Pod 的 describe 和事件，区分正常启动等待、挂载失败或镜像拉取问题。",
    },
    references: [
      {
        title: "Kubernetes：Deployment",
        url: "https://kubernetes.io/docs/concepts/workloads/controllers/deployment/",
      },
    ],
  },
  {
    id: "k8s-workloads",
    module: "kubernetes",
    prerequisites: ["k8s-declarative"],
    title: "工作负载与滚动发布",
    subtitle: "标签 → Deployment → ReplicaSet → Pod → 发布历史",
    duration: "45 分钟",
    outcome:
      "解释新旧 ReplicaSet 共存，选择合适工作负载，并判断滚动更新为何卡住。",
    why: "会读单个 Pod 还不够。发布时要追踪它属于哪个版本，以及控制器怎样保护已有服务。以下是一次预设的发布中快照。",
    sections: [
      {
        title: "找到对象之间的关系",
        body: "Deployment 管理 ReplicaSet，ReplicaSet 再维持 Pod 数量。修改 Pod 模板会触发一个新版本，例如更换镜像或模板中的环境变量；只改 replicas 是扩缩容，不会单独触发新模板版本。标签供人和控制器筛选对象，ownerReferences 则记录拥有关系，两者不能互相替代。",
      },
      {
        title: "发布时为什么会有三个 Pod",
        body: "两副本应用采用 maxSurge 为 1、maxUnavailable 为 0 时，发布允许临时多一个 Pod，并努力保留两个可用副本。本课旧 ReplicaSet 为 hello-web-6d7f8c9b5，新 ReplicaSet 为 hello-web-7b8c9d6f4（哈希为教学示例）。DESIRED 是目标数量，CURRENT 是实际数量，READY 是就绪数量。新版本的一个 Pod 未就绪，旧 ReplicaSet 仍保留两个副本，这是保护服务的正常表现。应查新版本失败原因，而不是为了“数量整齐”删除旧副本。",
        example:
          "# 手工实验阅读示例：Deployment spec 的策略片段，不是独立清单。\nstrategy:\n  type: RollingUpdate\n  rollingUpdate:\n    maxSurge: 1\n    maxUnavailable: 0\nrevisionHistoryLimit: 5",
      },
      {
        title: "选对控制器并保留发布依据",
        body: "无状态网站通常使用 Deployment；需要稳定身份和持久存储关系的服务考虑 StatefulSet；每个节点都要运行的采集组件使用 DaemonSet；一次性任务使用 Job，定时任务使用 CronJob。发布前记录镜像标识与变更内容，发布后核查就绪、端点和业务。revision 是模板历史，不是完整数据库或外部配置的备份。",
      },
    ],
    concepts: [
      {
        term: "ReplicaSet",
        plain: "维持某个 Pod 模板的副本数",
        detail: "通常由 Deployment 管理；新旧版本可以在滚动发布期间共存。",
      },
      {
        term: "Label / selector",
        plain: "对象标签与筛选条件",
        detail: "同样的键和值才能匹配；标签不是对象名称，也不是权限边界。",
      },
      {
        term: "RollingUpdate",
        plain: "逐步替换应用版本",
        detail:
          "maxSurge 控制允许增加的数量，maxUnavailable 控制允许不可用的数量。",
      },
    ],
    commands: [
      {
        command:
          "kubectl --context kind-k8s-lab -n learning get replicasets -l app=hello-web",
        purpose: "对照新旧版本的副本分布",
        expected: "旧版就绪 2，新版就绪 0",
        output:
          "NAME                DESIRED   CURRENT   READY   AGE\nhello-web-6d7f8c9b5  2         2         2       1d\nhello-web-7b8c9d6f4   1         1         0       3m",
      },
      {
        command:
          "kubectl --context kind-k8s-lab -n learning rollout history deployment/hello-web",
        purpose: "阅读已有发布版本记录",
        expected: "存在第 1、2 个修订版本",
        output:
          "deployment.apps/hello-web\nREVISION  CHANGE-CAUSE\n1         initial release nginx:1.27\n2         release candidate nginx:1.28",
      },
    ],
    evidence: [
      "hello-web-7b8c9d6f4   1         1         0",
      "release candidate nginx:1.28",
    ],
    commonMistakes: [
      "为了减少 Pod 数量手动删除旧版本。",
      "把扩容当作新的模板修订版本。",
      "认为 rollout 历史会保存数据库、PVC 和外部配置。",
    ],
    quiz: {
      evidence:
        "期望 2；maxSurge=1；maxUnavailable=0\n旧 RS READY=2，新 RS READY=0",
      question: "新旧 ReplicaSet 同时存在，首先应怎么判断？",
      options: [
        "一定是控制器故障",
        "可能因新版本未就绪而保留旧版，需要调查新版",
        "应该把旧 ReplicaSet 删除",
      ],
      correct: 1,
      explanation:
        "三个 Pod 可符合滚动策略；保留旧版有助于维持可用性。需要检查新 Pod 的状态与探针。",
    },
    challenge: {
      task: "设计一次两副本网站的滚动发布验收单。",
      steps: [
        "画出 Deployment、两个 ReplicaSet 与 Pod 的关系。",
        "解释这次最多三个 Pod 的原因。",
        "列出版本、就绪和业务三类验收证据。",
      ],
      acceptance: [
        "写出 maxSurge=1 与 maxUnavailable=0 的含义。",
        "不要求直接修改 ReplicaSet。",
        "验收包含业务请求而非只看 Running。",
      ],
      solution:
        "Deployment 控制新旧 RS，RS 控制对应 Pod。允许增加一个副本，已有两个可用副本在新版未就绪时保留。验收应确认目标镜像和修订版本、所有目标副本就绪、旧版按预期缩为零、Service 有就绪端点，并完成代表性业务请求。",
    },
    references: [
      {
        title: "Kubernetes：Deployment 滚动更新",
        url: "https://kubernetes.io/docs/concepts/workloads/controllers/deployment/",
      },
    ],
  },
  {
    id: "k8s-network",
    module: "kubernetes",
    prerequisites: ["k8s-workloads"],
    title: "Service、DNS 与流量路径",
    subtitle: "从服务名追到真正处理请求的 Pod",
    duration: "45 分钟",
    outcome:
      "连接 Service selector、Pod 标签、targetPort 与 EndpointSlice，区分集群内外访问。",
    why: "有 Service 不代表有可用后端，有域名也不代表业务健康。以下命令展示一组预设健康快照，不会发送真实请求。",
    sections: [
      {
        title: "把每一跳说清楚",
        body: "集群内客户端使用服务名，DNS 通常把普通 Service 名解析为 ClusterIP，服务转发规则再把流量送向后端 Pod。Service 的 port 是客户端访问端口，targetPort 是后端接收端口，程序还必须真的在那个端口监听。Pod IP 可随重建变化，所以客户端通常不应把它写死。",
      },
      {
        title: "selector 决定找到谁",
        body: "带 selector 的 Service 通过标签匹配同命名空间 Pod，控制器把后端地址及就绪条件写入 EndpointSlice。本课 Service 选择 app=hello-web，端点为 10.244.0.5:80。若把 selector 错写成 app=hello-api，Pod 即使全部 Running，也可能没有匹配端点。端点存在还应确认 ready 条件和真实响应。",
        example:
          "# 手工实验阅读示例：不在模拟终端执行。\napiVersion: v1\nkind: Service\nmetadata:\n  name: hello-web\n  namespace: learning\nspec:\n  selector:\n    app: hello-web\n  ports:\n    - port: 80\n      targetPort: 80\n  type: ClusterIP",
      },
      {
        title: "DNS 与外部入口是不同问题",
        body: "同命名空间可使用 hello-web，跨命名空间可使用 hello-web.learning；默认集群域下完整名称为 hello-web.learning.svc.cluster.local，实际集群域可能被修改。ClusterIP 默认供集群内部访问。浏览器在电脑或手机上访问还需要合适入口，例如本地转发、Ingress 或 LoadBalancer；Kind 不会凭空提供云负载均衡器。",
      },
    ],
    concepts: [
      {
        term: "targetPort",
        plain: "Service 转给后端的端口",
        detail: "它必须对应容器内应用监听的端口或命名端口。",
      },
      {
        term: "EndpointSlice",
        plain: "后端地址及就绪信息的集合",
        detail: "服务路由使用这些信息；多个切片可共同描述同一 Service。",
      },
      {
        term: "Service DNS",
        plain: "集群内可查询的服务名称",
        detail: "域名解析与后端可用性分属不同环节，解析成功不等于请求成功。",
      },
    ],
    commands: [
      {
        command:
          "kubectl --context kind-k8s-lab -n learning describe service hello-web",
        purpose: "读取选择器和端口映射",
        expected: "选择 app=hello-web，转至 80",
        output:
          "Name: hello-web\nNamespace: learning\nSelector: app=hello-web\nType: ClusterIP\nIP: 10.96.0.20\nPort: http 80/TCP\nTargetPort: 80/TCP\nEndpoints: 10.244.0.5:80",
      },
      {
        command:
          "kubectl --context kind-k8s-lab -n learning get endpointslices -l kubernetes.io/service-name=hello-web -o yaml",
        purpose: "验证后端地址与就绪条件",
        expected: "地址为 10.244.0.5 且 ready 为 true",
        output:
          "items:\n- metadata:\n    name: hello-web-example\n  ports:\n  - port: 80\n    protocol: TCP\n  endpoints:\n  - addresses:\n    - 10.244.0.5\n    conditions:\n      ready: true",
      },
    ],
    evidence: ["TargetPort: 80/TCP", "ready: true"],
    commonMistakes: [
      "把 ClusterIP 当作手机能直连的局域网 IP。",
      "认为 Pod 名称相同就会被 Service 匹配。",
      "DNS 能解析便跳过后端和业务检查。",
    ],
    quiz: {
      evidence:
        "Service selector: app=hello-api\nPod label: app=hello-web\nEndpointSlice 没有端点",
      question: "最直接的检查方向是？",
      options: [
        "扩大 CPU limit",
        "核对 Service selector 与 Pod 标签",
        "把 ClusterIP 发给公网用户",
      ],
      correct: 1,
      explanation:
        "选择器不匹配能解释端点缺失；应先核对声明配置与设计目标，不要随意把所有 Pod 都纳入服务。",
    },
    challenge: {
      task: "为同命名空间客户端写出访问 hello-web 的完整路径。",
      steps: [
        "写出服务名、Service 端口和后端端口。",
        "标注标签匹配的位置。",
        "区分已经取得的证据和仍需真实验证的环节。",
      ],
      acceptance: [
        "包含 DNS、ClusterIP、EndpointSlice、Pod 应用四步。",
        "说明 port 与 targetPort 不必相同。",
        "承认模拟快照不证明手机能访问。",
      ],
      solution:
        "客户端查询 hello-web，DNS 返回普通 Service 的 ClusterIP，客户端访问 80，服务规则根据就绪端点转到 Pod 的 80。selector 与 Pod 标签决定后端成员。本课证明配置关系与快照中的就绪条件，DNS 查询、网络传输和业务响应仍需实机检查；手机还需要集群外入口。",
    },
    references: [
      {
        title: "Kubernetes：Service",
        url: "https://kubernetes.io/docs/concepts/services-networking/service/",
      },
      {
        title: "Kubernetes：服务与 Pod 的 DNS",
        url: "https://kubernetes.io/docs/concepts/services-networking/dns-pod-service/",
      },
    ],
  },
  {
    id: "k8s-config",
    module: "kubernetes",
    prerequisites: ["k8s-network"],
    title: "配置与 Secret 的生命周期",
    subtitle: "把程序、配置和凭据分开，理解更新何时生效",
    duration: "40 分钟",
    outcome: "区分环境变量和文件挂载的更新行为，设计不泄露凭据的配置验证。",
    why: "相同镜像常用于不同环境，差异应由配置表达。以下快照只显示非敏感配置和引用名称，不包含真实 Secret 值。",
    sections: [
      {
        title: "哪些内容应该放在哪里",
        body: "镜像保存应用代码和依赖，ConfigMap 保存非敏感配置，例如日志级别或服务地址，Secret 用于密码和令牌等敏感数据。Secret 中的 base64 只是编码，不能当作加密保障。权限控制、传输与存储保护、轮换和日志脱敏需要一起设计，不能把密码写进 Git、截图或排障记录。",
      },
      {
        title: "改了配置，旧进程为什么没变",
        body: "环境变量在容器启动时注入，更新 ConfigMap 或 Secret 后，正在运行的进程不会自动拿到新变量。以普通卷挂载的内容可以延迟更新，但应用仍要重新读取文件；通过 subPath 挂载则不会获得自动更新。排障时先确认消费方式，再决定重建 Pod 或应用重载，避免只反复修改数据。",
      },
      {
        title: "一次配置变更要能回查",
        body: "本课 Deployment 引用 web-config-v2，并把 LOG_LEVEL 注入环境变量。用带版本的配置名可以明确追踪本次发布使用的值，旧版配置也便于回退；具体保留策略要避免无限堆积。发布前核对键是否存在，发布后验证新 Pod 的启动记录与实际行为，日志只记录配置版本，不能打印凭据。",
        example:
          "# 手工实验阅读示例：容器 env 片段，不是完整清单。\nenv:\n  - name: LOG_LEVEL\n    valueFrom:\n      configMapKeyRef:\n        name: web-config-v2\n        key: LOG_LEVEL\n  - name: DATABASE_PASSWORD\n    valueFrom:\n      secretKeyRef:\n        name: database-credentials\n        key: password",
      },
    ],
    concepts: [
      {
        term: "ConfigMap",
        plain: "非敏感配置对象",
        detail: "与应用镜像解耦，可作为环境变量或文件提供给容器。",
      },
      {
        term: "Secret",
        plain: "受权限保护的敏感配置对象",
        detail: "base64 不是加密；仅向需要它的身份和容器提供访问。",
      },
      {
        term: "配置生效方式",
        plain: "进程何时读到新值",
        detail:
          "环境变量需新容器；卷文件可能延迟更新且需要应用读取；subPath 不自动更新。",
      },
    ],
    commands: [
      {
        command:
          "kubectl --context kind-k8s-lab -n learning get configmap web-config-v2 -o yaml",
        purpose: "检查非敏感键和值",
        expected: "LOG_LEVEL 为 info",
        output:
          "apiVersion: v1\nkind: ConfigMap\nmetadata:\n  name: web-config-v2\n  namespace: learning\ndata:\n  LOG_LEVEL: info\n  CONFIG_VERSION: v2",
      },
      {
        command:
          "kubectl --context kind-k8s-lab -n learning describe deployment config-demo",
        purpose: "读取配置引用方式，不读取凭据内容",
        expected: "LOG_LEVEL 来自 web-config-v2",
        output:
          "Name: config-demo\nContainers:\n  web:\n    Environment:\n      LOG_LEVEL: <set to the key LOG_LEVEL of config map web-config-v2>\n      DATABASE_PASSWORD: <set to the key password in secret database-credentials>\n    Mounts: <none>",
      },
    ],
    evidence: ["LOG_LEVEL: info", "config map web-config-v2"],
    commonMistakes: [
      "把 base64 值公开，误以为它已加密。",
      "更新 ConfigMap 后假定旧容器环境变量会立即变化。",
      "排障时输出整个 Secret 到聊天或日志。",
    ],
    quiz: {
      evidence:
        "LOG_LEVEL 通过 env 注入。\nConfigMap 由 debug 改为 info。\nPod 尚未重建。",
      question: "旧进程仍打印 debug，首先应如何解释？",
      options: [
        "环境变量不会随 ConfigMap 自动刷新",
        "ConfigMap 永远不能更新",
        "需要把密码打印出来验证",
      ],
      correct: 0,
      explanation:
        "应按发布流程启动使用新配置的容器，或在设计阶段采用应用可重载的配置文件机制。",
    },
    challenge: {
      task: "为日志级别变更编写安全的发布与回退计划。",
      steps: [
        "说明配置消费方式。",
        "指出何时需要替换 Pod。",
        "列出不暴露 Secret 的验收证据。",
      ],
      acceptance: [
        "提到环境变量只在启动时注入。",
        "使用配置版本与行为作验证。",
        "回退同时考虑镜像和配置。",
      ],
      solution:
        "记录镜像和配置版本，将新模板指向 web-config-v2，使新容器启动时取得 info。验证新 Pod 就绪、日志级别及业务请求，不输出密码。若失败，按审批计划恢复旧模板与旧配置引用；外部凭据轮换可能还需要配套恢复方案。",
    },
    references: [
      {
        title: "Kubernetes：ConfigMap",
        url: "https://kubernetes.io/docs/concepts/configuration/configmap/",
      },
      {
        title: "Kubernetes：Secret",
        url: "https://kubernetes.io/docs/concepts/configuration/secret/",
      },
    ],
  },
  {
    id: "k8s-storage",
    module: "kubernetes",
    prerequisites: ["k8s-config"],
    title: "存储与数据生命周期",
    subtitle: "容器层、emptyDir、PVC、PV 和回收策略",
    duration: "45 分钟",
    outcome: "解释 Pod 重建与数据持久化的关系，读懂 PVC 绑定和 PV 回收策略。",
    why: "网站可以重建，用户数据不能靠“再启动一次”恢复。本课是预设存储快照，不会创建、删除或备份任何真实数据。",
    sections: [
      {
        title: "数据在哪一层，决定何时丢失",
        body: "容器可写层不适合保存需要长期保留的数据。emptyDir 在 Pod 创建时提供临时空间，同一 Pod 内容器重启可以继续使用它，但 Pod 被移除时数据也随之消失。PVC 把 Pod 的存储需求与具体卷分开，让符合条件的新 Pod 可以继续挂载同一数据；能否跨节点使用还取决于驱动和卷类型。",
      },
      {
        title: "从申请到实际卷",
        body: "PVC 声明容量、访问模式和 StorageClass；PV 表示集群中的存储资源；StorageClass 描述如何提供存储。Bound 表示申请已绑定，不代表文件内容正确、磁盘永不故障或应用已有备份。ReadWriteOnce 通常表示单个节点读写挂载，不应误解成只能由一个 Pod 使用。",
      },
      {
        title: "删除前先查回收与恢复路径",
        body: "本课 PV 的回收策略为 Delete，删除 PVC 后底层存储可能随之删除；Retain 会保留存储供管理员处理，但仍不是备份。Kind 的本地存储还依赖节点容器和电脑，删除学习集群可能让数据不可用。实际实验先使用可丢弃数据，并验证独立备份和恢复流程，再讨论删除或迁移。",
        example:
          "# 手工实验阅读示例：PVC；需先确认集群有可用的 standard StorageClass。\napiVersion: v1\nkind: PersistentVolumeClaim\nmetadata:\n  name: web-data\n  namespace: learning\nspec:\n  accessModes:\n    - ReadWriteOnce\n  storageClassName: standard\n  resources:\n    requests:\n      storage: 1Gi",
      },
    ],
    concepts: [
      {
        term: "PVC",
        plain: "应用提出的存储申请",
        detail: "属于命名空间；Pod 引用它来使用绑定卷。",
      },
      {
        term: "PV",
        plain: "被申请绑定的实际存储资源",
        detail: "属于集群级资源；生命周期可独立于某个 Pod。",
      },
      {
        term: "回收策略",
        plain: "申请删除后如何处理存储",
        detail:
          "Delete 可能删除底层卷；Retain 留给人工处理，两者都不能替代备份。",
      },
    ],
    commands: [
      {
        command: "kubectl --context kind-k8s-lab -n learning get pvc web-data",
        purpose: "检查申请是否绑定及绑定对象",
        expected: "PVC 绑定 pv-web-data",
        output:
          "NAME       STATUS   VOLUME        CAPACITY   ACCESS MODES   STORAGECLASS\nweb-data   Bound    pv-web-data   1Gi        RWO            standard",
      },
      {
        command: "kubectl --context kind-k8s-lab get pv pv-web-data",
        purpose: "读取集群级卷的回收策略",
        expected: "回收策略是 Delete",
        output:
          "NAME          CAPACITY   ACCESS MODES   RECLAIM POLICY   STATUS   CLAIM\npv-web-data   1Gi        RWO            Delete           Bound    learning/web-data",
      },
    ],
    evidence: ["Bound    pv-web-data", "Delete"],
    commonMistakes: [
      "把容器重启与 Pod 删除当作相同的数据生命周期。",
      "认为 PVC Bound 等于已有备份。",
      "为解决 Pending 直接删除承载用户数据的 PVC。",
    ],
    quiz: {
      evidence: "PVC web-data 已 Bound\nPV 回收策略为 Delete",
      question: "有人提议删除 PVC 再试，应该先做什么？",
      options: [
        "直接删除，数据肯定还在",
        "确认数据归属、备份与恢复能力，并检查删除影响",
        "只需重启浏览器",
      ],
      correct: 1,
      explanation:
        "Delete 策略可能让底层存储一并删除。先诊断、确认可恢复性和操作范围，不能把数据操作当作普通重启。",
    },
    challenge: {
      task: "给上传文件服务选择存储，并写出生命周期说明。",
      steps: [
        "区分临时缓存与用户上传数据。",
        "说明 Pod 替换时怎样找到原卷。",
        "列出删 PVC 和删 Kind 集群前的检查项。",
      ],
      acceptance: [
        "临时数据与持久数据分开。",
        "指出 PVC 持久化并非备份。",
        "包含回收策略和实际恢复验证。",
      ],
      solution:
        "临时缓存可使用 emptyDir，上传数据使用经验证的持久卷并通过 PVC 引用。替换 Pod 后继续引用原 PVC，但需确认卷的节点限制与挂载模式。删除前检查 PV 策略、数据归属、备份位置和恢复结果；Kind 节点内数据不应作为唯一副本。",
    },
    references: [
      {
        title: "Kubernetes：持久卷",
        url: "https://kubernetes.io/docs/concepts/storage/persistent-volumes/",
      },
    ],
  },
  {
    id: "k8s-probes",
    module: "kubernetes",
    prerequisites: ["k8s-storage"],
    title: "启动、存活与就绪探针",
    subtitle: "分别回答“启动完了吗”“需重启吗”“能接流量吗”",
    duration: "40 分钟",
    outcome: "根据故障表现选择探针，解释 Running、Ready 和重启次数为何不同。",
    why: "探针配置错误本身也会制造故障。这里使用预设的就绪失败快照，重复命令不会让模拟 Pod 自动恢复。",
    sections: [
      {
        title: "三个问题，三种动作",
        body: "startupProbe 给慢启动程序完成初始化的机会；它成功前，存活与就绪检查不会开始。livenessProbe 判断容器是否陷入需要重启才能恢复的状态，达到失败阈值后会触发容器重启。readinessProbe 判断此刻能否接收流量，失败会让容器未就绪，通常使该 Pod 不再作为 Service 的就绪后端，不直接重启容器。",
      },
      {
        title: "不要把依赖故障放进所有探针",
        body: "如果数据库短暂不可用，网站也许应该暂时退出流量，但重启网站并不能修复数据库。把数据库检查同时放进存活探针，可能导致所有副本反复重启。存活接口应检查进程能否自行继续工作，就绪接口再判断是否满足服务条件；每个接口都要轻量，并明确失败时希望系统采取什么动作。",
      },
      {
        title: "按启动预算调参数",
        body: "下面的启动探针每 5 秒检查一次，连续失败阈值为 24，提供约两分钟的启动容忍窗口，实际还受检查耗时与调度影响。超时、周期与阈值应来自观测，而不是盲目增大。本课 Pod 为 Running、READY 为 0/1、重启为 0，与就绪返回 503 一致；下一步查应用依赖和探针配置。",
        example:
          "# 手工实验阅读示例：容器探针片段；应用必须实现这些接口。\nstartupProbe:\n  httpGet:\n    path: /startup\n    port: 8080\n  periodSeconds: 5\n  failureThreshold: 24\nlivenessProbe:\n  httpGet:\n    path: /live\n    port: 8080\nreadinessProbe:\n  httpGet:\n    path: /ready\n    port: 8080",
      },
    ],
    concepts: [
      {
        term: "startupProbe",
        plain: "等待应用完成启动",
        detail:
          "成功前暂停 liveness 和 readiness；持续失败达到阈值也会导致容器被重启。",
      },
      {
        term: "livenessProbe",
        plain: "判断是否需要重启容器",
        detail: "不应把所有外部依赖故障都视为必须重启本进程。",
      },
      {
        term: "readinessProbe",
        plain: "判断现在能否接流量",
        detail: "失败使容器未就绪，不会直接引起容器重启。",
      },
    ],
    commands: [
      {
        command:
          "kubectl --context kind-k8s-lab -n learning describe pod probe-demo",
        purpose: "关联探针失败、就绪与重启次数",
        expected: "就绪失败，但重启次数为 0",
        output:
          "Name: probe-demo\nStatus: Running\nContainers:\n  web:\n    Ready: False\n    Restart Count: 0\n    Readiness: http-get http://:8080/ready\nEvents:\n  Warning Unhealthy Readiness probe failed: HTTP probe failed with statuscode: 503",
      },
      {
        command:
          "kubectl --context kind-k8s-lab -n learning logs probe-demo --tail=20",
        purpose: "寻找就绪接口拒绝请求的应用证据",
        expected: "依赖尚未就绪，存活仍正常",
        output:
          "INFO startup completed\nINFO GET /live 200\nWARN dependency cache unavailable\nWARN GET /ready 503\nINFO waiting for cache reconnect",
      },
    ],
    evidence: ["Restart Count: 0", "dependency cache unavailable"],
    commonMistakes: [
      "把 Running 当成 Ready。",
      "认为 readiness 失败必然触发重启。",
      "为了让页面变绿直接删除探针。",
    ],
    quiz: {
      evidence: "/live 200；/ready 503；cache unavailable；Restart Count: 0",
      question: "哪个解释最合理？",
      options: [
        "容器已经退出",
        "进程存活但暂时不满足接流量条件，应检查缓存依赖",
        "只要把存活探针也改成 /ready 就能修好缓存",
      ],
      correct: 1,
      explanation:
        "证据指向依赖导致未就绪。重启进程未必能解决依赖问题，应先核实依赖连通与就绪设计。",
    },
    challenge: {
      task: "为启动耗时较长的网站设计三种探针职责。",
      steps: [
        "估算启动窗口。",
        "分别描述三个接口检查什么。",
        "写出依赖短暂故障时预期的行为。",
      ],
      acceptance: [
        "启动探针给初始化留出时间。",
        "就绪失败与重启动作分离。",
        "不把所有数据库故障都触发为存活失败。",
      ],
      solution:
        "启动检查等待初始化完成，窗口根据真实启动耗时留余量。存活检查进程是否可恢复运行，就绪检查关键服务条件。数据库暂时不可用时可使就绪失败并退出流量，进程继续重连；依赖恢复后重新就绪，并用请求验证，而不是移除探针。",
    },
    references: [
      {
        title: "Kubernetes：三种探针",
        url: "https://kubernetes.io/docs/concepts/workloads/pods/probes/",
      },
    ],
  },
  {
    id: "k8s-resources",
    module: "kubernetes",
    prerequisites: ["k8s-probes"],
    title: "资源、调度与 OOM",
    subtitle: "用 requests、limits 与事件解释“排不上”和“被杀掉”",
    duration: "45 分钟",
    outcome:
      "区分调度资源不足、CPU 限流与内存超限，避免用同一种重启处理所有问题。",
    why: "资源配置决定应用能放在哪里、运行时受什么限制。下面是两个不同故障对象的预设快照，不是同一个 Pod 的前后变化。",
    sections: [
      {
        title: "requests 是调度时的承诺",
        body: "调度器按照 requests 等约束为 Pod 寻找节点，并不是只看此刻 CPU 利用率。500m CPU 表示半个 CPU，128Mi 是内存单位。即使电脑任务管理器显示空闲，如果节点可分配资源已被其他 Pod 的请求占用，新 Pod 仍可能 Pending。还要检查节点亲和性、污点、卷约束等，不能把所有 Pending 都归为缺内存。",
      },
      {
        title: "limits 的后果要分 CPU 与内存",
        body: "CPU 超过限制通常表现为被限流，应用可能变慢；内存不能用同样方式暂停增长，超过限制可能被 OOM 机制终止。看到 OOMKilled 时，应结合上一次退出状态、资源限制与负载判断，单独的退出码 137 不能证明一定是内存限制。提高限制前先检查泄漏、峰值和节点余量。",
        example:
          "# 手工实验阅读示例：容器 resources 片段。\nresources:\n  requests:\n    cpu: 250m\n    memory: 128Mi\n  limits:\n    cpu: 500m\n    memory: 256Mi",
      },
      {
        title: "按证据制定容量调整",
        body: "本课 report-job 的事件明确给出 Insufficient cpu，说明当前调度约束下没有足够 CPU 请求容量；memory-demo 的上次退出原因是 OOMKilled，限制为 128Mi。前者先评估请求是否合理和集群容量，后者先查内存峰值与应用行为。Kind 还受 Docker Desktop 的总体资源分配影响，改 Pod 数字不能创造电脑资源。",
      },
    ],
    concepts: [
      {
        term: "requests",
        plain: "调度时申请的资源量",
        detail: "调度器依据请求及其他约束放置 Pod，不仅依据实时使用率。",
      },
      {
        term: "limits",
        plain: "运行时资源上限",
        detail: "CPU 常体现为限流，内存超过上限可能被终止。",
      },
      {
        term: "OOMKilled",
        plain: "进程因内存问题被终止的状态证据",
        detail: "需结合限制、使用峰值及节点信息分析；不要只凭退出码下结论。",
      },
    ],
    commands: [
      {
        command:
          "kubectl --context kind-k8s-lab -n learning describe pod report-job",
        purpose: "读取无法调度的具体原因",
        expected: "事件为 CPU 请求容量不足",
        output:
          "Name: report-job\nStatus: Pending\nNode: <none>\nRequests:\n  cpu: 4\n  memory: 256Mi\nEvents:\n  Warning FailedScheduling 0/1 nodes are available: 1 Insufficient cpu.",
      },
      {
        command:
          "kubectl --context kind-k8s-lab -n learning describe pod memory-demo",
        purpose: "关联上次终止原因与内存限制",
        expected: "上次被 OOMKilled，限制为 128Mi",
        output:
          "Name: memory-demo\nStatus: Running\nContainers:\n  web:\n    Last State: Terminated\n      Reason: OOMKilled\n      Exit Code: 137\n    Restart Count: 3\n    Limits:\n      memory: 128Mi\n    Requests:\n      memory: 64Mi",
      },
    ],
    evidence: ["Insufficient cpu", "Reason: OOMKilled"],
    commonMistakes: [
      "看到节点当前空闲就认定调度器错误。",
      "把 CPU 限流与内存 OOM 当成同一机制。",
      "无依据地删除 limits 或把请求设为零。",
    ],
    quiz: {
      evidence: "Pod Pending；Node: <none>；FailedScheduling: Insufficient cpu",
      question: "优先检查什么？",
      options: [
        "容器日志里的业务异常",
        "Pod 的 CPU 请求与节点可分配资源及已分配请求",
        "Service 的 DNS 名称",
      ],
      correct: 1,
      explanation:
        "容器还未调度到节点，事件明确指向调度容量。要先核实请求和节点资源，再决定合理调整或扩容。",
    },
    challenge: {
      task: "为两个故障分别写一个待验证假设和最小调整计划。",
      steps: [
        "区分启动前调度问题与运行期终止。",
        "列出需要补充的容量证据。",
        "说明改动后的验收指标。",
      ],
      acceptance: [
        "report-job 检查 CPU 请求。",
        "memory-demo 检查内存峰值与泄漏。",
        "调整后验证稳定性而非只看短暂 Running。",
      ],
      solution:
        "report-job 可能申请超过现有可用 CPU 请求容量，先核查请求合理性和节点分配，再选择调整请求或增加容量。memory-demo 有 OOM 证据，检查峰值、泄漏与限制；有容量依据再调整。验收分别看成功调度，以及持续负载下无新增 OOM、就绪稳定、业务延迟正常。",
    },
    references: [
      {
        title: "Kubernetes：容器资源管理",
        url: "https://kubernetes.io/docs/concepts/configuration/manage-resources-containers/",
      },
    ],
  },
  {
    id: "k8s-security",
    module: "kubernetes",
    prerequisites: ["k8s-resources"],
    title: "身份、RBAC 与最小权限",
    subtitle: "谁在操作、能做什么、边界在哪里",
    duration: "40 分钟",
    outcome:
      "区分认证和授权，读懂 Role 与 RoleBinding，并检查只读身份的权限边界。",
    why: "排障工具只需要读取证据时，不应拥有修改部署或读取所有凭据的权限。这里的身份与权限回答均为模拟值，不代表本机授权。",
    sections: [
      {
        title: "先辨认身份，再讨论权限",
        body: "认证回答请求者是谁，授权决定这个身份能否执行指定操作。人通常通过 kubeconfig 使用凭据，Pod 内程序可使用 ServiceAccount 身份。命名空间是资源分区，并不自动提供所有隔离能力。排障前确认 context、namespace 和身份，避免拿管理员凭据验证后误以为应用账户也拥有相同权限。",
      },
      {
        title: "角色描述允许，绑定指定对象",
        body: "Role 在一个命名空间定义资源与动作，例如允许 get、list、watch pods。RoleBinding 把角色授予某个用户、组或 ServiceAccount。ClusterRole 可以定义更广泛的规则，但被 RoleBinding 引用时，命名空间资源权限仍限于该绑定的命名空间。pods/log 是独立子资源，能查看 Pod 并不必然能读日志。",
        example:
          '# 手工实验阅读示例：命名空间只读角色；仍需单独的 RoleBinding 才会授权。\napiVersion: rbac.authorization.k8s.io/v1\nkind: Role\nmetadata:\n  name: learning-reader\n  namespace: learning\nrules:\n  - apiGroups: [""]\n    resources: ["pods", "pods/log", "events"]\n    verbs: ["get", "list", "watch"]',
      },
      {
        title: "验证允许和拒绝两面",
        body: "最小权限验收既要证明读 Pod 被允许，也要证明更新 Deployment 或读取 Secret 被拒绝。本课使用 --as 指定服务账户进行权限自查，真实环境中发起这种模拟身份请求的人需要 impersonate 权限；权限不足不意味着被检查账户无权。只读工作台不应请求管理员权限来绕过拒绝，应该补充精确而必要的规则。",
      },
    ],
    concepts: [
      {
        term: "ServiceAccount",
        plain: "集群内程序使用的身份",
        detail: "属于命名空间；身份本身不等于拥有管理员权限。",
      },
      {
        term: "RBAC",
        plain: "通过角色与绑定授权",
        detail: "权限由资源、动作和作用范围组成；授权规则通常是累加允许。",
      },
      {
        term: "最小权限",
        plain: "只授予任务确实需要的能力",
        detail:
          "检查允许操作和拒绝操作，避免通配符、任意命名空间和不必要的 Secret 访问。",
      },
    ],
    commands: [
      {
        command:
          "kubectl --context kind-k8s-lab -n learning auth can-i get pods --as=system:serviceaccount:learning:lab-reader",
        purpose: "模拟核验服务账户能否读 Pod",
        expected: "yes 代表该项读取获准",
        output: "yes",
      },
      {
        command:
          "kubectl --context kind-k8s-lab -n learning auth can-i patch deployments --as=system:serviceaccount:learning:lab-reader",
        purpose: "模拟核验修改部署是否被拒绝",
        expected: "no 代表不能修改 Deployment",
        output: "no",
      },
    ],
    evidence: ["yes", "no"],
    commonMistakes: [
      "为了方便给排障身份 cluster-admin。",
      "把能读 Pod 当作能读取 Secret 或修改 Deployment。",
      "忽略 --as 在真实环境需要 impersonate 权限。",
    ],
    quiz: {
      evidence: "lab-reader：get pods = yes；patch deployments = no",
      question: "只读诊断工具遇到这个结果应怎么办？",
      options: [
        "自动申请 cluster-admin",
        "按权限读取证据，把修改留给独立审批执行流程",
        "用另一个命名空间绕过限制",
      ],
      correct: 1,
      explanation:
        "拒绝修改符合只读职责。需要变更时应走明确授权流程，不能把调查身份悄悄升级。",
    },
    challenge: {
      task: "为 learning 命名空间的 Pod 排障助手写一份权限申请。",
      steps: [
        "列出要读取的对象和子资源。",
        "写出被授权的服务账户。",
        "列出不应授予的动作与资源。",
      ],
      acceptance: [
        "包含 pods、pods/log 与 events。",
        "范围明确为 learning。",
        "明确排除 Secret 读取与部署修改。",
      ],
      solution:
        "为 learning 中的 lab-reader 绑定命名空间 Role，只允许读取必要的 pods、pods/log 和 events；按实际 API 使用进一步收窄动作。验证 get pods 可行、patch deployments 和 get secrets 被拒绝；不使用通配符和 cluster-admin，也不赋予助手 impersonate 权限。",
    },
    references: [
      {
        title: "Kubernetes：RBAC 授权",
        url: "https://kubernetes.io/docs/reference/access-authn-authz/rbac/",
      },
    ],
  },
];

export const troubleshootingLessons: Lesson[] = [
  {
    id: "troubleshoot-startup",
    module: "troubleshooting",
    prerequisites: ["04"],
    title: "启动故障分诊",
    subtitle: "Pending、ImagePullBackOff 与 CrashLoopBackOff 分开查",
    duration: "50 分钟",
    outcome: "根据容器启动进度选择事件、镜像信息或上次日志，形成有证据的假设。",
    why: "这三类故障发生在不同环节，反复重启不会自动解决它们。本课是三份互相独立的故障快照，没有隐藏的真实故障注入。",
    sections: [
      {
        title: "先问进程走到了哪一步",
        body: "Pending 是 Pod 阶段，可能尚未调度，也可能在等待镜像、配置或卷准备。kubectl 的 STATUS 列会展示更具体的等待原因。Node 为空且事件 FailedScheduling 时，先查资源和调度约束；已分配节点却卡住时，继续看镜像、挂载与容器状态，不要把 Pending 当成单一根因。",
      },
      {
        title: "镜像尚未到达，不会有业务日志",
        body: "ImagePullBackOff 表示镜像拉取失败后正在退避重试。事件里的 manifest unknown 支持标签不存在的假设，unauthorized 指向仓库认证，连接超时可能是网络或代理问题。本课 opspilot-missing-demo-tag 的证据是镜像版本不存在，应核对镜像仓库、标签和 Kind 节点可见性，不能只检查电脑是否曾下载过别的版本。",
      },
      {
        title: "启动过又退出，要看上次现场",
        body: "CrashLoopBackOff 是容器反复失败后等待重试的表现，不是完整根因。当前日志可能只有刚启动的一小段，--previous 可以读取同一 Pod 内上一个容器实例的日志；它不是永久历史归档。本课上一实例报告缺少 APP_MODE，所以先查配置引用与键名，保留证据后再提出变更，而不是盲目删除 Pod。",
      },
    ],
    concepts: [
      {
        term: "FailedScheduling",
        plain: "调度器没有找到合适节点",
        detail: "查看具体原因，例如资源请求、污点、亲和性或卷约束。",
      },
      {
        term: "ImagePullBackOff",
        plain: "拉取镜像失败后的退避等待",
        detail: "检查事件区分名称、认证和网络问题；等待本身不是修复。",
      },
      {
        term: "CrashLoopBackOff",
        plain: "容器反复退出后的退避等待",
        detail: "查看终止原因、退出码、上次日志与配置，不把它当作唯一根因。",
      },
    ],
    commands: [
      {
        command:
          "kubectl --context kind-k8s-lab -n learning describe pod pending-demo",
        purpose: "检查尚未调度的独立快照",
        expected: "节点为空，节点可调度内存不足以满足请求",
        output:
          "Name: pending-demo\nStatus: Pending\nNode: <none>\nEvents:\n  Warning FailedScheduling 0/1 nodes are available: 1 Insufficient memory.",
      },
      {
        command:
          "kubectl --context kind-k8s-lab -n learning describe pod image-demo",
        purpose: "读取镜像故障的具体解释",
        expected: "镜像标签不存在",
        output:
          "Name: image-demo\nNode: k8s-lab-control-plane\nState: Waiting\nReason: ImagePullBackOff\nImage: nginx:opspilot-missing-demo-tag\nEvents:\n  Warning Failed Failed to pull image: manifest unknown\n  Normal BackOff Back-off pulling image",
      },
      {
        command:
          "kubectl --context kind-k8s-lab -n learning logs crash-demo --previous --tail=20",
        purpose: "读取反复退出容器的上次日志快照",
        expected: "缺少 APP_MODE 配置",
        output:
          "INFO starting application\nERROR required environment variable APP_MODE is missing\nFATAL configuration validation failed; exiting with code 1",
      },
    ],
    evidence: [
      "Insufficient memory",
      "manifest unknown",
      "APP_MODE is missing",
    ],
    commonMistakes: [
      "尚未启动容器时反复找业务日志。",
      "把所有 ImagePullBackOff 都当作网络故障。",
      "先删除 Pod，随后才想收集上次日志。",
    ],
    quiz: {
      evidence:
        "CrashLoopBackOff；上次日志：required environment variable APP_MODE is missing",
      question: "证据最支持先检查什么？",
      options: [
        "Service selector",
        "环境变量与 ConfigMap 引用是否提供 APP_MODE",
        "节点 DNS 一定损坏",
      ],
      correct: 1,
      explanation:
        "日志直接指出缺少配置，但仍需核对模板和引用以确认缺失原因。先保留日志，再设计最小修复。",
    },
    challenge: {
      task: "分别为三份快照填写“环节—证据—下一步”。",
      steps: [
        "判断是否已经调度及启动。",
        "逐条引用具体错误。",
        "写一个能确认或排除假设的检查。",
      ],
      acceptance: [
        "三种状态使用不同检查路径。",
        "不把状态名直接写成根因。",
        "变更前保留日志和事件。",
      ],
      solution:
        "pending-demo 在调度环节受内存请求约束，核查节点容量与请求。image-demo 在镜像拉取环节报告 manifest unknown，核查镜像名称与可用标签。crash-demo 已启动后因配置校验退出，核查 APP_MODE 的模板和配置来源。三者都先固定证据与操作目标，再提出具体修复。",
    },
    references: [
      {
        title: "Kubernetes：调试 Pod",
        url: "https://kubernetes.io/docs/tasks/debug/debug-application/debug-pods/",
      },
    ],
  },
  {
    id: "troubleshoot-network",
    module: "troubleshooting",
    prerequisites: ["troubleshoot-startup"],
    title: "网络故障的证据链",
    subtitle: "从访问位置查到 DNS、选择器、端点和应用",
    duration: "50 分钟",
    outcome: "用最短证据链定位 Service 无后端，避免把所有转圈问题归因于 DNS。",
    why: "手机打不开、集群内打不开和单个 Pod 打不开不是同一个故障。以下为预设 selector 错误案例，查询不会改变 Service。",
    sections: [
      {
        title: "首先写清楚客户端在哪里",
        body: "记录客户端在手机、电脑还是 Pod 内，访问的协议、主机名和端口是什么。手机访问电脑局域网地址时，先检查同网连通、监听地址与端口；Pod 访问 Service 名时，才沿集群 DNS 与服务路径调查。不同子网不必然无法互通，但必须有路由和允许的网络策略，不能仅凭 IP 长得不同就下结论。",
      },
      {
        title: "使用匹配证据排除猜测",
        body: "本课 Service 选择 app=hello-api，而健康 Pod 的标签为 app=hello-web，EndpointSlice 的 endpoints 为空。三项证据共同支持“选择器不匹配导致无后端”，比单独看到 Pod Running 更有解释力。修复设计应恢复预期标签关系，不能把 selector 删除或扩大成不相关应用，否则可能把用户流量发错服务。",
      },
      {
        title: "修好端点以后继续验证",
        body: "端点恢复只是中间结果，后续还要验证 targetPort 是否对应应用监听端口、DNS 是否解析、请求是否获得预期响应。NetworkPolicy、集群网络组件、节点规则和客户端代理也可能影响链路。排查时每次只改变一个有证据的问题，并从原客户端位置复测，避免用“电脑能打开”代替“手机已恢复”。",
      },
    ],
    concepts: [
      {
        term: "访问位置",
        plain: "请求从哪个网络发出",
        detail: "手机局域网、宿主机与 Pod 网络有不同边界，需要分别验证。",
      },
      {
        term: "空端点",
        plain: "Service 当前没有可用的目标地址",
        detail: "检查 selector、Pod 标签与就绪；并非自动证明 DNS 故障。",
      },
      {
        term: "证据链",
        plain: "多条相互印证的观察",
        detail: "把客户端、服务配置、后端状态与请求结果连接成可验证解释。",
      },
    ],
    commands: [
      {
        command:
          "kubectl --context kind-k8s-lab -n learning get service broken-web -o yaml",
        purpose: "检查故障服务想选择的标签",
        expected: "selector 为 app: hello-api",
        output:
          "apiVersion: v1\nkind: Service\nmetadata:\n  name: broken-web\nspec:\n  type: ClusterIP\n  selector:\n    app: hello-api\n  ports:\n  - port: 80\n    targetPort: 80",
      },
      {
        command:
          "kubectl --context kind-k8s-lab -n learning get pods -l app=hello-web --show-labels",
        purpose: "对照实际应用标签与就绪",
        expected: "健康 Pod 标签为 app=hello-web",
        output:
          "NAME           READY   STATUS    RESTARTS   LABELS\nnetwork-demo   1/1     Running   0          app=hello-web,track=stable",
      },
      {
        command:
          "kubectl --context kind-k8s-lab -n learning get endpointslices -l kubernetes.io/service-name=broken-web -o yaml",
        purpose: "确认故障服务的切片没有后端地址",
        expected: "存在 EndpointSlice，但 endpoints 为空数组",
        output:
          "items:\n- apiVersion: discovery.k8s.io/v1\n  kind: EndpointSlice\n  metadata:\n    name: broken-web-placeholder\n    namespace: learning\n    labels:\n      kubernetes.io/service-name: broken-web\n  addressType: IPv4\n  ports:\n  - port: 80\n    protocol: TCP\n  endpoints: []",
      },
    ],
    evidence: ["app: hello-api", "app=hello-web,track=stable", "endpoints: []"],
    commonMistakes: [
      "一看到转圈就重启 CoreDNS。",
      "拿宿主机访问结果代替原客户端验证。",
      "只看 Pod 健康，忽略 selector 与 targetPort。",
    ],
    quiz: {
      evidence:
        "Service app=hello-api；Pod app=hello-web；EndpointSlice 的 endpoints 为空",
      question: "哪个方案与证据最一致？",
      options: [
        "先核对预期应用，再修正选择器并验证端点和请求",
        "直接给所有 Pod 加相同标签",
        "删除 DNS 服务",
      ],
      correct: 0,
      explanation:
        "必须确认服务真正应该选择的应用，再提出最小变更。恢复端点之后仍需验证请求，不能仅凭配置一致宣布恢复。",
    },
    challenge: {
      task: "写一份 broken-web 的故障记录与恢复验收。",
      steps: [
        "记录客户端位置和目标地址。",
        "引用三项匹配证据。",
        "提出最小修改并列出原位置复测。",
      ],
      acceptance: [
        "根因假设明确指向标签不匹配。",
        "不建议修改无关 DNS 或全局网络。",
        "验收包含就绪端点与实际 HTTP 响应。",
      ],
      solution:
        "记录集群内客户端访问 broken-web:80 失败；服务选择 hello-api，而目标应用标签为 hello-web，且端点为空。确认设计后将服务选择器恢复为正确标签，检查端点地址、ready 与端口，再从原客户端验证服务名和代表性请求。模拟只提供故障证据，实际改动需在自己的隔离实验环境完成。",
    },
    references: [
      {
        title: "Kubernetes：调试 Service",
        url: "https://kubernetes.io/docs/tasks/debug/debug-application/debug-service/",
      },
    ],
  },
  {
    id: "troubleshoot-capstone",
    module: "troubleshooting",
    prerequisites: ["troubleshoot-network"],
    title: "综合演练：发布故障与恢复验证",
    subtitle: "时间线 → 证据 → 假设 → 审批 → 执行 → 验证",
    duration: "60 分钟",
    outcome:
      "独立写出可审阅的故障结论、回退提案和验收条件，知道哪些结论仍缺证据。",
    why: "学习链的终点是能解释和验证一次完整处置，而不是记住更多命令。本课只展示发布失败快照，回退操作没有被执行。",
    sections: [
      {
        title: "先建立时间线和候选原因",
        body: "预设事故发生在新版上线后：历史有第 7、8 个修订版，新版日志报告不支持的 CONFIG_SCHEMA，旧副本仍就绪。旧版 ReplicaSet 为 release-demo-6d7f8c9b5，新版为 release-demo-7b8c9d6f4；查询日志的 Pod 为 release-demo-7b8c9d6f4-k2m9x，名称多了一段实例后缀（哈希为教学示例）。时间相邻只提供线索，日志和版本差异才帮助收窄原因。先记录影响范围、发布时间、镜像与配置版本，再核对新版是否和现有配置兼容；避免把所有同时发生的变化都当作根因。",
      },
      {
        title: "让回退提案可以被审阅",
        body: "提案需要写明目标 context、命名空间、Deployment、当前修订版、计划回退版本和依据，并说明影响、执行人、批准人及停止条件。Deployment 回退主要恢复 Pod 模板，不会自动还原数据库迁移或外部配置。若新版已经做不可逆数据迁移，回退旧镜像可能更危险，必须先确认兼容性和备份恢复方案。",
        example:
          "# 手工实验阅读示例：只有在隔离环境核验版本、兼容性并完成审批后才考虑执行。\n# 这是一条真实写操作，不属于模拟命令白名单。\nkubectl --context kind-k8s-lab -n learning rollout undo deployment/release-demo --to-revision=7",
      },
      {
        title: "执行成功不是事故结束",
        body: "恢复后要重新确认目标镜像、就绪副本、Service 端点和原先失败的业务请求，并在约定观察窗口内检查错误率、延迟与重启次数。若恢复指标未达标，就停止扩大动作并重新调查。本课训练的是一条可复用的基础处置链；生产系统还需要持续补充真实演练、容量、网络、数据与安全经验。",
      },
    ],
    concepts: [
      {
        term: "回退提案",
        plain: "可审阅的变更计划",
        detail: "明确目标、版本、证据、影响、兼容性、审批人和停止条件。",
      },
      {
        term: "恢复验收",
        plain: "证明服务真的恢复",
        detail: "副本就绪、端点、业务请求和持续观测共同构成恢复证据。",
      },
      {
        term: "变更边界",
        plain: "动作能恢复什么、不能恢复什么",
        detail: "Deployment 回退不自动恢复数据库、PVC 数据或外部配置。",
      },
    ],
    commands: [
      {
        command:
          "kubectl --context kind-k8s-lab -n learning rollout history deployment/release-demo",
        purpose: "取得候选回退版本依据",
        expected: "第 7 版稳定，第 8 版为新发布",
        output:
          "deployment.apps/release-demo\nREVISION  CHANGE-CAUSE\n7         stable image web:v7 config schema v1\n8         release image web:v8 requires schema v2",
      },
      {
        command:
          "kubectl --context kind-k8s-lab -n learning logs release-demo-7b8c9d6f4-k2m9x --previous --tail=20",
        purpose: "读取新版本失败原因",
        expected: "新版本拒绝旧配置格式",
        output:
          "INFO release=web:v8\nERROR unsupported CONFIG_SCHEMA=v1; expected v2\nFATAL startup validation failed; exiting with code 1",
      },
      {
        command:
          "kubectl --context kind-k8s-lab -n learning get replicasets -l app=release-demo",
        purpose: "确认当前影响和旧版保留情况",
        expected: "旧版就绪 2，新版未就绪",
        output:
          "NAME              DESIRED   CURRENT   READY\nrelease-demo-6d7f8c9b5   2         2         2\nrelease-demo-7b8c9d6f4   1         1         0",
      },
    ],
    evidence: [
      "requires schema v2",
      "unsupported CONFIG_SCHEMA=v1",
      "release-demo-7b8c9d6f4   1         1         0",
    ],
    commonMistakes: [
      "只因发布后出错就跳过日志和配置差异确认。",
      "把 rollout undo 当作数据库与外部配置的完整恢复。",
      "命令返回成功立即宣布业务恢复。",
    ],
    quiz: {
      evidence: "v8 需要 schema v2，日志实际读到 v1。旧版仍有两个就绪副本。",
      question: "下一步最合理的是？",
      options: [
        "立即删除整个命名空间",
        "核对配置兼容性，提出有审批和验收条件的最小恢复计划",
        "把 CONFIG_SCHEMA 随意改成 v2 就一定成功",
      ],
      correct: 1,
      explanation:
        "证据支持版本与配置不兼容的假设，但还需核对配置内容和数据兼容性。选择修正配置或回退时必须评估影响，再按计划验证。",
    },
    challenge: {
      task: "提交一份可由同伴审阅的事故处理单。",
      steps: [
        "写明已知事实、影响和仍未知的内容。",
        "用版本、日志和副本证据提出原因假设。",
        "给出修配置或回退的选择依据、审批与停止条件。",
        "列出恢复后四类验收和后续预防措施。",
      ],
      acceptance: [
        "至少引用三条具体证据。",
        "明确模拟未执行回退，也没有恢复后证据。",
        "变更前检查数据与配置兼容性。",
        "验收包括版本、就绪、端点、业务及观察窗口。",
      ],
      solution:
        "事实：v8 发布后启动校验失败，日志读到 schema v1，而 v8 要求 v2；旧版两个副本仍就绪，实际用户影响需查请求数据。假设为配置不兼容。核对变更差异和数据兼容性后，向指定审批人提交恢复 v7 或发布兼容配置的最小方案，明确 learning/release-demo 和停止条件。执行后验证镜像、2/2 就绪、端点和业务，并观察错误率与重启。当前只有故障快照，不能宣布已恢复。预防措施为发布前配置契约检查和回退演练。",
    },
    references: [
      {
        title: "Kubernetes：Deployment 回退",
        url: "https://kubernetes.io/docs/concepts/workloads/controllers/deployment/#rolling-back-a-deployment",
      },
      {
        title: "Kubernetes：调试应用",
        url: "https://kubernetes.io/docs/tasks/debug/debug-application/debug-pods/",
      },
    ],
  },
];
