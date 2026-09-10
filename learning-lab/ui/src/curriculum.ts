import { dockerLessons, kindLessons } from "./courses/docker-kind.ts";
import {
  kubernetesLessons,
  troubleshootingLessons,
} from "./courses/kubernetes.ts";

export type LessonCommand = {
  command: string;
  purpose: string;
  expected: string;
  output?: string;
};

export type LessonConcept = {
  term: string;
  plain: string;
  detail: string;
};

export type LessonQuiz = {
  evidence?: string;
  question: string;
  options: string[];
  correct: number;
  explanation: string;
};

export type Lesson = {
  module?: ModuleId;
  prerequisites?: string[];
  sections?: { title: string; body: string; example?: string }[];
  challenge?: {
    task: string;
    steps: string[];
    acceptance: string[];
    solution: string;
  };
  references?: { title: string; url: string }[];
  id: string;
  title: string;
  subtitle: string;
  duration: string;
  outcome: string;
  why: string;
  concepts: LessonConcept[];
  commands: LessonCommand[];
  evidence: string[];
  commonMistakes: string[];
  quiz: LessonQuiz;
};

const introductoryLessons: Lesson[] = [
  {
    id: "00",
    sections: [
      {
        title: "先看懂命令，再验证你的电脑",
        body: "这一章先建立学习方法。网页给出固定样例，你可以立即观察输出；真正的 Docker 引擎和 Kubernetes 集群需要在电脑上单独准备。命令由工具名、子命令、选项和对象名组成，例如 kubectl 的 --client 选项把版本查询限定为客户端。不要把示例版本号当作必须安装的版本，也不要把网页里成功运行等同于系统里安装成功。",
      },
      {
        title: "把环境问题拆成三层",
        body: "第一层是命令能否找到：找不到命令通常检查安装路径与 PATH。第二层是容器引擎：Docker 客户端可以存在，而 Docker Desktop 尚未启动。第三层才是集群连接：kubectl 需要 kubeconfig 中的集群地址和身份，地址可能已经失效。按层定位能避免为了一个安装问题反复重建应用。",
      },
      {
        title: "如何完成这条学习链",
        body: "按目录完成 Docker、Kind、Kubernetes 和排障四章。每课先解释现象背后的机制，再观察模拟输出，最后写出证据支持的判断；新增深入课程还需要完成应用任务自评。每章实机手册把知识用到同一个小网站上，没有运行环境时可以先阅读与分析，之后补实机验收。学习记录只保存在当前浏览器。",
      },
    ],
    title: "环境检查",
    subtitle: "认识并检查 Docker、Kind、kubectl",
    duration: "10 分钟",
    outcome:
      "读懂三个工具的模拟版本输出，区分客户端存在、容器引擎可用和集群连通。",
    why: "后面的所有练习都依赖这三个工具。先确认工具正常，可以避免把安装问题误判成 Kubernetes 故障。",
    concepts: [
      {
        term: "Docker",
        plain: "构建和运行容器的工具",
        detail:
          "镜像保存程序和依赖，容器引擎负责运行容器。版本命令只检查客户端，不证明引擎正在运行。",
      },
      {
        term: "Kind",
        plain: "本机练习集群",
        detail:
          "把 Kubernetes 节点运行在容器中；本练习使用 Docker，Kind 也支持其他容器提供程序。",
      },
      {
        term: "kubectl",
        plain: "集群遥控器",
        detail: "向 Kubernetes 查询状态或发送操作指令。",
      },
    ],
    commands: [
      {
        command: "docker --version",
        purpose: "确认 Docker 命令存在",
        expected: "输出 Docker version 和版本号",
      },
      {
        command: "kind version",
        purpose: "确认 Kind 命令存在",
        expected: "输出 kind v...",
      },
      {
        command: "kubectl version --client",
        purpose: "确认 kubectl 客户端存在",
        expected: "输出 Client Version",
      },
    ],
    evidence: ["Docker version", "kind v", "Client Version"],
    commonMistakes: [
      "Docker Desktop 已安装，但没有启动。",
      "只看到 kubectl 客户端版本，不代表已经连接集群。",
    ],
    quiz: {
      evidence:
        "Docker version 29.0.0 (example)\nkind v0.29.0 (example)\nClient Version: v1.34.0 (example)",
      question: "这些模拟输出能支持哪项判断？",
      options: [
        "本机 Docker 引擎已启动",
        "真实集群已经连通",
        "认识了客户端版本输出；本机安装和集群连接仍需实机检查",
      ],
      correct: 2,
      explanation:
        "这里是固定模拟输出，不能证明本机安装。真实终端中的版本输出也只证明客户端可执行；Docker 引擎和集群连通需要分别检查。",
    },
  },
  {
    id: "01",
    sections: [
      {
        title: "从一个程序开始理解容器",
        body: "容器不是一台完整虚拟机，而是一组受隔离和资源约束的进程。启动镜像时，容器运行它指定的主进程；主进程退出，容器也会停止。Linux 容器需要 Linux 内核，macOS 或 Windows 上的 Docker Desktop 通常提供这一运行环境。镜像负责交付文件和默认配置，容器才承载这次执行。",
      },
      {
        title: "用 hello-world 区分对象和状态",
        body: "hello-world 只打印一段消息便退出，因此它适合认识容器，却不适合练习持续提供网站服务。docker image ls 查看模板，docker ps 查看正在运行的实例，这两个列表回答不同的问题。--rm 让退出后的实例自动删除，镜像仍保留；接下来的生命周期课程将用持续运行的网站解释停止、重启、日志和退出码。",
      },
      {
        title: "容器与后面的课程如何衔接",
        body: "理解镜像和容器后，先学习如何写 Dockerfile 生成自己的镜像，再处理端口、容器间网络和数据保存，最后用 Compose 组织多个服务。只有能解释应用为什么启动、为何访问不到、重建后数据去了哪里，再进入 Kind，才能分清问题发生在宿主机、容器节点还是 Kubernetes 应用层。",
      },
    ],
    title: "Docker 基础",
    subtitle: "镜像、容器和端口",
    duration: "25 分钟",
    outcome: "从模拟输出解释镜像、容器，以及临时容器退出后的清理行为。",
    why: "Kind 的 Kubernetes 节点本身就运行在 Docker 容器里。先理解容器，后面看 Pod 会轻松很多。",
    concepts: [
      {
        term: "镜像 Image",
        plain: "只读模板",
        detail: "像软件安装包，保存程序和依赖。",
      },
      {
        term: "容器 Container",
        plain: "镜像创建的实例",
        detail:
          "有自己的进程和隔离环境，可以处于运行或停止状态；docker ps 默认只显示正在运行的容器。",
      },
      {
        term: "端口 Port",
        plain: "网络服务入口",
        detail:
          "容器端口不会自动发布到主机；主机访问通常需要端口映射，例如 -p 8080:80。hello-world 不提供网络服务。",
      },
    ],
    commands: [
      {
        command: "docker image ls",
        purpose: "查看本地镜像",
        expected: "显示 REPOSITORY、TAG 和 IMAGE ID",
      },
      {
        command: "docker run --rm hello-world",
        purpose: "模拟临时容器的一次运行",
        expected: "看到 Hello from Docker!；未在本机创建容器",
      },
      {
        command: "docker ps",
        purpose: "查看正在运行的容器",
        expected: "hello-world 已结束，因此列表可能为空",
      },
    ],
    evidence: ["REPOSITORY", "Hello from Docker!", "CONTAINER ID"],
    commonMistakes: [
      "把镜像当成正在运行的容器。",
      "看到 docker ps 为空就认为执行失败；临时容器结束后为空是正常的。",
    ],
    quiz: {
      evidence:
        "$ docker run --rm hello-world\nHello from Docker!\n$ docker ps\nCONTAINER ID   IMAGE   STATUS\n(没有数据行)",
      question: "示例中 hello-world 没有出现在 docker ps，最合理的解释是？",
      options: [
        "程序已退出，--rm 随后删除容器；镜像仍可保留",
        "Docker 已自动删除所有镜像",
        "所有容器都必须持续运行，否则就是故障",
      ],
      correct: 0,
      explanation:
        "hello-world 打印消息后退出。docker ps 默认只列运行中的容器，--rm 还会在退出后移除这个容器，不会因此删除其镜像。",
    },
  },
  {
    id: "02",
    sections: [
      {
        title: "把容器知识应用到集群",
        body: "Docker 章节已经说明容器怎样运行进程。Kind 利用这个能力把 Kubernetes 节点运行在容器中，节点内部再由容器运行时承载 Pod。宿主机上的 docker ps 看到的是节点容器，不是每一个业务 Pod；业务状态应通过 kubectl 查询。Kind 的价值是可重复的本地实验，而不是模拟所有生产基础设施。",
      },
      {
        title: "目标和分区是两次选择",
        body: "context 选择集群地址、身份和默认命名空间；namespace 在选定集群内组织命名空间级对象。同名的 Deployment 可以存在于两个命名空间，也可以存在于两套集群。每次命令显式写 --context kind-k8s-lab，查询工作负载再写 -n learning，使记录中的操作范围清楚，不依赖可能变动的默认值。",
      },
      {
        title: "本章先建立环境，再承载应用",
        body: "这一课先认识节点和作用域，随后学习控制平面如何协调节点、怎样声明多节点配置、为何主机有镜像但 Pod 仍拉取失败，以及什么时候能安全重建。实机手册沿用独立 k8s-lab 集群，将 Docker 章节制作的镜像装入节点；不要为了匹配样例输出去删除已有的学习集群。",
      },
    ],
    title: "Kind 集群",
    subtitle: "集群、节点、上下文和命名空间",
    duration: "30 分钟",
    outcome: "读懂模拟 context、节点和命名空间输出，知道如何显式指定学习集群。",
    why: "运维操作最危险的错误之一是选错集群。每次操作前先确认 context，是必须养成的习惯。",
    concepts: [
      {
        term: "Cluster",
        plain: "一组协作的机器",
        detail: "Kubernetes 管理应用的整体环境。",
      },
      {
        term: "Node",
        plain: "集群中的计算节点",
        detail:
          "运行 Pod 的物理机、虚拟机或容器化节点；本练习的 Kind 节点运行在 Docker 容器中。",
      },
      {
        term: "Context",
        plain: "当前操作目标",
        detail: "告诉 kubectl 使用哪个集群、用户和默认命名空间。",
      },
      {
        term: "Namespace",
        plain: "资源分区",
        detail: "在同一集群中对资源进行逻辑分组。",
      },
    ],
    commands: [
      {
        command: "kubectl config current-context",
        purpose: "查看 kubeconfig 保存的默认 context",
        expected: "示例为 kind-k8s-lab；真实默认值可能不同",
      },
      {
        command: "kubectl --context kind-k8s-lab get nodes",
        purpose: "显式查询学习集群节点",
        expected: "示例节点状态为 Ready",
      },
      {
        command: "kubectl --context kind-k8s-lab get namespaces",
        purpose: "查询学习集群资源分区",
        expected: "示例包含 learning 命名空间",
      },
    ],
    evidence: ["kind-k8s-lab", "Ready", "learning"],
    commonMistakes: [
      "没有看 context 就直接执行命令。",
      "把 Namespace 误认为一台独立服务器。",
    ],
    quiz: {
      evidence:
        "$ kubectl config current-context\nproduction\n$ kubectl --context kind-k8s-lab get nodes\nk8s-lab-control-plane   Ready",
      question: "第二条命令查询哪个目标？它会改变默认 context 吗？",
      options: [
        "查询 production，并改为学习集群",
        "查询 kind-k8s-lab；默认 context 仍是 production",
        "同时查询两个集群",
      ],
      correct: 1,
      explanation:
        "--context 只覆盖这一次命令的目标，不改变 kubeconfig 中保存的默认 context。current-context 读取的是默认值，也不证明集群可达。",
    },
  },
  {
    id: "03",
    sections: [
      {
        title: "一个网站对应几类对象",
        body: "Kind 章节准备了节点和镜像，现在才开始管理应用。Deployment 记录期望副本和模板，通过 ReplicaSet 维持 Pod；Pod 中的容器提供程序服务；Service 用标签选出后端并提供稳定入口。它们各有职责，因此排查网站时需要同时检查控制器、运行实例与网络入口，而不能只看一个绿色状态。",
      },
      {
        title: "快照证明什么，不能证明什么",
        body: "Deployment 的 2/2 表示当前就绪副本与期望值一致；Pod 的 Running 表示阶段，READY 的 1/1 表示容器就绪。Service 是 ClusterIP 时，默认只提供集群内部入口。这些快照仍不能证明数据库可用、请求延迟合格或浏览器可访问。后面的服务发现、探针和综合任务会逐步补齐这些证据。",
      },
      {
        title: "从观察到声明式管理",
        body: "先看懂一个已经部署的网站，再学习对象的 metadata、spec 和 status，以及标签选择器怎样把资源关联起来。随后处理更新、配置、数据、资源与权限，让应用在变化中保持可解释。实机实验使用独立 study-web，网页快照使用预设 hello-web 场景；两者不要求 Pod 名称或时间完全相同，应核对字段含义。",
      },
    ],
    title: "读懂应用部署",
    subtitle: "Deployment、Pod 和 Service",
    duration: "35 分钟",
    outcome:
      "检查预先部署应用的模拟证据，区分副本就绪、Pod 运行与 Service 入口。",
    why: "Kubernetes 不只负责启动程序，还会持续检查实际状态是否符合期望状态，并在异常时重新创建实例。",
    concepts: [
      {
        term: "Pod",
        plain: "最小运行单元",
        detail: "通常包含一个主要应用容器。",
      },
      {
        term: "Deployment",
        plain: "应用副本控制器",
        detail:
          "声明期望副本并管理滚动更新，通过 ReplicaSet 维持 Pod 数量；不保证应用自身没有故障。",
      },
      {
        term: "Service",
        plain: "稳定网络入口",
        detail:
          "通常通过标签选择后端 Pod。ClusterIP 默认供集群内部访问；存在 Service 不等于后端健康或外部可访问。",
      },
    ],
    commands: [
      {
        command: "kubectl --context kind-k8s-lab -n learning get deployment",
        purpose: "比较就绪与期望副本",
        expected: "hello-web 的 READY 为 2/2，AVAILABLE 为 2",
      },
      {
        command: "kubectl --context kind-k8s-lab -n learning get pods",
        purpose: "同时检查运行状态与容器就绪",
        expected: "两个 Pod 均为 Running，READY 均为 1/1",
      },
      {
        command: "kubectl --context kind-k8s-lab -n learning get service",
        purpose: "检查服务类型与端口",
        expected: "hello-web 类型为 ClusterIP，端口为 80/TCP",
      },
    ],
    evidence: ["2/2", "Running", "ClusterIP"],
    commonMistakes: [
      "只看 Pod，不检查 Deployment 的期望副本。",
      "以为 Service 会运行应用；真正运行应用的是 Pod。",
    ],
    quiz: {
      evidence:
        "DEPLOYMENT   READY   AVAILABLE\nhello-web    2/2     2\nPOD          READY   STATUS\nhello-web-a  1/1     Running\nhello-web-b  1/1     Running\nSERVICE      TYPE        PORT(S)\nhello-web    ClusterIP   80/TCP",
      question: "根据这组快照，哪项判断有证据支持？",
      options: [
        "两个副本就绪，Service 提供集群内部入口；外部访问仍未验证",
        "ClusterIP 说明公网用户能直接访问",
        "Running 就能证明全部业务请求成功",
      ],
      correct: 0,
      explanation:
        "2/2 和 1/1 是就绪证据；Running 仅反映运行状态。ClusterIP 默认面向集群内部，仍需检查后端端点和实际请求，才能判断服务路径是否正常。",
    },
  },
  {
    id: "04",
    sections: [
      {
        title: "先定义失败，再收集证据",
        body: "在排障之前，先说清哪个请求、哪个对象、什么时候出现了异常。记录集群和命名空间，读取资源状态，再用 describe 看条件与事件，最后关联正确容器和时间范围的日志。这样得到的是可复核的证据链，而不是凭印象判断；不要在保留现场之前通过重启抹掉上一轮退出日志或对象状态。",
      },
      {
        title: "区分事实、假设和操作",
        body: "0/1 Running 是事实，探针返回 503 是另一条事实；应用依赖未就绪可能解释两者，但仍是假设。修改探针或回滚是操作，必须说明预期改善哪项证据。只恢复 Ready 仍不够，还需确认真实请求、错误率与观察时间。后面的启动故障、网络故障和综合复盘将练习如何逐层缩小范围。",
      },
      {
        title: "不要把不同来源拼成虚假的时间线",
        body: "课程命令展示固定快照，判断题则给出独立故障场景；它们不是你连续操作同一真实环境的历史。真实诊断要注明采集时间、目标 Pod 和容器，旧日志或空事件不能替代当前状态。实机手册会手工引入一个就绪探针故障，再从 Deployment、Pod、事件和请求逐项观察，最后以同样指标复验恢复。",
      },
    ],
    title: "故障排查",
    subtitle: "状态、事件、日志和 describe",
    duration: "45 分钟",
    outcome:
      "结合应用部署课的状态快照，阅读模拟事件、日志和详情，形成待验证的故障假设。",
    why: "排障的关键不是背命令，而是建立稳定的证据顺序。先观察再修改，才能知道真正原因和修复是否有效。",
    concepts: [
      {
        term: "Pod phase",
        plain: "Pod 生命周期阶段",
        detail:
          "阶段包括 Pending、Running、Succeeded、Failed 和 Unknown。kubectl 的 STATUS 列还可能显示容器等待原因，如 CrashLoopBackOff；它不是 Pod phase。Running 也不等于 Ready。",
      },
      {
        term: "Event",
        plain: "Kubernetes 的解释",
        detail: "记录调度、拉取镜像和探针等重要事件。",
      },
      {
        term: "Log",
        plain: "应用自己的记录",
        detail: "查看容器内部程序输出的运行细节。",
      },
      {
        term: "describe",
        plain: "对象诊断摘要",
        detail:
          "汇总配置、状态、条件和近期事件，不包含所有历史。就绪探针失败会使容器未就绪，不会直接触发容器重启。",
      },
    ],
    commands: [
      {
        command:
          "kubectl --context kind-k8s-lab -n learning get events --sort-by=.lastTimestamp",
        purpose: "按最后记录时间查看命名空间事件",
        expected: "示例显示 No resources found；事件可能过期，不能据此证明健康",
      },
      {
        command:
          "kubectl --context kind-k8s-lab -n learning logs deployment/hello-web",
        purpose: "查看 Deployment 所选一个 Pod 的日志",
        expected: "示例显示 nginx 启动与请求日志；不是两个副本的全部日志",
      },
      {
        command:
          "kubectl --context kind-k8s-lab -n learning describe pod -l app=hello-web",
        purpose: "查看标签匹配的所有 Pod 详情",
        expected: "示例显示两个 Pod 的 Status、Containers 和 Events",
      },
    ],
    evidence: ["No resources found", "nginx", "Status:"],
    commonMistakes: [
      "看到异常后立即重启，导致现场证据消失。",
      "只看日志，不看 Kubernetes Event 和资源状态。",
    ],
    quiz: {
      evidence:
        "POD          READY   STATUS    RESTARTS\nhello-web-a  0/1     Running   0\nWarning Unhealthy: Readiness probe failed: HTTP 503\nApplication log: GET /ready 503",
      question: "这些故障示例证据最支持下一步做什么？",
      options: [
        "认定 Running 就是健康，忽略 503",
        "检查就绪探针配置和 /ready 依赖，再验证就绪与实际请求",
        "认定就绪探针会重启容器，等待自动恢复",
      ],
      correct: 1,
      explanation:
        "Running 与 0/1 可以同时存在。503 和 Unhealthy 支持就绪检查失败的假设，但还不能确定根因。就绪探针失败会停止把该 Pod 作为就绪后端，不会像存活探针失败那样直接重启容器。",
    },
  },
];

