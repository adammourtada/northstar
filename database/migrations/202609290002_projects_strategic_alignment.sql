-- Apply manually as postgres after the organization and objective migrations.
-- The repository does not execute this migration automatically.
begin;
do $$
begin
  if current_user <> 'postgres' then
    raise exception 'Apply this migration as the postgres database role';
  end if;
end;
$$;

create table public.projects (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  name text not null,
  description text,
  owner_id uuid references public.profiles(id),
  created_by uuid not null references public.profiles(id),
  status text not null default 'planned',
  priority text not null default 'medium',
  start_date date,
  target_date date,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint projects_name_valid check (char_length(name) > 0 and name !~ '^[[:space:]]|[[:space:]]$'),
  constraint projects_status_valid check (status in ('planned', 'active', 'on_hold', 'at_risk', 'completed', 'cancelled')),
  constraint projects_priority_valid check (priority in ('low', 'medium', 'high', 'critical')),
  constraint projects_dates_valid check (target_date >= start_date),
  constraint projects_completion_valid check ((status = 'completed') = (completed_at is not null)),
  -- Required FK target and also supports the tenant-scoped project list.
  constraint projects_organization_id_id_key unique (organization_id, id)
);

-- SQL foreign keys require an exact unique target, even though id alone is unique.
-- Keep the existing primary key, read policies, RPCs, and migration file unchanged.
alter table public.strategic_objectives
  add constraint strategic_objectives_organization_id_id_key unique (organization_id, id);

create table public.project_objectives (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  project_id uuid not null,
  objective_id uuid not null,
  created_at timestamptz not null default now(),
  constraint project_objectives_project_objective_key unique (project_id, objective_id),
  constraint project_objectives_project_tenant_fkey foreign key (organization_id, project_id)
    references public.projects(organization_id, id) on delete cascade,
  constraint project_objectives_objective_tenant_fkey foreign key (organization_id, objective_id)
    references public.strategic_objectives(organization_id, id) on delete cascade
);
-- Reverse lookup and objective FK maintenance; project lookup uses the unique pair.
create index project_objectives_organization_objective_idx on public.project_objectives(organization_id, objective_id);

create trigger projects_set_updated_at
before insert or update on public.projects
for each row execute function northstar_private.set_updated_at();

create function northstar_private.can_manage_projects(p_organization_id uuid)
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.organization_members as membership
    where membership.organization_id = p_organization_id
      and membership.user_id = (select auth.uid())
      and membership.role in ('owner', 'admin', 'manager')
  );
$$;

-- Internal operation only. Runs with its calling RPC's privileges; never exposed
-- to API roles. Any failure propagates and rolls back the entire RPC transaction.
create function northstar_private.replace_project_objectives(
  p_organization_id uuid, p_project_id uuid, p_objective_ids uuid[]
)
returns void
language plpgsql security invoker
set search_path = ''
as $$
begin
  if p_objective_ids is null or exists (
    select 1 from pg_catalog.unnest(p_objective_ids) as selected(id)
    where not exists (
      select 1 from public.strategic_objectives as objective
      where objective.id = selected.id and objective.organization_id = p_organization_id
    )
  ) then
    -- Null, missing, and foreign IDs get the same non-disclosing error.
    raise exception 'Selected objectives are unavailable' using errcode = '22023';
  end if;
  delete from public.project_objectives
  where organization_id = p_organization_id and project_id = p_project_id;
  insert into public.project_objectives (organization_id, project_id, objective_id)
  select p_organization_id, p_project_id, selected.id
  from (select distinct id from pg_catalog.unnest(p_objective_ids) as selection(id)) as selected;
  -- Composite FKs still enforce tenant integrity if an objective changes/deletes
  -- concurrently, and for trusted administrative writes outside these RPCs.
end;
$$;

create function public.create_project(
  p_organization_id uuid, p_name text, p_description text default null,
  p_status text default 'planned', p_priority text default 'medium',
  p_start_date date default null, p_target_date date default null,
  p_objective_ids uuid[] default '{}'
)
returns uuid
language plpgsql security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_id uuid;
begin
  if v_user_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;
  if not northstar_private.can_manage_projects(p_organization_id) then
    raise exception 'Project unavailable or access denied' using errcode = '42501';
  end if;
  insert into public.projects (
    organization_id, name, description, owner_id, created_by,
    status, priority, start_date, target_date, completed_at
  ) values (
    p_organization_id,
    pg_catalog.regexp_replace(p_name, '^[[:space:]]+|[[:space:]]+$', '', 'g'),
    nullif(pg_catalog.regexp_replace(p_description, '^[[:space:]]+|[[:space:]]+$', '', 'g'), ''),
    v_user_id, v_user_id, p_status, p_priority, p_start_date, p_target_date,
    case when p_status = 'completed' then pg_catalog.statement_timestamp() else null end
  ) returning id into v_id;
  perform northstar_private.replace_project_objectives(p_organization_id, v_id, p_objective_ids);
  return v_id;
end;
$$;

create function public.update_project(
  p_project_id uuid, p_name text, p_description text, p_status text, p_priority text,
  p_start_date date, p_target_date date, p_objective_ids uuid[]
)
returns uuid
language plpgsql security definer
set search_path = ''
as $$
declare
  v_organization_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;
  -- Serialize updates to the same project's fields and complete relationship set.
  select project.organization_id into v_organization_id
  from public.projects as project
  where project.id = p_project_id
    and northstar_private.can_manage_projects(project.organization_id)
  for update;
  if v_organization_id is null then
    raise exception 'Project unavailable or access denied' using errcode = '42501';
  end if;
  update public.projects set
    name = pg_catalog.regexp_replace(p_name, '^[[:space:]]+|[[:space:]]+$', '', 'g'),
    description = nullif(pg_catalog.regexp_replace(p_description, '^[[:space:]]+|[[:space:]]+$', '', 'g'), ''),
    status = p_status, priority = p_priority, start_date = p_start_date, target_date = p_target_date,
    completed_at = case when p_status <> 'completed' then null
      when status = 'completed' then completed_at else pg_catalog.statement_timestamp() end
  where id = p_project_id and organization_id = v_organization_id;
  perform northstar_private.replace_project_objectives(v_organization_id, p_project_id, p_objective_ids);
  return p_project_id;
end;
$$;

alter table public.projects enable row level security;
alter table public.project_objectives enable row level security;
create policy projects_select_member on public.projects for select to authenticated
using (northstar_private.is_organization_member(organization_id));
create policy project_objectives_select_member on public.project_objectives for select to authenticated
using (northstar_private.is_organization_member(organization_id));

revoke all on table public.projects, public.project_objectives from public, anon, authenticated, service_role;
grant select on table public.projects, public.project_objectives to authenticated;
grant all privileges on table public.projects, public.project_objectives to service_role;
revoke all on function northstar_private.can_manage_projects(uuid) from public, anon, authenticated, service_role;
revoke all on function northstar_private.replace_project_objectives(uuid, uuid, uuid[]) from public, anon, authenticated, service_role;
revoke all on function public.create_project(uuid, text, text, text, text, date, date, uuid[]) from public, anon, authenticated, service_role;
revoke all on function public.update_project(uuid, text, text, text, text, date, date, uuid[]) from public, anon, authenticated, service_role;
grant execute on function public.create_project(uuid, text, text, text, text, date, date, uuid[]) to authenticated;
grant execute on function public.update_project(uuid, text, text, text, text, date, date, uuid[]) to authenticated;
-- No direct API-role mutations, delete RPCs, dynamic SQL, or exception handlers.
commit;
