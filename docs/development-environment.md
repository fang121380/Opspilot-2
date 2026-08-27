# Opspilot 2 Development Environment

## Verified on this machine

- macOS 26.6.2 on Apple Silicon (`arm64`).
- Python 3.12.13, using the repository virtual environment at `.venv`.
- Node.js 24.15.0 and npm 11.12.1.
- Go 1.27.0 at `/Users/andrew/.local/opt/go-1.27.0`.
- Helm 3.19.0 at `/Users/andrew/.local/bin/helm`.

## Installed but pending normal-Terminal verification

- `kubectl` at `/Users/andrew/.local/bin/kubectl`.
- `kind` at `/Users/andrew/.local/bin/kind`.

Both files are native Apple Silicon executables with executable permissions. In the current Codex process they terminate with exit code 137 before printing a version, so cluster setup is intentionally deferred until they can be checked outside this execution sandbox.

## Still required for the integration milestone

Docker Desktop provides the container runtime required by Kind. Install it from Docker's official distribution, start the application, then verify:

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

