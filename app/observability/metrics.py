from prometheus_client import Counter, make_asgi_app

ALERTS_RECEIVED = Counter(
    "opspilot_alerts_received_total",
    "Prometheus-compatible alert webhooks received by Opspilot 2.",
)
INVESTIGATIONS_STARTED = Counter(
    "opspilot_investigations_started_total",
    "Incident investigations started by Opspilot 2.",
)


metrics_app = make_asgi_app()
