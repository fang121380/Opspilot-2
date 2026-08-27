from fastapi import FastAPI

app = FastAPI(
    title="OpsPilot",
    description="Opspilot 2: safety-first AI incident response for Kubernetes workloads.",
    version="0.1.0",
)


@app.get("/health", tags=["system"])
async def health() -> dict[str, str]:
    """Return a lightweight liveness response."""

    return {"status": "ok", "service": "opspilot-2"}
