# Open-Source Landscape and Design Decisions

This note records public projects studied for Opspilot 2. They are design references, not code sources. Opspilot 2 keeps its own scope, implementation, documentation, and tests.

## Projects reviewed

| Project | Useful observation | Opspilot 2 decision |
| --- | --- | --- |
| [Kubernaut](https://github.com/jordigilh/kubernaut) | Alert ingestion, investigation, workflow selection, execution, verification, and audit are distinct responsibilities. Its published architecture also separates API, agent, executor, and data storage. | Keep API, diagnostic adapters, policy, executor, and storage as independent packages. Do not begin with its multi-service deployment model. |
| [SRE Agent](https://github.com/alparn/sre-agent) | A small explicit `OBSERVE -> REASON -> ACT -> LEARN` loop is more inspectable than an opaque agent framework. It keeps observability integrations behind adapters and gates risky actions. | Start with a deterministic incident state machine and typed tools. Add LLM reasoning only after evidence collection is testable. |
| [k8s-aiops-observability](https://github.com/lasmcode/k8s-aiops-observability) | A convincing demo needs controlled fault injection, monitored SLIs/SLOs, reproducible bootstrap commands, and data that shows the effect of remediation. | Build the Kind drill around one deployment regression and a measurable HTTP 5xx SLI before adding anomaly detection. |
| [AIOpsLab](https://arxiv.org/abs/2501.06706) | Agent evaluation requires an environment that can deploy workloads, inject faults, generate load, export telemetry, and evaluate outcomes. | Treat the later Kind drill and regression dataset as first-class product work, not README decoration. |

## Patterns adopted

1. **Fingerprint active alerts.** The same firing alert must reuse an active incident rather than spawn duplicates.
2. **Normalize at the boundary.** Alertmanager-specific JSON is translated into an internal `Incident` immediately.
3. **Use typed evidence.** Later diagnostic tools will return typed models rather than free-form terminal output.
4. **Make mutations narrow.** A proposal is not executable code; only a policy-approved, typed action reaches the executor.
5. **Verify recovery.** A successful Kubernetes API call does not resolve an incident. The system must check the affected SLI again.

## Deliberate differences

Opspilot 2 does not claim autonomous production remediation. Its first release is approval-gated, single-cluster, and supports one controlled rollback scenario. This makes the safety model and test suite easier to inspect in an interview.

