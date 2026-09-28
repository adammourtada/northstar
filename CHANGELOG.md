# Changelog

Notable changes to Northstar will be documented here. No releases have been published.

## Unreleased

### Added

- Authenticated organization onboarding through the secure creation RPC, membership-validated workspace selection, and a minimal organization-aware application shell with offline tests.
- Organization database foundation migration with profiles/backfill, organizations, membership roles, a secure creation RPC, and tenant-isolating RLS; prepared for manual application only.
- Initial email/password authentication with signup confirmation, login, logout, SSR session refresh, a protected `/app` proof page, and offline frontend tests.
- Supabase browser and server client foundation, with local configuration documentation and an offline initialization check.
- GitHub Actions CI for frontend lint, type checking, and production builds, plus an automated backend health endpoint test.
- Initial runnable Next.js frontend and FastAPI backend for Issue #10, with a minimal development page, `/health` endpoint, and Windows local development instructions.
- Repository foundation for Issue #7, with placeholders for the web app, API, database migrations, architecture decisions, tests, and GitHub Actions workflows.
- Root ignore rules, an empty environment-variable example, and shared editor defaults.
- Contribution workflow documentation and a proprietary all-rights-reserved notice.
- Development guidance and a repository structure overview in the README.
