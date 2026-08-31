# ADR-0007: Treat the LLM as a Narrator, Not an Executor

中文摘要：LLM 只生成说明文本，没有工具调用和修复权限。

## Status

Accepted

## Context

Opspilot 2 needs natural-language incident summaries, but model-generated text is untrusted. Giving the model direct tools or allowing its output to become a shell command would bypass the evidence and approval boundaries already established.

## Decision

The LLM integration is a replaceable text-only provider. The provider receives a system prompt and a structured user prompt, and returns text. It has no tool access and no remediation authority. The deterministic analyzer and policy engine remain the source of truth for evidence, confidence, and executable actions.

The first provider implements the common OpenAI-compatible Chat Completions request shape with temperature `0`, bounded timeout, and sanitized errors. API keys are supplied at runtime and are never included in error text.

## Consequences

Positive:

- A model can improve operator-facing explanations without changing safety decisions.
- Provider behavior is testable with an HTTP mock and can be replaced by a local model later.
- The project can compare model summaries against the deterministic baseline.

Trade-offs:

- The first integration does not support model-directed tool selection.
- Prompt and output evaluation remain separate work; text quality is not treated as incident correctness.
