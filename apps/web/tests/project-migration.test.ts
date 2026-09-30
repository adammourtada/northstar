import { readFileSync } from "node:fs";
import { expect, it } from "vitest";

// Static security regression checks, not a substitute for PostgreSQL execution.
const sql = readFileSync(new URL("../../../database/migrations/202609290002_projects_strategic_alignment.sql", import.meta.url), "utf8");
const functionBody = (name: string) => sql.split(`create function ${name}(`)[1].split("$$;")[0];

it("enforces tenant-aware relational integrity for both ends and duplicate prevention", () => {
  expect(sql).toContain("projects_organization_id_id_key unique (organization_id, id)");
  expect(sql).toContain("strategic_objectives_organization_id_id_key unique (organization_id, id)");
  expect(sql).toMatch(/foreign key \(organization_id, project_id\)\s+references public.projects\(organization_id, id\) on delete cascade/);
  expect(sql).toMatch(/foreign key \(organization_id, objective_id\)\s+references public.strategic_objectives\(organization_id, id\) on delete cascade/);
  expect(sql).toContain("unique (project_id, objective_id)");
  expect(sql).not.toMatch(/references public\.(organizations|profiles)\(id\) on delete cascade/);
});
it("restricts RLS to membership reads and revokes all direct API mutations", () => {
  for (const table of ["projects", "project_objectives"]) {
    expect(sql).toContain(`alter table public.${table} enable row level security`);
    expect(sql).toContain(`create policy ${table}_select_member on public.${table} for select to authenticated`);
  }
  expect(sql.match(/using \(northstar_private.is_organization_member\(organization_id\)\)/g)).toHaveLength(2);
  expect(sql).toContain("revoke all on table public.projects, public.project_objectives from public, anon, authenticated, service_role");
  expect(sql).toContain("grant select on table public.projects, public.project_objectives to authenticated");
  expect(sql).toContain("grant all privileges on table public.projects, public.project_objectives to service_role");
  expect(sql).not.toMatch(/grant (insert|update|delete|all).*to authenticated/i);
});
it("uses fixed paths and limits EXECUTE to the two RPCs", () => {
  for (const name of ["northstar_private.can_manage_projects", "northstar_private.replace_project_objectives", "public.create_project", "public.update_project"]) {
    expect(functionBody(name)).toContain("set search_path = ''");
    expect(sql).toMatch(new RegExp(`revoke all on function ${name.replaceAll(".", "\\.")}\\([^;]+from public, anon, authenticated, service_role`));
  }
  const grants = sql.match(/grant execute[^;]+;/g)!;
  expect(grants).toHaveLength(2); expect(grants.every((grant) => grant.includes("public.") && grant.includes("to authenticated"))).toBe(true);
  expect(sql).not.toMatch(/create (or replace )?function northstar_private\.(is_organization_member|can_manage_objectives|set_updated_at)/);
});
it("derives caller identity/attribution and exposes no internal write parameters", () => {
  const helper = functionBody("northstar_private.can_manage_projects");
  expect(helper).toContain("membership.user_id = (select auth.uid())");
  expect(helper).toContain("membership.role in ('owner', 'admin', 'manager')");
  for (const name of ["public.create_project", "public.update_project"]) {
    const body = functionBody(name);
    expect(body).toContain("auth.uid()"); expect(body).toContain("northstar_private.can_manage_projects");
    expect(body.split("returns uuid")[0]).not.toMatch(/p_(created_by|owner_id|user_id|role|completed_at)/);
  }
  expect(functionBody("public.create_project")).toContain("v_user_id, v_user_id");
  const update = functionBody("public.update_project");
  expect(update).toContain("for update;");
  expect(update.split("update public.projects set")[1].split("where id")[0]).not.toMatch(/(organization_id|created_by|owner_id)\s*=/);
});
it("validates all links, deduplicates, and keeps replacement in the same uncaught RPC transaction", () => {
  const replace = functionBody("northstar_private.replace_project_objectives");
  expect(replace).toContain("p_objective_ids is null or exists");
  expect(replace).toContain("objective.id = selected.id and objective.organization_id = p_organization_id");
  expect(replace).toContain("select distinct id from pg_catalog.unnest(p_objective_ids)");
  expect(replace.indexOf("raise exception")).toBeLessThan(replace.indexOf("delete from"));
  for (const name of ["public.create_project", "public.update_project"]) {
    const body = functionBody(name);
    expect(body).toContain("perform northstar_private.replace_project_objectives(");
    expect(body).not.toMatch(/exception\s+when|\bcommit\s*;|\brollback\s*;/i);
  }
});
it("controls completion transitions and reuses the timestamp trigger", () => {
  expect(functionBody("public.create_project")).toContain("case when p_status = 'completed' then pg_catalog.statement_timestamp() else null end");
  expect(functionBody("public.update_project")).toMatch(/completed_at = case when p_status <> 'completed' then null\s+when status = 'completed' then completed_at else pg_catalog.statement_timestamp\(\) end/);
  expect(sql).toContain("check ((status = 'completed') = (completed_at is not null))");
  expect(sql).toMatch(/create trigger projects_set_updated_at\s+before insert or update on public.projects\s+for each row execute function northstar_private.set_updated_at\(\)/);
});