export type ModuleId =
  "foundation" | "docker" | "kind" | "kubernetes" | "troubleshooting";
export const modules: {
  id: ModuleId;
  title: string;
  outcome: string;
  milestone: string;
}[] = [
  {
    id: "foundation",
    title: "学习准备",
    outcome: "区分工具、运行环境和操作目标。",
    milestone: "能解释客户端版本为何不能证明环境可用。",
  },
  {
    id: "docker",
    title: "Docker：从进程到多服务",
    outcome: "理解容器生命周期，构建镜像，连接网络和存储，组织多服务。",
    milestone: "交付可重复构建、可访问、可诊断的容器应用。",
  },
  {
    id: "kind",
    title: "Kind：搭建可复现的实验环境",
    outcome: "理解节点与宿主机关系，配置集群、装载镜像并管理生命周期。",
    milestone: "能将本地镜像送入指定学习集群，并说明重建会丢失什么。",
  },
  {
    id: "kubernetes",
    title: "Kubernetes：管理应用的整个生命周期",
    outcome: "从声明式对象走到发布、网络、配置、存储、健康检查和权限。",
    milestone: "能解释从配置到 Pod、Service 和请求的完整路径。",
  },
  {
    id: "troubleshooting",
    title: "综合排障：用证据验证判断",
    outcome: "串联状态、事件、日志和流量，区分启动、就绪与网络故障。",
    milestone: "提交包含现象、证据、假设、最小修复和验证的事故记录。",
  },
];

export const lessons: Lesson[] = [
  { ...introductoryLessons[0], module: "foundation", prerequisites: [] },
  { ...introductoryLessons[1], module: "docker", prerequisites: ["00"] },
  ...dockerLessons,
  {
    ...introductoryLessons[2],
    module: "kind",
    prerequisites: ["docker-capstone"],
  },
  ...kindLessons,
  {
    ...introductoryLessons[3],
    module: "kubernetes",
    prerequisites: ["kind-lifecycle"],
  },
  ...kubernetesLessons,
  {
    ...introductoryLessons[4],
    module: "troubleshooting",
    prerequisites: ["k8s-security"],
  },
  ...troubleshootingLessons,
];

export const glossary = lessons
  .flatMap((lesson) => lesson.concepts)
  .filter(
    (concept, index, items) =>
      items.findIndex((item) => item.term === concept.term) === index,
  );
