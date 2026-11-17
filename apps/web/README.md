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

### Password recovery

Sign in links to `/forgot-password`. The server action calls
`resetPasswordForEmail` with `/auth/recovery` on the same validated application
origin. Supabase's default, unmodified Reset Password template uses its
ConfirmationURL: Supabase verifies the email link and redirects to
`/auth/recovery?code=...`. Northstar exchanges that code using its PKCE verifier
cookie, then redirects to `/reset-password`. No template editing or custom SMTP
is required for this in-app flow. Account existence, mail failures and rate limits
receive the same generic check-email response. Supabase email rate limits and
default email-service recipient restrictions still apply.

`/auth/recovery` accepts exactly one credential path:

- A `code` is exchanged using the existing cookie-based PKCE client. Only a
  recovery exchange is accepted. Open these links in the browser/profile that
  requested the email, where the verifier cookie exists.
- A `token_hash` with `type=recovery` is verified with `verifyOtp` using a fixed
  recovery type. This optional path is for explicitly supplied verified-token
  links (for example, a future customized template). It is not used or required
  by the default-template local development flow.

Both paths must establish a session and pass server verification before the
callback redirects to the fixed `/reset-password` destination. Ambiguous input,
expired/reused links, missing verifier cookies and provider errors redirect to
`/forgot-password?error=recovery`. No `next` URL or client-supplied user identity
is trusted. Callback responses use `private, no-store` and `no-referrer`.

