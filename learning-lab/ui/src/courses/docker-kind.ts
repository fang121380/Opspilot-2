import type { Lesson } from "../curriculum";

const dockerDocs = "https://docs.docker.com";
const kindDocs = "https://kind.sigs.k8s.io/docs/user";

export const dockerLessons: Lesson[] = [
  {
    id: "docker-lifecycle",
    module: "docker",
    prerequisites: ["01"],
    title: "容器生命周期与进程",
    subtitle: "从创建到退出，解释容器为什么停下来",
    duration: "40 分钟",
    outcome:
      "结合状态、退出码和日志，区分正常结束、应用失败与尚未证实的资源问题。",
    why: "进入 Kubernetes 前，先理解容器并不是自动常驻的小电脑；它的主进程决定了实例的生命。",
    sections: [
      {
        title: "沿着一个实例追踪状态",
        body: "本课是预设故障快照：lab-worker 已退出，后面的查询不会让它重新运行。docker run 会基于镜像创建新实例并启动，docker start 则启动已有的停止实例。停止保留实例及可写层，删除才移除该层。先用名称锁定对象，再看状态和日志，避免把新建实例误当成旧实例恢复。",
      },
      {
        title: "主进程退出，容器也随之停止",
        body: "容器内 PID 1 是它的主进程。后台模式 -d 只是把终端还给你，并不会让已经退出的程序继续活着。停止时 Docker 先发送配置的停止信号（通常为 SIGTERM），超时后才强制结束；应用应接住信号并保存数据。用 exec 形式启动应用有助于让信号直接送达，而不是被中间 Shell 吞掉。",
        example:
          '# Dockerfile 阅读样例，不在模拟终端执行\nENTRYPOINT ["python", "worker.py"]\n# 在隔离实验环境的系统终端中，docker stop lab-worker 会改变实例状态。\n# 本课只读取停止后的证据，不自动执行停止或重启。',
      },
      {
        title: "退出码是线索，日志才补充语境",
        body: "ExitCode 0 通常表示程序按自己的约定正常结束，非零通常表示失败，但不能只凭数值下根因结论。本例退出码为 1，日志明确指出缺少配置文件；OOMKilled 为 false，只能说明这份快照没有标记该容器被 OOM 杀死。先核对配置来源和路径，修复后再比较新一次启动日志与业务结果。",
      },
    ],
    concepts: [
      {
        term: "PID 1",
        plain: "容器的主进程",
        detail: "它退出时容器停止；程序还需要正确处理信号与子进程。",
      },
      {
        term: "退出码",
        plain: "程序结束时交回的状态",
        detail:
          "必须结合具体程序语义、日志和容器状态解释，非零不自动等于内存不足。",
      },
      {
        term: "容器可写层",
        plain: "这个实例自己的文件改动",
        detail: "停止后仍在，删除实例后移除；它不是可靠的数据持久化方案。",
      },
    ],
    commands: [
      {
        command: "docker inspect lab-worker",
        purpose: "读取停止实例的状态摘要",
        expected: "exited、ExitCode 1、OOMKilled false",
        output:
          '[预设场景：生命周期，inspect 节选]\n[\n  {\n    "Name": "/lab-worker",\n    "State": {\n      "Status": "exited",\n      "ExitCode": 1,\n      "OOMKilled": false\n    },\n    "Config": {\n      "Image": "lab-worker:v1"\n    }\n  }\n]',
      },
      {
        command: "docker logs --tail 20 lab-worker",
        purpose: "查找此次启动退出前的应用说明",
        expected: "缺少 /app/config.yaml",
        output:
          "[预设场景：生命周期]\nworker starting\nERROR config file /app/config.yaml not found\nworker exiting with code 1",
      },
    ],
    evidence: ['"ExitCode": 1', "/app/config.yaml not found"],
    commonMistakes: [
      "认为 -d 会自动修复主进程退出。",
      "看到退出码 1 就断言 OOM。",
      "删掉失败容器后才想起读取日志。",
    ],
    quiz: {
      evidence:
        "State=exited; ExitCode=1; OOMKilled=false\nERROR config file /app/config.yaml not found",
      question: "哪个下一步最符合证据？",
      options: [
        "先核对配置挂载和文件路径，保留日志后再修复验证",
        "把内存加倍，根因已经确定",
        "不断 docker start，配置会自己出现",
      ],
      correct: 0,
      explanation:
        "日志直接指向配置缺失，状态证明已退出；重启不会自动补全缺失配置。",
    },
    challenge: {
      task: "写一份三句故障记录，解释 lab-worker 为什么没有持续运行。",
      steps: [
        "读取两个快照，记录实例名和状态。",
        "分开写出已知事实与待验证假设。",
        "说明下一次启动前检查什么、启动后如何验收。",
      ],
      acceptance: [
        "引用 ExitCode 1 和配置路径。",
        "没有把退出码当成唯一根因证据。",
        "包含修复后新日志与业务工作完成的检查。",
      ],
      solution:
        "lab-worker 已退出，退出码为 1，日志报告 /app/config.yaml 不存在。优先检查镜像内路径、挂载源文件和读取权限，目前没有 OOMKilled 证据。补好配置后在实机重新启动，检查本次日志不再出现该错误，并验证任务确实完成或服务持续可用。",
    },
    references: [
      {
        title: "Docker：运行容器与退出状态",
        url: `${dockerDocs}/engine/containers/run/`,
      },
      {
        title: "Docker：停止信号",
        url: `${dockerDocs}/reference/cli/docker/container/stop/`,
      },
    ],
  },
  {
    id: "docker-build",
    module: "docker",
    prerequisites: ["docker-lifecycle"],
    title: "从源码构建可复现镜像",
    subtitle: "Dockerfile、构建上下文、镜像层和缓存",
    duration: "55 分钟",
    outcome:
      "读懂一个 Dockerfile，判断哪些输入变化会使缓存失效，并用镜像身份核对运行版本。",
    why: "运行预制镜像只是起点；把自己的程序变成可追踪版本，才具备部署和回滚的基础。",
    sections: [
      {
        title: "构建输入的边界",
        body: "本课预设镜像 lab-web:v1 已构建完成，查询仅展示固定快照。构建上下文是交给构建器读取的文件集合，Dockerfile 中 COPY 的源路径受它限制。在项目目录构建时，用 .dockerignore 排除 .git、依赖目录、日志与本地密钥，能减少传输和误打包；不要把凭据写进镜像或普通构建参数。",
        example:
          '# 阅读样例：Dockerfile；源码目录预先包含 requirements.txt 和 app/\nFROM python:3.12-slim\nWORKDIR /app\nCOPY requirements.txt .\nRUN pip install --no-cache-dir -r requirements.txt\nCOPY app/ ./app/\nUSER 10001\nCMD ["python", "-m", "app"]\n\n# .dockerignore 阅读样例\n.git\n.venv\n.env\n__pycache__\n\n# 系统终端手工构建（会创建镜像，不属于模拟命令）\n# docker build -t lab-web:v1 .',
      },
      {
        title: "镜像层与缓存不是一回事",
        body: "镜像由只读文件系统层及配置组成，构建缓存则帮助复用已有步骤的结果。把依赖清单先复制、源码后复制，修改源码通常无需再次安装未变的依赖；依赖清单变化则会使安装步骤及后续依赖步骤重新构建。缓存命中不代表依赖永远最新，history 也不能独自证明某次构建是否命中缓存，要看那次构建日志。",
      },
      {
        title: "版本标签、镜像身份与精简交付",
        body: "v1 是可移动标签，同名重新构建可能指向不同内容。发布记录应保留镜像 ID，在仓库分发时还可记录 digest；拉取策略和目标平台也会影响实机结果。生产构建常用多阶段方式，仅把运行产物复制到最终阶段，减少编译器和缓存残留。本例非 root 用户能缩小应用权限，但还需检查目录可读写和监听端口是否合适。",
      },
    ],
    concepts: [
      {
        term: "构建上下文",
        plain: "构建器可读取的输入文件集合",
        detail: "COPY 的输入来自上下文；.dockerignore 在发送前排除不必要内容。",
      },
      {
        term: "构建缓存",
        plain: "重复使用相同构建步骤的结果",
        detail:
          "输入或指令变化可能使该步骤及依赖它的后续步骤失效，不等于镜像层本身。",
      },
      {
        term: "镜像 digest",
        plain: "内容的不可变标识",
        detail: "与可移动 tag 不同；本地构建镜像未推送时可能没有 RepoDigests。",
      },
    ],
    commands: [
      {
        command: "docker image inspect lab-web:v1",
        purpose: "核对镜像配置与运行身份",
        expected: "工作目录 /app，用户 10001",
        output:
          '[预设场景：构建，inspect 节选]\n[\n  {\n    "Id": "sha256:1111111111111111111111111111111111111111111111111111111111111111",\n    "RepoTags": [\n      "lab-web:v1"\n    ],\n    "RepoDigests": [],\n    "Config": {\n      "WorkingDir": "/app",\n      "User": "10001",\n      "Cmd": [\n        "python",\n        "-m",\n        "app"\n      ]\n    }\n  }\n]',
      },
      {
        command: "docker history lab-web:v1",
        purpose: "从历史摘要解释构建步骤顺序",
        expected: "源码复制位于依赖安装之后",
        output:
          '[预设场景：构建，history 节选；新步骤在上]\nIMAGE         CREATED BY\n111111111111  CMD ["python" "-m" "app"]\n<missing>     USER 10001\n<missing>     COPY app/ ./app/\n<missing>     RUN pip install --no-cache-dir -r requirements.txt\n<missing>     COPY requirements.txt .\n<missing>     WORKDIR /app',
      },
    ],
    evidence: ['"User": "10001"', "COPY requirements.txt"],
    commonMistakes: [
      "先 COPY 全部源码再安装依赖，使小修改也触发依赖层重建。",
      "以为删除后续层中的密钥就能清除前面层里的密钥。",
      "把 tag 当成不会改变的内容身份。",
    ],
    quiz: {
      evidence:
        "COPY requirements.txt .\nRUN pip install -r requirements.txt\nCOPY app/ ./app/",
      question: "只修改 app/main.py，依赖清单和基础镜像不变，最合理的预期是？",
      options: [
        "所有步骤一定重新执行",
        "依赖安装步骤可能复用缓存，源码复制及其后续依赖步骤重新构建",
        "运行中的容器立即自动更新",
      ],
      correct: 1,
      explanation:
        "源代码修改影响后面的 COPY；缓存是否可用仍取决于构建环境。构建镜像不会自动替换现有容器。",
    },
    challenge: {
      task: "给一个源码频繁修改的服务设计构建与版本核验流程。",
      steps: [
        "解释示例中两个 COPY 的顺序。",
        "列出三类应排除的上下文文件。",
        "分别写出源码变化和依赖变化时的缓存预期。",
        "说明如何证明新容器使用了目标镜像。",
      ],
      acceptance: [
        "区分 tag 与内容身份。",
        "不把构建成功等同于运行更新。",
        "包含构建日志与新实例镜像检查。",
      ],
      solution:
        "先复制 requirements.txt 再安装依赖，最后复制 app；排除 .git、.venv 和 .env。仅源码变化通常可复用安装步骤，依赖变化会重建安装及后续步骤。保存构建日志和镜像 ID，为版本分配新标签；在隔离环境创建新实例后用 inspect 比较镜像身份，并验证应用返回预期版本。",
    },
    references: [
      {
        title: "Docker：构建缓存失效",
        url: `${dockerDocs}/build/cache/invalidation/`,
      },
      {
        title: "Docker：构建上下文",
        url: `${dockerDocs}/build/concepts/context/`,
      },
      {
        title: "Docker：多阶段构建",
        url: `${dockerDocs}/build/building/multi-stage/`,
      },
    ],
  },
  {
    id: "docker-network",
    module: "docker",
    prerequisites: ["docker-build"],
    title: "容器网络与访问路径",
    subtitle: "沿着浏览器、主机端口、容器端口和 DNS 排查",
    duration: "50 分钟",
    outcome:
      "画出电脑、手机和容器的请求路径，解释 localhost 的范围及服务名称解析条件。",
    why: "同一个页面在电脑能打开、手机却一直转圈，往往是监听地址或网络路径问题，而不是页面代码错误。",
    sections: [
      {
        title: "先问请求从哪里发出",
        body: "本课是独立的预设网络快照：lab-web 把容器 8000 端口发布到主机 127.0.0.1:8080。电脑可从自身回环访问，但手机的 127.0.0.1 指手机自己，也无法直接使用电脑仅绑定回环的端口。让手机访问需同时满足主机监听合适接口、地址可路由、防火墙允许及应用正常；同名 Wi-Fi 也可能存在访客隔离。",
      },
      {
        title: "三个端口位置不要混在一起",
        body: "应用须在容器内监听可被容器网络到达的地址，常见为 0.0.0.0:8000；若只监听容器内回环，端口映射也未必能接通。-p 的左侧是主机端口，右侧是容器端口，EXPOSE 只记录用途而不负责发布。docker port 证明配置映射存在，不证明 HTTP 请求成功，最终还需实际请求和服务日志。",
        example:
          "# 系统终端手工操作的阅读示例，会创建容器\n# 只给本机访问：docker run --name lab-web -p 127.0.0.1:8080:8000 lab-web:v1\n# 若需局域网测试，须另行确认合适的主机接口及防火墙，再创建对应实例。\n# 这些命令不在模拟器执行，也不会改变本课固定快照。",
      },
      {
        title: "容器之间用服务名，不用主机回环",
        body: "在用户自定义 bridge 网络上，Docker 提供名称解析，同网的 API 可通过 lab-db:5432 访问数据库。容器中的 localhost 仍只指该容器自己；主机发布端口是另一条访问路径。本例 inspect 显示 lab-web 与 lab-db 同网，只能说明具备网络连接条件；还需验证 DNS、目标监听和认证，不能凭同网就认定数据库查询成功。",
      },
    ],
    concepts: [
      {
        term: "回环地址",
        plain: "当前网络环境里的自己",
        detail: "手机、主机和通常的隔离容器各有自己的 127.0.0.1。",
      },
      {
        term: "端口发布",
        plain: "把主机入口转到容器端口",
        detail: "主机绑定地址决定从哪些接口接收流量；映射存在不保证应用就绪。",
      },
      {
        term: "用户自定义 bridge",
        plain: "同主机容器的独立网络",
        detail: "同网络容器可按名称解析；与默认 bridge 的名称解析行为不同。",
      },
    ],
    commands: [
      {
        command: "docker port lab-web",
        purpose: "确认发布端口绑定到哪个主机地址",
        expected: "127.0.0.1:8080",
        output: "[预设场景：网络]\n8000/tcp -> 127.0.0.1:8080",
      },
      {
        command: "docker network inspect lab-net",
        purpose: "检查 web 与数据库网络成员关系",
        expected: "同网包含 lab-web 和 lab-db",
        output:
          '[预设场景：网络，inspect 节选]\n[\n  {\n    "Name": "lab-net",\n    "Driver": "bridge",\n    "Containers": {\n      "web-id": {\n        "Name": "lab-web",\n        "IPv4Address": "172.20.0.2/16"\n      },\n      "db-id": {\n        "Name": "lab-db",\n        "IPv4Address": "172.20.0.3/16"\n      }\n    }\n  }\n]',
      },
    ],
    evidence: ["127.0.0.1:8080", '"Name": "lab-db"'],
    commonMistakes: [
      "在手机输入电脑页面显示的 127.0.0.1。",
      "让 API 用 localhost:5432 访问另一个数据库容器。",
      "认为 EXPOSE 自动开放了主机端口。",
    ],
    quiz: {
      evidence: "8000/tcp -> 127.0.0.1:8080\n手机地址：192.168.30.76",
      question: "手机访问电脑局域网 IP:8080 失败，哪项已有明确配置证据？",
      options: [
        "手机肯定没有联网",
        "数据库密码肯定错误",
        "发布端口只绑定电脑回环接口，局域网访问条件未满足",
      ],
      correct: 2,
      explanation:
        "回环绑定只接受本机路径；还可能有路由或防火墙因素，但不能仅凭失败确认这些因素。",
    },
    challenge: {
      task: "为“电脑能打开、手机打不开”写一个有顺序的检查清单。",
      steps: [
        "写出手机到主机再到容器的路径。",
        "标注每一跳的地址和端口。",
        "用两个快照说明已知与未知。",
      ],
      acceptance: [
        "明确回环绑定限制。",
        "区分容器间 DNS 和手机访问入口。",
        "最后包含实际 HTTP 验证。",
      ],
      solution:
        "先确认手机和电脑的可达局域网地址；检查主机发布接口是否允许局域网，核对防火墙与网络隔离，再查容器应用监听 8000 的地址及日志。本例只绑定 127.0.0.1:8080，需在实机调整部署后测试。lab-net 中的 lab-db 名称用于容器间通信，不是手机应输入的网站地址。",
    },
    references: [
      {
        title: "Docker：Bridge 网络与 DNS",
        url: `${dockerDocs}/engine/network/drivers/bridge/`,
      },
      {
        title: "Docker：端口发布",
        url: `${dockerDocs}/engine/network/port-publishing/`,
      },
    ],
  },
  {
    id: "docker-storage",
    module: "docker",
    prerequisites: ["docker-network"],
    title: "数据持久化与配置挂载",
    subtitle: "把可丢弃的容器和必须保留的数据分开",
    duration: "50 分钟",
    outcome:
      "从 Mounts 识别命名卷与绑定挂载，解释删除实例后的数据边界，并制定备份验证办法。",
    why: "应用升级常需要重建容器；如果数据只保存在可写层，升级就可能变成丢数据事故。",
    sections: [
      {
        title: "先分类，再选择存放位置",
        body: "本课预设 lab-db 已把数据库目录挂到命名卷 lab-data，把配置文件从主机绑定为只读；查询只读取摘要。应用日志、缓存、配置与业务记录有不同寿命。业务数据应离开实例可写层；可重建缓存可以丢弃；配置宜来自可追踪文件或配置管理。先回答“容器删除后还要不要”，再决定挂载方式。",
      },
      {
        title: "卷与绑定挂载的责任不同",
        body: "命名卷由 Docker 管理存放位置，用名称引用，适合保留数据库文件。绑定挂载直接引用 Docker 守护进程所在主机的路径，适合开发代码和配置，但依赖路径、权限及平台文件共享设置。挂载到非空容器目录会遮住原有内容，并非删除镜像里的文件；只读挂载限制容器写入，仍不阻止主机修改该文件。",
        example:
          "# 阅读样例：两种挂载参数，不在模拟器执行\n--mount type=volume,source=lab-data,target=/var/lib/postgresql/data\n--mount type=bind,source=/absolute/lab/postgresql.conf,target=/etc/postgresql/postgresql.conf,readonly\n# 绑定源路径必须按实际系统准备，不能照抄示例绝对路径。",
      },
      {
        title: "持久化不等于已有备份",
        body: "删除普通容器通常保留命名卷，显式删除卷或 Compose down -v 则可能移除业务数据，所以清理前要确认资源归属。卷也会遭遇误写、磁盘损坏和数据库文件不一致。备份必须采用数据库支持的一致性导出方式，并在独立测试环境恢复验证；仅看到 volume inspect 有结果，不能证明备份存在或数据可恢复。",
      },
    ],
    concepts: [
      {
        term: "命名卷 Volume",
        plain: "独立于容器实例的数据存储",
        detail:
          "由 Docker 管理，删除容器不等于删除命名卷，但显式删除卷仍会丢数据。",
      },
      {
        term: "绑定挂载 Bind mount",
        plain: "把主机路径映射进容器",
        detail: "依赖主机路径与权限；readonly 约束容器写入，不约束主机。",
      },
      {
        term: "恢复验证",
        plain: "把备份真正还原一次",
        detail: "检查记录数量、关键业务与一致性，证明备份能用于恢复。",
      },
    ],
    commands: [
      {
        command: "docker inspect lab-db",
        purpose: "分类数据库目录与配置文件挂载",
        expected: "volume 可写，bind 只读",
        output:
          '[预设场景：存储，inspect 节选]\n[\n  {\n    "Name": "/lab-db",\n    "Mounts": [\n      {\n        "Type": "volume",\n        "Name": "lab-data",\n        "Destination": "/var/lib/postgresql/data",\n        "RW": true\n      },\n      {\n        "Type": "bind",\n        "Source": "/absolute/lab/postgresql.conf",\n        "Destination": "/etc/postgresql/postgresql.conf",\n        "RW": false\n      }\n    ]\n  }\n]',
      },
      {
        command: "docker volume inspect lab-data",
        purpose: "确认卷的身份与驱动",
        expected: "lab-data 使用 local 驱动",
        output:
          '[预设场景：存储，inspect 节选]\n[\n  {\n    "Name": "lab-data",\n    "Driver": "local",\n    "Scope": "local",\n    "Labels": {\n      "purpose": "learning"\n    }\n  }\n]',
      },
    ],
    evidence: ['"RW": false', '"Name": "lab-data"'],
    commonMistakes: [
      "用容器可写层保存唯一一份数据库。",
      "以为只读挂载让主机文件也不可修改。",
      "把存在卷当成存在备份，未经确认执行 down -v。",
    ],
    quiz: {
      evidence:
        "Mounts: volume lab-data -> /var/lib/postgresql/data\nbind config -> /etc/postgresql/postgresql.conf, RW=false",
      question: "哪项判断准确？",
      options: [
        "删除容器后命名卷通常保留；仍应防止显式删卷并验证备份",
        "RW=false 表示数据库目录不可写",
        "命名卷可以抵抗所有误删除",
      ],
      correct: 0,
      explanation:
        "RW=false 属于配置文件的 bind 挂载；命名卷与实例生命周期分离，但不是自动备份。",
    },
    challenge: {
      task: "为数据库容器升级写一个不丢数据的准备方案。",
      steps: [
        "确认真正的数据目录和挂载类型。",
        "记录镜像版本、卷名、配置路径及权限。",
        "说明备份与恢复演练方法。",
        "明确清理时不能误删的资源。",
      ],
      acceptance: [
        "区分保留卷和备份数据。",
        "不建议直接打包运行中数据库文件充当一致性备份。",
        "包含独立环境恢复后的业务核验。",
      ],
      solution:
        "核对 /var/lib/postgresql/data 对应 lab-data 并记录当前版本与配置。采用数据库支持的逻辑导出或一致性备份，在独立实例恢复，检查关键表和应用查询。升级使用原数据卷前先确认版本兼容与迁移策略；保留回退所需备份，不执行未经核对的卷删除或 down -v。",
    },
    references: [
      {
        title: "Docker：Volumes",
        url: `${dockerDocs}/engine/storage/volumes/`,
      },
      {
        title: "Docker：Bind mounts",
        url: `${dockerDocs}/engine/storage/bind-mounts/`,
      },
    ],
  },
  {
    id: "docker-compose",
    module: "docker",
    prerequisites: ["docker-storage"],
    title: "Compose 编排一个应用栈",
    subtitle: "把多个容器、网络和卷写成可重建的声明",
    duration: "60 分钟",
    outcome:
      "解释 Compose 服务依赖与健康检查，分清进程启动、依赖就绪和业务可用。",
    why: "手工运行许多容器容易遗漏参数；一份可读声明能保存服务关系，但仍需要运行证据检验。",
    sections: [
      {
        title: "从单个容器转向应用结构",
        body: "本课预设 compose-lab 项目包含 web 与 redis，命令结果是固定的健康快照。Compose 的 services 定义各个服务，networks 定义通信边界，volumes 定义持久数据。服务名可在同项目网络中作为访问名称，项目名则帮助隔离多套实验。配置文件应和代码一起追踪，但真实密码应通过合适的外部配置或 secret 管理。",
      },
      {
        title: "启动顺序不保证依赖已经能接请求",
        body: "短写 depends_on 能表达启动顺序，却不能保证数据库已完成恢复或缓存已接受连接。用 healthcheck 定义检查，再用 condition: service_healthy 让依赖启动等待该检查。本例 Redis 以 ping 作为就绪条件；这依然不是 Web 业务健康证明。运行中依赖断线时，应用还需重试与重新连接，不能只依靠最初的启动等待。",
        example:
          '# compose.yaml 阅读样例；需准备能连接 redis:6379 的 lab-web:v1\nservices:\n  web:\n    image: lab-web:v1\n    ports:\n      - "127.0.0.1:8080:8000"\n    environment:\n      REDIS_HOST: redis\n    depends_on:\n      redis:\n        condition: service_healthy\n  redis:\n    image: redis:7-alpine\n    healthcheck:\n      test: ["CMD", "redis-cli", "ping"]\n      interval: 5s\n      timeout: 3s\n      retries: 5\n# 系统终端手工运行 docker compose -p compose-lab up -d 会创建资源。\n# 此样例用于理解声明，不由工作台自动部署。',
      },
      {
        title: "声明、运行状态与请求各查一层",
        body: "排查时先核对渲染后的配置，确认环境变量与端口是预期值，再看 ps 的服务状态与健康字段，最后查特定服务的日志及实际请求。up -d 会创建或按配置重建服务，restart 并不会替你应用所有配置变更；down 会移除项目的容器和网络。项目使用卷时，清理参数要核对，避免把业务数据一并删除。",
      },
    ],
    concepts: [
      {
        term: "Compose 项目",
        plain: "一套关联服务及其资源",
        detail: "项目名影响容器、网络等资源命名，帮助把实验与其他工作分开。",
      },
      {
        term: "healthcheck",
        plain: "应用定义的健康判断",
        detail: "由检查命令和周期等配置决定，检查覆盖不到的业务仍可能失败。",
      },
      {
        term: "service_healthy",
        plain: "启动依赖时等待健康检查通过",
        detail: "解决启动时序问题，不代替应用运行中的重连和容错。",
      },
    ],
    commands: [
      {
        command: "docker compose -p compose-lab ps",
        purpose: "检查服务进程与健康状态",
        expected: "redis healthy，web 运行",
        output:
          "[预设场景：Compose]\nNAME                 SERVICE  STATUS                 PORTS\ncompose-lab-web-1     web      Up 2 minutes           127.0.0.1:8080->8000/tcp\ncompose-lab-redis-1   redis    Up 2 minutes (healthy) 6379/tcp",
      },
      {
        command: "docker compose -p compose-lab logs --tail 20 web",
        purpose: "核对 web 是否已连上依赖并开始监听",
        expected: "connected redis:6379，listening 0.0.0.0:8000",
        output:
          "[预设场景：Compose]\nweb-1 | connected redis:6379\nweb-1 | listening 0.0.0.0:8000\nweb-1 | GET /ready 200",
      },
    ],
    evidence: ["(healthy)", "connected redis:6379"],
    commonMistakes: [
      "把 depends_on 短写当成数据库就绪保证。",
      "认为 redis healthy 就证明 web 所有功能正常。",
      "改完配置只 restart 就认定配置已应用。",
    ],
    quiz: {
      evidence:
        "depends_on: [redis]\nredis: Up 1 second\nweb: connection refused",
      question: "为什么依赖已启动，web 还可能连接失败？",
      options: [
        "Compose 不支持服务名访问",
        "运行状态不等于就绪，需要健康等待与应用重试",
        "只要删除数据卷就能解决",
      ],
      correct: 1,
      explanation:
        "进程创建后可能还在初始化。健康等待改善启动时序，运行中的故障还需应用处理。",
    },
    challenge: {
      task: "把“先启 Redis，再启 Web”的口头要求变成可检验方案。",
      steps: [
        "解释 YAML 中依赖条件与检查命令。",
        "用两个模拟输出判断目前各层证据。",
        "补充一个真正验证 Web 业务的验收步骤。",
      ],
      acceptance: [
        "明确健康检查针对 Redis。",
        "指出 GET /ready 不是所有业务正确的证明。",
        "包括依赖短暂中断后的重连验证计划。",
      ],
      solution:
        "Redis 配置 redis-cli ping，Web 使用 service_healthy 等待；快照显示 Redis 健康，Web 已连接并监听。还需实机访问具有代表性的读写功能并核对结果。在隔离测试中验证 Redis 短暂不可用后 Web 能重试恢复，记录恢复耗时；不能只观察启动顺序。",
    },
    references: [
      {
        title: "Docker：Compose 启动与停止顺序",
        url: `${dockerDocs}/compose/how-tos/startup-order/`,
      },
      {
        title: "Docker：Compose 网络",
        url: `${dockerDocs}/compose/how-tos/networking/`,
      },
    ],
  },
  {
    id: "docker-capstone",
    module: "docker",
    prerequisites: ["docker-compose"],
    title: "Docker 综合验收",
    subtitle: "交付一个能解释、能排障、能恢复的本地服务",
    duration: "60 分钟",
    outcome:
      "独立建立镜像、进程、网络、存储与请求五层检查链，为迁移 Kind 准备证据。",
    why: "记住很多命令并不代表掌握容器；能解释每条证据能证明什么、不能证明什么，才算完成这一阶段。",
    sections: [
      {
        title: "从用户现象倒推检查顺序",
        body: "本课独立预设 capstone-web 正在运行，但出现部分请求 500。不要先删除重建：先记录发生时间、访问地址和影响范围，再核对实例使用的镜像、运行状态及监听入口。页面可达说明部分路径已通，不能说明数据库正常；容器 Running 说明进程在，但也不能证明每个请求正确。将事实按层排列，比随机试命令更有效。",
      },
      {
        title: "把配置证据和业务证据对应起来",
        body: "inspect 显示实例使用 lab-web:v2，端口只发布本机，并把 /app/data 挂到 lab-records。日志中健康检查 200，而写入记录的接口 500 并出现 permission denied，这把调查范围缩到数据目录权限等候选因素。挂载存在不代表应用用户能写；应继续核对运行用户、目录属主与权限，不能直接扩大到特权运行。",
      },
      {
        title: "交付时必须说明恢复边界",
        body: "一份完整交付记录包含版本身份、启动声明、访问方式、数据位置、备份与恢复办法，以及健康和代表性业务验证。修复权限后先验证写入再读取，重建测试实例后确认数据保留，并记录新日志。进入 Kind 前把这些事实整理好：Kubernetes 会增加调度和控制器，但镜像版本、进程退出、网络与数据这些基础问题仍然存在。",
      },
    ],
    concepts: [
      {
        term: "证据链",
        plain: "按请求路径连接多个可核验事实",
        detail:
          "先现象和时间，再配置和状态，最后日志与实际请求，避免单一信号下结论。",
      },
      {
        term: "最小权限",
        plain: "只授予程序完成任务所需的权限",
        detail:
          "修复数据目录权限应明确用户和路径，不应直接把整个容器改成特权。",
      },
      {
        term: "交付验收",
        plain: "证明服务能被正确使用和恢复",
        detail: "覆盖版本、网络、数据、代表性业务和恢复步骤，不只看启动成功。",
      },
    ],
    commands: [
      {
        command: "docker inspect capstone-web",
        purpose: "收集版本、身份、端口和存储证据",
        expected: "v2、10001、lab-records 和本机端口",
        output:
          '[预设场景：Docker 综合，inspect 节选]\n[\n  {\n    "Name": "/capstone-web",\n    "State": {\n      "Status": "running"\n    },\n    "Config": {\n      "Image": "lab-web:v2",\n      "User": "10001"\n    },\n    "NetworkSettings": {\n      "Ports": {\n        "8000/tcp": [\n          {\n            "HostIp": "127.0.0.1",\n            "HostPort": "8081"\n          }\n        ]\n      }\n    },\n    "Mounts": [\n      {\n        "Type": "volume",\n        "Name": "lab-records",\n        "Destination": "/app/data",\n        "RW": true\n      }\n    ]\n  }\n]',
      },
      {
        command: "docker logs --tail 30 capstone-web",
        purpose: "比较健康入口与业务入口结果",
        expected: "健康 200，写入 500，数据目录权限失败",
        output:
          "[预设场景：Docker 综合]\nGET /ready 200\nPOST /records 500\nERROR write /app/data/records.json: permission denied\nGET /ready 200",
      },
    ],
    evidence: ['"User": "10001"', "/app/data/records.json: permission denied"],
    commonMistakes: [
      "健康接口返回 200 就结束所有验收。",
      "遇到权限错误就启用 privileged。",
      "没有留下版本、挂载和访问地址记录就迁移集群。",
    ],
    quiz: {
      evidence:
        "User=10001; volume /app/data RW=true\nGET /ready 200\nPOST /records 500: permission denied",
      question: "现有证据最支持哪个调查方向？",
      options: [
        "DNS 一定坏了",
        "检查应用用户对数据目录的文件权限，再验证业务写入",
        "给容器开放所有主机权限",
      ],
      correct: 1,
      explanation:
        "RW=true 允许挂载层面写入，但文件系统用户权限仍可能拒绝；健康入口不能覆盖写入业务。",
    },
    challenge: {
      task: "提交一份可供同学接手的 Docker 阶段验收记录。",
      steps: [
        "列出版本、用户、端口和卷四项事实。",
        "解释健康成功与业务失败为何可以同时存在。",
        "提出最小修复与验证步骤。",
        "说明重建与恢复时必须保留的资料。",
      ],
      acceptance: [
        "引用两条不同来源的证据。",
        "包含权限假设但不把尚未查询的属主写成事实。",
        "验收涵盖写入、读取、重建后的数据与备份恢复。",
      ],
      solution:
        "快照显示 v2、用户 10001、回环 8081 和 lab-records；健康入口 200，但写记录时目录权限被拒绝。先读取数据目录权限并核对所需 UID/GID，采用范围最小的权限修复；随后验证写入与读取、新日志、重建后数据保留及独立恢复。交接保存构建身份、Compose 声明、访问地址、数据卷和备份恢复步骤。",
    },
    references: [
      {
        title: "Docker：容器运行与用户权限",
        url: `${dockerDocs}/engine/containers/run/`,
      },
      {
        title: "Docker：存储与备份",
        url: `${dockerDocs}/engine/storage/volumes/`,
      },
    ],
  },
];

