# Opspilot 2 Development Environment

中文版本：[开发环境](development-environment-zh.md)

## Verified on this machine

- macOS 26.6.2 on Apple Silicon (`arm64`).
- Python 3.12.13, using the repository virtual environment at `.venv`.
- Node.js 24.15.0 and npm 11.12.1.
- Go 1.27.0 at `/Users/andrew/.local/opt/go-1.27.0`.
- Helm 3.19.0 at `/Users/andrew/.local/bin/helm`.
- Docker Desktop 4.88.1 with Docker Engine 29.7.2.

## 已验证的云原生工具

- `kubectl` v1.37.0 at `/Users/andrew/.local/bin/kubectl`.
- `kind` v0.33.0 at `/Users/andrew/.local/bin/kind`.

Both are native Apple Silicon executables and now pass version checks in the current terminal environment.

## Docker and Kind integration

Docker Desktop is installed from Docker's official Apple Silicon distribution and the two-node `opspilot-2` Kind cluster has been exercised successfully. Verify the active toolchain with:

```bash
docker version
kubectl version --client
kind version
```

Do not install or run `winget`; that is a Windows package manager and does not apply to this macOS project.

## Python commands

```bash
python3 -m venv .venv
.venv/bin/pip install -e '.[dev]'
make test
make lint
```
