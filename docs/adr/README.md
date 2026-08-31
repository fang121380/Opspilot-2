# Opspilot 2 Architecture Decision Records

This directory contains the project's design decisions. Chinese summaries are available in [README-zh.md](README-zh.md); the numbered records remain the canonical technical history.

| ID | Decision |
| --- | --- |
| ADR-0001 | Constrain the first release to one incident loop |
| ADR-0002 | Keep diagnostic adapters read-only |
| ADR-0003 | Gate remediation on converging evidence |
| ADR-0004 | Require expiring approval for every remediation |
| ADR-0005 | Correlate audit events with OpenTelemetry trace IDs |
| ADR-0006 | Use a deterministic investigation orchestrator |
| ADR-0007 | Treat the LLM as a narrator, not an executor |
| ADR-0008 | Expose investigation as an explicit API operation |
| ADR-0009 | Use the Kubernetes Python client directly |
| ADR-0010 | Separate offline development from runtime dependencies |
| ADR-0011 | Expose read-only diagnostics through MCP |
| ADR-0012 | Separate proposal, approval, and execution APIs |
| ADR-0013 | Represent long investigations as Jobs |
| ADR-0014 | Use atomic remediation state transitions |
| ADR-0015 | Version and safely adopt the relational schema |
| ADR-0016 | Authenticate privileged operator actions |
| ADR-0017 | Authenticate Alertmanager webhooks |
| ADR-0018 | Persist investigation Job snapshots |
| ADR-0019 | Deduplicate active investigation Jobs |
| ADR-0020 | Allow one active remediation proposal per incident |
| ADR-0021 | Guard investigation state transitions |
| ADR-0022 | Explicitly recover interrupted investigation Jobs |
