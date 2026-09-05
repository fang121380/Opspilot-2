export type LessonCommand = {
  command: string;
  purpose: string;
  expected: string;
};

export type LessonConcept = {
  term: string;
  plain: string;
  detail: string;
};

export type LessonQuiz = {
  question: string;
  options: string[];
  correct: number;
  explanation: string;
};

export type Lesson = {
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

export const lessons: Lesson[] = [
  {
    id: "00",
    title: "环境检查",
    subtitle: "认识并检查 Docker、Kind、kubectl",
    duration: "10 分钟",
    outcome: "能说清三个工具分别做什么，并确认它们已经安装。",
    why: "后面的所有练习都依赖这三个工具。先确认工具正常，可以避免把安装问题误判成 Kubernetes 故障。",
    concepts: [
      { term: "Docker", plain: "应用的盒子", detail: "把程序、依赖和运行环境打包在一起。" },
      { term: "Kind", plain: "本机练习集群", detail: "使用 Docker 容器模拟 Kubernetes 节点。" },
      { term: "kubectl", plain: "集群遥控器", detail: "向 Kubernetes 查询状态或发送操作指令。" },
    ],
    commands: [
      { command: "docker --version", purpose: "确认 Docker 命令存在", expected: "输出 Docker version 和版本号" },
      { command: "kind version", purpose: "确认 Kind 命令存在", expected: "输出 kind v..." },
      { command: "kubectl version --client", purpose: "确认 kubectl 客户端存在", expected: "输出 Client Version" },
    ],
    evidence: ["Docker version", "kind v", "Client Version"],
    commonMistakes: ["Docker Desktop 已安装，但没有启动。", "只看到 kubectl 客户端版本，不代表已经连接集群。"],
    quiz: {
      question: "哪个工具负责向 Kubernetes 集群发送查询命令？",
      options: ["Docker", "Kind", "kubectl"],
      correct: 2,
      explanation: "kubectl 是 Kubernetes 的命令行客户端；Docker 运行容器，Kind 创建本地练习集群。",
    },
  },
  {
    id: "01",
    title: "Docker 基础",
    subtitle: "镜像、容器和端口",
    duration: "25 分钟",
    outcome: "理解镜像与容器的关系，并能启动一个临时容器。",
    why: "Kind 的 Kubernetes 节点本身就运行在 Docker 容器里。先理解容器，后面看 Pod 会轻松很多。",
    concepts: [
      { term: "镜像 Image", plain: "只读模板", detail: "像软件安装包，保存程序和依赖。" },
      { term: "容器 Container", plain: "运行中的实例", detail: "镜像启动后产生的进程和隔离环境。" },
      { term: "端口 Port", plain: "程序入口", detail: "让浏览器或其他程序能够访问容器中的服务。" },
    ],
    commands: [
      { command: "docker image ls", purpose: "查看本地镜像", expected: "显示 REPOSITORY、TAG 和 IMAGE ID" },
      { command: "docker run --rm hello-world", purpose: "启动一个临时容器", expected: "看到 Hello from Docker!" },
      { command: "docker ps", purpose: "查看正在运行的容器", expected: "hello-world 已结束，因此列表可能为空" },
    ],
    evidence: ["REPOSITORY", "Hello from Docker!", "CONTAINER ID"],
    commonMistakes: ["把镜像当成正在运行的容器。", "看到 docker ps 为空就认为执行失败；临时容器结束后为空是正常的。"],
    quiz: {
      question: "镜像和容器最接近下面哪种关系？",
      options: ["安装包与运行中的程序", "浏览器与网站", "服务器与网线"],
      correct: 0,
      explanation: "镜像是模板，容器是由镜像启动出来的运行实例。一个镜像可以启动多个容器。",
    },
  },
  {
    id: "02",
    title: "Kind 集群",
    subtitle: "集群、节点、上下文和命名空间",
    duration: "30 分钟",
    outcome: "确认自己正在操作哪个集群，并找到学习集群的节点和命名空间。",
    why: "运维操作最危险的错误之一是选错集群。每次操作前先确认 context，是必须养成的习惯。",
    concepts: [
      { term: "Cluster", plain: "一组协作的机器", detail: "Kubernetes 管理应用的整体环境。" },
      { term: "Node", plain: "集群中的机器", detail: "真正运行 Pod 的计算节点；Kind 用容器模拟。" },
      { term: "Context", plain: "当前操作目标", detail: "告诉 kubectl 使用哪个集群、用户和默认命名空间。" },
      { term: "Namespace", plain: "资源分区", detail: "在同一集群中对资源进行逻辑分组。" },
    ],
    commands: [
      { command: "kubectl config current-context", purpose: "确认当前集群", expected: "必须是 kind-k8s-lab" },
      { command: "kubectl get nodes", purpose: "查看集群节点", expected: "节点状态为 Ready" },
      { command: "kubectl get namespaces", purpose: "查看资源分区", expected: "包含 learning 命名空间" },
    ],
    evidence: ["kind-k8s-lab", "Ready", "learning"],
    commonMistakes: ["没有看 context 就直接执行命令。", "把 Namespace 误认为一台独立服务器。"],
    quiz: {
      question: "执行 kubectl 命令前，最先应该确认什么？",
      options: ["屏幕亮度", "当前 context", "Docker 镜像大小"],
      correct: 1,
      explanation: "context 决定命令发送到哪个集群。先确认目标，能避免误操作其他环境。",
    },
  },
  {
    id: "03",
    title: "部署一个应用",
    subtitle: "Deployment、Pod 和 Service",
    duration: "35 分钟",
    outcome: "理解 Kubernetes 如何保持应用副本，并通过稳定地址提供访问。",
    why: "Kubernetes 不只负责启动程序，还会持续检查实际状态是否符合期望状态，并在异常时重新创建实例。",
    concepts: [
      { term: "Pod", plain: "最小运行单元", detail: "通常包含一个主要应用容器。" },
      { term: "Deployment", plain: "应用管理员", detail: "声明副本数量并负责滚动更新和故障恢复。" },
      { term: "Service", plain: "稳定访问地址", detail: "Pod 会变化，Service 提供不变的入口。" },
    ],
    commands: [
      { command: "kubectl -n learning get deployment", purpose: "检查期望副本", expected: "hello-web 显示 2/2 Ready" },
      { command: "kubectl -n learning get pods", purpose: "检查实际运行实例", expected: "两个 Pod 都是 Running" },
      { command: "kubectl -n learning get service", purpose: "检查稳定访问入口", expected: "hello-web 类型为 ClusterIP" },
    ],
    evidence: ["2/2", "Running", "ClusterIP"],
    commonMistakes: ["只看 Pod，不检查 Deployment 的期望副本。", "以为 Service 会运行应用；真正运行应用的是 Pod。"],
    quiz: {
      question: "Pod 名称可能变化时，哪个对象提供稳定访问入口？",
      options: ["Service", "Event", "Context"],
      correct: 0,
      explanation: "Service 根据标签找到后端 Pod，并提供稳定的集群地址。",
    },
  },
  {
    id: "04",
    title: "故障排查",
    subtitle: "状态、事件、日志和 describe",
    duration: "45 分钟",
    outcome: "按照状态 → 事件 → 日志 → 详情的顺序收集证据，而不是盲目重启。",
    why: "排障的关键不是背命令，而是建立稳定的证据顺序。先观察再修改，才能知道真正原因和修复是否有效。",
    concepts: [
      { term: "Status", plain: "当前发生了什么", detail: "例如 Running、Pending、CrashLoopBackOff。" },
      { term: "Event", plain: "Kubernetes 的解释", detail: "记录调度、拉取镜像和探针等重要事件。" },
      { term: "Log", plain: "应用自己的记录", detail: "查看容器内部程序输出的运行细节。" },
      { term: "describe", plain: "对象完整诊断信息", detail: "汇总配置、状态、条件和相关事件。" },
    ],
    commands: [
      { command: "kubectl -n learning get events --sort-by=.lastTimestamp", purpose: "按时间查看集群事件", expected: "健康集群可能显示 No resources found" },
      { command: "kubectl -n learning logs deployment/hello-web", purpose: "查看应用日志", expected: "显示 nginx 请求或启动日志" },
      { command: "kubectl -n learning describe pod -l app=hello-web", purpose: "查看 Pod 详细诊断", expected: "显示 Status、Containers 和 Events" },
    ],
    evidence: ["No resources found", "nginx", "Status:"],
    commonMistakes: ["看到异常后立即重启，导致现场证据消失。", "只看日志，不看 Kubernetes Event 和资源状态。"],
    quiz: {
      question: "发现 Pod 异常时，哪种处理顺序更合理？",
      options: ["立即删除 → 再问原因", "状态 → 事件 → 日志 → 详情", "不断重启直到恢复"],
      correct: 1,
      explanation: "先按固定顺序收集证据，确定原因后再修改，修复过程才可验证、可复盘。",
    },
  },
];

export const glossary = lessons
  .flatMap((lesson) => lesson.concepts)
  .filter((concept, index, items) => items.findIndex((item) => item.term === concept.term) === index);
