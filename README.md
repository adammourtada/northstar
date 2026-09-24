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
