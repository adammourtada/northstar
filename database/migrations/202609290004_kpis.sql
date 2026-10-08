-- One-time, forward-only migration. Apply manually as postgres after 202609290003.
-- Adding this file does not execute SQL against Supabase.
begin;
do $$
begin
  if current_user <> 'postgres' then
    raise exception 'Apply this migration as the postgres database role';
  end if;
end;
$$;

create table public.kpis (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  objective_id uuid,
  name text not null,
  description text,
  owner_id uuid not null references public.profiles(id),
  unit text not null,
  target_value numeric,
  direction text not null,
  reporting_frequency text,
  status text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint kpis_objective_tenant_fkey foreign key (organization_id, objective_id)
    references public.strategic_objectives(organization_id, id),
  constraint kpis_name_valid check (char_length(name) between 1 and 200 and name !~ '^[[:space:]]|[[:space:]]$'),
  constraint kpis_unit_valid check (char_length(unit) between 1 and 80 and unit !~ '^[[:space:]]|[[:space:]]$'),
  constraint kpis_description_valid check (char_length(description) <= 5000),
  constraint kpis_direction_valid check (direction in ('increase', 'decrease', 'maintain')),
  constraint kpis_status_valid check (status in ('active', 'paused', 'archived')),
  constraint kpis_frequency_valid check (reporting_frequency in ('daily', 'weekly', 'monthly', 'quarterly', 'annually')),
  -- Unrestricted numeric plus CHECKs rejects excess scale instead of silently rounding.
  constraint kpis_target_finite check (target_value::text not in ('NaN', 'Infinity', '-Infinity')),
  constraint kpis_target_bounds check (abs(target_value) < 100000000000000000000 and scale(target_value) <= 10)
);
-- Covers tenant lists and objective FK maintenance without a duplicate tenant index.
create index kpis_organization_objective_idx on public.kpis(organization_id, objective_id);
create trigger kpis_set_updated_at before insert or update on public.kpis
for each row execute function northstar_private.set_updated_at();

create function northstar_private.can_manage_kpis(p_organization_id uuid)
returns boolean language sql stable security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.organization_members as membership
    where membership.organization_id = p_organization_id
      and membership.user_id = (select auth.uid())
      and membership.role in ('owner', 'admin', 'manager')
  );
$$;

create function public.create_kpi(
  p_organization_id uuid, p_name text, p_unit text, p_direction text,
  p_description text default null, p_target_value numeric default null,
  p_reporting_frequency text default null, p_status text default 'active',
  p_objective_id uuid default null
)
returns uuid language plpgsql security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_id uuid;
begin
  if v_user_id is null or not northstar_private.can_manage_kpis(p_organization_id) then
    raise exception 'KPI unavailable or access denied' using errcode = '42501';
  end if;
  if p_objective_id is not null and not exists (
    select 1 from public.strategic_objectives where id = p_objective_id and organization_id = p_organization_id
  ) then
    raise exception 'Selected objective unavailable' using errcode = '22023';
  end if;
  insert into public.kpis (organization_id, objective_id, name, description, owner_id, unit,
    target_value, direction, reporting_frequency, status)
  values (p_organization_id, p_objective_id,
    pg_catalog.regexp_replace(p_name, '^[[:space:]]+|[[:space:]]+$', '', 'g'),
    nullif(pg_catalog.regexp_replace(p_description, '^[[:space:]]+|[[:space:]]+$', '', 'g'), ''),
    v_user_id, pg_catalog.regexp_replace(p_unit, '^[[:space:]]+|[[:space:]]+$', '', 'g'),
    p_target_value, p_direction, p_reporting_frequency, p_status)
  returning id into v_id;
  return v_id;
end;
$$;

create function public.update_kpi(
  p_kpi_id uuid, p_name text, p_unit text, p_direction text,
  p_description text, p_target_value numeric, p_reporting_frequency text,
  p_status text, p_objective_id uuid
)
returns uuid language plpgsql security definer
set search_path = ''
as $$
declare
  v_organization_id uuid;
begin
  if auth.uid() is null then
    raise exception 'KPI unavailable or access denied' using errcode = '42501';
  end if;
  select kpi.organization_id into v_organization_id from public.kpis as kpi
  where kpi.id = p_kpi_id and northstar_private.can_manage_kpis(kpi.organization_id)
  for update;
  if v_organization_id is null then
    raise exception 'KPI unavailable or access denied' using errcode = '42501';
  end if;
  if p_objective_id is not null and not exists (
    select 1 from public.strategic_objectives where id = p_objective_id and organization_id = v_organization_id
  ) then
    raise exception 'Selected objective unavailable' using errcode = '22023';
  end if;
  update public.kpis set
    name = pg_catalog.regexp_replace(p_name, '^[[:space:]]+|[[:space:]]+$', '', 'g'),
    description = nullif(pg_catalog.regexp_replace(p_description, '^[[:space:]]+|[[:space:]]+$', '', 'g'), ''),
    unit = pg_catalog.regexp_replace(p_unit, '^[[:space:]]+|[[:space:]]+$', '', 'g'),
    target_value = p_target_value, direction = p_direction, reporting_frequency = p_reporting_frequency,
    status = p_status, objective_id = p_objective_id
  where id = p_kpi_id and organization_id = v_organization_id;
  return p_kpi_id;
end;
$$;

alter table public.kpis enable row level security;
create policy kpis_select_member on public.kpis for select to authenticated
using (northstar_private.is_organization_member(organization_id));
revoke all on table public.kpis from public, anon, authenticated, service_role;
grant select on table public.kpis to authenticated;
grant all privileges on table public.kpis to service_role;
revoke all on function northstar_private.can_manage_kpis(uuid) from public, anon, authenticated, service_role;
revoke all on function public.create_kpi(uuid, text, text, text, text, numeric, text, text, uuid) from public, anon, authenticated, service_role;
revoke all on function public.update_kpi(uuid, text, text, text, text, numeric, text, text, uuid) from public, anon, authenticated, service_role;
grant execute on function public.create_kpi(uuid, text, text, text, text, numeric, text, text, uuid) to authenticated;
grant execute on function public.update_kpi(uuid, text, text, text, text, numeric, text, text, uuid) to authenticated;
-- No mutation policies, delete RPC, or client ownership/tenant reassignment.
commit;
