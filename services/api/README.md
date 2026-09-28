# Northstar API

Initial FastAPI service. The application package lives in `app/`, with the ASGI entry point at `app.main:app`.

Use Python 3.12+ and run these commands in PowerShell from this directory:

```powershell
py -3 -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
.\.venv\Scripts\python.exe -m uvicorn app.main:app --reload
```

If Python is available as `python` rather than `py`, use `python -m venv .venv`.
Calling the virtual environment's interpreter directly avoids PowerShell activation-policy changes.

In another terminal:

```powershell
Invoke-RestMethod http://127.0.0.1:8000/health | ConvertTo-Json
```

Expected HTTP 200 response:

```json
{"status": "ok", "service": "northstar-api"}
```

Interactive API documentation is at http://127.0.0.1:8000/docs.
Stop the server with Ctrl+C. No environment variables, credentials, or external services are required.

## Automated tests

After creating the virtual environment above, run these commands from `services/api`:

```powershell
.\.venv\Scripts\python.exe -m pip install -r requirements-dev.txt
.\.venv\Scripts\python.exe -m pytest
```

On macOS or Linux, use `.venv/bin/python` instead of `.\.venv\Scripts\python.exe`.
The development requirements include the production dependencies, pytest, and httpx.
The health test uses FastAPI's TestClient in process, so no running server, database, environment variables, or API keys are needed.
GitHub Actions runs the backend tests with Python 3.13.
