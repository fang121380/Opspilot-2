# 09 镜像交付实验：多阶段构建到本机仓库

先完成工作台的「从源码构建可复现镜像」「多阶段构建与运行产物」「镜像仓库与版本交付」。本实验把一个完整的小服务编译成静态程序，以非 root 用户运行，再练习 tag → push → digest → pull → 新实例验收。

这里的命令需要在电脑系统终端**手工执行**，工作台模拟输出不表示它们已经运行。本手册已按官方文档检查，未将下面的实机步骤视作已通过的测试。第一次需要联网下载 Go 和 Registry 基础镜像；不需要电脑安装 Go。

本实验独立使用 `work/study-delivery`、`opspilot-study-api`、`opspilot-study-api-pulled` 和 `opspilot-study-registry`。不修改前面实验的网页、`opspilot-lab-web:1`、Kind 集群或现有个人应用。仓库仅绑定电脑回环地址，不上传到 Docker Hub，不登录云仓库，不保存凭据。

## 1. 检查环境和实验范围

Windows 使用 PowerShell，Docker Desktop 选择 Linux containers；macOS/Linux 使用系统终端。Docker 命令均为单行、两种终端通用。

```text
docker context show
docker context inspect
docker info
docker ps -a --filter name=opspilot-study-api
docker ps -a --filter name=opspilot-study-registry
docker image inspect opspilot-study-api:1
docker image inspect opspilot-study-api:2
docker image inspect 127.0.0.1:15000/opspilot-study-api:1
docker image inspect 127.0.0.1:15000/opspilot-study-api:2
```

确认当前 Docker context 对应这台电脑的引擎，`OSType` 为 `linux`。如果连的是远程 SSH/TCP 引擎，停止本实验，先回到自己明确知道的本机环境；不要猜 context 名称。镜像首次提示不存在是正常的。若专用名称已有资源，先确定是否是自己的上一轮实验，不覆盖不明镜像或删除不明容器。

