-- One-time forward-only migration. Review and apply manually as postgres after 202609290005.
-- Adding this file does not execute SQL against Supabase.
begin;
do $$
begin
  if current_user <> 'postgres' then
    raise exception 'Apply this migration as the postgres database role';
  end if;
end;
$$;

create table public.risks (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  title text not null,
  description text,
  owner_id uuid references public.profiles(id),
  probability integer not null,
  impact integer not null,
  status text not null default 'open',
  mitigation_plan text,
  identified_at timestamptz not null default now(),
  review_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint risks_organization_id_id_key unique (organization_id, id),
  constraint risks_owner_tenant_fkey foreign key (organization_id, owner_id)
    references public.organization_members(organization_id, user_id),
  constraint risks_title_valid check (char_length(title) between 1 and 200 and title !~ '^[[:space:]]|[[:space:]]$'),
  constraint risks_description_valid check (char_length(description) <= 5000),
  constraint risks_mitigation_valid check (char_length(mitigation_plan) <= 5000),
  constraint risks_probability_valid check (probability between 1 and 5),
  constraint risks_impact_valid check (impact between 1 and 5),
  constraint risks_status_valid check (status in ('open', 'monitoring', 'mitigated', 'accepted', 'closed')),
  constraint risks_identified_valid check (pg_catalog.isfinite(identified_at)),
  constraint risks_review_valid check (pg_catalog.isfinite(review_date))
);
-- Also supports membership FK maintenance; composite UNIQUE covers tenant lists.
create index risks_organization_owner_idx on public.risks(organization_id, owner_id);
create trigger risks_set_updated_at before insert or update on public.risks
for each row execute function northstar_private.set_updated_at();

create table public.risk_projects (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  risk_id uuid not null,
  project_id uuid not null,
  created_at timestamptz not null default now(),
  constraint risk_projects_risk_project_key unique (risk_id, project_id),
  constraint risk_projects_risk_tenant_fkey foreign key (organization_id, risk_id)
    references public.risks(organization_id, id) on delete cascade,
  constraint risk_projects_project_tenant_fkey foreign key (organization_id, project_id)
    references public.projects(organization_id, id) on delete cascade
);
create index risk_projects_organization_project_idx on public.risk_projects(organization_id, project_id);

create table public.risk_objectives (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  risk_id uuid not null,
  objective_id uuid not null,
  created_at timestamptz not null default now(),
  constraint risk_objectives_risk_objective_key unique (risk_id, objective_id),
  constraint risk_objectives_risk_tenant_fkey foreign key (organization_id, risk_id)
    references public.risks(organization_id, id) on delete cascade,
  constraint risk_objectives_objective_tenant_fkey foreign key (organization_id, objective_id)
    references public.strategic_objectives(organization_id, id) on delete cascade
);
create index risk_objectives_organization_objective_idx on public.risk_objectives(organization_id, objective_id);

create function northstar_private.can_manage_risks(p_organization_id uuid)
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

-- Internal only: invoker rights inherit the calling RPC's privileges.
-- Any invalid association aborts and rolls back the entire risk/link save.
create function northstar_private.replace_risk_links(
  p_organization_id uuid, p_risk_id uuid, p_project_ids uuid[], p_objective_ids uuid[]
)
returns void language plpgsql security invoker
set search_path = ''
as $$
begin
  if p_project_ids is null or p_objective_ids is null or exists (
    select 1 from pg_catalog.unnest(p_project_ids) as selected(id)
    where not exists (
      select 1 from public.projects as project
      where project.id = selected.id and project.organization_id = p_organization_id
    )
  ) or exists (
    select 1 from pg_catalog.unnest(p_objective_ids) as selected(id)
    where not exists (
      select 1 from public.strategic_objectives as objective
      where objective.id = selected.id and objective.organization_id = p_organization_id
    )
  ) then
    raise exception 'Selected risk associations are unavailable' using errcode = '22023';
  end if;
  delete from public.risk_projects where organization_id = p_organization_id and risk_id = p_risk_id;
  delete from public.risk_objectives where organization_id = p_organization_id and risk_id = p_risk_id;
  insert into public.risk_projects (organization_id, risk_id, project_id)
  select p_organization_id, p_risk_id, selected.id
  from (select distinct id from pg_catalog.unnest(p_project_ids) as selection(id)) as selected;
  insert into public.risk_objectives (organization_id, risk_id, objective_id)
  select p_organization_id, p_risk_id, selected.id
  from (select distinct id from pg_catalog.unnest(p_objective_ids) as selection(id)) as selected;
end;
$$;

create function public.create_risk(
  p_organization_id uuid, p_title text, p_description text, p_owner_id uuid,
  p_probability integer, p_impact integer, p_status text, p_mitigation_plan text,
  p_review_date date, p_project_ids uuid[], p_objective_ids uuid[]
)
returns uuid language plpgsql security definer
set search_path = ''
as $$
declare
  v_id uuid;
