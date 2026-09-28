# NORTHSTAR

**Management Intelligence & Strategy Execution Platform**

Northstar is a management platform designed to connect organizational strategy with execution by bringing together strategic objectives, projects, KPIs, risks, resources, and organizational performance.

## Project Status

Northstar is currently in early development.

## Vision

Organizations often manage strategy, projects, performance, risk, and resources across disconnected systems. Northstar aims to provide management with a unified view of organizational execution and the intelligence needed to identify emerging problems and make better decisions.

## Planned Core Capabilities

- Strategic objective management
- Project portfolio management
- KPI and performance monitoring
- Organizational risk management
- Resource and capacity visibility
- Management intelligence
- Executive reporting
## Documentation

- [Product Requirements](docs/product-requirements.md)
- [Technical Architecture](docs/architecture.md)
- [Database Schema](docs/database-schema.md)

## Development

The repository foundation is in place. The planned Next.js frontend and FastAPI backend have not been initialized, and no install, run, or test commands are configured yet.

Development is issue-driven, with one meaningful change per branch and review before merging into stable `main`. See [CONTRIBUTING.md](CONTRIBUTING.md) for branch conventions, testing, and documentation expectations.

[.env.example](.env.example) lists planned environment variables with empty values. Store real values in ignored local environment files or hosting-provider secret management; never commit secrets. No service setup is required for this foundation.

## Repository Structure

```text
northstar/
├── apps/
│   └── web/
├── services/
│   └── api/
├── database/
│   └── migrations/
├── docs/
│   ├── decisions/
│   ├── product-requirements.md
│   ├── architecture.md
│   └── database-schema.md
├── tests/
├── .github/
│   └── workflows/
├── .gitignore
├── .env.example
├── .editorconfig
├── CONTRIBUTING.md
├── CHANGELOG.md
├── LICENSE
└── README.md
```

Empty directories contain `.gitkeep` placeholders so Git preserves the intended structure. Application code, migrations, tests, and workflows will be introduced through future issues.

## Local Development

Issue #10 adds the runnable frontend and backend described below. The earlier foundation-stage descriptions above are retained as project history. Both apps run independently without environment variables or external services; `.env.example` remains a list of planned integrations.

### Frontend setup and start

Install Node.js 20.9+ (a current LTS release is recommended), including npm. In PowerShell, from the repository root:

```powershell
cd apps/web
npm ci
npm run dev
```

Open http://localhost:3000 to see the minimal NORTHSTAR development page. Stop the server with Ctrl+C.

Run the frontend checks from `apps/web`:

```powershell
npm run lint
npm run typecheck
npm run build
```

To serve the production build locally, run `npm start` after `npm run build`.
If PowerShell blocks `npm.ps1`, use `npm.cmd` for these commands.

### Backend setup and start on Windows

Install Python 3.12+ with the Windows Python launcher. In a separate PowerShell terminal, from the repository root:

```powershell
cd services/api
py -3 -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
.\.venv\Scripts\python.exe -m uvicorn app.main:app --reload
```

If Python is available as `python` rather than `py`, use `python -m venv .venv`.
These commands use the virtual environment directly, so activation and execution-policy changes are unnecessary. Stop the server with Ctrl+C.

The API runs at http://127.0.0.1:8000, with interactive documentation at http://127.0.0.1:8000/docs.

### Test the health endpoint

With the backend running, use another PowerShell terminal:

```powershell
Invoke-RestMethod http://127.0.0.1:8000/health | ConvertTo-Json
```

Expected HTTP 200 response:

```json
{
  "status": "ok",
  "service": "northstar-api"
}
```

Dependencies, build output, Python caches, and `.venv` are excluded by the root `.gitignore`.

### Supabase foundation

Northstar's Supabase browser and server client foundation is available. See the
[frontend Supabase guide](apps/web/README.md#supabase-foundation) for the required
local variable names, where to obtain the Project URL and Publishable key, and
the optional initialization check. Real values belong only in ignored
`apps/web/.env.local`; never commit that file or expose secret keys in browser code.

### Continuous integration

GitHub Actions validates pull requests targeting `main` and pushes to `main` with independent frontend and backend jobs. The frontend runs ESLint, TypeScript checks, and a production build; the backend runs pytest. No external services or secrets are required. See [backend testing instructions](services/api/README.md#automated-tests) to run the API tests locally.
