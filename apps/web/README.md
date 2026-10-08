# Northstar Web

Minimal Next.js App Router frontend using React, TypeScript, Tailwind CSS, and ESLint.

From this directory, with Node.js 20.9+ and npm installed:

```powershell
npm ci
npm run dev
```

Open http://localhost:3000. Authentication requires the local Supabase configuration
below; lint, typecheck, tests, and production builds require no credentials.

Validation and production commands:

```powershell
npm run lint
npm run typecheck
npm test
npm run build
npm start
```

See the root [Local Development guide](../../README.md#local-development) for both applications.

## Supabase foundation

Northstar uses Supabase. Browser and server client factories are available in
`lib/supabase/client.ts` and `lib/supabase/server.ts`, following the
[Supabase SSR guide](https://supabase.com/docs/guides/auth/server-side/creating-a-client).
Call the browser factory from browser code; await a new server client within each
request. The server factory uses Next.js cookies. The Next.js 16 Proxy refreshes
sessions with `getClaims()` and forwards updated cookies to server rendering and
the browser. Protected pages independently validate claims on the server.

Get the Project URL and Publishable key from your Supabase project's Connect
dialog or Settings > API Keys screens. Set these names in `apps/web/.env.local`:

```dotenv
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
```

Fill in real values only in that local file, which must never be committed.
The root `.env.example` contains empty placeholders only. Publishable keys are
intended for browser use; secret keys and legacy service-role keys must never be
exposed to browser code or assigned a `NEXT_PUBLIC_` variable. Neither is used by
these clients. Restart the development server after changing local configuration.

With Node.js 24 LTS, run this optional local check from `apps/web`:

```powershell
npm run check:supabase
```

It loads `.env.local` and initializes the browser client factory in Node without
printing configuration values. Network requests are disabled. Success verifies
local initialization only, not project connectivity or key validity on Supabase.
The normal typecheck compiles both client utilities. The local check is not part
of CI; lint, typecheck, tests, and build require no Supabase credentials.
Authentication pages render dynamically at request time, so builds do not call
Supabase. Tests mock the authentication provider and do not send emails.

## Authentication development

Northstar uses email/password authentication with email confirmation enabled.
In Supabase **Authentication > URL Configuration**, use Site URL
`http://localhost:3000` and allowed redirect URL `http://localhost:3000/**`.
Email/password login, new-user signup, and email confirmation must be enabled.
`apps/web/.env.local` remains local and ignored. Never put Supabase secret or
service-role keys in frontend code; authentication uses only the publishable key.

### Default confirmation email and PKCE

The current development setup uses Supabase's default SMTP provider and default
Confirm signup email template. No custom SMTP or template customization is required.
Keep email confirmation enabled.

Signup sets `emailRedirectTo` to `/auth/confirm` on the requesting application's
origin (`http://localhost:3000/auth/confirm` locally). After Supabase confirms the
email, it redirects there with a PKCE authorization `code`. The callback calls
`exchangeCodeForSession(code)` through the cookie-based SSR client, establishing
the session before redirecting to `/app`. The SSR client uses PKCE by default; see
the [Supabase SSR guide](https://supabase.com/docs/guides/auth/server-side/advanced-guide).
Update the Site URL and redirect allowlist when deploying elsewhere.

Open the confirmation email in the same browser and browser profile used for
signup: the code exchange needs the PKCE verifier stored in that browser's cookies.
If that cookie is unavailable, the callback shows a safe login error; after email
confirmation, try signing in with email/password. Custom SMTP and template
customization may be added later for production branding.

### Routes and local smoke test

1. Run `npm run dev`, then visit `/app` while signed out: it redirects to `/login`.
2. Visit `/signup` and enter an email, password, and matching confirmation.
   Successful submission shows a check-email message.
3. Follow the new confirmation email in the browser used for signup.
   `/auth/confirm` exchanges the returned PKCE authorization code, establishes
   the cookie session, and redirects to `/app`.
   Invalid or expired links redirect to a safe login error message.
4. `/app` requires a valid organization membership (see onboarding below) and shows
   the organization, role, authenticated email, and Sign out button. Reload to check
   session persistence. Signed-in visits to `/login`
   and `/signup` redirect to `/app`.
5. Sign out to clear the current browser session and return to `/login`. Visiting
   `/app` again must redirect to `/login`. Sign back in using email/password.

`npm test` covers rendered forms, validation, protected-route redirects, safe
errors, confirmation redirects, sign-out, and cookie forwarding without a live
Supabase account. Real email delivery and a full browser session require the
manual smoke test above. Never log confirmation URLs, passwords, or session tokens.

## Organization onboarding and workspaces

The organization foundation migration must already be manually applied to the
development Supabase project. No migration or RLS change is part of onboarding.

- Authenticated users visiting `/app` with no memberships are redirected on the
  server to `/onboarding/organization`. Existing members are redirected out of
  first-organization onboarding.
- The form suggests a normalized slug from the name until the user edits the
  slug. Both fields are validated on the server. Creation calls only
  `create_organization` with `p_name` and `p_slug`; creator identity and owner
  membership remain database-controlled. Duplicate slugs receive a safe message.
- One membership enters `/app` automatically. Multiple memberships require a
  selection on `/organizations` unless a valid saved preference exists. The
  selector displays each available organization's name, slug, and the caller's role.
- Selection is saved server-side in the HTTP-only `northstar-organization` cookie
  (`SameSite=Lax`, Secure in production, 30-day lifetime). It is only a preference.
  Each use checks freshly loaded, RLS-protected memberships filtered by the
  server-validated caller ID. An inaccessible saved organization is ignored:
  the sole remaining membership is selected, or the user must choose again.
- `/app` shows only organization name, role, email, Sign out, and a Switch
  organization link when multiple memberships exist. Invitation and organization
  management remain future work; no dashboard or other product modules are added.

Offline tests mock the Supabase boundary and cover slug/input validation, RPC
arguments and safe errors, protected routing, invalid preferences, and selection.
For a manual smoke test, sign in without memberships, create an organization,
and confirm its owner role appears on `/app`. Try an occupied slug with another
new account. With independently provisioned test memberships, verify multiple
workspace selection, switching, and loss of access after membership removal.
No test setup inserts memberships or changes the live database automatically.

## Strategic Objectives

The authenticated workspace links to `/objectives`. The list uses the current
membership-validated organization and shows priority, status, progress, and dates.
Owner/admin/manager roles can use `/objectives/new` and `/objectives/[id]/edit`;
member/viewer roles are read-only. Server actions revalidate context and role,
validate input, and call secure creation/update RPCs. The database controls creator
and initial owner. No ownership reassignment or deletion is available.

The feature requires the separately reviewed
`database/migrations/202609290001_strategic_objectives.sql` after the organization
foundation. It is not applied automatically. Offline tests use mocked Supabase
boundaries and require no credentials. See the database guide for the manual
security/browser checklist after eventual application.

## Projects and strategic alignment

`/app` links to `/projects`, with creation at `/projects/new` and editing at
`/projects/[id]/edit`. All routes use membership-validated current workspace
selection. Owners/admins/managers manage projects and their objective links;
members/viewers are read-only. The list shows dates, completion information, and
linked objective titles without health/alignment scores.

Forms allow zero or more objectives from the current organization. Validation
errors preserve name, description, priority, status, dates, and selected objectives,
including through React's automatic form reset. Database RPCs independently
authorize writes and atomically validate/save same-tenant links. Completion and
attribution are database-controlled; owner reassignment and deletion are deferred.

The feature requires `database/migrations/202609290002_projects_strategic_alignment.sql`
after the prior two migrations. Migration files are applied manually and are not
automatically executed by the repository. `npm test` includes offline input,
authorization, data-layer, DOM interaction, and static migration security tests.
See the database guide for the PostgreSQL/browser checks after manual application.

## KPI foundation

`/kpis`, `/kpis/new`, and `/kpis/[id]/edit` reuse membership-validated workspace
selection and the authenticated server client. Server routes and actions independently
check owner/admin/manager access. Members/viewers have read-only lists. Reads filter
by organization and use RLS; writes call only `create_kpi` and `update_kpi`.
The list shows name, description, target/unit, direction, reporting frequency,
status, and objective title. Forms offer only objectives in the selected organization,
allow clearing alignment, and preserve every field after validation or database errors.

Targets are plain decimal strings with optional minus sign, 1?20 integer digits,
and optionally 1?10 fractional digits. Exponents, separators, NaN, infinity, and
partial numbers are rejected. Strings are sent unchanged to PostgreSQL numeric;
reads select `target_value::text` to avoid JSON number precision loss. No JavaScript
floating-point conversion occurs. Text limits: name 200, unit 80, description 5000.

Requires manual application of `database/migrations/202609290004_kpis.sql` after
all four previous migrations. No live database verification is performed by offline
tests. `npm.cmd` can replace `npm` on Windows with restricted PowerShell execution.
Input, authenticated-boundary, route/action, DOM reset, and migration tests run via
`npm test`. Follow the database guide's manual browser/security checklist after review.
KPI measurements, current values, deletion, owner reassignment, trends, and calculations
are intentionally deferred.
