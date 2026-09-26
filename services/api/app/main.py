"""FastAPI entry point for the Northstar API."""

from fastapi import FastAPI

app = FastAPI(title="Northstar API")


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok", "service": "northstar-api"}
