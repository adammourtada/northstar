import { readFileSync } from "node:fs";
import { expect, it } from "vitest";
const sql = readFileSync(new URL("../../../database/migrations/202609290004_kpis.sql", import.meta.url), "utf8");
const functionBody = (name: string) => sql.split(`create function ${name}(`)[1].split("$$;")[0];
it("is transactional and requires postgres for manual application", () => {
  expect(sql).toMatch(/begin;/); expect(sql).toContain("current_user <> 'postgres'"); expect(sql.trim()).toMatch(/commit;$/);
  expect(sql).not.toMatch(/drop\s|create table public.kpi_measurements/i);
});
it("uses the existing tenant-aware objective key and appropriate index", () => {
  expect(sql).toMatch(/foreign key \(organization_id, objective_id\)\s+references public.strategic_objectives\(organization_id, id\)/);
  const prior = readFileSync(new URL("../../../database/migrations/202609290002_projects_strategic_alignment.sql", import.meta.url), "utf8");
  expect(prior).toContain("unique (organization_id, id)"); expect(sql).toContain("on public.kpis(organization_id, objective_id)");
});
it("enforces required fields, enums, finite bounded targets and timestamp maintenance", () => {
  for (const fragment of ["name text not null", "unit text not null", "owner_id uuid not null references public.profiles(id)", "between 1 and 200", "between 1 and 80", "char_length(description) <= 5000", "'increase', 'decrease', 'maintain'", "'active', 'paused', 'archived'", "'daily', 'weekly', 'monthly', 'quarterly', 'annually'", "'NaN', 'Infinity', '-Infinity'", "scale(target_value) <= 10", "abs(target_value) < 100000000000000000000", "execute function northstar_private.set_updated_at()"] ) expect(sql).toContain(fragment);
  expect(sql.match(/!~ '\^\[\[:space:\]\]\|\[\[:space:\]\]\$'/g)).toHaveLength(2);
  expect(sql).toContain("target_value numeric,"); expect(sql).not.toMatch(/numeric\(/);
});
it("enables membership-only RLS SELECT and revokes all direct user writes", () => {
  expect(sql).toContain("alter table public.kpis enable row level security"); expect(sql).toContain("using (northstar_private.is_organization_member(organization_id))");
  expect(sql).toContain("revoke all on table public.kpis from public, anon, authenticated, service_role");
  expect(sql).toContain("grant select on table public.kpis to authenticated"); expect(sql).toContain("grant all privileges on table public.kpis to service_role");
  expect(sql).not.toMatch(/create policy[^;]+for (insert|update|delete)|grant (insert|update|delete|all)[^;]+to authenticated/i);
});
it("restricts every definer search path, internal helper and RPC grants", () => {
  expect(sql.match(/security definer/g)).toHaveLength(3); expect(sql.match(/set search_path = ''/g)).toHaveLength(3);
  expect(sql).toContain("revoke all on function northstar_private.can_manage_kpis(uuid) from public, anon, authenticated, service_role");
  for (const name of ["create_kpi", "update_kpi"]) {
    const signature = `public.${name}(uuid, text, text, text, text, numeric, text, text, uuid)`;
    expect(sql).toContain(`revoke all on function ${signature} from public, anon, authenticated, service_role`);
    expect(sql).toContain(`grant execute on function ${signature} to authenticated`);
  }
  expect(sql).not.toMatch(/execute\s+format|execute\s+'|delete_kpi/i);
});
it("derives identity and roles from membership inside both authorized RPCs", () => {
  const helper = functionBody("northstar_private.can_manage_kpis");
  expect(helper).toContain("membership.user_id = (select auth.uid())"); expect(helper).toContain("membership.role in ('owner', 'admin', 'manager')");
  const create = functionBody("public.create_kpi"), update = functionBody("public.update_kpi");
  expect(create).toContain("v_user_id uuid := auth.uid()"); expect(create).toContain("not northstar_private.can_manage_kpis(p_organization_id)");
  expect(update).toContain("auth.uid() is null"); expect(update).toContain("northstar_private.can_manage_kpis(kpi.organization_id)"); expect(update).toContain("for update");
  expect(create).toContain("v_user_id, pg_catalog.regexp_replace(p_unit");
  for (const body of [create, update]) { expect(body).not.toMatch(/p_owner_id|p_user_id|p_role/); expect(body).toContain("KPI unavailable or access denied"); expect(body).not.toContain("exception when"); }
  const assignment = update.split("update public.kpis set")[1].split("where id")[0]; expect(assignment).not.toMatch(/owner_id\s*=|organization_id\s*=/);
});
it("validates optional objective alignment before mutations and permits NULL clearing", () => {
  for (const name of ["create_kpi", "update_kpi"]) {
    const body = functionBody(`public.${name}`); expect(body).toContain("p_objective_id is not null and not exists");
    expect(body).toMatch(/id = p_objective_id and organization_id = (p_organization_id|v_organization_id)/);
    expect(body).toContain("Selected objective unavailable"); expect(body).toContain("errcode = '22023'");
  }
  expect(functionBody("public.update_kpi")).toContain("objective_id = p_objective_id");
});
