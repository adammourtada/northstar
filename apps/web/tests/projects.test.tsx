import { beforeEach, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

const mock = vi.hoisted(() => ({
  identity: vi.fn(), organizations: vi.fn(), cookie: vi.fn(), from: vi.fn(),
  eq: vi.fn(), rpc: vi.fn(), revalidate: vi.fn(), rows: vi.fn(), single: vi.fn(), objectives: vi.fn(),
}));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/auth", () => ({ requireIdentity: mock.identity }));
vi.mock("@/lib/organizations", () => ({ listOrganizations: async () => { await mock.identity(); return mock.organizations(); } }));
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => ({ from: mock.from, rpc: mock.rpc }) }));
vi.mock("next/headers", () => ({ cookies: async () => ({ get: mock.cookie }) }));
vi.mock("next/cache", () => ({ revalidatePath: mock.revalidate }));
vi.mock("next/navigation", () => ({ redirect: (path: string) => { throw new Error(`redirect:${path}`); }, notFound: () => { throw new Error("notFound"); } }));

import { currentProjectOrganization, listProjects, getProject, createProject, updateProject } from "@/lib/projects";
import { saveProject } from "@/app/projects/actions";
import Projects from "@/app/projects/page";
import NewProject from "@/app/projects/new/page";
import EditProject from "@/app/projects/[id]/edit/page";

const id = "11111111-1111-4111-8111-111111111111";
const objectiveId = "22222222-2222-4222-8222-222222222222";
const otherId = "33333333-3333-4333-8333-333333333333";
const organization = { id: "workspace", name: "Acme", slug: "acme", role: "owner" };
const input = { name: "Project", description: "Details", status: "planned", priority: "medium", start_date: null, target_date: null, objective_ids: [] as string[] } as const;
const row = { ...input, id, organization_id: "workspace", completed_at: null, project_objectives: [] };
const props = () => ({ params: Promise.resolve({ id }), searchParams: Promise.resolve({}) });
function form(values: Record<string, string> = {}, objectives: string[] = []) {
  const data = new FormData();
  Object.entries({ name: "Project", description: "Details", priority: "medium", status: "planned", start_date: "", target_date: "", ...values })
    .forEach(([key, value]) => data.set(key, value));
  objectives.forEach((value) => data.append("objective_ids", value)); return data;
}
beforeEach(() => {
  mock.identity.mockResolvedValue({ id: "caller" });
  mock.organizations.mockResolvedValue([organization]); mock.cookie.mockReturnValue(undefined);
  mock.rows.mockResolvedValue({ data: [row], error: null }); mock.single.mockResolvedValue({ data: row, error: null });
  mock.objectives.mockResolvedValue({ data: [{ id: objectiveId, title: "Improve service", organization_id: "workspace" }], error: null });
  mock.rpc.mockResolvedValue({ data: id, error: null });
  mock.from.mockImplementation((table: string) => {
    const query = {
      select: () => query, eq: (key: string, value: string) => { mock.eq(key, value); return query; },
      order: (key: string) => key === "created_at" ? query : table === "projects" ? mock.rows() : mock.objectives(),
      maybeSingle: mock.single,
    }; return query;
  });
});

