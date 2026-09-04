# 00 环境检查 / Prerequisites

## 目标 / Goal

理解 Docker、Kind、kubectl 各自负责什么，并确认本机能运行本地 Kubernetes。

Understand the role of Docker, Kind, and kubectl, and verify that this machine can run local Kubernetes.

## 操作 / Do

```bash
cd learning-lab
make check
docker run --rm hello-world
```

`docker run` 成功后，说明 Docker 能拉取并启动容器。Kind 会把 Kubernetes 节点运行在 Docker 容器中。

When `docker run` succeeds, Docker can pull and start containers. Kind runs Kubernetes nodes as Docker containers.

## 验收 / Acceptance

- [ ] `docker info` 能返回运行时信息 / `docker info` returns runtime information.
- [ ] `kind --version` 和 `kubectl version --client` 可执行 / both commands work.
- [ ] `hello-world` 输出完成后容器自动删除 / the container exits and is removed.

