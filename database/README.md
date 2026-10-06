# Database foundation

## Project milestones

After applying the organization, objective, and project migrations, manually apply
`migrations/202609290003_project_milestones.sql` as `postgres`. It adds tenant-scoped
milestone reads and restricted create/update RPCs for owners, admins, and managers.
Completion sets progress to 100 and records the timestamp; reopening clears it.
Before rollout, verify with separate tenants that foreign projects/milestones are
inaccessible, members/viewers cannot write, and repeated completion preserves the
timestamp. Offline application tests do not replace these live RLS checks.

`migrations/202609280001_organization_foundation.sql` is a one-time, transactional
PostgreSQL/Supabase migration. Migration files are applied manually and are not automatically executed by the repository. No migration runner or live database dependency is
added to CI. Review before manual application, using the trusted `postgres`
database role; the migration checks that role so table/function ownership and
the RLS bypass used by internal helpers are explicit. Do not expose the
`northstar_private` schema through the Data API or grant clients CREATE in it.

## Data and lifecycle

- `profiles.id` exactly matches `auth.users.id`. An AFTER INSERT auth trigger
  creates the profile; a backfill inserts existing auth user IDs with
  `ON CONFLICT (id) DO NOTHING`, preserving any profile data. No credentials or
  user metadata are copied. Profile fields start nullable.
- `organizations` stores a required creator profile, a nonempty trimmed name,
  and a globally unique slug. Slugs must contain lowercase ASCII letters/digits
  separated by single hyphens. The RPC trims surrounding whitespace; constraints
  reject empty or malformed values even for privileged direct writes.
- `organization_members` connects profiles to organizations, with one row per
  `(organization_id, user_id)`. Roles are `owner`, `admin`, `manager`, `member`,
  and `viewer`. Role-management capabilities are deferred.
- Organization and membership IDs default to PostgreSQL `gen_random_uuid()`.
  INSERT/UPDATE triggers set `updated_at` to the statement timestamp regardless
  of submitted values; API callers can update only permitted profile fields.
- Auth user deletion cascades to a profile and its memberships. The creator FK
  uses RESTRICT: deleting an auth user/profile that created an organization fails
  until an explicit future ownership/account lifecycle handles it. Deleting an
  organization as a privileged operator cascades to its memberships. Ordinary API callers
  cannot delete organizations or memberships in this foundation.

