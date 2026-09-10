# 05 Docker 综合实验：把自己的网页做成镜像

这份实机实验接在 Docker 学习链之后，产出下一份 Kind 实验要使用的 `opspilot-lab-web:1` 镜像。你将亲自验证“源文件 → 构建上下文 → 镜像 → 容器 → HTTP → 日志”的因果关系，再观察容器与数据卷的生命周期。

网页终端是模拟练习；以下命令只在电脑的系统终端手工运行。没有可用 Docker 时先做课程模拟，把实机验收留空。初次构建会下载 Nginx 基础镜像，不能保证离线可用。

## 前置条件和文件位置

先完成 [环境检查](00-prerequisites.md)，确认 `docker info` 成功。Windows 使用 Docker Desktop 的 Linux containers 模式和 PowerShell；macOS/Linux 使用终端。下面的 Docker 命令全部为单行，两种系统通用；不要把网页终端当作系统终端。

打开 **Opspilot-2 仓库根目录**，建立自己的练习目录。它不是仓库已有应用的源码，不要覆盖同名的个人练习文件；若目录已存在，先检查内容再继续。

macOS/Linux：

```bash
mkdir -p work/study-web
cd work/study-web
```

Windows PowerShell：

```powershell
New-Item -ItemType Directory -Force work/study-web
Set-Location work/study-web
```

后续本课命令均在 `Opspilot-2/work/study-web` 运行。用编辑器保存以下三个 UTF-8 文本文件，文件名不能带隐藏的 `.txt` 后缀。

`index.html` 的完整内容：

```html
<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="utf-8">
    <title>Opspilot study web</title>
  </head>
  <body>
    <h1>Opspilot study web v1</h1>
    <p>这份页面来自我构建的 Docker 镜像。</p>
  </body>
</html>
```

`Dockerfile` 的完整内容：

```dockerfile
FROM nginx:stable-alpine
COPY index.html /usr/share/nginx/html/index.html
EXPOSE 80
```

`.dockerignore` 的完整内容：

```text
.git
*.log
```

`FROM` 选择基础镜像，`COPY` 把构建上下文中的文件写入镜像，`EXPOSE` 记录容器预期端口，不会把端口发布到电脑。`stable-alpine` 是会变化的标签，适合本课演示；严谨复现还需记录镜像摘要并按 digest 固定基础镜像版本。

## 构建、运行、取得证据

先检查本课专用名称是否已存在：

```text
docker ps -a --filter name=opspilot-study-web
docker image inspect opspilot-lab-web:1
```

首次检查镜像不存在是正常现象。如果名称被自己上一轮实验占用，可先核对镜像和用途，再按末尾的局部清理处理；不删除其他容器或覆盖不明来源的镜像标签。

```text
docker build -t opspilot-lab-web:1 .
docker image inspect opspilot-lab-web:1
docker run -d --name opspilot-study-web --label opspilot.lab=study-web -p 127.0.0.1:8090:80 opspilot-lab-web:1
docker ps --filter name=opspilot-study-web
docker port opspilot-study-web
```

