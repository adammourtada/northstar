import { readFileSync } from "node:fs";
import { expect, it } from "vitest";
const sql = readFileSync(new URL("../../../database/migrations/202609290006_risks.sql",import.meta.url),"utf8");
const body = (name: string) => sql.split(`create function ${name}(`)[1].split("$$;")[0];
it("is manual, transactional and enforces bounds, text limits and database timestamps", () => {
  expect(sql).toContain("current_user <> 'postgres'"); expect(sql.trim()).toMatch(/commit;$/);
  for(const fragment of ["title text not null","probability integer not null","impact integer not null","probability between 1 and 5","impact between 1 and 5","'open', 'monitoring', 'mitigated', 'accepted', 'closed'","char_length(title) between 1 and 200","char_length(description) <= 5000","char_length(mitigation_plan) <= 5000","pg_catalog.isfinite(review_date)","identified_at timestamptz not null default now()","execute function northstar_private.set_updated_at()"]) expect(sql).toContain(fragment);
  expect(sql).not.toMatch(/exposure\s+(integer|numeric)|p_(identified_at|created_at|updated_at|exposure)|delete_risk/);
});
it("enforces owner membership and every link with same-tenant composite foreign keys", () => {
  expect(sql).toMatch(/foreign key \(organization_id, owner_id\)\s+references public.organization_members\(organization_id, user_id\)/);
  expect(sql).toContain("unique (organization_id, id)");
  for(const target of ["public.risks(organization_id, id)","public.projects(organization_id, id)","public.strategic_objectives(organization_id, id)"]) expect(sql).toContain("references "+target);
  expect(sql.match(/foreign key \(organization_id,/g)).toHaveLength(5);
  expect(sql).toContain("unique (risk_id, project_id)"); expect(sql).toContain("unique (risk_id, objective_id)");
  const links=body("northstar_private.replace_risk_links");
  expect(links).toContain("p_project_ids is null or p_objective_ids is null");
  expect(links).toContain("project.organization_id = p_organization_id"); expect(links).toContain("objective.organization_id = p_organization_id");
  expect(links.match(/select distinct id/g)).toHaveLength(2);
});
it("allows membership SELECT only and revokes default table and function privileges", () => {
  for(const table of ["risks","risk_projects","risk_objectives"]) expect(sql).toContain(`alter table public.${table} enable row level security`);
  expect(sql.match(/using \(northstar_private.is_organization_member\(organization_id\)\)/g)).toHaveLength(3);
  expect(sql).toContain("revoke all on table public.risks, public.risk_projects, public.risk_objectives\nfrom public, anon, authenticated, service_role");
  expect(sql).toContain("grant select on table public.risks, public.risk_projects, public.risk_objectives to authenticated");
  expect(sql).not.toMatch(/create policy[^;]+for (insert|update|delete)|grant (all|insert|update|delete)[^;]+to authenticated/i);
  for(const fragment of ["northstar_private.can_manage_risks(uuid)","northstar_private.replace_risk_links(uuid, uuid, uuid[], uuid[])","public.create_risk(uuid, text, text, uuid, integer, integer, text, text, date, uuid[], uuid[])","public.update_risk(uuid, text, text, uuid, integer, integer, text, text, date, uuid[], uuid[])"]) expect(sql).toContain("revoke all on function "+fragment);
  expect(sql.match(/grant execute on function public\./g)).toHaveLength(2);
});
it("authorizes definer RPCs, validates owners and serializes atomic updates", () => {
  expect(sql.match(/security definer/g)).toHaveLength(3); expect(sql.match(/set search_path = ''/g)).toHaveLength(4);
  expect(body("northstar_private.can_manage_risks")).toContain("membership.user_id = (select auth.uid())");
  expect(body("northstar_private.can_manage_risks")).toContain("membership.role in ('owner', 'admin', 'manager')");
  for(const name of ["create_risk","update_risk"]) {
    const rpc=body("public."+name);
    expect(rpc).toContain("auth.uid() is null"); expect(rpc).toContain("northstar_private.can_manage_risks(");
    expect(rpc).toContain("p_owner_id is not null and not exists"); expect(rpc).toContain("user_id = p_owner_id");
    expect(rpc).toContain("perform northstar_private.replace_risk_links("); expect(rpc).not.toContain("exception when");
  }
  const update=body("public.update_risk"); expect(update).toContain("for update");
  const assignments=update.split("update public.risks set")[1].split("where id")[0];
  expect(assignments).not.toMatch(/organization_id\s*=|identified_at\s*=|created_at\s*=/);
});