稍后的 HTTP 仓库实验还要求 `docker info` 中 **Insecure Registries** 覆盖 `127.0.0.0/8` 或明确的 `127.0.0.1:15000`。Docker 当前将回环段列为本地例外，但官方说明未来可能变化。本教程不修改 Docker daemon 配置；未满足条件时先完成前半段构建和 HTTP 验收，仓库部分留待环境具备条件后完成。[Docker 本地仓库例外说明](https://docs.docker.com/reference/cli/dockerd/#insecure-registries)

Docker Desktop 的引擎运行在 Linux 环境中，发布端口由 Desktop 转发到电脑。后面会分别验证电脑 HTTP 入口和引擎 push/pull 路径；前者成功不能替后者作保证。不要把仓库地址换成 `host.docker.internal` 来试图绕过 TLS，也不要扩大为局域网监听。[Desktop 网络说明](https://docs.docker.com/desktop/features/networking/)

## 2. 建立独立目录和完整文件

从 Opspilot-2 仓库根目录开始。以下创建命令在目录已存在时应停止；保留已有内容，手动检查是否继续本轮实验。

macOS/Linux：

```bash
mkdir -p work
mkdir work/study-delivery
cd work/study-delivery
```

Windows PowerShell：

```powershell
New-Item -ItemType Directory -Force work
New-Item -ItemType Directory work/study-delivery -ErrorAction Stop
Set-Location work/study-delivery
```

后续在 `Opspilot-2/work/study-delivery` 操作。用编辑器保存以下三个完整 UTF-8 文本文件，不要带隐藏的 `.txt` 扩展名：

```text
study-delivery/
  main.go
  Dockerfile
  .dockerignore
```

`main.go`：

```go
package main

import (
    "context"
    "encoding/json"
    "errors"
    "log"
    "net/http"
    "os"
    "os/signal"
    "syscall"
    "time"
)

const version = "delivery-v1"

func main() {
    mux := http.NewServeMux()
    mux.HandleFunc("/status", func(w http.ResponseWriter, r *http.Request) {
        if r.URL.Path != "/status" {
            http.NotFound(w, r)
            return
        }
        if r.Method != http.MethodGet {
            w.Header().Set("Allow", http.MethodGet)
            http.Error(w, "GET required", http.StatusMethodNotAllowed)
            log.Printf("%s /status status=405", r.Method)
            return
        }
        w.Header().Set("Content-Type", "application/json; charset=utf-8")
        payload := map[string]string{"status": "ok", "version": version}
        if err := json.NewEncoder(w).Encode(payload); err != nil {
            log.Printf("write response failed: %v", err)
            return
        }
        log.Printf("GET /status status=200")
    })
    server := &http.Server{
        Addr:              ":8080",
        Handler:           mux,
        ReadHeaderTimeout: 5 * time.Second,
        WriteTimeout:      10 * time.Second,
        IdleTimeout:       30 * time.Second,
    }
    stop, cancel := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
    defer cancel()
    done := make(chan struct{})
    go func() {
        <-stop.Done()
        ctx, release := context.WithTimeout(context.Background(), 5*time.Second)
        defer release()
        if err := server.Shutdown(ctx); err != nil {
            log.Printf("shutdown: %v", err)
        }
        close(done)
    }()
    log.Printf("starting version=%s uid=%d listen=:8080", version, os.Getuid())
    if err := server.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
        log.Fatal(err)
    }
    <-done
    log.Print("server stopped")
}
```

`Dockerfile`：

```dockerfile
FROM golang:1.26 AS build
WORKDIR /src
COPY main.go .
RUN CGO_ENABLED=0 go build -trimpath -o /out/server main.go

FROM scratch
COPY --from=build /out/server /server
USER 10001:10001
EXPOSE 8080
ENTRYPOINT ["/server"]
```

`.dockerignore`：

```text
*
!Dockerfile
!main.go
!.dockerignore
```

只有上述文件参与本次构建，避免把实验记录和其他文件混入上下文。本程序没有外部 Go 模块，也不向外部 HTTPS 服务发请求，因此无需 `go.mod`、依赖下载层或根证书。它只监听 8080、写标准输出日志，不写根文件系统。将来增加数据库、文件写入或 HTTPS 上游时，需要扩充运行契约。

`golang:1.26` 采用当前官方多阶段示例系列，属于会变化的标签，不能保证以后得到逐字节相同产物。首次练习记录所用基础镜像摘要、构建日志与目标架构；严格复现时再把 `FROM` 固定为自己实际解析并验证的 digest。本手册没有提供虚构的可拉取摘要。[Docker 多阶段说明](https://docs.docker.com/build/building/multi-stage/)

## 3. 构建、读取配置、验证 HTTP

```text
docker build --progress=plain -t opspilot-study-api:1 .
docker image inspect opspilot-study-api:1
docker history opspilot-study-api:1
docker run -d --name opspilot-study-api --label opspilot.lab=study-delivery --read-only --cap-drop ALL --security-opt no-new-privileges=true -p 127.0.0.1:18090:8080 opspilot-study-api:1
docker port opspilot-study-api
docker logs --tail 20 opspilot-study-api
```

构建失败立即停止，不要继续运行尚未成功构建的镜像。`inspect` 中应是 `Os: linux`、`User: 10001:10001`、入口 `/server`。架构按真实电脑记录，不强行匹配课程模拟的 arm64。`history` 展示最终阶段摘要，不会把编译器作为最终文件层全部保留下来；它也不能独自证明缓存命中。

macOS/Linux：

```bash
curl --max-time 10 -i http://127.0.0.1:18090/status
curl --max-time 10 -i -X POST http://127.0.0.1:18090/status
```

Windows PowerShell：

```powershell
curl.exe --max-time 10 -i http://127.0.0.1:18090/status
curl.exe --max-time 10 -i -X POST http://127.0.0.1:18090/status
```

GET 预期 HTTP 200，JSON 包含 `status: ok` 与 `version: delivery-v1`；POST 预期 405，说明接口只接受 GET。用浏览器打开 [服务状态](http://127.0.0.1:18090/status) 同样可以看 JSON。最后读取日志，应该有启动 `uid=10001` 和 GET/POST 请求记录。

```text
docker logs --tail 20 opspilot-study-api
docker inspect opspilot-study-api
```

这里 `--read-only` 和非 root 是本例经过设计后适用的运行条件，不是所有镜像可直接套用的启动参数。scratch 中没有 Shell，不要求通过 `docker exec ... sh` 进入容器来证明业务正常。

## 4. 用一次源码修改理解缓存和版本

先原样再执行一次构建，观察构建日志中是否出现 `CACHED`；缓存可能因清理、构建器差异或基础镜像变化而不可用，不能规定必须全部命中。

```text
docker build --progress=plain -t opspilot-study-api:1 .
```

把 `main.go` 中 `delivery-v1` 改为 `delivery-v2`，然后构建新标签：

```text
docker build --progress=plain -t opspilot-study-api:2 .
docker image inspect opspilot-study-api:2
```

预期源码 COPY、编译及依赖它的后续步骤重新处理。重新请求 18090，仍是 v1：正在运行的容器不会因新镜像出现而更新。本轮保留 v1 容器作为对照，仓库节推送两个明确版本。不要覆盖原有网页项目的镜像。

本实验只构建当前引擎默认平台。多平台交付还需为各平台产生可运行产物并发布对应清单，不能通过改标签完成。想比较 Windows/Intel 与 Apple Silicon 的结果时，先分别记录 `Os`、`Architecture` 和工具版本，不把 `exec format error` 当成应用路由错误。[Docker 多平台构建](https://docs.docker.com/build/building/multi-platform/)、[缓存输入与步骤顺序](https://docs.docker.com/build/cache/optimize/)

## 5. 启动临时本机仓库，验证两个网络视角

仅在第 1 节本机引擎与回环 HTTP 条件满足时继续。确认 15000 端口空闲，专用容器名没有被其他用途占用。下面容器在删除时可以丢弃所有仓库数据：使用 tmpfs，不创建命名卷或保留匿名数据卷；容器停止后数据也不应被当作可恢复存储。

```text
docker run -d --name opspilot-study-registry --label opspilot.lab=study-delivery -p 127.0.0.1:15000:5000 --mount type=tmpfs,destination=/var/lib/registry registry:3
docker port opspilot-study-registry
docker logs --tail 20 opspilot-study-registry
```

端口应为 `5000/tcp -> 127.0.0.1:15000`。日志里出现临时 HTTP secret 提示不等于已经配置用户登录；本例没有认证。它只用于本机练习，不承载私密数据。使用当前受支持 Docker；旧引擎曾有 localhost 发布的同网段可达问题。[端口发布边界](https://docs.docker.com/engine/network/port-publishing/)

从**电脑**验证仓库接口：

macOS/Linux：

```bash
curl --max-time 10 -i http://127.0.0.1:15000/v2/
```

Windows PowerShell：

```powershell
curl.exe --max-time 10 -i http://127.0.0.1:15000/v2/
```

预期 HTTP 200，正文 `{}`。然后为两个专用镜像增加本机仓库标签，并由 **Docker 引擎**完成上传：

```text
docker tag opspilot-study-api:1 127.0.0.1:15000/opspilot-study-api:1
docker tag opspilot-study-api:2 127.0.0.1:15000/opspilot-study-api:2
docker push 127.0.0.1:15000/opspilot-study-api:1
docker push 127.0.0.1:15000/opspilot-study-api:2
docker image inspect 127.0.0.1:15000/opspilot-study-api:1
docker image inspect 127.0.0.1:15000/opspilot-study-api:2
```

每步成功后再进行下一步。`tag` 只增加本地引用；成功 `push` 的输出应包含仓库摘要，`RepoDigests` 可用来记录完整引用。如果电脑 curl 成功但 push 报 `HTTP response to HTTPS client` 或连接失败，说明引擎路径或 TLS 条件尚未满足；保存具体错误，停止仓库节，按末尾局部清理处理。本教程不要求改 daemon、放开不安全网段、关闭防火墙或登录任何个人仓库。

本机 HTTP 仓库流程依据 [Distribution 本地部署](https://distribution.github.io/distribution/about/deploying/) 和 [Docker push](https://docs.docker.com/reference/cli/docker/image/push/)；是否可用仍以上述真实两层检查为准。

## 6. 按真实摘要拉取，再运行新实例

先读取 v2 的完整仓库引用，命令兼容两种终端：

```text
docker image inspect --format '{{index .RepoDigests 0}}' 127.0.0.1:15000/opspilot-study-api:2
```

只有返回类似 `127.0.0.1:15000/opspilot-study-api@sha256:...` 的完整值才继续。为避免把教学占位摘要当作真实值，下面用变量接收你电脑的实际结果。

macOS/Linux：

```bash
delivery_ref=$(docker image inspect --format '{{index .RepoDigests 0}}' 127.0.0.1:15000/opspilot-study-api:2)
printf '%s\n' "$delivery_ref"
docker pull "$delivery_ref"
docker run -d --name opspilot-study-api-pulled --label opspilot.lab=study-delivery --read-only --cap-drop ALL --security-opt no-new-privileges=true -p 127.0.0.1:18091:8080 "$delivery_ref"
curl --max-time 10 -i http://127.0.0.1:18091/status
```

Windows PowerShell：

```powershell
$deliveryRef = docker image inspect --format '{{index .RepoDigests 0}}' 127.0.0.1:15000/opspilot-study-api:2
$deliveryRef
docker pull $deliveryRef
docker run -d --name opspilot-study-api-pulled --label opspilot.lab=study-delivery --read-only --cap-drop ALL --security-opt no-new-privileges=true -p 127.0.0.1:18091:8080 $deliveryRef
curl.exe --max-time 10 -i http://127.0.0.1:18091/status
```

仍需逐条执行：获取变量失败或 `pull` 失败时，不继续创建容器。预期 18091 返回 `delivery-v2`，18090 仍是 `delivery-v1`。

```text
docker inspect opspilot-study-api-pulled
docker logs --tail 20 opspilot-study-api-pulled
docker logs --tail 30 opspilot-study-registry
```

新实例的 `Config.Image` 应是保存的仓库摘要引用，HTTP 正文符合 v2。`pull` 可能显示内容已存在：它仍向仓库查询所需清单，已有本地内容可以复用。因此本节证明仓库清单可访问和摘要可运行，并没有证明另一台空缓存电脑完成完整下载。不要为了制造下载进度删除其他镜像。

这里也没有证明 Kind 能访问该仓库：节点的 `127.0.0.1` 是节点自身。衔接 [Kind 镜像交付实验](06-kind-project.md) 时，仍沿用该手册的命名和 `kind load docker-image` 路径，不直接把本机仓库引用塞入现有 Deployment。

真实团队私库需要 TLS、可信证书、认证和仓库路径授权。`docker login` 不是上传镜像，也不授予所有路径写权限；凭据应由凭据存储管理。本实验不执行 login，不把 token 写进命令、Dockerfile 或交接笔记。[登录与凭据管理](https://docs.docker.com/reference/cli/docker/login/)、[按摘要拉取](https://docs.docker.com/reference/cli/docker/image/pull/)

## 7. 故障定位与验收

| 现象                          | 先读的证据                              | 下一步                                             |
| ----------------------------- | --------------------------------------- | -------------------------------------------------- |
| `COPY main.go` 失败           | 当前目录、文件名、`.dockerignore`       | 确认三个完整文件在同级，文件不是 `main.go.txt`     |
| Go 编译失败                   | build 首个报错的文件与行号              | 核对完整源码，不运行旧镜像冒充新成果               |
| `exec format error`           | 镜像 Os/Architecture、引擎平台          | 检查是否误复制宿主机程序或运行不匹配架构           |
| 启动后退出                    | `docker logs` 和 State.ExitCode         | 找到具体程序错误；不凭退出码猜测内存故障           |
| 找不到 `sh`                   | scratch 的文件边界、HTTP 与日志         | 本例本来没有 Shell，先验证应用而不是改 root        |
| 18090、18091 或 15000 已占用  | docker run 错误、现有服务用途           | 保留占用者；先停止本节，再为本实验统一改地址和标签 |
| `/status` 正常，`/` 是 404    | 请求路径                                | 本程序只实现 `/status`，使用完整路径               |
| curl 仓库成功但 push 失败     | context、本地例外、push 的 TLS/连接错误 | 区分电脑与引擎视角，不默认修改 daemon              |
| 仓库重启后 `manifest unknown` | Registry 的 tmpfs 数据生命周期          | 仓库数据是临时的，确认仍是本节资源后重新 push      |
| pull 已存在但页面仍 v1        | 访问端口、容器 Config.Image             | 拉取不更新旧容器；核对 18091 的新实例              |

- [ ] 解释构建阶段含什么、最终阶段为什么不需要编译器和 Shell。
- [ ] 记录真实平台、非 root 用户、构建日志与 HTTP v1 证据。
- [ ] 比较原样重建与修改源码后的缓存结果，解释旧容器为什么仍是 v1。
- [ ] 单独记录电脑 `/v2/` HTTP 检查和 Docker 引擎 push/pull 结果。
- [ ] 保存实际 v1/v2 标签与摘要，解释它们与 image ID 的区别。
- [ ] 用新容器的摘要引用、日志和 HTTP v2 正文完成联合验收。
- [ ] 说明这份结果没有证明跨电脑、跨平台或 Kind 节点仓库访问。

若只完成前半段，应记录“构建与 HTTP 已验证，仓库交付未完成”及阻碍原因，不把阅读模拟输出作为实机通过。

## 8. 仅清理本节专用资源

先保存需要的 HTTP 结果、摘要和日志；确认这些名称属于本轮实验且标签为 `opspilot.lab=study-delivery`：

```text
docker inspect opspilot-study-api
docker inspect opspilot-study-api-pulled
docker inspect opspilot-study-registry
```

对本轮实际创建的资源逐条执行。未创建的名称会提示不存在，可跳过；用途不符则停止，不执行删除：

```text
docker stop opspilot-study-api opspilot-study-api-pulled opspilot-study-registry
docker rm opspilot-study-api opspilot-study-api-pulled opspilot-study-registry
docker ps -a --filter label=opspilot.lab=study-delivery
```

本节 Registry 数据使用 tmpfs，停止即丢弃，不需要删除卷。镜像可以保留复习；确需清理时，只删除本次明确创建的四个标签：

```text
docker image rm 127.0.0.1:15000/opspilot-study-api:1
docker image rm 127.0.0.1:15000/opspilot-study-api:2
docker image rm opspilot-study-api:1
docker image rm opspilot-study-api:2
```

摘要拉取可能留下额外引用；需要删除时，以第 6 节自己记录的完整 `delivery_ref`/`deliveryRef` 传给 `docker image rm`，不要用泛化的 sha256 列表批量删除。出现被引用或仍使用的提示时保留它，不加 `--force`。基础镜像与共享构建缓存可以保留；不运行全局 prune。源码与学习笔记也保留，下次可从原文件重新构建。