The reset page and password action independently validate Supabase-signed claims
and fetch the authenticated user from Auth. They require a recovery AMR entry
issued within the last 15 minutes; ordinary sign-in sessions and user metadata
cannot authorize this form. Keep `amr` in any custom access-token hook. Session
refresh does not extend the recovery timestamp. Missing/expired recovery evidence
requires a new recovery email. This uses Supabase's
[signed authentication method references](https://supabase.com/docs/guides/auth/jwt-fields#authentication-methods-amrmethod),
without another signing secret or database state.

New passwords must match and contain 8–128 characters, without trimming.
Supabase's configured password policy is also enforced by `updateUser`.
Passwords are never returned in action state or logged. A successful update signs
out the current session and redirects to sign-in with a success notice. If sign-out
fails after the update, the UI explicitly reports that the password was saved and
directs the user to sign out from the workspace.

#### Local development with default Supabase email

1. Under **Authentication > URL Configuration**, keep Site URL at the application's
   base origin with no trailing slash (`http://localhost:3000` locally; the HTTPS
   origin in production). Add the exact `/auth/recovery` URL to Redirect URLs.
   Preserve the existing signup callback allowlist. Production should use exact
   URLs rather than development wildcards.
2. Keep the default Supabase email service and the unmodified **Reset Password**
   template. Do not edit email templates or configure custom SMTP for this flow.
3. Keep email/password authentication enabled. Request a fresh reset from
   Northstar's `/forgot-password`, using an address permitted by the default
   Supabase email service. Open the email in that same browser/profile, on the
   same application origin (`localhost` and `127.0.0.1` are different origins).
   Do not clear cookies or switch into a private window between request and click.

#### Dashboard-generated links and limitations

Dashboard-generated recovery emails do not originate from Northstar's PKCE client,
so there is no matching Northstar verifier cookie. With the default template,
they normally return to Site URL and can carry implicit-flow tokens in a URL
fragment (`#access_token=...`). Server route handlers cannot read URL fragments;
changing Site URL to `/auth/recovery` or `/reset-password` does not solve this.
Northstar intentionally does not add a browser fragment-token bridge or fall
back to an unrelated logged-in session.

For local development, ask the recipient to visit `/forgot-password` and request
a fresh Northstar-initiated email instead of using the dashboard reset email.
Existing dashboard emails cannot be converted into a PKCE exchange just by
changing their destination. Cross-browser/device PKCE recovery is likewise not
supported; request another email in the browser that will open it.

The optional `/auth/recovery?token_hash=...&type=recovery` verification path remains
available if an explicitly supplied token-hash link is introduced later. The
default dashboard email does not provide this application callback, and the
Supabase verification URL's `token` parameter must not simply be renamed to
`token_hash`. Do not copy email credentials into logs or support messages.
No service-role credential, database migration or SMTP change is required.

After URL configuration, manually test a fresh in-app reset in the requesting
browser. Confirm wrong-browser/expired/reused links fail safely and request a new
link, ordinary signed-in sessions cannot directly use the reset action, and a
successful change permits sign-in with the new password. Offline tests mock
Supabase and do not verify email delivery or live tokens.

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
KPI definition deletion, owner reassignment, trends, and calculations are deferred.

## KPI measurements (issue #30)

KPI names in the list link to `/kpis/[id]`, which shows the definition,
target and latest actual as separate fields, plus measurement history. A KPI
without measurements has no invented actual value. Owners, admins, and managers
can record at `/kpis/[id]/measurements/new`; members and viewers can read history
but cannot record, including through direct URLs, actions, or the creation RPC.

Measurements use exact plain decimal strings: optional minus sign, 1–20 integer
digits and up to 10 fractional digits. Values remain strings in forms/RPC payloads
and are selected as `value::text`. PostgreSQL unrestricted numeric enforces finite
values, absolute magnitude below 10^20, and scale at most 10 without rounding.
Zero and negative measurements are valid. Notes are optional, up to 5000 characters.

Input timestamps require an explicit Z or numeric offset, for example
`2026-10-20T14:30:00-04:00`; ambiguous local times and invalid calendar dates are
rejected. The submitted instant is preserved and history displays times in UTC.
History and latest actual use `measured_at DESC, created_at DESC, id DESC`.
Inserting an older, backdated observation does not replace a newer actual.

The membership-validated current workspace scopes server reads and actions.
RLS allows SELECT only for organization members. The SECURITY DEFINER creation
RPC uses an empty search path, checks membership and owner/admin/manager authority,
checks the selected KPI's organization, and sets `recorded_by = auth.uid()`.
A composite foreign key prevents cross-tenant KPI associations. Ordinary users
have no direct INSERT/UPDATE/DELETE privileges and there are no measurement edit
or delete routes/RPCs. Trusted administrative access follows existing conventions.

Review and manually apply `database/migrations/202609290005_kpi_measurements.sql`
as `postgres` after all five earlier migrations. Repository checks never apply it.
No charts, scoring, alerts, thresholds, forecasts, or variance calculations are added.
Offline tests cover application behavior and SQL contracts; they do not prove live
Supabase authorization. See the database guide for the remaining manual checks.

## Risk Management

The workspace links to `/risks`, an organization-scoped register with exposure,
owner, status, review date, and linked project/objective titles. Detail pages at
`/risks/[id]` include the mitigation plan and identified timestamp. Owners,
admins and managers use `/risks/new` and `/risks/[id]/edit`; members/viewers read
only. Direct URLs and server actions enforce those roles independently.

Forms support optional owners, multiple projects/objectives, and clearing all links.
Owner options show membership user IDs and roles: existing profile RLS only
permits reading one's own profile, so this feature does not expose other members'
profile names or email addresses. Any current organization member can be assigned,
without granting additional write permissions.

Title is required (200 characters); description and mitigation plan are optional
(5000 each). Probability and impact are integers 1–5; exposure is their product,
1–25, calculated by application logic. Status is open, monitoring, mitigated,
accepted or closed. Review dates are optional date-only values with no time-zone
conversion; identified time is database-controlled and shown in UTC.
All fields, selects and link checkboxes survive failed validation or RPC execution,
including React's automatic resets. Pending saves disable the submit button.

Reads filter by the membership-validated current workspace and use RLS. Server
actions reject stale workspace forms and validate owners and links against
tenant-scoped choices. Secure RPCs independently enforce membership, management
roles and same-tenant associations, saving fields and links atomically.

Requires manual review/application of
`database/migrations/202609290006_risks.sql` after the measurement migration.
See the database guide for deployment and live RLS/RPC checks. Offline tests run
via `npm test`; they do not prove live Supabase authorization.
No deletion, risk audit timeline, alerts, predictions, heatmaps or dashboards are added.
