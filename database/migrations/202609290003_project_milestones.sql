-- Applied manually as postgres after the three preceding migrations.
-- The repository does not automatically execute this file.
begin;
do $$
begin
  if current_user <> 'postgres' then
    raise exception 'Apply this migration as the postgres database role';
  end if;
end;
$$;

create table public.milestones (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  project_id uuid not null,
  name text not null,
  description text,
  status text not null default 'not_started',
  progress_percent integer not null default 0,
  due_date date,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint milestones_project_tenant_fkey foreign key (organization_id, project_id)
    references public.projects(organization_id, id),
  constraint milestones_name_valid check (char_length(name) > 0 and name !~ '^[[:space:]]|[[:space:]]$'),
  constraint milestones_status_valid check (status in ('not_started', 'in_progress', 'completed', 'blocked', 'cancelled')),
  constraint milestones_progress_valid check (progress_percent between 0 and 100),
  constraint milestones_completion_valid check ((status = 'completed') = (completed_at is not null)),
  constraint milestones_completed_progress_valid check (status <> 'completed' or progress_percent = 100)
);
-- Supports tenant/project lists and composite FK maintenance; no duplicate index.
create index milestones_organization_project_idx on public.milestones(organization_id, project_id);

-- Also protects lifecycle and immutable relationships during trusted direct writes.
create function northstar_private.set_milestone_completion()
returns trigger
language plpgsql security invoker
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' then
    if new.organization_id is distinct from old.organization_id or new.project_id is distinct from old.project_id then
      raise exception 'Milestone relationships cannot be changed' using errcode = '23514';
    end if;
  end if;
  -- Reject invalid progress before normalizing completed to 100.
  if new.progress_percent is null or new.progress_percent < 0 or new.progress_percent > 100 then
    raise exception 'Invalid milestone progress' using errcode = '23514';
  end if;
  if new.status = 'completed' then
    new.progress_percent := 100;
    if tg_op = 'UPDATE' then
      if old.status = 'completed' then
        new.completed_at := old.completed_at;
      else
        new.completed_at := pg_catalog.statement_timestamp();
      end if;
    else
      new.completed_at := pg_catalog.statement_timestamp();
    end if;
  else
    new.completed_at := null;
  end if;
  return new;
end;
$$;
create trigger milestones_set_completion before insert or update on public.milestones
for each row execute function northstar_private.set_milestone_completion();
create trigger milestones_set_updated_at before insert or update on public.milestones
for each row execute function northstar_private.set_updated_at();

create function northstar_private.can_manage_milestones(p_organization_id uuid)
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

create function public.create_milestone(
  p_project_id uuid, p_name text, p_description text default null,
  p_status text default 'not_started', p_progress_percent integer default 0,
  p_due_date date default null
)
returns uuid
language plpgsql security definer
set search_path = ''
as $$
declare
  v_organization_id uuid;
  v_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;
  select project.organization_id into v_organization_id from public.projects as project
  where project.id = p_project_id and northstar_private.can_manage_milestones(project.organization_id);
  if v_organization_id is null then
    raise exception 'Project unavailable or access denied' using errcode = '42501';
  end if;
  insert into public.milestones (organization_id, project_id, name, description, status, progress_percent, due_date)
  values (v_organization_id, p_project_id,
    pg_catalog.regexp_replace(p_name, '^[[:space:]]+|[[:space:]]+$', '', 'g'),
    nullif(pg_catalog.regexp_replace(p_description, '^[[:space:]]+|[[:space:]]+$', '', 'g'), ''),
    p_status, p_progress_percent, p_due_date)
  returning id into v_id;
  return v_id;
end;
$$;

create function public.update_milestone(
  p_milestone_id uuid, p_name text, p_description text, p_status text,
  p_progress_percent integer, p_due_date date
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
  select milestone.organization_id into v_organization_id from public.milestones as milestone
  where milestone.id = p_milestone_id and northstar_private.can_manage_milestones(milestone.organization_id)
  for update;
  if v_organization_id is null then
    raise exception 'Milestone unavailable or access denied' using errcode = '42501';
  end if;
  update public.milestones set
    name = pg_catalog.regexp_replace(p_name, '^[[:space:]]+|[[:space:]]+$', '', 'g'),
    description = nullif(pg_catalog.regexp_replace(p_description, '^[[:space:]]+|[[:space:]]+$', '', 'g'), ''),
    status = p_status, progress_percent = p_progress_percent, due_date = p_due_date
  where id = p_milestone_id and organization_id = v_organization_id;
  return p_milestone_id;
end;
$$;

alter table public.milestones enable row level security;
create policy milestones_select_member on public.milestones for select to authenticated
using (northstar_private.is_organization_member(organization_id));
revoke all on table public.milestones from public, anon, authenticated, service_role;
grant select on table public.milestones to authenticated;
grant all privileges on table public.milestones to service_role;
revoke all on function northstar_private.set_milestone_completion() from public, anon, authenticated, service_role;
revoke all on function northstar_private.can_manage_milestones(uuid) from public, anon, authenticated, service_role;
revoke all on function public.create_milestone(uuid, text, text, text, integer, date) from public, anon, authenticated, service_role;
revoke all on function public.update_milestone(uuid, text, text, text, integer, date) from public, anon, authenticated, service_role;
grant execute on function public.create_milestone(uuid, text, text, text, integer, date) to authenticated;
grant execute on function public.update_milestone(uuid, text, text, text, integer, date) to authenticated;
commit;
