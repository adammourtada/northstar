-- One-time migration; review for manual application after the organization foundation.
-- Adding this file does not apply SQL to any database.
begin;

do $$
begin
  if current_user <> 'postgres' then
    raise exception 'Apply this migration as the postgres database role';
  end if;
end;
$$;

create table public.strategic_objectives (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  title text not null,
  description text,
  owner_id uuid references public.profiles(id),
  created_by uuid not null references public.profiles(id),
  priority text not null default 'medium',
  status text not null default 'draft',
  progress_percent integer not null default 0,
  start_date date,
  target_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint strategic_objectives_title_valid check (
    char_length(title) > 0 and title !~ '^[[:space:]]|[[:space:]]$'
  ),
  constraint strategic_objectives_priority_valid check (priority in ('low', 'medium', 'high', 'critical')),
  constraint strategic_objectives_status_valid check (status in ('draft', 'active', 'at_risk', 'completed', 'cancelled')),
  constraint strategic_objectives_progress_valid check (progress_percent between 0 and 100),
  constraint strategic_objectives_dates_valid check (target_date >= start_date)
);

-- The initial list is scoped by organization; no status/owner filters yet.
create index strategic_objectives_organization_id_idx on public.strategic_objectives(organization_id);

create trigger strategic_objectives_set_updated_at
before insert or update on public.strategic_objectives
for each row execute function northstar_private.set_updated_at();

-- Narrow boolean helper; caller identity is never an argument. The postgres owner
-- bypasses membership RLS, avoiding recursion. No new client helper grant is needed.
create function northstar_private.can_manage_objectives(p_organization_id uuid)
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
      and membership.role in ('owner', 'admin', 'manager')
  );
$$;

create function public.create_strategic_objective(
  p_organization_id uuid, p_title text, p_description text default null,
  p_priority text default 'medium', p_status text default 'draft',
  p_progress_percent integer default 0, p_start_date date default null,
  p_target_date date default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_id uuid;
begin
  if v_user_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;
  if not northstar_private.can_manage_objectives(p_organization_id) then
    raise exception 'Objective unavailable or access denied' using errcode = '42501';
  end if;
  -- Table constraints validate all writes, including privileged administrative writes.
  insert into public.strategic_objectives (
    organization_id, title, description, owner_id, created_by,
    priority, status, progress_percent, start_date, target_date
  ) values (
    p_organization_id,
    pg_catalog.regexp_replace(p_title, '^[[:space:]]+|[[:space:]]+$', '', 'g'),
    nullif(pg_catalog.regexp_replace(p_description, '^[[:space:]]+|[[:space:]]+$', '', 'g'), ''),
    v_user_id, v_user_id, p_priority, p_status, p_progress_percent, p_start_date, p_target_date
  ) returning id into v_id;
  return v_id;
end;
$$;

create function public.update_strategic_objective(
  p_objective_id uuid, p_title text, p_description text,
  p_priority text, p_status text, p_progress_percent integer,
  p_start_date date, p_target_date date
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_organization_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;
  select objective.organization_id into v_organization_id
  from public.strategic_objectives as objective
  where objective.id = p_objective_id;
  -- Missing IDs and other tenants have the same response; no existence disclosure.
  if v_organization_id is null or not northstar_private.can_manage_objectives(v_organization_id) then
    raise exception 'Objective unavailable or access denied' using errcode = '42501';
  end if;
  update public.strategic_objectives set
    title = pg_catalog.regexp_replace(p_title, '^[[:space:]]+|[[:space:]]+$', '', 'g'),
    description = nullif(pg_catalog.regexp_replace(p_description, '^[[:space:]]+|[[:space:]]+$', '', 'g'), ''),
    priority = p_priority, status = p_status, progress_percent = p_progress_percent,
    start_date = p_start_date, target_date = p_target_date
  where id = p_objective_id and organization_id = v_organization_id;
  if not found then
    raise exception 'Objective unavailable or access denied' using errcode = '42501';
  end if;
  return p_objective_id;
end;
$$;

alter table public.strategic_objectives enable row level security;
create policy strategic_objectives_select_member on public.strategic_objectives
for select to authenticated
using (northstar_private.is_organization_member(organization_id));

revoke all on table public.strategic_objectives from public, anon, authenticated, service_role;
grant select on table public.strategic_objectives to authenticated;
grant all privileges on table public.strategic_objectives to service_role;

revoke all on function northstar_private.can_manage_objectives(uuid) from public, anon, authenticated, service_role;
revoke all on function public.create_strategic_objective(uuid, text, text, text, text, integer, date, date)
from public, anon, authenticated, service_role;
revoke all on function public.update_strategic_objective(uuid, text, text, text, text, integer, date, date)
from public, anon, authenticated, service_role;
grant execute on function public.create_strategic_objective(uuid, text, text, text, text, integer, date, date) to authenticated;
grant execute on function public.update_strategic_objective(uuid, text, text, text, text, integer, date, date) to authenticated;

-- No mutation policies, direct mutation grants, ownership reassignment, or delete RPC.
-- Existing helpers, schema privileges, and foundation objects remain unchanged.
commit;
