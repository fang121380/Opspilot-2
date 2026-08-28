from prometheus_client import Counter, make_asgi_app

ALERTS_RECEIVED = Counter(
    "opspilot_alerts_received_total",
    "Prometheus-compatible alert webhooks received by Opspilot 2.",
)
INVESTIGATIONS_STARTED = Counter(
    "opspilot_investigations_started_total",
    "Incident investigations started by Opspilot 2.",
)
INCIDENTS_CREATED = Counter(
    "opspilot_incidents_created_total",
    "New incidents created after alert deduplication.",
)
ALERTS_DEDUPLICATED = Counter(
    "opspilot_alerts_deduplicated_total",
    "Alert webhooks matched to an existing active incident.",
)
INVESTIGATION_OUTCOMES = Counter(
    "opspilot_investigation_outcomes_total",
    "Completed investigation outcomes by bounded result.",
    ["outcome"],
)
REMEDIATION_OUTCOMES = Counter(
    "opspilot_remediation_outcomes_total",
    "Remediation execution requests by bounded result.",
    ["outcome"],
)
VERIFICATION_OUTCOMES = Counter(
    "opspilot_verification_outcomes_total",
    "Post-remediation verification requests by bounded result.",
    ["outcome"],
)


metrics_app = make_asgi_app()