`created_by` records the original creator; the `owner` membership represents
organization ownership. They are set together on creation. There is no owner
transfer, invitation, or membership mutation yet. Minimal organization onboarding
and workspace selection use this foundation; see the
[frontend guide](../apps/web/README.md#organization-onboarding-and-workspaces).

## Supported creation path

The RPC signature is `public.create_organization(p_name text, p_slug text)` and it
returns the new organization UUID. The onboarding server action uses this call:

```ts
const { data: organizationId, error } = await supabase.rpc("create_organization", {
  p_name: "My organization",
  p_slug: "my-organization",
});
```

The client must have an authenticated session. The RPC accepts no user or creator
ID; it obtains `auth.uid()`, rejects NULL, ensures that caller's profile exists,
inserts the organization with that creator, and inserts their `owner` membership.
All operations share one transaction. A constraint or membership failure rolls
back creation; no partially created organization is retained. No secret or
service-role key is needed by application code.

## Permissions and RLS security review

| Object | Authenticated access | Anonymous access |
| --- | --- | --- |
| profiles | SELECT own row; UPDATE only own `full_name`, `avatar_url` | None |
| organizations | SELECT only joined organizations | None |
| organization_members | SELECT all membership rows within joined organizations | None |
| create_organization | EXECUTE; identity derived from caller | None |
| private membership helper | Boolean membership check for caller only | None |

Table grants and RLS enforce both row and column restrictions. There are no
direct organization/membership write grants or mutation policies, so clients
cannot self-join, escalate roles, spoof creators, or write across tenants.
Profile identity and timestamps cannot be client-updated. Other members' profile
details are intentionally not readable. Global slug uniqueness can reveal that
a slug is unavailable, but does not grant access to the associated tenant.

`northstar_private.is_organization_member(uuid)` queries membership as the trusted
table owner, bypassing RLS inside its narrowly scoped boolean query. Both SELECT
policies call it instead of recursively querying memberships under caller RLS.
It accepts no user ID. This follows the
[Supabase private helper pattern](https://supabase.com/docs/guides/database/postgres/row-level-security).
Do not change helper ownership or enable FORCE RLS without reviewing recursion.

All functions fix `search_path = ''`, qualify referenced objects, and use no
dynamic SQL. Only the auth-user trigger, membership helper, and creation RPC use
SECURITY DEFINER. The timestamp trigger is SECURITY INVOKER. Default PUBLIC and
Supabase API-role grants are explicitly revoked on these new objects; only the
listed authenticated privileges and full `service_role` table privileges are regranted. Trigger functions are not directly
executable by API roles. Existing unrelated objects/default privileges are not
changed. The `service_role` retains trusted server-side administrative table access
and bypasses RLS; its key must never be exposed to ordinary clients. Function and
private-schema permissions are unchanged. Trusted server operations and privileged
database operators remain outside the ordinary-user RLS trust boundary.

Indexes comprise the three primary keys, unique slug, unique organization/user
pair, and explicit `organization_members_user_id_idx` and
`organizations_created_by_idx`. The compound unique index already covers queries
by organization ID; a duplicate organization-only index is unnecessary.

## Validation after manual application

Static review is not a substitute for executing PostgreSQL policies and triggers.
After independently reviewing and manually applying the migration in a disposable
test project, verify the following with isolated test users, not production data:

1. Preexisting auth users receive profiles; new signups create profiles and still
   complete authentication. Backfill never changes an existing profile.
2. Anonymous requests cannot read/write any table or execute creation/helper RPCs.
3. User A can read/update their own permitted profile fields; attempts to update
   IDs, timestamps, or user B's fields fail or affect no rows.
4. Each user's creation RPC returns a UUID, sets their creator ID, and adds exactly
   one owner membership. Missing identity, blank inputs, invalid slugs, and
   duplicate slugs fail without leaving partial organizations/memberships.
5. Users A/B in separate organizations cannot read each other's organizations or
   membership rows. SELECT on memberships completes without recursive-RLS errors.
   Using privileged test setup, give B a membership in A's organization and verify
   both can see that organization's membership rows but not unrelated tenants.
6. Direct organization INSERT/UPDATE/DELETE and membership INSERT/UPDATE/DELETE
   fail for anon and authenticated users, including owner/admin membership roles.
   Verify trusted `service_role` table operations retain administrative access. Confirm that
   a caller cannot submit `created_by`/`user_id` arguments to the creation RPC.
7. Privileged test inserts/updates cannot forge `updated_at`. Verify UUID defaults,
   all FK/CHECK/UNIQUE constraints, deletion cascades, and creator deletion RESTRICT.
8. In a disposable database, force an owner-membership insert to fail and confirm
   the creation RPC rolls back the organization and any profile repair as well.

No SQL in this checklist is executed automatically or against a remote project.

## Strategic Objectives (issue #22)

`migrations/202609290001_strategic_objectives.sql` is a separate transactional
migration, applied manually and not automatically executed by the repository. Apply only after the organization
foundation, following independent review as the trusted `postgres` role.
It creates `strategic_objectives` with tenant ownership, creator attribution,
initial owner, priority/status, manual progress, optional dates, and timestamps.
See [the schema](../docs/database-schema.md#8-strategic_objectives) for columns
and constraints. Foreign keys use NO ACTION; no deletion lifecycle is added.
The organization-only index supports the initial tenant-scoped list.

Both RPCs return an objective UUID:

- `create_strategic_objective(p_organization_id uuid, p_title text,
  p_description text default null, p_priority text default 'medium',
  p_status text default 'draft', p_progress_percent integer default 0,
  p_start_date date default null, p_target_date date default null)`.
- `update_strategic_objective(p_objective_id uuid, p_title text,
  p_description text, p_priority text, p_status text, p_progress_percent integer,
  p_start_date date, p_target_date date)` replaces the editable fields only.

### Objective security review

- RLS SELECT uses the unchanged `is_organization_member` helper. Every role can
  read only joined tenants. There are no INSERT/UPDATE/DELETE policies.
- PUBLIC/anon have no table or new function privileges. Authenticated receives
  SELECT and EXECUTE on the two RPCs only; direct mutations are revoked.
  `service_role` retains trusted administrative table privileges, outside the
  ordinary-user boundary. Application code uses no service-role credentials.
- The private `can_manage_objectives(uuid)` boolean helper derives identity from
  `auth.uid()` and checks membership plus owner/admin/manager role. It has no
  API-role EXECUTE grants; only the definer RPCs need it. It queries memberships
  as postgres, avoiding recursive RLS without changing the existing helper.
- The helper and RPCs use SECURITY DEFINER, fixed empty search paths, qualified
  objects, and no dynamic SQL. Default EXECUTE is revoked in the transaction.
- Guessed organization IDs cannot grant writes: the creation RPC checks the
  caller's membership/role. Update determines the stored organization and checks
  the same authorization. Missing and inaccessible IDs share one denial message.
- RPC inputs contain no creator, owner, user, or role fields. Creation sets both
  attribution IDs to `auth.uid()`; update never changes attribution or tenant.
  Constraints enforce normalized nonempty titles, enums, progress, and date order.
- The objective trigger reuses `set_updated_at()` for INSERT/UPDATE. Existing
  objects and privileges are not altered; no destructive SQL or delete RPC exists.

### Manual validation after eventual application

Offline mocks and static review do not execute PostgreSQL security behavior.
In a disposable test project, after applying manually:

1. Test anonymous denial and each of owner/admin/manager/member/viewer with real
   sessions. Verify member/viewer direct RPC calls cannot create or update.
2. With two isolated tenants, try cross-tenant SELECT, guessed organization
   creation, and guessed objective update. Compare missing/inaccessible responses.
3. Try direct table INSERT/UPDATE/DELETE as authenticated, including owners;
   all must fail. Verify trusted service-role administrative table access.
4. Confirm creator and owner equal the caller on creation; spoofed RPC arguments,
   tenant reassignment, and attribution updates must fail. Confirm private helper
   execution is denied to API roles and membership reads do not recurse.
5. Exercise every constraint, defaults, nullable dates, whitespace-only titles,
   progress boundaries, and automatic timestamps through RPCs and trusted setup.
6. In the browser, create/edit/reload objectives, check validation and pending
   states, switch workspaces (including another tab with a form open), revoke or
   downgrade membership before submitting, and confirm safe failure messages.
7. Confirm empty states, read-only navigation, mobile layout, keyboard access,
   and progress display. Verify failed writes leave the stored objective unchanged.

## Projects and strategic alignment (issue #24)

`migrations/202609290002_projects_strategic_alignment.sql` follows the organization
and strategic-objective migrations. Migration files are applied manually as
`postgres` and are not automatically executed by the repository. The migration
does not change the older migration files or weaken existing objective security.

`projects` contains tenant ownership, name/description, initial owner and creator,
status/priority, dates, completion timestamp, and creation/update timestamps.
`project_objectives` is a tenant-owned junction containing ID, project ID,
objective ID, and creation timestamp. See the
[schema](../docs/database-schema.md#9-projects) for exact columns and constraints.

### RPC contracts and atomicity

- `create_project(p_organization_id uuid, p_name text, p_description text default null,
  p_status text default 'planned', p_priority text default 'medium',
  p_start_date date default null, p_target_date date default null,
  p_objective_ids uuid[] default '{}')` returns the created UUID.
- `update_project(p_project_id uuid, p_name text, p_description text,
  p_status text, p_priority text, p_start_date date, p_target_date date,
  p_objective_ids uuid[])` returns the updated UUID. All editable fields and the
  complete replacement relationship set are supplied; an empty array clears links.

Both functions require `auth.uid()` and owner/admin/manager membership. They accept
no user, role, creator, owner, or completion-timestamp parameters. Creation assigns
both attribution fields to the caller. Update cannot reassign attribution or tenant.
Completed creation/entry sets `completed_at`; remaining completed preserves it;
leaving completed clears it. The existing timestamp trigger maintains `updated_at`.

The internal `replace_project_objectives(uuid, uuid, uuid[])` validates every
objective against the same organization, rejects null/missing/foreign IDs with
one generic error, deduplicates IDs, then replaces the set. It is SECURITY INVOKER
with no API-role execution rights and runs only within the definer RPC's transaction.
Errors propagate without catch-and-continue handling, so failed relationship
insertion rolls back project creation or the entire update. Update takes a row
lock to serialize concurrent replacement of the same project's relationships.

### Security review and indexes

- Composite `(organization_id, project_id)` and `(organization_id, objective_id)`
  FKs enforce same-tenant relationships even for privileged direct writes. Required
  `(organization_id, id)` UNIQUE targets are added to projects and objectives;
  the existing objective primary key and security objects remain unchanged.
- `(project_id, objective_id)` is unique, preventing duplicate links. Its index
  supports forward lookup; `(organization_id, objective_id)` supports reverse
  lookup and FK maintenance. The project composite unique index supports tenant
  lists, so no redundant project organization-only index is added.
- Project organization/profile references use NO ACTION. Only relationship rows
  cascade on eventual parent project/objective deletion. No delete RPC/UI exists.
- Both tables enable RLS with SELECT policies using the existing nonrecursive
  membership helper. All five membership roles can read their own tenants.
- PUBLIC/anon have no table access or function execution. Authenticated has SELECT
  and execution of only the two public RPCs, with no direct INSERT/UPDATE/DELETE.
  The private `can_manage_projects(uuid)` returns only a boolean for the caller;
  it has no API-role execution grants. It bypasses membership RLS as postgres.
- All four new functions use fixed empty search paths and qualified objects.
  Only authorization and public RPCs use SECURITY DEFINER; all default execution
  is revoked before intended grants. There is no dynamic SQL or exposed helper.
- Guessed organization/project IDs cannot grant writes. Missing/foreign projects
  have the same denial. Missing/foreign objectives have the same denial. Role
  checks apply even when directly calling the public RPCs.
- Trusted `service_role` retains administrative table access outside the ordinary
  user boundary; application code uses only the authenticated server client.
  No existing grants/policies/functions are weakened, and no data is destroyed.

### Manual validation after application

Offline tests mock application boundaries and statically inspect migration security;
they do not execute PostgreSQL. After independent review and manual application in
a disposable test project:

1. Test every role, anonymous callers, and a caller whose membership was removed
   or downgraded. Try direct RPCs and direct table mutations as well as the UI.
2. With two tenants, attempt foreign project reads/updates, guessed organization
   creation, and foreign/missing/null objective IDs. Verify generic errors and no
   partial project, field, or relationship changes.
3. Using trusted setup, attempt cross-tenant junction INSERT/UPDATE and duplicates;
   verify the composite FKs/unique constraint reject them independently of RPCs.
4. Create with zero, one, multiple, and duplicate IDs. Edit to replace/add/remove
   links. Verify joined titles and preselected checkboxes, with no foreign choices.
5. Create completed; transition into completed; edit while completed; leave it;
   complete again. Verify timestamp set/preserve/clear behavior and updated_at.
   Attempt spoofed creator/owner/completion/tenant inputs and direct mutations.
6. Force a relationship-insert failure in disposable setup and verify the entire
   creation/update rolls back. Test simultaneous updates to one project to confirm
   field/link sets do not interleave. Verify no recursive RLS errors.
7. Test empty/error states, keyboard/mobile layouts, repeated invalid-date submits
   preserving selects/checkboxes, stale selections, and workspace changes in another
   tab. Confirm success redirects to `/projects` and `/app` context remains intact.
8. Verify trusted service-role table access, denied private-helper execution, and
   cascading removal of junction rows only when a parent is administratively deleted.
