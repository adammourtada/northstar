-- One-time forward-only migration. Review and apply manually as postgres after 202609290004.
-- Adding this file does not execute SQL against Supabase.
begin;
do $$
begin
  if current_user <> 'postgres' then
    raise exception 'Apply this migration as the postgres database role';
  end if;
end;
$$;
alter table public.kpis
  add constraint kpis_organization_id_id_key unique (organization_id, id);
create table public.kpi_measurements (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  kpi_id uuid not null,
  value numeric not null,
  measured_at timestamptz not null,
  recorded_by uuid not null references public.profiles(id),
  notes text,
  created_at timestamptz not null default now(),
  constraint kpi_measurements_kpi_tenant_fkey foreign key (organization_id, kpi_id)
    references public.kpis(organization_id, id),
  -- Unrestricted numeric rejects invalid scale rather than rounding on assignment.
  constraint kpi_measurements_value_finite check (value::text not in ('NaN', 'Infinity', '-Infinity')),
  constraint kpi_measurements_value_bounds check (abs(value) < 100000000000000000000 and scale(value) <= 10),
  constraint kpi_measurements_timestamp_finite check (pg_catalog.isfinite(measured_at)),
  constraint kpi_measurements_notes_valid check (char_length(notes) <= 5000)
);
-- Covers organization/KPI history, latest queries and composite FK maintenance.
create index kpi_measurements_history_idx on public.kpi_measurements
  (organization_id, kpi_id, measured_at desc, created_at desc, id desc);
create function public.create_kpi_measurement(
  p_organization_id uuid, p_kpi_id uuid, p_value numeric,
  p_measured_at timestamptz, p_notes text default null
)
returns uuid language plpgsql security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_id uuid;
begin
  -- Organization is only an expected scope, never evidence of authorization.
  if v_user_id is null
    or not northstar_private.is_organization_member(p_organization_id)
    or not northstar_private.can_manage_kpis(p_organization_id) then
    raise exception 'KPI unavailable or access denied' using errcode = '42501';
  end if;
  if not exists (
    select 1 from public.kpis as kpi
    where kpi.id = p_kpi_id and kpi.organization_id = p_organization_id
  ) then
    raise exception 'KPI unavailable or access denied' using errcode = '42501';
  end if;
  insert into public.kpi_measurements (organization_id, kpi_id, value, measured_at, recorded_by, notes)
  values (p_organization_id, p_kpi_id, p_value, p_measured_at, v_user_id,
    nullif(pg_catalog.regexp_replace(p_notes, '^[[:space:]]+|[[:space:]]+$', '', 'g'), ''))
  returning id into v_id;
  return v_id;
end;
$$;
alter table public.kpi_measurements enable row level security;
create policy kpi_measurements_select_member on public.kpi_measurements for select to authenticated
using (northstar_private.is_organization_member(organization_id));
revoke all on table public.kpi_measurements from public, anon, authenticated, service_role;
grant select on table public.kpi_measurements to authenticated;
grant all privileges on table public.kpi_measurements to service_role;
revoke all on function public.create_kpi_measurement(uuid, uuid, numeric, timestamptz, text)
from public, anon, authenticated, service_role;
grant execute on function public.create_kpi_measurement(uuid, uuid, numeric, timestamptz, text) to authenticated;
-- No user mutation policies, direct write privileges, update RPC or delete RPC.
commit;
