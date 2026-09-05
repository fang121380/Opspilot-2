# 00 环境检查 / Prerequisites

## 目标与模式 / Goal and Mode

区分客户端存在、Docker 引擎可用、集群连通三种证据。网页课程只返回模拟版本；以下命令在电脑终端真实执行。运行 hello-world 会启动并移除一个容器，若镜像不存在还会下载镜像。

Distinguish client availability, Docker engine availability, and cluster connectivity. The website only simulates versions; commands below run in the computer terminal. Running hello-world creates and removes a container and may download its image.

## 操作 / Practice

```text
node --version
python --version
docker --version
kind version
kubectl version --client
docker info
docker run --rm hello-world
```

Windows 使用 `python`，macOS 可用 `python3 --version`。网页要求 Node.js >=22.18，桥接要求 Python >=3.12。Windows 真实集群需要 Docker Desktop 使用 Linux containers，且 WSL2/虚拟化正常。

Use `python` on Windows or `python3 --version` on macOS. The UI needs Node.js >=22.18 and the bridge Python >=3.12. Live Windows practice requires Docker Desktop Linux containers with working WSL2 and virtualization.

真实版本命令只证明客户端可执行。`docker info` 成功说明引擎可达；hello-world 成功说明本次容器能运行，只有镜像确实发生下载时才能证明本次拉取成功。这些都不证明 Kubernetes 已连接，集群验证留到第 02 课。

Real version commands only show that clients run. Successful `docker info` shows engine reachability; hello-world demonstrates this container run. It proves a pull only if a download actually occurred. None of these proves Kubernetes connectivity; that is checked in lab 02.

## 验收 / Acceptance

- [ ] 记录真实版本及 `docker info` 的结果 / Record actual versions and engine results.
- [ ] hello-world 输出后正常退出，理解 `--rm` 清理容器而不是删除镜像 / Observe completion and explain container-only cleanup.
- [ ] 能解释 Docker 运行容器、Kind 将节点运行在容器里、kubectl 查询集群 / Explain the three tools.
- [ ] 网页模拟通过与本机检查分别记录 / Keep simulated completion separate from host verification.
