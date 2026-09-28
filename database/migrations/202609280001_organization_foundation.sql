-- One-time migration. Review and apply manually as the Supabase postgres role.
-- No remote database is contacted by adding this file to the repository.
begin;

-- Ownership is security-critical: the definer helpers must bypass table RLS.
do $$
begin
  if current_user <> 'postgres' then
    raise exception 'Apply this migration as the postgres database role';
  end if;
end;
$$;

-- Keep internal helpers out of the exposed public API schema.
create schema northstar_private;
revoke all on schema northstar_private from public, anon, authenticated, service_role;
grant usage on schema northstar_private to authenticated;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  -- Preserve creator attribution; account deletion needs a future lifecycle flow.
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint organizations_name_valid check (
    char_length(name) > 0 and name !~ '^[[:space:]]|[[:space:]]$'
  ),
  constraint organizations_slug_valid check (
    slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'
  )
);

create table public.organization_members (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role text not null,
  joined_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint organization_members_role_valid check (
    role in ('owner', 'admin', 'manager', 'member', 'viewer')
  ),
  constraint organization_members_organization_user_key unique (organization_id, user_id)
);

-- The compound UNIQUE index already supports organization_id lookups.
create index organization_members_user_id_idx on public.organization_members(user_id);
create index organizations_created_by_idx on public.organizations(created_by);

create function northstar_private.set_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.updated_at := pg_catalog.statement_timestamp();
  return new;
end;
$$;

create trigger profiles_set_updated_at
before insert or update on public.profiles
for each row execute function northstar_private.set_updated_at();

create trigger organizations_set_updated_at
before insert or update on public.organizations
for each row execute function northstar_private.set_updated_at();

create trigger organization_members_set_updated_at
before insert or update on public.organization_members
for each row execute function northstar_private.set_updated_at();

create function northstar_private.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- Do not trust user metadata for identity or copy authentication credentials.
  insert into public.profiles (id) values (new.id)
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger northstar_auth_user_created
after insert on auth.users
for each row execute function northstar_private.handle_new_auth_user();

-- Install the trigger first, then cover users who predate this migration.
-- Existing profile data is never overwritten.
insert into public.profiles (id)
select id from auth.users
on conflict (id) do nothing;

create function northstar_private.is_organization_member(p_organization_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.organization_members as membership
    where membership.organization_id = p_organization_id
      and membership.user_id = (select auth.uid())
  );
$$;

create function public.create_organization(p_name text, p_slug text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_organization_id uuid;
begin
  if v_user_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  -- Only repair the caller's profile; the FK still requires a real auth user.
  insert into public.profiles (id) values (v_user_id)
  on conflict (id) do nothing;

  insert into public.organizations (name, slug, created_by)
  values (
    pg_catalog.regexp_replace(p_name, '^[[:space:]]+|[[:space:]]+$', '', 'g'),
    pg_catalog.regexp_replace(p_slug, '^[[:space:]]+|[[:space:]]+$', '', 'g'),
    v_user_id
  )
  returning id into v_organization_id;

  insert into public.organization_members (organization_id, user_id, role)
  values (v_organization_id, v_user_id, 'owner');

  -- No exception handlers/commits: failure rolls back both inserts together.
  return v_organization_id;
end;
$$;

alter table public.profiles enable row level security;
alter table public.organizations enable row level security;
alter table public.organization_members enable row level security;

create policy profiles_select_own on public.profiles
for select to authenticated
using (id = (select auth.uid()));

create policy profiles_update_own on public.profiles
for update to authenticated
using (id = (select auth.uid()))
with check (id = (select auth.uid()));

create policy organizations_select_member on public.organizations
for select to authenticated
using (northstar_private.is_organization_member(id));

create policy organization_members_select_member on public.organization_members
for select to authenticated
using (northstar_private.is_organization_member(organization_id));

-- Supabase default privileges may otherwise grant more than this issue needs.
revoke all on table public.profiles, public.organizations, public.organization_members
from public, anon, authenticated, service_role;
grant select on table public.profiles, public.organizations, public.organization_members
to authenticated;
grant update (full_name, avatar_url) on public.profiles to authenticated;
grant all privileges on table public.profiles, public.organizations, public.organization_members
to service_role;

-- Functions default to PUBLIC EXECUTE. Revoke within this same transaction.
revoke all on function northstar_private.set_updated_at()
from public, anon, authenticated, service_role;
revoke all on function northstar_private.handle_new_auth_user()
from public, anon, authenticated, service_role;
revoke all on function northstar_private.is_organization_member(uuid)
from public, anon, authenticated, service_role;
revoke all on function public.create_organization(text, text)
from public, anon, authenticated, service_role;

grant execute on function northstar_private.is_organization_member(uuid) to authenticated;
grant execute on function public.create_organization(text, text) to authenticated;

-- No FORCE RLS: owner-executed helpers intentionally bypass RLS to avoid recursion.
-- Ordinary API users cannot mutate memberships, spoof creators, or change profile identity.
commit;
