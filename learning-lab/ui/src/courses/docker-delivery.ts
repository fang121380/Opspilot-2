import type { Lesson } from "../curriculum";

export const dockerDeliveryLessons: Lesson[] = [
  {
    id: "docker-multistage",
    module: "docker",
    prerequisites: ["docker-build"],
    title: "多阶段构建与运行产物",
    subtitle: "把编译环境和最终交付分开，再核对平台与权限",
    duration: "60 分钟",
    outcome:
      "解释多阶段复制的对象，识别静态程序、平台和非 root 运行的约束，并用独立 HTTP 实验验证交付。",
    why: "镜像构建成功只是第一关；还需要知道交付了什么、在哪种机器上运行、为什么精简后没有 Shell 仍能提供服务。",
    sections: [
      {
        title: "先找到真正需要交付的文件",
        body: "本课使用一个只依赖 Go 标准库的小 HTTP 服务：构建阶段含编译器与源码，最终阶段只复制 /out/server 到 /server。每个 FROM 开始新的阶段，COPY --from=build 按阶段名称读取产物，不会把整个编译环境合并进来。scratch 是空基础，不含 Shell、包管理器或常规系统工具；能够运行的前提是程序本身满足运行依赖。本例关闭 CGO，生成适合该 Linux 平台的静态二进制；换成依赖动态库的程序，不能照搬这个结论。",
        example:
          '# 核心结构阅读样例；完整 main.go 与实操见 09-image-delivery.md\nFROM golang:1.26 AS build\nWORKDIR /src\nCOPY main.go .\nRUN CGO_ENABLED=0 go build -trimpath -o /out/server main.go\nFROM scratch\nCOPY --from=build /out/server /server\nUSER 10001:10001\nEXPOSE 8080\nENTRYPOINT ["/server"]',
      },
      {
        title: "精简镜像以后，用什么证明它正确",
        body: "非 root 用户 10001:10001 能读取并执行二进制，应用监听 8080，不依赖主目录、用户名查询或写入系统目录，因此适合这个最小运行环境。没有 sh 时 docker exec 容器 sh 会失败，这不是 HTTP 服务一定损坏的证据；应先从宿主机读取响应、容器日志与 inspect。镜像体积小也不代表没有漏洞，更不代表请求逻辑正确。若应用以后需要访问 HTTPS 上游、使用时区数据库或写临时文件，需要显式提供证书、数据和写入位置，重新验证运行契约。",
      },
      {
        title: "平台、构建上下文和缓存各管什么",
        body: "本课默认构建电脑 Docker 引擎对应的 Linux 平台，Apple Silicon 通常是 arm64，常见 Intel 或 AMD 电脑是 amd64；最终镜像的 Architecture 必须与实际运行能力相符。复制本机编译的可执行文件进去，可能得到操作系统或架构不匹配的错误。只把 main.go 放进 COPY 输入，配合 .dockerignore 排除记录、密钥和其他目录；源码修改会影响编译及其后续依赖步骤，未修改的输入可能命中缓存。本例没有外部 Go 模块，因此不虚构下载依赖层；增加依赖后再按依赖清单与源码变化频率安排步骤。",
      },
    ],
    concepts: [
      {
        term: "构建阶段",
        plain: "制作运行产物的环境",
        detail: "可包含编译器；最终阶段只得到显式复制的文件与自身配置。",
      },
      {
        term: "静态二进制",
        plain: "不依赖动态链接库加载的程序文件",
        detail: "仍受操作系统、CPU 架构及程序的数据文件需求约束。",
      },
      {
        term: "运行契约",
        plain: "程序启动和工作所需的条件",
        detail:
          "包括用户权限、文件、端口、平台、证书及可写目录，精简后逐项验证。",
      },
    ],
    commands: [
      {
        command: "docker image inspect opspilot-study-api:1",
        purpose: "读取最终镜像的平台、运行用户与入口",
        expected: "linux/arm64，User 10001:10001，入口 /server",
        output:
          '[独立预设场景：多阶段构建；inspect 节选，真实架构依电脑而定]\n[{\n  "Os": "linux",\n  "Architecture": "arm64",\n  "Config": {\n    "User": "10001:10001",\n    "Entrypoint": ["/server"]\n  }\n}]',
      },
      {
        command: "docker logs --tail 10 opspilot-study-api",
        purpose: "观察程序启动身份与一次成功请求",
        expected: "uid=10001，GET /status 返回 200",
        output:
          "[独立预设场景：多阶段构建；应用日志节选]\nstarting version=delivery-v1 uid=10001 listen=:8080\nGET /status status=200",
      },
    ],
    evidence: ['"User": "10001:10001"', "GET /status status=200"],
    commonMistakes: [
      "把 COPY --from=build 理解成复制整个编译环境。",
      "因 scratch 里没有 sh 就判断服务无法运行。",
      "以为关闭 CGO 就能跨操作系统和任意架构运行。",
      "把镜像大小、日志中的 200 当成所有业务都经过验证。",
    ],
    quiz: {
      evidence:
        "inspect: User=10001:10001, Entrypoint=/server\n日志: GET /status status=200\n补充现象: docker exec 的 sh 报 executable file not found",
      question: "同学建议给容器改成 root 才能修复，哪项判断更合适？",
      options: [
        "需要 root，所有 HTTP 服务都必须以 root 运行",
        "scratch 没有 Shell，先从宿主机核对 HTTP 正文和日志，不因 sh 缺失改权限",
        "有 200 日志，后续所有业务与架构都已验证",
      ],
      correct: 1,
      explanation:
        "现有证据说明非 root 程序能处理一次请求。Shell 不存在和权限不足是不同问题，仍需验证真实请求内容与适用平台。",
    },
    challenge: {
      task: "画出源码到 HTTP 响应的交付链，并为这个最小镜像写一份运行契约。",
      steps: [
        "说明两个阶段各保留什么，指出 COPY 的来源与目标。",
        "记录模拟输出中的用户和架构，注明不是本机实测。",
        "列出修改代码、改用另一架构、增加 HTTPS 上游时分别需要复核的内容。",
        "阅读实机手册，定义 HTTP、日志、镜像配置的联合验收。",
      ],
      acceptance: [
        "区分构建器、最终镜像和正在运行的容器。",
        "说明 static 不等于跨平台万能，也不保证证书文件存在。",
        "能解释缓存变化与源码变化的关系。",
        "验收包含 /status 的 version 正文、非 root 身份与实际平台，不只看容器 Up。",
      ],
      solution:
        "main.go 进入构建上下文，在含 Go 编译器的 build 阶段生成 Linux 对应架构的 /out/server；最终 scratch 阶段仅复制 /server，以 10001:10001 监听 8080。改源码需重建并启动新实例，换架构需重新生成匹配产物，增加 HTTPS 上游需准备信任证书。实机分别检查镜像 Os/Architecture/User、HTTP /status 的 delivery-v1、启动及请求日志，模拟快照本身不证明本机完成。",
    },
    references: [
      {
        title: "Docker：多阶段构建",
        url: "https://docs.docker.com/build/building/multi-stage/",
      },
      {
        title: "Docker：多平台构建",
        url: "https://docs.docker.com/build/building/multi-platform/",
      },
      {
        title: "Docker：优化缓存",
        url: "https://docs.docker.com/build/cache/optimize/",
      },
    ],
  },
  {
    id: "docker-registry",
    module: "docker",
    prerequisites: ["docker-multistage"],
    title: "镜像仓库与版本交付",
    subtitle: "从 tag 到 digest，把构建成果交给下一台运行环境",
    duration: "65 分钟",
    outcome:
      "解释 tag、push、pull 和 digest 的作用，设计有来源记录、权限边界和运行验收的镜像交付。",
    why: "本机有镜像，不等于另一台电脑或 Kind 节点能获取；先打通镜像交付，再学习集群发布才能避免盲目重启。",
    sections: [
      {
        title: "给镜像取地址，然后才是上传",
        body: "镜像引用由仓库地址、命名空间或仓库路径、标签组成，例如 127.0.0.1:15000/opspilot-study-api:1。docker tag 为本地内容增加引用，不上传镜像，也不复制一个独立运行实例；push 才把相关内容与清单交给指定仓库，pull 则从仓库取得可用内容。网页命令只读固定快照，没有真实上传或登录。对应手册仅向本机临时仓库推送专用练习镜像，不使用个人云仓库，也不触碰既有 hello-web 应用。",
      },
      {
        title: "标签方便人记，摘要帮助人核对",
        body: "标签可以被重新指向另一份内容，所以发布记录只写 v1 并不足以锁定版本。digest 由清单内容决定，用完整仓库路径加 @sha256 摘要可以固定要获取的清单；多平台镜像还可能先指向包含不同平台清单的索引。本地 image ID 通常对应镜像配置对象，不能要求它与仓库清单 digest 相等。本课 inspect 给出示例 RepoDigests，真实实验要保存自己的结果；同一 digest 说明内容身份固定，不说明来源一定可信、没有漏洞或业务一定正确。",
      },
      {
        title: "访问权限、地址和平台是三个独立问题",
        body: "真实私有仓库一般需要 TLS、可信证书与访问控制，docker login 负责为特定仓库建立客户端认证，凭据应由凭据存储管理，不能塞进 Dockerfile、笔记或截图；登录成功仍不代表拥有每个路径的推送权限。本机无认证 HTTP 仓库只用于当前电脑隔离实验，不能作为团队部署模板。Kind 节点的 localhost 指节点自身，主机仓库地址不能直接原样照搬；后续 Kind 课先使用明确的本地镜像导入路径，再讨论独立的节点仓库连接配置。",
      },
    ],
    concepts: [
      {
        term: "tag",
        plain: "便于记忆的可移动引用",
        detail: "给本地镜像打仓库标签不代表已经 push，也不会更新运行中的容器。",
      },
      {
        term: "manifest digest",
        plain: "仓库清单内容的标识",
        detail:
          "与本地配置对象的 image ID 不同；多平台索引及平台清单也应区分。",
      },
      {
        term: "registry",
        plain: "分发镜像内容和清单的服务",
        detail: "客户端、Docker 引擎和 Kind 节点的网络可达性及凭据分别验证。",
      },
    ],
    commands: [
      {
        command: "docker image inspect 127.0.0.1:15000/opspilot-study-api:1",
        purpose: "观察已交付快照中的标签和仓库摘要",
        expected: "RepoTags 与 RepoDigests 同时存在，不能把 Id 当作仓库 digest",
        output:
          '[独立预设场景：镜像仓库；inspect 节选，摘要是教学占位值]\n[{\n  "Id": "sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",\n  "RepoTags": ["127.0.0.1:15000/opspilot-study-api:1"],\n  "RepoDigests": ["127.0.0.1:15000/opspilot-study-api@sha256:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb"]\n}]',
      },
      {
        command: "docker port opspilot-study-registry",
        purpose: "核对临时仓库的电脑端入口范围",
        expected: "主机绑定 127.0.0.1:15000，目标是容器 5000",
        output:
          "[独立预设场景：镜像仓库；端口查询]\n5000/tcp -> 127.0.0.1:15000",
      },
    ],
    evidence: ['"RepoDigests": [', "5000/tcp -> 127.0.0.1:15000"],
    commonMistakes: [
      "只执行 docker tag，就认为其他电脑已经能拉取。",
      "把本地 image ID、平台清单 digest 和索引 digest 混为一谈。",
      "把登录成功当成所有仓库都有写权限。",
      "把电脑的 127.0.0.1 直接填给 Kind 节点作为同一个服务地址。",
    ],
    quiz: {
      evidence:
        "同事将 :1 标签重新推送为新内容；你的交付记录保留旧 manifest digest。目标机器仍能访问该仓库和原清单。",
      question: "怎样更准确地获取原来记录的版本？",
      options: [
        "继续使用 :1，标签永远不变",
        "只用本地 image ID，所有仓库都支持把它当拉取地址",
        "使用完整仓库路径@记录的 digest，随后核对平台并验证业务",
      ],
      correct: 2,
      explanation:
        "digest 固定清单身份，标签可能移动；仍需确保目标平台支持、内容可获得，以及业务结果符合验收。",
    },
    challenge: {
      task: "给另一个学习环境写一份可复核的镜像交付单，并标出当前本机仓库的适用边界。",
      steps: [
        "写出本地标签、仓库路径、push、pull 的顺序与作用。",
        "记录示例 tag、manifest digest 和 image ID 的区别。",
        "说明真实私库的 TLS、认证、授权条件与本课无认证回环仓库的差别。",
        "解释 Kind 节点如何获取镜像，列出交付后应用验收。",
      ],
      acceptance: [
        "交付记录包括来源、平台、完整仓库路径与实际摘要，不复制占位摘要到实机。",
        "明确 tag 不上传，pull 不替换已有容器。",
        "没有要求把凭据写进源码，也没有把临时 HTTP 仓库公开。",
        "区分电脑与节点 localhost，验收包含新实例和 HTTP version。",
      ],
      solution:
        "先从源码构建并记录平台，为同一内容增加 127.0.0.1:15000/opspilot-study-api:1 标签，再向本机仓库 push，记录真实 RepoDigests。用仓库路径@该摘要 pull 后，在新实例验证 /status 版本。当前地址只适合该电脑，Kind 改用后续课程的 kind load 导入路线；团队私库需另外配置节点可达地址、TLS 信任和最小访问权限，不提交登录凭据。",
    },
    references: [
      {
        title: "Docker：推送镜像",
        url: "https://docs.docker.com/reference/cli/docker/image/push/",
      },
      {
        title: "Docker：按摘要拉取",
        url: "https://docs.docker.com/reference/cli/docker/image/pull/",
      },
      {
        title: "Docker：登录与凭据存储",
        url: "https://docs.docker.com/reference/cli/docker/login/",
      },
      {
        title: "Distribution：部署本地仓库",
        url: "https://distribution.github.io/distribution/about/deploying/",
      },
    ],
  },
];
