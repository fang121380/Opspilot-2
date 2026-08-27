from __future__ import annotations

from pydantic import BaseModel, Field

from app.adapters.kubernetes import DeploymentStatus
from app.adapters.prometheus import MetricQueryResult
from app.domain.incidents import Incident


class IncidentEvidence(BaseModel):
    deployment: DeploymentStatus
    error_rate: MetricQueryResult
    recent_logs: str


class EvidenceReference(BaseModel):
    id: str
    source: str
    observation: str


class RootCauseHypothesis(BaseModel):
    title: str
    rationale: str
    confidence: float
    evidence_ids: list[str]


class RemediationRecommendation(BaseModel):
    action: str
    namespace: str
    deployment: str
    requires_approval: bool = True


class AnalysisOutcome(BaseModel):
    summary: str
    impact: str
    confidence: float
    evidence: list[EvidenceReference] = Field(default_factory=list)
    hypotheses: list[RootCauseHypothesis] = Field(default_factory=list)
    recommended_actions: list[RemediationRecommendation] = Field(default_factory=list)


def analyze_deployment_regression(
    incident: Incident, evidence: IncidentEvidence
) -> AnalysisOutcome:
    """Produce an inspectable first-pass diagnosis for the MVP demo scenario.

    This rule intentionally requires three independent signals before recommending a
    mutation: reduced Deployment availability, non-zero HTTP 5xx rate, and error
    logs. An LLM may later summarize this outcome but cannot bypass this gate.
    """

    deployment = evidence.deployment
    error_rate = max((sample.value for sample in evidence.error_rate.samples), default=0.0)
    has_error_logs = "error" in evidence.recent_logs.lower()
    availability_regressed = deployment.available_replicas < deployment.desired_replicas
    elevated_error_rate = error_rate > 0.0

    references = [
        EvidenceReference(
            id="deployment-availability",
            source="kubernetes",
            observation=(
                f"Deployment {deployment.name} has {deployment.available_replicas}/"
                f"{deployment.desired_replicas} available replicas."
            ),
        ),
        EvidenceReference(
            id="http-5xx-rate",
            source="prometheus",
            observation=(
                f"The highest queried HTTP 5xx rate for {incident.service or deployment.name} "
                f"is {error_rate:.4f}."
            ),
        ),
        EvidenceReference(
            id="recent-error-logs",
            source="logs",
            observation=(
                "Recent logs contain error-level output."
                if has_error_logs
                else "Recent logs contain no error-level output."
            ),
        ),
    ]

    if availability_regressed and elevated_error_rate and has_error_logs:
        return AnalysisOutcome(
            summary=(
                f"{incident.service or deployment.name} has elevated 5xx traffic while the "
                f"latest Deployment is not fully available."
            ),
            impact="The service is likely returning errors to users.",
            confidence=0.85,
            evidence=references,
            hypotheses=[
                RootCauseHypothesis(
                    title="Recent deployment regression",
                    rationale=(
                        "Reduced replica availability, elevated HTTP 5xx rate, and recent error "
                        "logs converge on a failing rollout."
                    ),
                    confidence=0.85,
                    evidence_ids=[reference.id for reference in references],
                )
            ],
            recommended_actions=[
                RemediationRecommendation(
                    action="rollback_deployment",
                    namespace=deployment.namespace,
                    deployment=deployment.name,
                )
            ],
        )

    return AnalysisOutcome(
        summary=(
            f"Opspilot 2 collected evidence for {incident.service or deployment.name}, but it does "
            "not meet the threshold for a rollback recommendation."
        ),
        impact="Impact remains under investigation.",
        confidence=0.2,
        evidence=references,
        hypotheses=[
            RootCauseHypothesis(
                title="Insufficient evidence for a deployment regression",
                rationale=(
                    "A rollback requires reduced availability, an elevated 5xx signal, and "
                    "error-level logs. At least one signal is missing."
                ),
                confidence=0.2,
                evidence_ids=[reference.id for reference in references],
            )
        ],
    )