it("requires authentication before page/action queries", async () => {
  mock.identity.mockRejectedValue(new Error("redirect:/login"));
  for (const operation of [Projects, NewProject, () => EditProject(props()), () => saveProject("workspace", null, { error: "" }, form())]) {
    await expect(operation()).rejects.toThrow("redirect:/login");
  }
  expect(mock.from).not.toHaveBeenCalled(); expect(mock.rpc).not.toHaveBeenCalled();
});
it("reuses zero/one/multiple workspace behavior without trusting the cookie", async () => {
  mock.organizations.mockResolvedValue([]);
  await expect(Projects()).rejects.toThrow("redirect:/onboarding/organization");
  mock.organizations.mockResolvedValue([organization]); mock.cookie.mockReturnValue({ value: "foreign" });
  expect(await currentProjectOrganization()).toEqual(organization);
  const other = { ...organization, id: "other" };
  mock.organizations.mockResolvedValue([organization, other]);
  await expect(Projects()).rejects.toThrow("redirect:/organizations");
  mock.cookie.mockReturnValue({ value: "other" }); expect(await currentProjectOrganization()).toEqual(other);
});
it("fails closed on membership errors and changed workspaces", async () => {
  expect((await saveProject("other", null, { error: "" }, form())).error).toContain("workspace changed");
  mock.organizations.mockResolvedValue(null);
  expect(renderToStaticMarkup(await Projects())).toContain("Unable to load organizations");
  expect((await saveProject("workspace", null, { error: "" }, form())).error).toContain("Unable to load organizations");
  expect(mock.rpc).not.toHaveBeenCalled();
});
it.each(["owner", "admin", "manager"])("allows %s to create and edit", async (role) => {
  mock.organizations.mockResolvedValue([{ ...organization, role }]);
  expect(renderToStaticMarkup(await NewProject())).toContain('name="name"');
  expect(renderToStaticMarkup(await EditProject(props()))).toContain("Save changes");
  await expect(saveProject("workspace", null, { error: "" }, form())).rejects.toThrow("redirect:/projects");
  await expect(saveProject("workspace", id, { error: "" }, form())).rejects.toThrow("redirect:/projects");
  expect(mock.rpc.mock.calls.map(([name]) => name)).toEqual(["create_project", "update_project"]);
});
it.each(["member", "viewer"])("blocks %s on create/edit URLs and forged actions", async (role) => {
  mock.organizations.mockResolvedValue([{ ...organization, role }]);
  const html = renderToStaticMarkup(await Projects());
  expect(html).toContain("read-only"); expect(html).not.toContain("New Project"); expect(html).not.toContain("/edit");
  await expect(NewProject()).rejects.toThrow("redirect:/projects");
  await expect(EditProject(props())).rejects.toThrow("redirect:/projects");
  for (const projectId of [null, id]) expect((await saveProject("workspace", projectId, { error: "" }, form({ role: "owner" }))).error).toContain("permission");
  expect(mock.rpc).not.toHaveBeenCalled();
});
it("scopes reads and joined alignment to current tenant and renders titles/completion", async () => {
  mock.rows.mockResolvedValue({ data: [{ ...row, completed_at: "2026-09-29T12:00:00Z", project_objectives: [
    { objective_id: objectiveId, strategic_objectives: { id: objectiveId, title: "Improve service" } },
    { objective_id: otherId, strategic_objectives: { id: otherId, title: "Reduce delays" } },
  ] }], error: null });
  const html = renderToStaticMarkup(await Projects());
  expect(html).toContain("Improve service"); expect(html).toContain("Reduce delays"); expect(html).toContain("Completed:");
  expect(html).not.toContain(objectiveId); expect(html).not.toContain(otherId);
  await getProject("workspace", id);
  expect(mock.eq).toHaveBeenCalledWith("organization_id", "workspace"); expect(mock.eq).toHaveBeenCalledWith("id", id);
});
it("makes missing/foreign/malformed projects unavailable without an update", async () => {
  mock.single.mockResolvedValue({ data: null, error: null });
  await expect(EditProject(props())).rejects.toThrow("notFound");
  expect((await saveProject("workspace", id, { error: "" }, form())).error).toBe("Project unavailable or access denied.");
  expect(await getProject("workspace", "invalid")).toEqual({ project: null }); expect(mock.rpc).not.toHaveBeenCalled();
});
it("rejects foreign/stale objectives before RPC using tenant-scoped choices", async () => {
  const result = await saveProject("workspace", null, { error: "" }, form({}, [otherId]));
  expect(result.error).toBe("Selected objectives are unavailable. Refresh the form and choose again.");
  expect(mock.eq).toHaveBeenCalledWith("organization_id", "workspace"); expect(mock.rpc).not.toHaveBeenCalled();
});
it.each([0, 1, 2])("supports %s objectives and deduplicates before the RPC", async (count) => {
  mock.objectives.mockResolvedValue({ data: [{ id: objectiveId }, { id: otherId }], error: null });
  const selected = [objectiveId, otherId].slice(0, count);
  await expect(saveProject("workspace", null, { error: "" }, form({}, [...selected, ...selected]))).rejects.toThrow("redirect:/projects");
  expect(mock.rpc).toHaveBeenCalledWith("create_project", expect.objectContaining({ p_objective_ids: selected }));
});
it("allowlists RPC arguments, ignoring creator, owner, completion, role and tenant spoofing", async () => {
  await expect(saveProject("workspace", null, { error: "" }, form({ created_by: "spoof", owner_id: "spoof", completed_at: "spoof", organization_id: "foreign", role: "owner" }))).rejects.toThrow("redirect:/projects");
  const payload = { p_name: "Project", p_description: "Details", p_status: "planned", p_priority: "medium", p_start_date: null, p_target_date: null, p_objective_ids: [] };
  expect(mock.rpc).toHaveBeenCalledWith("create_project", { p_organization_id: "workspace", ...payload });
  await updateProject(id, input);
  expect(mock.rpc).toHaveBeenCalledWith("update_project", { p_project_id: id, ...payload });
  expect(mock.revalidate).toHaveBeenCalledWith("/projects");
});
it("returns all editable values unchanged with validation errors", async () => {
  const values = { name: "  Keep name  ", description: "Keep\nDetails", priority: "high", status: "active", start_date: "2026-10-20", target_date: "2026-10-01" };
  expect(await saveProject("workspace", null, { error: "" }, form(values, [objectiveId]))).toEqual({
    error: "Target date must be on or after start date.", values: { ...values, objective_ids: [objectiveId] },
  });
  expect(mock.rpc).not.toHaveBeenCalled();
});
it("preselects existing relationships on edit and allows creation without objectives", async () => {
  mock.single.mockResolvedValue({ data: { ...row, project_objectives: [{ objective_id: objectiveId, strategic_objectives: { id: objectiveId, title: "Improve service" } }] }, error: null });
  expect(renderToStaticMarkup(await EditProject(props()))).toContain('checked=""');
  mock.objectives.mockResolvedValue({ data: [], error: null });
  const html = renderToStaticMarkup(await NewProject());
  expect(html).toContain("No strategic objectives available"); expect(html).toContain("Create project");
  expect(html).toContain('value="medium" selected'); expect(html).toContain('value="planned" selected');
  for (const name of ["created_by", "owner_id", "organization_id", "completed_at", "role"]) expect(html).not.toContain(`name="${name}"`);
});
it("distinguishes empty lists, no alignment, and failed queries", async () => {
  expect(renderToStaticMarkup(await Projects())).toContain("No strategic objectives linked.");
  mock.rows.mockResolvedValue({ data: [], error: null }); expect(renderToStaticMarkup(await Projects())).toContain("No projects yet.");
  mock.rows.mockResolvedValue({ data: null, error: { message: "private SQL" } });
  expect(renderToStaticMarkup(await Projects())).toContain("Unable to load projects");
  mock.objectives.mockResolvedValue({ data: null, error: { message: "private SQL" } });
  expect(renderToStaticMarkup(await NewProject())).not.toContain('name="name"');
  expect((await saveProject("workspace", null, { error: "" }, form())).error).toContain("Unable to load strategic objectives");
});
it("maps database and network errors safely, including stale selection races", async () => {
  for (const code of ["22023", "23503"]) {
    mock.rpc.mockResolvedValue({ data: null, error: { code, message: "foreign UUID exists" } });
    expect((await createProject("workspace", input)).error).toBe("Selected objectives are unavailable. Refresh the form and choose again.");
  }
  mock.rpc.mockRejectedValue(new Error("private connection"));
  expect((await updateProject(id, input)).error).toBe("Unable to save project. Please try again.");
  mock.single.mockResolvedValue({ data: null, error: { message: "private SQL" } });
  expect(renderToStaticMarkup(await EditProject(props()))).not.toContain("private SQL");
  mock.from.mockImplementation(() => { throw new Error("private"); }); expect(await listProjects("workspace")).toBeNull();
});