export const kindLessons: Lesson[] = [
  {
    id: "kind-architecture",
    module: "kind",
    prerequisites: ["02"],
    title: "Kind 架构与三层边界",
    subtitle: "电脑、节点容器、Pod 分别承担什么职责",
    duration: "45 分钟",
    outcome:
      "解释 Kind 节点为什么是容器，区分 Docker 引擎、节点运行时和 Kubernetes API。",
    why: "如果把主机 Docker 的容器列表当成全部 Pod，后续镜像与网络排查就会选错层级。",
    sections: [
      {
        title: "把三层结构画出来",
        body: "本课预设 k8s-lab 集群含一个控制平面和一个工作节点，与入门课单节点快照相互独立。你的电脑提供资源，Docker 启动两个 Kind 节点容器，每个节点内的容器运行时再负责 Pod 容器。主机 docker ps 通常看到节点，而 kubectl 查询才看到 Kubernetes 对象；两者观察的是不同层，并不矛盾。",
      },
      {
        title: "控制平面决定，节点执行",
        body: "控制平面的 API server 接收 kubectl 请求，etcd 保存集群状态，调度器选择可运行节点，控制器持续协调期望与实际状态。工作节点上的 kubelet 根据分配管理 Pod 并上报状态，运行时负责拉取镜像和启动容器。Kind 把这些组件装进本机容器便于学习，它不会把单台电脑变成真正跨机器的高可用基础设施。",
      },
      {
        title: "按层判断故障范围",
        body: "Docker 引擎不可用时，节点容器就无法正常提供集群；API 不可达时 kubectl 可能先出现连接错误；单个 Pod 失败则未必影响整个集群。节点 Ready 是基础设施信号，不是每个应用健康证明。本例 kind get nodes 展示容器节点名，kubectl 展示 Kubernetes Node 状态，应对照两者定位观察层而不是直接重装所有工具。",
      },
    ],
    concepts: [
      {
        term: "控制平面",
        plain: "保存集群状态并协调工作的一组组件",
        detail: "包括 API server、etcd、调度器和控制器等，不等同于业务应用。",
      },
      {
        term: "kubelet",
        plain: "节点上落实 Pod 运行要求的代理",
        detail: "与 API 和容器运行时协作，报告节点及 Pod 状态。",
      },
      {
        term: "容器运行时",
        plain: "真正启动 Pod 容器的节点组件",
        detail:
          "Kind 节点内部通常使用 containerd，与主机 Docker 镜像存储分开。",
      },
    ],
    commands: [
      {
        command: "kind get nodes --name k8s-lab",
        purpose: "识别 Kind 创建的节点容器",
        expected: "control-plane 和 worker 两个节点名",
        output:
          "[预设场景：Kind 架构，两节点]\nk8s-lab-control-plane\nk8s-lab-worker",
      },
      {
        command: "kubectl --context kind-k8s-lab get nodes -o wide",
        purpose: "从 API 读取节点角色与运行时",
        expected: "两个节点 Ready，运行时 containerd",
        output:
          "[预设场景：Kind 架构，列节选；Node 为集群级资源，不指定命名空间]\nNAME                    STATUS ROLES         INTERNAL-IP CONTAINER-RUNTIME\nk8s-lab-control-plane   Ready  control-plane 172.18.0.2  containerd://2.1.0\nk8s-lab-worker          Ready  <none>        172.18.0.3  containerd://2.1.0",
      },
    ],
    evidence: ["k8s-lab-worker", "containerd://2.1.0"],
    commonMistakes: [
      "把 Docker 节点容器与业务 Pod 当成同一层。",
      "认为两节点 Kind 等于两台独立电脑的高可用。",
      "Node Ready 后忽略应用就绪状态。",
    ],
    quiz: {
      evidence:
        "kind get nodes: k8s-lab-control-plane, k8s-lab-worker\nNode runtime: containerd://2.1.0",
      question: "主机 docker ps 中没有直接列出每个业务 Pod，应该如何理解？",
      options: [
        "Pod 不可能真的运行",
        "主机看到节点容器，业务容器由节点内部运行时管理",
        "kubectl 的数据一定是错误的",
      ],
      correct: 1,
      explanation:
        "这是分层结构：主机 Docker 管理节点容器，Kubernetes 和节点运行时管理 Pod。",
    },
    challenge: {
      task: "画出从 kubectl 查询到 Pod 运行的职责图。",
      steps: [
        "写出主机、Kind 节点与 Pod 三层。",
        "标出 API server、kubelet、运行时的位置和作用。",
        "分别给出引擎故障与单个应用故障应检查的层。",
      ],
      acceptance: [
        "明确主机 Docker 与节点 containerd 的区别。",
        "没有把 Ready 等同于业务成功。",
        "说明本地多节点共享同一台主机资源。",
      ],
      solution:
        "kubectl 访问控制平面的 API server；调度结果交给节点 kubelet，kubelet 通过节点 containerd 运行 Pod。外层 Docker 承载 Kind 节点。引擎故障先查主机和节点容器，单应用异常查对应 Pod、事件和日志；两个 Ready 节点仍共享电脑资源，不能据此宣称生产高可用。",
    },
    references: [
      { title: "Kind：Quick Start", url: `${kindDocs}/quick-start/` },
      {
        title: "Kind：Node Image 设计",
        url: "https://kind.sigs.k8s.io/docs/design/node-image/",
      },
    ],
  },
  {
    id: "kind-config",
    module: "kind",
    prerequisites: ["kind-architecture"],
    title: "用配置声明学习集群",
    subtitle: "多节点、API 入口和主机端口映射",
    duration: "55 分钟",
    outcome:
      "读懂 Kind 配置并解释创建时配置、节点端口映射和 Kubernetes Service 的关系。",
    why: "可重复的实验需要保存拓扑和入口；临时口头记住几个端口无法可靠重建环境。",
    sections: [
      {
        title: "把集群形状写成文件",
        body: "本课预设 k8s-lab 以两节点和固定主机入口创建，配置仅供阅读，不会修改真实集群。kind 配置的 nodes 指定节点角色，networking 控制 API 监听地址等。保存配置和节点镜像版本能让实验条件更一致；修改文件不会自动改变已存在的节点容器，端口等创建时设置通常应在备份并确认后重建实验集群。",
        example:
          '# kind-lab.yaml 阅读样例\nkind: Cluster\napiVersion: kind.x-k8s.io/v1alpha4\nname: k8s-lab\nnetworking:\n  apiServerAddress: "127.0.0.1"\nnodes:\n  - role: control-plane\n    extraPortMappings:\n      - containerPort: 30080\n        hostPort: 8080\n        listenAddress: "127.0.0.1"\n        protocol: TCP\n  - role: worker\n# 系统终端手工创建命令（会创建节点资源，不属于模拟器）\n# kind create cluster --config kind-lab.yaml\n# 已有同名集群时先检查归属和数据，不要直接删除。',
      },
      {
        title: "从主机入口走到应用还差哪些环节",
        body: "extraPortMappings 只把主机端口转发到节点容器端口，不会自动创建 Service 或应用。如果使用 NodePort，节点映射的 containerPort 应与 Service 的 nodePort 对上，本例是 30080；Service 再把流量送往匹配且就绪的后端。主机 8080、节点 30080、Service port 和应用 targetPort 是不同位置，排查时要逐跳核对。",
      },
      {
        title: "API 入口和网页入口分开管理",
        body: "kubectl 通过 kubeconfig 记录的 API server 地址管理集群，而浏览器通过应用入口访问业务，两者不是同一服务。API 保持回环监听适合本机学习；网页是否允许手机访问应单独选择合适监听接口与网络。检查 docker port 可以看到节点发布端口，检查集群连接则要通过 kubectl；一个入口通不代表另一个入口也通。",
      },
    ],
    concepts: [
      {
        term: "Kind 配置文件",
        plain: "创建实验集群的拓扑说明",
        detail: "声明节点和网络设置，修改文件不会自动调整现有集群。",
      },
      {
        term: "extraPortMappings",
        plain: "主机到节点容器的端口转发",
        detail: "不是 Pod 或 Service 定义；NodePort 场景下要与 nodePort 对齐。",
      },
      {
        term: "API server 入口",
        plain: "kubectl 管理集群的地址",
        detail: "与浏览器访问业务的端口独立，保存在 kubeconfig 的集群配置中。",
      },
    ],
    commands: [
      {
        command: "docker port k8s-lab-control-plane",
        purpose: "区分管理 API 与示例应用映射",
        expected: "6443 映射动态主机端口，30080 映射 8080",
        output:
          "[预设场景：Kind 配置]\n6443/tcp -> 127.0.0.1:58123\n30080/tcp -> 127.0.0.1:8080",
      },
      {
        command:
          "kubectl --context kind-k8s-lab -n learning get service lab-nodeport -o yaml",
        purpose: "对照节点映射、Service 和应用端口",
        expected: "nodePort 30080，targetPort 8000",
        output:
          "[预设场景：Kind 配置，YAML 节选]\napiVersion: v1\nkind: Service\nmetadata:\n  name: lab-nodeport\n  namespace: learning\nspec:\n  type: NodePort\n  selector:\n    app: lab-web\n  ports:\n    - port: 80\n      targetPort: 8000\n      nodePort: 30080",
      },
    ],
    evidence: ["30080/tcp -> 127.0.0.1:8080", "targetPort: 8000"],
    commonMistakes: [
      "只配 extraPortMappings 就期待网页出现。",
      "把 API server 端口当作应用网站端口。",
      "改 Kind YAML 后认为现有节点立刻更新。",
    ],
    quiz: {
      evidence:
        "主机 8080 -> 节点 30080\nService: port 80, targetPort 8000, nodePort 30080",
      question: "哪个路径描述正确？",
      options: [
        "主机 8080 → 节点 30080 → Service 转发 → 就绪后端 8000",
        "主机 8080 → API server 6443 → 数据库",
        "节点 30080 不需要 Service 就能自动找到应用",
      ],
      correct: 0,
      explanation:
        "映射和 Service 共同连接路径；仍需选择器、端点及应用监听正确。",
    },
    challenge: {
      task: "解释一个本机网页入口，并指出手机访问的限制。",
      steps: [
        "按快照列出四个端口的角色。",
        "解释当前回环绑定的可达范围。",
        "列出尚需验证的 Service 后端与应用条件。",
      ],
      acceptance: [
        "没有混淆 58123 管理入口与 8080 网页入口。",
        "指出映射不等于业务正常。",
        "指出配置修改需真正应用到实验环境。",
      ],
      solution:
        "58123 转到 API 6443；网页从本机 8080 到节点 30080，再由 NodePort Service 指向后端 8000，Service 内部端口为 80。目前 8080 仅绑定电脑回环，手机不能直接访问。还需验证标签匹配、就绪端点和 HTTP 响应；需要调整创建时配置时，应先保存数据与声明再计划重建。",
    },
    references: [
      { title: "Kind：配置与端口映射", url: `${kindDocs}/configuration/` },
    ],
  },
  {
    id: "kind-images",
    module: "kind",
    prerequisites: ["kind-config"],
    title: "把本地镜像交给节点",
    subtitle: "镜像仓库边界、导入和拉取策略",
    duration: "50 分钟",
    outcome:
      "根据 Pod 事件区分主机镜像存在与节点可用，设计不依赖 latest 的本地发布流程。",
    why: "Docker build 成功却出现 ImagePullBackOff，是从 Docker 转到 Kind 时最常见的断点之一。",
    sections: [
      {
        title: "主机镜像不会自动出现在节点里",
        body: "本课预设主机已经有 lab-web:v3，但目标节点找不到该镜像，Pod 正在回退等待拉取；查询不会自动完成导入。Docker 引擎与 Kind 节点的 containerd 各有镜像存储，主机 docker image ls 看到镜像只是第一步。多节点集群还要考虑 Pod 最终被调度到哪一个节点，不能只在某个节点准备镜像就认定全部可用。",
      },
      {
        title: "导入与仓库是两条交付路径",
        body: "本地练习可用 kind load docker-image 将主机镜像导入指定名称的集群，命令中的 --name 应与 k8s-lab 对应。团队和自动化场景常改用镜像仓库，让节点按可访问的仓库地址拉取，并配置必要凭据。两种路径都需要版本身份与平台兼容，成功构建不代表另一个架构或节点一定能运行。",
        example:
          "# 系统终端手工操作的阅读示例；会向指定集群导入镜像\n# docker build -t lab-web:v3 .\n# kind load docker-image lab-web:v3 --name k8s-lab\n\n# Pod 模板中的容器片段，仅用于阅读\ncontainers:\n  - name: web\n    image: lab-web:v3\n    imagePullPolicy: IfNotPresent\n# 需在完整工作负载声明中使用；此片段不能单独 apply。",
      },
      {
        title: "拉取策略决定何时找仓库",
        body: "IfNotPresent 在节点已有该镜像时可使用本地副本，否则尝试拉取；Never 只用节点本地镜像，缺失就失败；Always 会在启动时向仓库解析镜像身份，内容存在时可复用缓存。省略策略时 latest 或无标签通常默认 Always，非 latest 通常默认 IfNotPresent；策略在对象创建时设定，后续改标签不自动替你修改已有策略。",
      },
    ],
    concepts: [
      {
        term: "节点镜像存储",
        plain: "目标节点运行时可使用的镜像集合",
        detail:
          "与主机 Docker 镜像列表分开；多节点必须保证调度目标也能获取镜像。",
      },
      {
        term: "imagePullPolicy",
        plain: "启动容器时如何获取镜像",
        detail: "Always、IfNotPresent、Never 各有不同仓库与本地依赖。",
      },
      {
        term: "ImagePullBackOff",
        plain: "镜像获取失败后的退避等待",
        detail:
          "查看事件才能区分不存在、认证、网络或其他问题；它不是最终根因名称。",
      },
    ],
    commands: [
      {
        command: "docker image ls lab-web:v3",
        purpose: "确认主机镜像存在但不越界下结论",
        expected: "主机列出 lab-web:v3",
        output:
          "[预设场景：Kind 镜像，主机视角]\nREPOSITORY TAG IMAGE ID     SIZE\nlab-web    v3  333333333333 152MB",
      },
      {
        command:
          "kubectl --context kind-k8s-lab -n learning get pod image-lab -o yaml",
        purpose: "同时读取 Pod 镜像拉取策略与容器等待原因",
        expected:
          "imagePullPolicy 为 IfNotPresent，等待原因为 ImagePullBackOff",
        output:
          '[预设场景：Kind 镜像，Pod YAML 节选]\napiVersion: v1\nkind: Pod\nmetadata:\n  name: image-lab\n  namespace: learning\nspec:\n  nodeName: k8s-lab-worker\n  containers:\n    - name: web\n      image: lab-web:v3\n      imagePullPolicy: IfNotPresent\nstatus:\n  phase: Pending\n  containerStatuses:\n    - name: web\n      ready: false\n      restartCount: 0\n      state:\n        waiting:\n          reason: ImagePullBackOff\n          message: Back-off pulling image "lab-web:v3"',
      },
    ],
    evidence: ["333333333333", "imagePullPolicy: IfNotPresent"],
    commonMistakes: [
      "主机镜像存在就认定 Kind 节点也能使用。",
      "导入 v3，却让 Pod 仍使用 latest 或另一个标签。",
      "把所有拉取失败都判断成密码错误。",
    ],
    quiz: {
      evidence:
        "主机有 lab-web:v3\nPod 在 k8s-lab-worker: IfNotPresent, pull access denied",
      question: "结合本课快照和这里补充的访问被拒绝事件，哪项说明最完整？",
      options: [
        "主机和节点镜像存储相同，日志不可信",
        "目标节点未能使用该镜像并尝试仓库拉取，应核对导入目标、标签和仓库可用性",
        "只需反复刷新页面",
      ],
      correct: 1,
      explanation:
        "主机已有并不证明节点已有；拒绝信息也可能是仓库不存在，需要结合交付路径排查。",
    },
    challenge: {
      task: "写出从本地 v3 镜像到 Kind Pod 可运行的完整核验链。",
      steps: [
        "分别记录主机与 Pod 两份证据。",
        "选择本地导入或仓库拉取路径并说明理由。",
        "列出标签、集群名、策略和平台核对项。",
        "描述修复后的验收。",
      ],
      acceptance: [
        "明确命令只展示未修复快照。",
        "导入目标使用 k8s-lab。",
        "修复后同时检查容器运行、就绪与实际业务。",
      ],
      solution:
        "本地实验选择把 lab-web:v3 导入 k8s-lab，确认节点可用且架构匹配；工作负载引用同一标签并使用适合本地镜像的 IfNotPresent。当前模拟仅显示导入前失败，不会因阅读操作样例而变成功。实机完成导入及需要的工作负载更新后，检查新事件无拉取失败、Pod 就绪并验证应用版本和业务响应。",
    },
    references: [
      {
        title: "Kind：载入镜像与拉取策略",
        url: `${kindDocs}/quick-start/#loading-an-image-into-your-cluster`,
      },
      {
        title: "Kubernetes：容器镜像",
        url: "https://kubernetes.io/docs/concepts/containers/images/",
      },
    ],
  },
  {
    id: "kind-lifecycle",
    module: "kind",
    prerequisites: ["kind-images"],
    title: "实验集群的保存、重建与验收",
    subtitle: "把环境当成可重建的实验，不把节点当成备份",
    duration: "55 分钟",
    outcome:
      "区分上下文记录与真实集群存活，制定有数据边界、恢复顺序与验收条件的重建计划。",
    why: "只有能重新建立相同学习环境，练习成果才不会依赖电脑上某个恰好还在运行的实例。",
    sections: [
      {
        title: "上下文只是连接配置",
        body: "本课预设电脑保留 kind-k8s-lab 上下文，但集群节点已经被移除；这是独立故障快照。kubeconfig 保存服务器地址、凭据引用和默认命名空间等，它不是集群本身。列表中看到上下文，不能证明节点还在或 API 可访问。重建同名集群后连接地址和凭据也可能变化，应使用新生成的连接配置并重新核对目标。",
      },
      {
        title: "删除节点会失去什么",
        body: "Kind 删除集群会移除节点容器，节点内部的集群状态、导入镜像和本地数据不应视作会自动保留。是否保留应用数据取决于实际存储映射和外部备份；不能因为用过 PVC 就假定跨删集群持久。重建前保存 Kind 配置、工作负载声明、镜像来源与数据备份，并在独立环境确认备份可恢复，不把截图或 kubectl get 清单当成完整备份。",
      },
      {
        title: "按依赖顺序恢复，而不是一次乱跑命令",
        body: "恢复顺序应是容器引擎与资源条件、按配置创建节点、验证 API 与节点 Ready、准备所需镜像、创建命名空间和依赖、部署应用、恢复业务数据，再验证入口与业务。实机写入步骤都应限定学习集群并确认资源归属。最后记录版本与验收结果，下一章才从这个明确基线学习 Deployment、Service 和故障处理。",
        example:
          "# 仅阅读的系统终端操作计划，不在模拟器执行\n# 1. kind export logs work/kind-logs --name k8s-lab （集群仍存在时保留诊断材料）\n# 2. 确认配置、应用声明、镜像来源和独立数据备份已保存。\n# 3. 只有确认可丢弃目标后才考虑 kind delete cluster --name k8s-lab。\n# 4. 用已保存配置创建集群，准备镜像，再恢复声明与数据。\n# 日志导出不是数据库或 etcd 的完整备份。",
      },
    ],
    concepts: [
      {
        term: "kubeconfig",
        plain: "kubectl 的连接配置",
        detail: "有记录不等于有活着的集群；注意区分 context 名与集群创建名称。",
      },
      {
        term: "声明恢复",
        plain: "重新建立期望资源的配置",
        detail: "YAML 可重建对象结构，但通常不包含业务数据库数据。",
      },
      {
        term: "重建基线",
        plain: "可重复得到并验证的实验状态",
        detail:
          "包含工具与镜像版本、拓扑、数据准备和业务验收，便于对比后续故障。",
      },
    ],
    commands: [
      {
        command: "kind get clusters",
        purpose: "从 Kind 视角确认当前集群列表",
        expected: "没有可见 Kind 集群",
        output:
          "[预设场景：Kind 生命周期，节点已移除]\nNo kind clusters found.",
      },
      {
        command: "kubectl config get-contexts kind-k8s-lab",
        purpose: "识别残留连接记录，避免误认为 API 已可用",
        expected: "仍保留 kind-k8s-lab 上下文",
        output:
          "[预设场景：Kind 生命周期，残留 kubeconfig]\nCURRENT NAME         CLUSTER      AUTHINFO     NAMESPACE\n*       kind-k8s-lab  kind-k8s-lab kind-k8s-lab learning\n此命令读取本地配置，不向 API server 发起健康检查。",
      },
    ],
    evidence: ["No kind clusters found.", "残留 kubeconfig"],
    commonMistakes: [
      "把 context 列表当成集群健康检查。",
      "以为节点内的镜像和 PVC 数据一定跨重建保留。",
      "把应用资源 YAML 当成数据库数据备份。",
    ],
    quiz: {
      evidence:
        "kind get clusters: No kind clusters found.\nget-contexts: kind-k8s-lab 仍存在",
      question: "这两份输出是否冲突？",
      options: [
        "冲突，必须删除电脑全部配置",
        "不冲突，连接记录可以残留，不能证明实际集群存在",
        "不冲突，因为 kubectl 会自动重建节点",
      ],
      correct: 1,
      explanation:
        "两个命令读取的对象不同。kubectl 不会因为查询上下文就自动创建 Kind 集群。",
    },
    challenge: {
      task: "为同学准备一份可安全执行的学习集群重建清单。",
      steps: [
        "说明当前已知状态和未验证部分。",
        "列出删除前需要保存的四类材料。",
        "写出恢复依赖顺序。",
        "定义进入 Kubernetes 下一阶段前的验收。",
      ],
      acceptance: [
        "区分日志、资源声明与数据备份。",
        "不要求删除其他 context 或其他项目资源。",
        "验收包含 API、节点、应用就绪、入口与数据。",
      ],
      solution:
        "当前 Kind 无集群，kubeconfig 残留，不能据此认定 API 可达。重建前保留 Kind 配置、应用声明、镜像来源及独立可恢复的数据备份，日志另外留作诊断。按引擎→节点→API/Ready→镜像→命名空间和依赖→应用和数据恢复推进；仅操作 k8s-lab，验收业务入口与读写结果后记录基线，不清理其他项目。",
    },
    references: [
      { title: "Kind：创建、删除与日志导出", url: `${kindDocs}/quick-start/` },
      { title: "Kind：配置与挂载", url: `${kindDocs}/configuration/` },
    ],
  },
];
