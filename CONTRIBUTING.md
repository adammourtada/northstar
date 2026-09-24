# Contributing to Northstar

Northstar follows issue-driven development. `main` represents the stable project state; changes should be reviewed before merging.

## Issues and branches

- Start from a GitHub issue with a clear problem, scope, and acceptance criteria.
- Keep one meaningful change per branch. Split unrelated work into separate issues and branches.
- For new branches, use `<category>/<issue-number>-<short-description>` with lowercase, hyphen-separated descriptions.

| Category | Purpose | Example |
| --- | --- | --- |
| `feature/` | New application behavior | `feature/12-objective-management` |
| `fix/` | Bug fixes | `fix/13-kpi-validation` |
| `docs/` | Documentation | `docs/14-architecture-notes` |
| `chore/` | Repository maintenance and tooling | `chore/7-repository-foundation` |
| `test/` | Test coverage and test infrastructure | `test/15-project-health` |

These are naming examples, not a list of existing issues. Existing issue branches may retain their names.

## Commits and pull requests

- Keep commits focused and use concise, imperative messages describing the change, such as `chore: establish repository foundation`.
- Explain the reason for a change in the commit body when it is not obvious, and reference the related issue where helpful.
- Review the diff before committing, including newly added files and any generated output.
- Open a pull request referencing the issue, describing the problem and resulting change, and recording validation results and any limitations.
- Keep pull requests small enough to review. Include screenshots when a future change affects the UI.
- Review every change before merging into `main`, address review feedback, and pass all required automated checks once CI is configured.

## Testing

Validate changes in proportion to their impact. Add or update meaningful tests for application behavior and bug fixes, and run the relevant checks before requesting review.

The architecture plans Vitest for frontend unit tests, pytest for backend tests, and Playwright for end-to-end tests. These tools and their commands are not configured at the repository foundation stage. Record checks actually performed; if a relevant check cannot run, explain why.

For documentation and repository maintenance, check formatting, links, directory structure, and `git diff --check` as appropriate.

## Documentation

Keep documentation aligned with behavior and setup changes. Read the [product requirements](docs/product-requirements.md), [architecture](docs/architecture.md), and [database schema](docs/database-schema.md) before changing their respective areas. Record significant architecture decisions in `docs/decisions/` and meaningful unreleased changes in [CHANGELOG.md](CHANGELOG.md).

Follow [.editorconfig](.editorconfig) for consistent formatting. Replace directory `.gitkeep` placeholders when real tracked content is added.

## Secrets and local configuration

Never commit secrets, credentials, populated environment files, or sensitive data in fixtures, logs, screenshots, or documentation. Keep real values in ignored local environment files or hosting-provider secret management. Keep [.env.example](.env.example) limited to variable names with empty values and explanatory comments.

Review staged changes for sensitive content before committing; ignore rules alone do not prevent every accidental disclosure. Production credentials must remain separate from development credentials, and server-side credentials must never be exposed to the browser.

## Current scope and ownership

The repository currently contains documentation and foundation files. Application scaffolding, authentication, database migrations, service configuration, UI screens, and CI workflows belong in future issues.

Northstar is proprietary. See [LICENSE](LICENSE) for the current all-rights-reserved notice; this guide does not grant permission to use or modify the repository.
