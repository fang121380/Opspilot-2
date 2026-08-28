# Opspilot 2 Development Environment

## Verified on this machine

- macOS 26.6.2 on Apple Silicon (`arm64`).
- Python 3.12.13, using the repository virtual environment at `.venv`.
- Node.js 24.15.0 and npm 11.12.1.
- Go 1.27.0 at `/Users/andrew/.local/opt/go-1.27.0`.
- Helm 3.19.0 at `/Users/andrew/.local/bin/helm`.

## 已验证的云原生工具

- `kubectl` v1.37.0 at `/Users/andrew/.local/bin/kubectl`.
- `kind` v0.33.0 at `/Users/andrew/.local/bin/kind`.

Both are native Apple Silicon executables and now pass version checks in the current terminal environment.

## Still required for the integration milestone

Docker Desktop provides the container runtime required by Kind. It is the only remaining local prerequisite. Install it from Docker's official distribution, start the application, then verify:

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
