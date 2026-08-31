# Opspilot 2 开发环境

English version: [Development environment](development-environment.md)

## 本机已验证环境

- Apple Silicon (`arm64`) 的 macOS 26.6.2。
- Python 3.12.13，使用仓库内 `.venv` 虚拟环境。
- Node.js 24.15.0 与 npm 11.12.1。
- Go 1.27.0，路径 `/Users/andrew/.local/opt/go-1.27.0`。
- Helm 3.19.0，路径 `/Users/andrew/.local/bin/helm`。
- Docker Desktop 4.88.1，Docker Engine 29.7.2。

## 已验证的云原生工具

- `kubectl` v1.37.0，路径 `/Users/andrew/.local/bin/kubectl`。
- `kind` v0.33.0，路径 `/Users/andrew/.local/bin/kind`。

两者均为原生 Apple Silicon 可执行文件，已可在当前终端完成版本检查。

## Docker 与 Kind 集成

Docker Desktop 安装自官方 Apple Silicon 发行版，双节点 `opspilot-2` Kind 集群已完成实机演练。可用以下命令检查工具链：

```bash
docker version
kubectl version --client
kind version
```

不要安装或运行 `winget`；它是 Windows 包管理器，不适用于此 macOS 项目。

## Python 命令

```bash
python3 -m venv .venv
.venv/bin/pip install -e '.[dev]'
make test
make lint
```
