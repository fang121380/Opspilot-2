# Learning Workbench Validation - 2026-09-05

## Scope

This change improves the learning-lab UI, its learning checks, local read-only bridge, Windows/macOS launchers, Android browser layout, documentation, and CI. The Opspilot incident-response engine is covered by regression tests but its remediation behavior is not changed by this patch.

## Local Results

| Check | Result |
| --- | --- |
| Python unit/integration suite | 182 passed on Windows 11 / Python 3.13.12 |
| Core `app/` coverage | 91.05%; learning bridge and launchers have separate behavioral tests |
| Ruff | Passed |
| Offline evaluation | 4/4 passed |
| Local API demo | Completed against fake adapters; no actual rollback |
| Frontend logic | 25 passed on Node 24.19.0 |
| Frontend production build | Passed |
| Vite and Playwright configuration types | Passed |
| Playwright | 10 passed in Chromium |
| Browser layout checks | 320, 390, 768, 1440 CSS pixels; home, lesson steps, cluster, case |
| Accessibility | axe WCAG 2/2.1 A/AA scans; keyboard dialog containment, Escape and focus restoration |
| Real learning cluster | kind 0.33.0 / Kubernetes 1.37.0; hello-web two Ready Pods, zero restarts at inspection |
| Read-only integration | UI on 5174 -> isolated bridge on 8788 -> kind-k8s-lab; resources, nodes, events, logs |
| Windows launchers | PowerShell 5.1 parsing and mocked success/failure/rerun cases |
| macOS/Linux launcher logic | Bash syntax and fake-tool workflow tests on Windows Git Bash |

The browser tests also cover all five lessons through completion and reload, corrupt/obsolete progress, unavailable browser storage, simulated readiness-probe cases, terminal clear without loss of evidence, dark theme persistence, and partial refresh failures that retain accurate provenance. Pod readiness gates and Deployment availability/minimum-ready behavior have explicit regressions.

## Limits

- The local Docker build could not fetch the `python:3.12-slim` registry token because `auth.docker.io` timed out. This is not recorded as a successful build. CI retains container build and Compose runtime checks.
- No physical Mac mini or Android device was controlled. Android layout was checked with Chromium mobile-sized viewports; LAN connectivity from an actual phone depends on the local network and firewall.
- Python 3.13 reports existing SQLite connection ResourceWarnings in core store tests and an upstream Starlette/AnyIO deprecation warning. These did not fail tests and were not silenced in code.
- This patch does not certify the main incident-response service for production or claim to fix unrelated core remediation issues.
- Remote CI status is available in the repository Actions tab for the final commit; local results above remain distinguishable from remote checks.

## Reproduce

From the repository root, install `.[dev]` in a Python 3.12+ virtual environment, and run:

```text
python -m ruff check .
python -m pytest --cov=app --cov-report=term-missing
python scripts/run-evals.py
python scripts/run-local-demo.py
```

From `learning-lab/ui`, with Node >=22.18:

```text
npm ci
npm test
npm run build
npx tsc --noEmit --skipLibCheck --module ESNext --moduleResolution Bundler --target ES2022 vite.config.ts playwright.config.ts
npx playwright install chromium
npm run test:e2e
```

Install the frontend dependencies before running the complete Python suite so the Vite dev/preview proxy integration checks can run. Platform-specific launcher tests may skip when the corresponding shell is unavailable; CI and reports must state those skips.
