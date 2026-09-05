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
  evidence?: string;
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
    outcome: "读懂三个工具的模拟版本输出，区分客户端存在、容器引擎可用和集群连通。",
    why: "后面的所有练习都依赖这三个工具。先确认工具正常，可以避免把安装问题误判成 Kubernetes 故障。",
    concepts: [
      { term: "Docker", plain: "构建和运行容器的工具", detail: "镜像保存程序和依赖，容器引擎负责运行容器。版本命令只检查客户端，不证明引擎正在运行。" },
      { term: "Kind", plain: "本机练习集群", detail: "把 Kubernetes 节点运行在容器中；本练习使用 Docker，Kind 也支持其他容器提供程序。" },
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
      evidence: "Docker version 29.0.0 (example)\nkind v0.29.0 (example)\nClient Version: v1.34.0 (example)",
      question: "这些模拟输出能支持哪项判断？",
      options: ["本机 Docker 引擎已启动", "真实集群已经连通", "认识了客户端版本输出；本机安装和集群连接仍需实机检查"],
      correct: 2,
      explanation: "这里是固定模拟输出，不能证明本机安装。真实终端中的版本输出也只证明客户端可执行；Docker 引擎和集群连通需要分别检查。",
    },
  },
  {
    id: "01",
    title: "Docker 基础",
    subtitle: "镜像、容器和端口",
    duration: "25 分钟",
    outcome: "从模拟输出解释镜像、容器，以及临时容器退出后的清理行为。",
    why: "Kind 的 Kubernetes 节点本身就运行在 Docker 容器里。先理解容器，后面看 Pod 会轻松很多。",
    concepts: [
      { term: "镜像 Image", plain: "只读模板", detail: "像软件安装包，保存程序和依赖。" },
      { term: "容器 Container", plain: "镜像创建的实例", detail: "有自己的进程和隔离环境，可以处于运行或停止状态；docker ps 默认只显示正在运行的容器。" },
      { term: "端口 Port", plain: "网络服务入口", detail: "容器端口不会自动发布到主机；主机访问通常需要端口映射，例如 -p 8080:80。hello-world 不提供网络服务。" },
    ],
    commands: [
      { command: "docker image ls", purpose: "查看本地镜像", expected: "显示 REPOSITORY、TAG 和 IMAGE ID" },
      { command: "docker run --rm hello-world", purpose: "模拟临时容器的一次运行", expected: "看到 Hello from Docker!；未在本机创建容器" },
      { command: "docker ps", purpose: "查看正在运行的容器", expected: "hello-world 已结束，因此列表可能为空" },
    ],
    evidence: ["REPOSITORY", "Hello from Docker!", "CONTAINER ID"],
    commonMistakes: ["把镜像当成正在运行的容器。", "看到 docker ps 为空就认为执行失败；临时容器结束后为空是正常的。"],
    quiz: {
      evidence: "$ docker run --rm hello-world\nHello from Docker!\n$ docker ps\nCONTAINER ID   IMAGE   STATUS\n(没有数据行)",
      question: "示例中 hello-world 没有出现在 docker ps，最合理的解释是？",
      options: ["程序已退出，--rm 随后删除容器；镜像仍可保留", "Docker 已自动删除所有镜像", "所有容器都必须持续运行，否则就是故障"],
      correct: 0,
      explanation: "hello-world 打印消息后退出。docker ps 默认只列运行中的容器，--rm 还会在退出后移除这个容器，不会因此删除其镜像。",
    },
  },
  {
    id: "02",
    title: "Kind 集群",
    subtitle: "集群、节点、上下文和命名空间",
    duration: "30 分钟",
    outcome: "读懂模拟 context、节点和命名空间输出，知道如何显式指定学习集群。",
    why: "运维操作最危险的错误之一是选错集群。每次操作前先确认 context，是必须养成的习惯。",
    concepts: [
      { term: "Cluster", plain: "一组协作的机器", detail: "Kubernetes 管理应用的整体环境。" },
      { term: "Node", plain: "集群中的计算节点", detail: "运行 Pod 的物理机、虚拟机或容器化节点；本练习的 Kind 节点运行在 Docker 容器中。" },
      { term: "Context", plain: "当前操作目标", detail: "告诉 kubectl 使用哪个集群、用户和默认命名空间。" },
      { term: "Namespace", plain: "资源分区", detail: "在同一集群中对资源进行逻辑分组。" },
    ],
    commands: [
      { command: "kubectl config current-context", purpose: "查看 kubeconfig 保存的默认 context", expected: "示例为 kind-k8s-lab；真实默认值可能不同" },
      { command: "kubectl --context kind-k8s-lab get nodes", purpose: "显式查询学习集群节点", expected: "示例节点状态为 Ready" },
      { command: "kubectl --context kind-k8s-lab get namespaces", purpose: "查询学习集群资源分区", expected: "示例包含 learning 命名空间" },
    ],
    evidence: ["kind-k8s-lab", "Ready", "learning"],
    commonMistakes: ["没有看 context 就直接执行命令。", "把 Namespace 误认为一台独立服务器。"],
    quiz: {
      evidence: "$ kubectl config current-context\nproduction\n$ kubectl --context kind-k8s-lab get nodes\nk8s-lab-control-plane   Ready",
      question: "第二条命令查询哪个目标？它会改变默认 context 吗？",
      options: ["查询 production，并改为学习集群", "查询 kind-k8s-lab；默认 context 仍是 production", "同时查询两个集群"],
      correct: 1,
      explanation: "--context 只覆盖这一次命令的目标，不改变 kubeconfig 中保存的默认 context。current-context 读取的是默认值，也不证明集群可达。",
    },
  },
  {
    id: "03",
    title: "读懂应用部署",
    subtitle: "Deployment、Pod 和 Service",
    duration: "35 分钟",
    outcome: "检查预先部署应用的模拟证据，区分副本就绪、Pod 运行与 Service 入口。",
    why: "Kubernetes 不只负责启动程序，还会持续检查实际状态是否符合期望状态，并在异常时重新创建实例。",
    concepts: [
      { term: "Pod", plain: "最小运行单元", detail: "通常包含一个主要应用容器。" },
      { term: "Deployment", plain: "应用副本控制器", detail: "声明期望副本并管理滚动更新，通过 ReplicaSet 维持 Pod 数量；不保证应用自身没有故障。" },
      { term: "Service", plain: "稳定网络入口", detail: "通常通过标签选择后端 Pod。ClusterIP 默认供集群内部访问；存在 Service 不等于后端健康或外部可访问。" },
    ],
    commands: [
      { command: "kubectl --context kind-k8s-lab -n learning get deployment", purpose: "比较就绪与期望副本", expected: "hello-web 的 READY 为 2/2，AVAILABLE 为 2" },
      { command: "kubectl --context kind-k8s-lab -n learning get pods", purpose: "同时检查运行状态与容器就绪", expected: "两个 Pod 均为 Running，READY 均为 1/1" },
      { command: "kubectl --context kind-k8s-lab -n learning get service", purpose: "检查服务类型与端口", expected: "hello-web 类型为 ClusterIP，端口为 80/TCP" },
    ],
    evidence: ["2/2", "Running", "ClusterIP"],
    commonMistakes: ["只看 Pod，不检查 Deployment 的期望副本。", "以为 Service 会运行应用；真正运行应用的是 Pod。"],
    quiz: {
      evidence: "DEPLOYMENT   READY   AVAILABLE\nhello-web    2/2     2\nPOD          READY   STATUS\nhello-web-a  1/1     Running\nhello-web-b  1/1     Running\nSERVICE      TYPE        PORT(S)\nhello-web    ClusterIP   80/TCP",
      question: "根据这组快照，哪项判断有证据支持？",
      options: ["两个副本就绪，Service 提供集群内部入口；外部访问仍未验证", "ClusterIP 说明公网用户能直接访问", "Running 就能证明全部业务请求成功"],
      correct: 0,
      explanation: "2/2 和 1/1 是就绪证据；Running 仅反映运行状态。ClusterIP 默认面向集群内部，仍需检查后端端点和实际请求，才能判断服务路径是否正常。",
    },
  },
  {
    id: "04",
    title: "故障排查",
    subtitle: "状态、事件、日志和 describe",
    duration: "45 分钟",
    outcome: "结合上一课的状态快照，阅读模拟事件、日志和详情，形成待验证的故障假设。",
    why: "排障的关键不是背命令，而是建立稳定的证据顺序。先观察再修改，才能知道真正原因和修复是否有效。",
    concepts: [
      { term: "Pod phase", plain: "Pod 生命周期阶段", detail: "阶段包括 Pending、Running、Succeeded、Failed 和 Unknown。kubectl 的 STATUS 列还可能显示容器等待原因，如 CrashLoopBackOff；它不是 Pod phase。Running 也不等于 Ready。" },
      { term: "Event", plain: "Kubernetes 的解释", detail: "记录调度、拉取镜像和探针等重要事件。" },
      { term: "Log", plain: "应用自己的记录", detail: "查看容器内部程序输出的运行细节。" },
      { term: "describe", plain: "对象诊断摘要", detail: "汇总配置、状态、条件和近期事件，不包含所有历史。就绪探针失败会使容器未就绪，不会直接触发容器重启。" },
    ],
    commands: [
      { command: "kubectl --context kind-k8s-lab -n learning get events --sort-by=.lastTimestamp", purpose: "按最后记录时间查看命名空间事件", expected: "示例显示 No resources found；事件可能过期，不能据此证明健康" },
      { command: "kubectl --context kind-k8s-lab -n learning logs deployment/hello-web", purpose: "查看 Deployment 所选一个 Pod 的日志", expected: "示例显示 nginx 启动与请求日志；不是两个副本的全部日志" },
      { command: "kubectl --context kind-k8s-lab -n learning describe pod -l app=hello-web", purpose: "查看标签匹配的所有 Pod 详情", expected: "示例显示两个 Pod 的 Status、Containers 和 Events" },
    ],
    evidence: ["No resources found", "nginx", "Status:"],
    commonMistakes: ["看到异常后立即重启，导致现场证据消失。", "只看日志，不看 Kubernetes Event 和资源状态。"],
    quiz: {
      evidence: "POD          READY   STATUS    RESTARTS\nhello-web-a  0/1     Running   0\nWarning Unhealthy: Readiness probe failed: HTTP 503\nApplication log: GET /ready 503",
      question: "这些故障示例证据最支持下一步做什么？",
      options: ["认定 Running 就是健康，忽略 503", "检查就绪探针配置和 /ready 依赖，再验证就绪与实际请求", "认定就绪探针会重启容器，等待自动恢复"],
      correct: 1,
      explanation: "Running 与 0/1 可以同时存在。503 和 Unhealthy 支持就绪检查失败的假设，但还不能确定根因。就绪探针失败会停止把该 Pod 作为就绪后端，不会像存活探针失败那样直接重启容器。",
    },
  },
];

export const glossary = lessons
  .flatMap((lesson) => lesson.concepts)
  .filter((concept, index, items) => items.findIndex((item) => item.term === concept.term) === index);
