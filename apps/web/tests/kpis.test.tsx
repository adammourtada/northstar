import { beforeEach, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
const mock = vi.hoisted(() => ({ identity: vi.fn(), organizations: vi.fn(), cookie: vi.fn(), from: vi.fn(), select: vi.fn(), eq: vi.fn(), order: vi.fn(), single: vi.fn(), rpc: vi.fn(), revalidate: vi.fn(), rows: [] as unknown[] }));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/auth", () => ({ requireIdentity: mock.identity }));
vi.mock("@/lib/organizations", () => ({ listOrganizations: async () => { await mock.identity(); return mock.organizations(); } }));
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => ({ from: mock.from, rpc: mock.rpc }) }));
vi.mock("next/headers", () => ({ cookies: async () => ({ get: mock.cookie }) }));
vi.mock("next/cache", () => ({ revalidatePath: mock.revalidate }));
vi.mock("next/navigation", () => ({ redirect: (path: string) => { throw new Error(`redirect:${path}`); }, notFound: () => { throw new Error("notFound"); } }));
import { listKpis, getKpi, createKpi, updateKpi, currentKpiOrganization } from "@/lib/kpis";
import { saveKpi } from "@/app/kpis/actions";
import Kpis from "@/app/kpis/page";
import NewKpi from "@/app/kpis/new/page";
import EditKpi from "@/app/kpis/[id]/edit/page";
const id = "11111111-1111-1111-1111-111111111111";
const objectiveId = "22222222-2222-2222-2222-222222222222";
const organization = { id: "a", name: "Acme", slug: "acme", role: "owner" };
const input = { name: "Response time", description: "Details", unit: "hours", target_value: "12345678901234567890.1234567890", direction: "decrease", status: "active", reporting_frequency: "monthly", objective_id: null } as const;
const row = { ...input, id, organization_id: "a", strategic_objectives: null };
const props = () => ({ params: Promise.resolve({ id }), searchParams: Promise.resolve({}) });
const form = (changes: Record<string, string> = {}) => {
  const data = new FormData(); Object.entries({ ...input, ...changes }).forEach(([k,v]) => data.set(k, v ?? "")); return data;
};
beforeEach(() => {
  mock.identity.mockResolvedValue({ id: "caller" }); mock.organizations.mockResolvedValue([organization]); mock.cookie.mockReturnValue(undefined);
  mock.rows = [row];
  const query = { select: mock.select, eq: mock.eq, order: mock.order, maybeSingle: mock.single };
  mock.from.mockReturnValue(query); mock.select.mockReturnValue(query); mock.eq.mockReturnValue(query);
  mock.order.mockImplementation((column: string) => column === "created_at" ? query : Promise.resolve({ data: mock.rows, error: null }));
  mock.single.mockResolvedValue({ data: row, error: null }); mock.rpc.mockResolvedValue({ data: id, error: null });
});
it("requires identity for routes, actions and data access", async () => {
  mock.identity.mockRejectedValue(new Error("redirect:/login"));
  for (const operation of [Kpis, NewKpi, () => EditKpi(props()), () => saveKpi("a", null, { error: "" }, form()), () => listKpis("a"), () => createKpi("a", input), () => updateKpi(id, input)]) await expect(operation()).rejects.toThrow("redirect:/login");
  expect(mock.from).not.toHaveBeenCalled(); expect(mock.rpc).not.toHaveBeenCalled();
});
it("validates the organization cookie against memberships", async () => {
  mock.cookie.mockReturnValue({ value: "foreign" }); expect(await currentKpiOrganization()).toEqual(organization);
  mock.organizations.mockResolvedValue([organization, { ...organization, id: "b" }]); await expect(currentKpiOrganization()).rejects.toThrow("redirect:/organizations");
  mock.organizations.mockResolvedValue([]); await expect(Kpis()).rejects.toThrow("redirect:/onboarding/organization");
});
it("fails closed on membership lookup errors", async () => {
  mock.organizations.mockResolvedValue(null); expect(renderToStaticMarkup(await Kpis())).toContain("Unable to load organizations");
  expect((await saveKpi("a", null, { error: "" }, form())).error).toContain("Unable to load organizations"); expect(mock.rpc).not.toHaveBeenCalled();
});
it("scopes reads and preserves numeric text", async () => {
  const html = renderToStaticMarkup(await Kpis()); expect(html).toContain(input.target_value); expect(html).toContain("No objective");
  expect(mock.eq).toHaveBeenCalledWith("organization_id", "a"); expect(mock.select.mock.calls[0][0]).toContain("target_value::text");
  await getKpi("a", id); expect(mock.eq).toHaveBeenCalledWith("id", id);
});
it.each(["owner", "admin", "manager"])("allows %s create/update through RPCs", async role => {
  mock.organizations.mockResolvedValue([{ ...organization, role }]);
  expect(renderToStaticMarkup(await NewKpi())).toContain('name="unit"'); expect(renderToStaticMarkup(await EditKpi(props()))).toContain("Save changes");
  await expect(saveKpi("a", null, { error: "" }, form())).rejects.toThrow("redirect:/kpis");
  await expect(saveKpi("a", id, { error: "" }, form())).rejects.toThrow("redirect:/kpis");
  expect(mock.rpc.mock.calls.map(([name]) => name)).toEqual(["create_kpi", "update_kpi"]);
});
it.each(["member", "viewer"])("keeps %s read-only on direct URLs and forged actions", async role => {
  mock.organizations.mockResolvedValue([{ ...organization, role }]); const html = renderToStaticMarkup(await Kpis());
  expect(html).toContain("read-only"); expect(html).not.toContain("New KPI"); expect(html).not.toContain("/edit");
  await expect(NewKpi()).rejects.toThrow("redirect:/kpis"); await expect(EditKpi(props())).rejects.toThrow("redirect:/kpis");
  for (const kpiId of [null, id]) expect((await saveKpi("a", kpiId, { error: "" }, form({ role: "owner" }))).error).toContain("permission");
  expect(mock.rpc).not.toHaveBeenCalled();
});
it("rejects foreign/missing KPIs and malformed IDs before update", async () => {
  mock.single.mockResolvedValue({ data: null, error: null }); await expect(EditKpi(props())).rejects.toThrow("notFound");
  expect((await saveKpi("a", id, { error: "" }, form())).error).toContain("unavailable");
  expect(await getKpi("a", "invalid")).toEqual({ kpi: null }); expect(mock.rpc).not.toHaveBeenCalled();
});
it("rejects switched workspace submissions", async () => {
  expect((await saveKpi("b", null, { error: "" }, form())).error).toContain("workspace changed"); expect(mock.rpc).not.toHaveBeenCalled();
});
it("accepts only eligible same-organization objectives and permits clearing", async () => {
  mock.rows = [{ id: objectiveId, title: "Customer experience" }];
  await expect(saveKpi("a", null, { error: "" }, form({ objective_id: objectiveId }))).rejects.toThrow("redirect:/kpis");
  expect(mock.from).toHaveBeenCalledWith("strategic_objectives"); expect(mock.eq).toHaveBeenCalledWith("organization_id", "a");
  expect(mock.rpc.mock.calls[0][1].p_objective_id).toBe(objectiveId);
  await expect(saveKpi("a", id, { error: "" }, form({ objective_id: "" }))).rejects.toThrow("redirect:/kpis");
  expect(mock.rpc.mock.calls[1][1].p_objective_id).toBeNull();
});
it("rejects foreign objectives and preserves all submitted fields", async () => {
  mock.rows = []; const data = form({ objective_id: objectiveId });
  expect(await saveKpi("a", null, { error: "" }, data)).toEqual({ error: "Selected objective is unavailable. Refresh the form and choose again.", values: Object.fromEntries(data) }); expect(mock.rpc).not.toHaveBeenCalled();
});
it.each(["validation", "database"])("preserves every field after %s errors", async kind => {
  const data = form({ name: kind === "validation" ? " " : " Keep ", target_value: "0.1234567890", status: "paused", reporting_frequency: "weekly", direction: "maintain" });
  mock.rpc.mockResolvedValue({ data: null, error: { code: "23514", message: "private database details" } });
  const result = await saveKpi("a", null, { error: "" }, data); expect(result.values).toEqual(Object.fromEntries(data)); expect(result.error).not.toContain("private database"); expect(mock.revalidate).not.toHaveBeenCalled();
});
it("allowlists RPC fields and never sends owner, role, or client organization IDs", async () => {
  await expect(saveKpi("a", null, { error: "" }, form({ owner_id: "spoof", organization_id: "foreign", role: "owner" }))).rejects.toThrow("redirect:/kpis");
  expect(mock.rpc).toHaveBeenCalledWith("create_kpi", { p_organization_id: "a", p_name: input.name, p_description: input.description, p_unit: input.unit, p_target_value: input.target_value, p_direction: input.direction, p_status: input.status, p_reporting_frequency: input.reporting_frequency, p_objective_id: null });
  await updateKpi(id, input); const payload = mock.rpc.mock.calls[1][1]; expect(payload.p_kpi_id).toBe(id); expect(payload).not.toHaveProperty("p_organization_id"); expect(payload).not.toHaveProperty("p_owner_id");
});
it("renders empty and load-error states distinctly", async () => {
  mock.rows = []; expect(renderToStaticMarkup(await Kpis())).toContain("No KPIs yet.");
  mock.order.mockRejectedValue(new Error("private")); const html = renderToStaticMarkup(await Kpis()); expect(html).toContain("Unable to load KPIs"); expect(html).not.toContain("No KPIs yet");
});
it("shows linked objective titles and fails closed if a linked title is unavailable", async () => {
  mock.rows = [{ ...row, objective_id: objectiveId, strategic_objectives: { id: objectiveId, title: "Customer experience" } }];
  expect(renderToStaticMarkup(await Kpis())).toContain("Objective: Customer experience");
  mock.rows = [{ ...row, objective_id: objectiveId }]; expect(await listKpis("a")).toBeNull();
});
it("returns safe failures for detail, RPC and objective-load errors", async () => {
  mock.single.mockResolvedValue({ data: null, error: { message: "private" } }); expect((await getKpi("a", id)).error).toContain("Unable to load KPI");
  mock.rpc.mockRejectedValue(new Error("private")); expect((await createKpi("a", input)).error).toBe("Unable to save KPI. Please try again.");
  mock.order.mockRejectedValue(new Error("private")); expect(renderToStaticMarkup(await NewKpi())).toContain("Unable to load objectives");
});
