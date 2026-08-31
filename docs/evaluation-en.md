# Opspilot 2 Evaluation Baseline

This page is the English counterpart of [评测基线](evaluation-zh.md).

The fixed dataset lives in `evals/incidents.json` and contains four scenarios: a real deployment regression, a healthy service, replica shortage without the required evidence, and misleading `ERROR` text from ordinary HTTP 400 logs.

Run it with:

```bash
make eval
```

The evaluator checks two safety properties:

1. When all three evidence signals are present, the analyzer identifies a deployment regression and recommends rollback.
2. When any required signal is missing, the analyzer does not recommend rollback.

This is a safety regression baseline for Opspilot 2, not a general LLM leaderboard. If a model is added later, report evidence collection accuracy, root-cause accuracy, and unsafe-action proposal rate separately. Natural-language quality alone is not sufficient for a remediation system.