最后的 `.` 是当前目录，即构建上下文；必须能找到 `Dockerfile` 和 `index.html`。`8090:80` 表示电脑端口 8090 转到容器端口 80。显式绑定 `127.0.0.1`，本实验只供电脑访问。旧版 Docker Engine 的 localhost 发布曾有同网段访问限制问题，使用当前受支持版本；本实验不配置公网或局域网分享。[Docker 端口说明](https://docs.docker.com/engine/network/port-publishing/)

打开 [实验网页](http://127.0.0.1:8090)，应该出现 `Opspilot study web v1`。再用系统终端查看真实 HTTP 响应：

macOS/Linux：

```bash
curl -i http://127.0.0.1:8090/
```

Windows PowerShell 使用 `curl.exe`，避免旧 PowerShell 的 `curl` 别名产生不同输出：

```powershell
curl.exe -i http://127.0.0.1:8090/
```

```text
docker logs --tail 30 opspilot-study-web
docker inspect opspilot-study-web
```

预期是 HTTP 200、页面正文标记一致、日志中出现 GET 请求。`docker ps` 的 Up 只证明进程正在运行，HTTP 响应才补上本次访问路径的证据。保存镜像 ID、容器 ID、端口映射和响应，不需要分享完整机器配置。

## 小实验：改源文件为什么页面不变

把本地 `index.html` 的标题改为 `Opspilot study web v2`，刷新网页。预期仍是 v1：镜像内的文件是构建时的副本，本课没有绑定宿主机目录。

```text
docker build -t opspilot-lab-web:2 .
docker image ls opspilot-lab-web
```

即使构建成功，已经运行的容器仍使用 v1。为比较版本，在没有同名容器且 8091 空闲时另建一个：

```text
docker run -d --name opspilot-study-web-v2 --label opspilot.lab=study-web -p 127.0.0.1:8091:80 opspilot-lab-web:2
```

打开 [v2 网页](http://127.0.0.1:8091)与 8090 对比。镜像标签不是运行中容器的自动更新通知。保留 v1 镜像，后面的 Kind 和 Kubernetes 实验使用它。

## 可选小实验：命名卷在容器移除后仍存在

先用 `docker volume inspect opspilot-study-data` 检查。若它已存在且用途不明，跳过本节，不修改里面的数据。首次不存在时创建专用卷，再启动一次性容器写入标记；这里 `sh -c` 在容器内运行，不是在电脑上执行脚本：

```text
docker volume create --label opspilot.lab=study-web opspilot-study-data
docker run --rm --mount type=volume,src=opspilot-study-data,dst=/data opspilot-lab-web:1 sh -c "echo study-volume-survives > /data/evidence.txt"
docker run --rm --mount type=volume,src=opspilot-study-data,dst=/data,readonly opspilot-lab-web:1 cat /data/evidence.txt
```

预期第二个容器读到 `study-volume-survives`，即使第一个容器已由 `--rm` 移除。卷不是备份：删卷、磁盘损坏仍会丢数据。本课也没有证明多机共享或数据库一致性。[Docker 卷说明](https://docs.docker.com/engine/storage/volumes/)

## 失败时沿哪一层检查

| 现象 | 先检查 | 下一步 |
| --- | --- | --- |
| Cannot connect to Docker daemon | `docker info` | 启动 Docker Desktop；确认当前 Docker context 对应本机引擎 |
| 构建找不到 Dockerfile / COPY 源文件 | 当前目录与文件扩展名 | 回到 `work/study-web`，核对完整文件名 |
| 拉取超时、证书或代理错误 | 构建输出里失败的 registry 请求 | 检查网络与 Docker 的代理设置；不是 HTML 代码问题 |
| 容器名已占用 | `docker inspect opspilot-study-web` | 核对是不是自己的旧练习，按局部清理处理 |
| 8090 已占用 | `docker ps` 与电脑端口占用 | 保留原服务，选空闲端口如 8092，并同步修改访问地址 |
| 容器退出或网页失败 | `docker ps -a`、`docker logs`、`docker port` | 先定位进程还是端口；不要直接全局清理 Docker |

## 验收和局部清理

- [ ] 能解释构建上下文、镜像、容器各自是什么，并记录 v1 镜像 ID。
- [ ] v1 页面返回 200，正文正确，日志能对应到本次请求。
- [ ] 能解释修改源文件、重新构建、创建新容器是三个不同动作。
- [ ] 若完成卷练习，能说明容器移除后数据为何仍在，以及卷不等于备份。

继续下一课前可以保留容器，也可以仅清理自己创建的两个容器。下面命令会停止并移除它们，按实际创建情况逐条运行；保留 `opspilot-lab-web:1` 镜像：

```text
docker stop opspilot-study-web
docker rm opspilot-study-web
docker stop opspilot-study-web-v2
docker rm opspilot-study-web-v2
```

仅在不再需要卷中的标记时手工执行 `docker volume rm opspilot-study-data`。不运行 `docker system prune`，不删除 Kind 节点容器。下一步进入 [Kind 综合实验](06-kind-project.md)。

## 进阶实机实验：Compose、服务 DNS 与真正的后端请求

前面的 Nginx 页面只有一个容器。这一节另外建立 **Python Web + Redis** 两个服务：浏览器每访问一次 `/`，Web 都通过 Compose 网络向 Redis 发出一次 `INCR`，返回递增计数。你将能亲自区分“网页进程活着”“依赖已就绪”和“业务真的调用了后端”。

这是手工实机练习，需要联网拉取 Python、Redis 基础镜像；工作台不会执行以下命令。使用自己的实验环境，仍然只操作 Opspilot-2。此前的 `work/study-web`、Kind 和主项目服务都不需要改动。

### 1. 建立独立目录，检查项目名称

先回到 **Opspilot-2 仓库根目录**，不要在上一节的 `work/study-web` 下创建。如果已有 `work/study-compose`，先检查个人文件，不覆盖已有练习。

macOS/Linux：

```bash
mkdir -p work/study-compose
cd work/study-compose
```

Windows PowerShell：

```powershell
New-Item -ItemType Directory -Force work/study-compose
Set-Location work/study-compose
```

接下来所有命令都在 `Opspilot-2/work/study-compose` 运行，统一显式使用项目名 `opspilot-study`：

```text
docker compose version
docker ps -a --filter label=com.docker.compose.project=opspilot-study
docker network ls --filter label=com.docker.compose.project=opspilot-study
```

后两条首次运行应没有数据行。如果已经有资源，先核对它们属于本节旧练习才继续；项目名是清理边界，不能把别人同名的项目当作自己的。下面的网站绑定电脑 `127.0.0.1:8083`，不供手机或公网访问；若该端口已有服务，保留原服务，选择另一个空闲主机端口并同步修改本节全部访问地址。

### 2. 用编辑器保存四个完整文件

文件均为 UTF-8，名称不能附带 `.txt`。不需要安装本机 Python，不需要 pip 依赖，也不需要自行补充 Web 项目。

`app.py`：

```python
import json
import os
import socket
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

REDIS_HOST = os.environ.get("REDIS_HOST", "redis")
REDIS_PORT = int(os.environ.get("REDIS_PORT", "6379"))


def redis_command(*arguments):
    # Redis RESP: an array of UTF-8 bulk strings. This lab needs PING and INCR only.
    parts = [f"*{len(arguments)}\r\n".encode("ascii")]
    for argument in arguments:
        encoded = argument.encode("utf-8")
        parts.extend([
            f"${len(encoded)}\r\n".encode("ascii"),
            encoded,
            b"\r\n",
        ])
    with socket.create_connection((REDIS_HOST, REDIS_PORT), timeout=2) as connection:
        connection.sendall(b"".join(parts))
        with connection.makefile("rb") as response:
            line = response.readline(4096)
    if not line.endswith(b"\r\n"):
        raise RuntimeError("Incomplete Redis response")
    kind, value = line[:1], line[1:-2]
    if kind == b":":
        return int(value)
    if kind == b"+":
        return value.decode("utf-8")
    if kind == b"-":
        raise RuntimeError(value.decode("utf-8", errors="replace"))
    raise RuntimeError("Unexpected Redis response type")


class Handler(BaseHTTPRequestHandler):
    def send_json(self, status, payload):
        body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        if self.path == "/live":
            self.send_json(200, {"web": "alive", "checks_redis": False})
            return
        if self.path not in ("/", "/ready"):
            self.send_json(404, {"error": "not found"})
            return
        try:
            if self.path == "/ready":
                if redis_command("PING") != "PONG":
                    raise RuntimeError("Redis did not return PONG")
                payload = {"web": "ready", "redis": "PONG"}
            else:
                payload = {
                    "version": "compose-v1",
                    "visits": redis_command("INCR", "opspilot:visits"),
                    "backend": f"{REDIS_HOST}:{REDIS_PORT}",
                }
            self.send_json(200, payload)
        except (OSError, RuntimeError, ValueError) as error:
            print(f"dependency failure: {type(error).__name__}: {error}", flush=True)
            self.send_json(503, {"error": "Redis unavailable", "path": self.path})

    def log_message(self, template, *arguments):
        print(f"request: {template % arguments}", flush=True)


if __name__ == "__main__":
    print(f"listening 0.0.0.0:8000; backend {REDIS_HOST}:{REDIS_PORT}", flush=True)
    ThreadingHTTPServer(("0.0.0.0", 8000), Handler).serve_forever()
```

这里用 Python 标准库实现本实验需要的两条 Redis 命令，目的是让你读懂“请求确实经过后端”。它没有实现通用 Redis 客户端的连接池、完整协议、认证或 TLS，不应当直接充当生产客户端。每个请求新建连接，依赖暂时不可用后，后续请求有机会重新连接恢复。

`Dockerfile`：

```dockerfile
FROM python:3.12-slim
WORKDIR /app
COPY app.py .
ENV PYTHONUNBUFFERED=1
USER 10001
EXPOSE 8000
CMD ["python", "app.py"]
```

`.dockerignore`：

```text
.git
.env
__pycache__
*.pyc
*.log
```

`compose.yaml`：

```yaml
services:
  web:
    build:
      context: .
    ports:
      - "127.0.0.1:8083:8000"
    environment:
      REDIS_HOST: redis
      REDIS_PORT: "6379"
    depends_on:
      redis:
        condition: service_healthy
    healthcheck:
      test: ["CMD", "python", "-c", "import urllib.request; urllib.request.urlopen('http://127.0.0.1:8000/live', timeout=2).read()"]
      interval: 5s
      timeout: 3s
      retries: 5
      start_period: 5s
  redis:
    image: redis:7-alpine
    command: ["redis-server", "--save", "", "--appendonly", "no"]
    tmpfs:
      - /data
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 5s
      timeout: 3s
      retries: 5
      start_period: 5s
```

Compose 自动建立项目的默认网络，两个服务加入其中。`web` 通过服务名 `redis` 访问 **容器端口 6379**；Redis 没有 `ports`，不会因此在电脑上开放一个数据库入口。`depends_on` 等待 Redis 健康才启动 Web。Web 自己的健康检查故意只查 `/live`，下一步会验证它的覆盖范围。

本实验为了专注网络，显式关闭 Redis RDB 保存和 AOF，并把 Redis 的 `/data` 挂为易失的 tmpfs，避免镜像默认目录创建匿名数据卷。计数器是可丢弃实验数据，Redis 重启后会重置；前一节学到的持久化、备份规则仍需在真实业务里单独设计。两个基础镜像 tag 都可能更新，需要严谨复现时记录并固定 digest。

### 3. 渲染配置、构建、启动

```text
docker compose -p opspilot-study config
docker compose -p opspilot-study build web
docker compose -p opspilot-study up -d
docker compose -p opspilot-study ps
docker compose -p opspilot-study logs --tail 30 web redis
```

`config` 检查并渲染最终配置，不会创建容器；核对 `REDIS_HOST`、`127.0.0.1:8083` 和健康依赖条件。`build web` 从当前上下文构建 Web 镜像，`up -d` 才建立网络和运行服务。如果 healthcheck 仍显示 `starting`，过几秒重新运行 `ps`；正常情况下两个服务最终均为 `healthy`。若出现错误，不要跳过，先看本节排查表。

Web 日志应有 `listening 0.0.0.0:8000; backend redis:6379`。这表示配置和进程启动到了对应位置，还没有证明一次计数业务成功。

### 4. 从主机发请求，直接核对 Redis 数据

macOS/Linux：

```bash
curl -i http://127.0.0.1:8083/live
curl -i http://127.0.0.1:8083/ready
curl -i http://127.0.0.1:8083/
curl -i http://127.0.0.1:8083/
```

Windows PowerShell：

```powershell
curl.exe -i http://127.0.0.1:8083/live
curl.exe -i http://127.0.0.1:8083/ready
curl.exe -i http://127.0.0.1:8083/
curl.exe -i http://127.0.0.1:8083/
```

干净新实验中，`/live` 返回 200 和 `checks_redis: false`；`/ready` 返回 200 和 `redis: PONG`；两次 `/` 返回 200，`visits` 分别为 1 和 2。已经在浏览器访问过 `/` 时计数会更大，应比较是否逐次递增，不要求固定数字。健康检查访问 `/live`，不会增加计数。

在系统终端直接查询后端：

```text
docker compose -p opspilot-study exec redis redis-cli GET opspilot:visits
docker compose -p opspilot-study logs --tail 30 web
```

Redis 中的数字应与最后一次 `/` 响应一致；期间不要另外刷新页面。Web 日志应能对应 `/ready` 与 `/` 的 200 请求。这三份证据分别来自 HTTP、后端数据和日志，比只看容器 `Up` 更完整。

### 5. 验证容器 DNS 和访问路径

下面命令在 Web 容器里运行 Python，通过容器自己的 DNS 解析服务名，不要求电脑安装 Python。单行可用于 macOS/Linux 终端和 Windows PowerShell：

```text
docker compose -p opspilot-study exec web python -c "import socket; print(socket.gethostbyname('redis'))"
docker network inspect opspilot-study_default
```

第一条应返回 Redis 在项目网络中的 IP；第二条的 `Containers` 中应包含本项目 Web 与 Redis 容器。具体 IP 和生成的容器 ID 会随环境变化，不要硬编码。DNS 能解析只证明名称解析环节，端口可达、协议和业务仍要靠上一节验证。

请求路径现在可以写成：

```text
电脑 curl / 浏览器
  → 电脑 127.0.0.1:8083
  → Web 容器 0.0.0.0:8000
  → 同项目网络 DNS 把 redis 解析为容器 IP
  → Redis 容器 6379，执行 INCR opspilot:visits
  → Web 返回带 visits 的 JSON
```

Web 中如果错误地配置 `REDIS_HOST=127.0.0.1`，它会访问 **Web 容器自己**，不会访问另一个 Redis 容器。电脑通常也不能直接使用 Compose 服务名 `redis`。服务名、电脑地址、容器 IP，各自有适用范围。

### 6. 可控故障：进程健康时，业务仍然可能失败

只停止本项目的 Redis，不影响主机其他 Redis 或其他项目：

```text
docker compose -p opspilot-study stop redis
docker compose -p opspilot-study ps -a
```

再次执行第 4 节的请求命令。预期 `/live` 仍返回 200，而 `/ready` 与 `/` 返回 503 和 `Redis unavailable`；请求遇到连接超时时可能等约两秒。Web 容器依然可能显示 `healthy`，因为它的健康检查只覆盖 `/live`。日志会显示依赖连接失败：

```text
docker compose -p opspilot-study logs --tail 30 web
```

这是预期实验结果：`service_healthy` 帮助初始启动排序，不会自动替你修复运行中依赖故障；Web 健康指标覆盖什么，取决于你写了什么检查。

恢复本项目 Redis：

```text
docker compose -p opspilot-study start redis
docker compose -p opspilot-study ps
```

等 Redis 健康后，再访问 `/ready` 和 `/`，应恢复 200；本脚本下一次请求会重新建立连接，不必重启 Web。计数从 1 重新开始是本节关闭 Redis 持久化的预期结果。记录故障前、故障中、恢复后三份响应与日志，解释哪些信号一致、哪些看似矛盾。

### 7. 验证修改源码后需要重新构建

用编辑器把 `app.py` 中 `compose-v1` 改为 `compose-v2`，访问 `/`：仍应看到 v1，因为容器使用镜像内的副本。执行：

```text
docker compose -p opspilot-study up -d --build web
```

这次 Compose 构建 Web 并按需重建它，再访问 `/` 应看到 v2。仅 `restart web` 不会把尚未构建的源码装进镜像。这个步骤通常保留正在运行的 Redis，计数应延续；如果你额外停止了 Redis，计数重置应按前述数据边界解释。

### 8. 排查、验收与只清理本项目

| 现象 | 先读什么证据 | 处理方向 |
| --- | --- | --- |
| `docker compose` 不存在 | `docker compose version` | 按环境检查文档补齐 Compose 插件或 Docker Desktop；不要改成不明来源脚本 |
| build 报找不到 `app.py` | 当前目录、文件名、`COPY` 错误 | 四个文件放在 `work/study-compose` 同级，检查隐藏 `.txt` |
| Redis 一直不健康 | `docker compose -p opspilot-study logs --tail 30 redis` | 对照完整 `command` 与 healthcheck；先修启动失败原因 |
| Web 启动就退出 | Web 日志 | 核对 Python 缩进、完整代码和构建输入；改完重新 build |
| 8083 已占用 | 启动错误与现有端口使用者 | 不关闭别人的服务，更换本实验主机端口并同步请求地址 |
| `/live` 200，`/ready` 503 | Redis 状态、Web 依赖日志、DNS 查询 | 顺序检查服务名、同网络、Redis 监听；不要把 Web 健康当业务健康 |
| DNS 正常但业务失败 | `/ready`、后端查询、Web 日志 | DNS 只解决地址；继续检查连接、协议和应用逻辑 |
| 改源码后仍旧版本 | build 日志、HTTP version | 重新构建并按需重建 Web；不只是 restart |

完成以下验收后，再清理资源：

- [ ] 能独立解释 build、config、up、restart 的区别。
- [ ] 用真实 HTTP 200、递增计数、Redis GET 和日志证明业务访问了后端。
- [ ] 用容器内 DNS 查询与 network inspect 解释 `redis` 为什么能解析。
- [ ] 停止 Redis 后观察到 `/live` 200 与业务 503，恢复后不重启 Web 也能再次成功。
- [ ] 解释计数为何在 Redis 重启后清零，以及这并不是持久化设计。
- [ ] 修改版本标记后，通过构建和重建取得 v2 响应。

确认项目资源都属于本节后，在 `work/study-compose` 执行下面命令。它停止并移除 **opspilot-study** 项目的服务容器和默认网络，不删除前面的 `opspilot-lab-web:1` 镜像，不删除 Kind 集群，也不会移除工作目录中的源码：

```text
docker compose -p opspilot-study down
docker ps -a --filter label=com.docker.compose.project=opspilot-study
docker network ls --filter label=com.docker.compose.project=opspilot-study
```

后两条应不再显示本项目资源。本节 Redis 使用 tmpfs，没有命名卷或匿名数据卷需要清理，无需添加 `-v`。不执行全局 prune。保存好自己的四个文件和实验记录，下次可从相同目录再次 `up -d --build` 重建。

参考：[Compose 网络与服务名](https://docs.docker.com/compose/how-tos/networking/)、[Compose 启动顺序与健康依赖](https://docs.docker.com/compose/how-tos/startup-order/)、[Redis INCR](https://redis.io/docs/latest/commands/incr/)、[Redis PING](https://redis.io/docs/latest/commands/ping/)。
