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
