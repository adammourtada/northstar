# Database foundation

`migrations/202609280001_organization_foundation.sql` is a one-time, transactional
PostgreSQL/Supabase migration. It has **not been automatically applied to any
remote Supabase project**. No migration runner or live database dependency is
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
transfer, invitation, membership mutation, or organization UI yet.

## Supported creation path

The RPC signature is `public.create_organization(p_name text, p_slug text)` and it
returns the new organization UUID. Future application code can call:

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