begin
  if auth.uid() is null or not northstar_private.can_manage_risks(p_organization_id) then
    raise exception 'Risk unavailable or access denied' using errcode = '42501';
  end if;
  if p_owner_id is not null and not exists (
    select 1 from public.organization_members
    where organization_id = p_organization_id and user_id = p_owner_id
  ) then
    raise exception 'Selected risk associations are unavailable' using errcode = '22023';
  end if;
  insert into public.risks (organization_id, title, description, owner_id,
    probability, impact, status, mitigation_plan, review_date)
  values (p_organization_id,
    pg_catalog.regexp_replace(p_title, '^[[:space:]]+|[[:space:]]+$', '', 'g'),
    nullif(pg_catalog.regexp_replace(p_description, '^[[:space:]]+|[[:space:]]+$', '', 'g'), ''),
    p_owner_id, p_probability, p_impact, p_status,
    nullif(pg_catalog.regexp_replace(p_mitigation_plan, '^[[:space:]]+|[[:space:]]+$', '', 'g'), ''),
    p_review_date)
  returning id into v_id;
  perform northstar_private.replace_risk_links(p_organization_id, v_id, p_project_ids, p_objective_ids);
  return v_id;
end;
$$;

create function public.update_risk(
  p_risk_id uuid, p_title text, p_description text, p_owner_id uuid,
  p_probability integer, p_impact integer, p_status text, p_mitigation_plan text,
  p_review_date date, p_project_ids uuid[], p_objective_ids uuid[]
)
returns uuid language plpgsql security definer
set search_path = ''
as $$
declare
  v_organization_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Risk unavailable or access denied' using errcode = '42501';
  end if;
  -- Serialize the editable fields and complete replacement link sets.
  select risk.organization_id into v_organization_id from public.risks as risk
  where risk.id = p_risk_id and northstar_private.can_manage_risks(risk.organization_id)
  for update;
  if v_organization_id is null then
    raise exception 'Risk unavailable or access denied' using errcode = '42501';
  end if;
  if p_owner_id is not null and not exists (
    select 1 from public.organization_members
    where organization_id = v_organization_id and user_id = p_owner_id
  ) then
    raise exception 'Selected risk associations are unavailable' using errcode = '22023';
  end if;
  update public.risks set
    title = pg_catalog.regexp_replace(p_title, '^[[:space:]]+|[[:space:]]+$', '', 'g'),
    description = nullif(pg_catalog.regexp_replace(p_description, '^[[:space:]]+|[[:space:]]+$', '', 'g'), ''),
    owner_id = p_owner_id, probability = p_probability, impact = p_impact, status = p_status,
    mitigation_plan = nullif(pg_catalog.regexp_replace(p_mitigation_plan, '^[[:space:]]+|[[:space:]]+$', '', 'g'), ''),
    review_date = p_review_date
  where id = p_risk_id and organization_id = v_organization_id;
  perform northstar_private.replace_risk_links(v_organization_id, p_risk_id, p_project_ids, p_objective_ids);
  return p_risk_id;
end;
$$;

alter table public.risks enable row level security;
alter table public.risk_projects enable row level security;
alter table public.risk_objectives enable row level security;
create policy risks_select_member on public.risks for select to authenticated
using (northstar_private.is_organization_member(organization_id));
create policy risk_projects_select_member on public.risk_projects for select to authenticated
using (northstar_private.is_organization_member(organization_id));
create policy risk_objectives_select_member on public.risk_objectives for select to authenticated
using (northstar_private.is_organization_member(organization_id));
revoke all on table public.risks, public.risk_projects, public.risk_objectives
from public, anon, authenticated, service_role;
grant select on table public.risks, public.risk_projects, public.risk_objectives to authenticated;
grant all privileges on table public.risks, public.risk_projects, public.risk_objectives to service_role;
revoke all on function northstar_private.can_manage_risks(uuid) from public, anon, authenticated, service_role;
revoke all on function northstar_private.replace_risk_links(uuid, uuid, uuid[], uuid[]) from public, anon, authenticated, service_role;
revoke all on function public.create_risk(uuid, text, text, uuid, integer, integer, text, text, date, uuid[], uuid[])
from public, anon, authenticated, service_role;
revoke all on function public.update_risk(uuid, text, text, uuid, integer, integer, text, text, date, uuid[], uuid[])
from public, anon, authenticated, service_role;
grant execute on function public.create_risk(uuid, text, text, uuid, integer, integer, text, text, date, uuid[], uuid[]) to authenticated;
grant execute on function public.update_risk(uuid, text, text, uuid, integer, integer, text, text, date, uuid[], uuid[]) to authenticated;
-- No direct API writes, delete RPC, exposure column, or timestamp input parameters.
commit;
