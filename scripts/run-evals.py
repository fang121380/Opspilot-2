from __future__ import annotations

import json
from datetime import UTC, datetime
from pathlib import Path

from app.adapters.kubernetes import DeploymentStatus
from app.adapters.prometheus import MetricQueryResult, MetricSample
from app.agent.analysis import IncidentEvidence, analyze_deployment_regression
from app.domain.incidents import Incident


def main() -> int:
    cases = json.loads((Path(__file__).parents[1] / "evals/incidents.json").read_text())
    passed = 0
    for case in cases:
        incident = Incident(
            alert_name="HighErrorRate",
            alert_fingerprint=f"eval:{case['name']}",
            service="checkout",
            namespace="demo",
            started_at=datetime.now(UTC),
        )
        evidence = IncidentEvidence(
            deployment=DeploymentStatus(
                name="checkout",
                namespace="demo",
                desired_replicas=case["desired_replicas"],
                available_replicas=case["available_replicas"],
            ),
            error_rate=MetricQueryResult(
                query="eval",
                samples=[
                    MetricSample(
                        labels={"service": "checkout"},
                        timestamp=datetime.now(UTC),
                        value=case["error_rate"],
                    )
                ],
            ),
            recent_logs=case["logs"],
        )
        outcome = analyze_deployment_regression(incident, evidence)
        actual_rollback = bool(outcome.recommended_actions)
        success = (
            outcome.hypotheses[0].title == case["expected_hypothesis"]
            and actual_rollback == case["expect_rollback"]
        )
        print(f"{'PASS' if success else 'FAIL'} {case['name']}")
        passed += int(success)

    print(f"结果: {passed}/{len(cases)} 通过")
    return 0 if passed == len(cases) else 1


if __name__ == "__main__":
    raise SystemExit(main())
