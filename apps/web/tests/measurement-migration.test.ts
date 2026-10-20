import { readFileSync } from "node:fs";
import { expect, it } from "vitest";
const sql = readFileSync(new URL("../../../database/migrations/202609290005_kpi_measurements.sql", import.meta.url), "utf8");
it("is a manual transactional forward migration with same-tenant foreign keys", () => {
  expect(sql).toContain("current_user <> 'postgres'");
  expect(sql.trim()).toMatch(/commit;$/);
  expect(sql).toContain("unique (organization_id, id)");
  expect(sql).toMatch(/foreign key \(organization_id, kpi_id\)\s+references public.kpis\(organization_id, id\)/);
  for (const fragment of ["organization_id uuid not null references public.organizations(id)", "recorded_by uuid not null references public.profiles(id)", "value numeric not null", "measured_at timestamptz not null", "created_at timestamptz not null default now()"]) expect(sql).toContain(fragment);
});
it("rejects nonfinite, out-of-range, overprecision and invalid notes without rounding", () => {
  for (const fragment of ["'NaN', 'Infinity', '-Infinity'", "abs(value) < 100000000000000000000", "scale(value) <= 10", "pg_catalog.isfinite(measured_at)", "char_length(notes) <= 5000"]) expect(sql).toContain(fragment);
  expect(sql).not.toMatch(/numeric\(|round\(/);
  expect(sql).toContain("(organization_id, kpi_id, measured_at desc, created_at desc, id desc)");
});
it("grants only membership SELECT and the creation RPC to authenticated users", () => {
  expect(sql).toContain("alter table public.kpi_measurements enable row level security");
  expect(sql).toContain("using (northstar_private.is_organization_member(organization_id))");
  expect(sql).toContain("revoke all on table public.kpi_measurements from public, anon, authenticated, service_role");
  expect(sql).toContain("grant select on table public.kpi_measurements to authenticated");
  expect(sql).toContain("revoke all on function public.create_kpi_measurement(uuid, uuid, numeric, timestamptz, text)");
  expect(sql).toContain("grant execute on function public.create_kpi_measurement(uuid, uuid, numeric, timestamptz, text) to authenticated");
  expect(sql).not.toMatch(/create policy[^;]+for (insert|update|delete)|grant (all|insert|update|delete)[^;]+to authenticated/i);
});
it("independently authorizes membership and management and controls recorder identity", () => {
  for (const fragment of ["security definer", "set search_path = ''", "v_user_id uuid := auth.uid()", "not northstar_private.is_organization_member(p_organization_id)", "not northstar_private.can_manage_kpis(p_organization_id)", "kpi.id = p_kpi_id and kpi.organization_id = p_organization_id", "p_measured_at, v_user_id", "KPI unavailable or access denied"]) expect(sql).toContain(fragment);
  expect(sql).not.toMatch(/p_recorded_by|p_user_id|p_role|create function public.(update|delete)|update public.kpi_measurements|delete from public.kpi_measurements/);
  const prior = readFileSync(new URL("../../../database/migrations/202609290004_kpis.sql", import.meta.url), "utf8");
  expect(prior).toContain("membership.role in ('owner', 'admin', 'manager')");
});
