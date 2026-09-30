import { beforeEach, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

const mock = vi.hoisted(() => ({
  requireIdentity: vi.fn(), organizations: vi.fn(), cookie: vi.fn(),
  from: vi.fn(), select: vi.fn(), eq: vi.fn(), order: vi.fn(), single: vi.fn(), rpc: vi.fn(), revalidate: vi.fn(),
}));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/auth", () => ({ requireIdentity: mock.requireIdentity }));
vi.mock("@/lib/organizations", () => ({ listOrganizations: async () => { await mock.requireIdentity(); return mock.organizations(); } }));
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => ({ from: mock.from, rpc: mock.rpc }) }));
vi.mock("next/headers", () => ({ cookies: async () => ({ get: mock.cookie }) }));
vi.mock("next/cache", () => ({ revalidatePath: mock.revalidate }));
vi.mock("next/navigation", () => ({ redirect: (path: string) => { throw new Error(`redirect:${path}`); }, notFound: () => { throw new Error("notFound"); } }));

import { currentObjectiveOrganization, createObjective, updateObjective, listObjectives, getObjective } from "@/lib/objectives";
import { saveObjective } from "@/app/objectives/actions";
import Objectives from "@/app/objectives/page";
import NewObjective from "@/app/objectives/new/page";
import EditObjective from "@/app/objectives/[id]/edit/page";

const organization = { id: "a", name: "Acme", slug: "acme", role: "owner" };
const input = { title: "Goal", description: "Details", priority: "medium", status: "draft", progress_percent: 0, start_date: null, target_date: null } as const;
const objective = { ...input, id: "objective", organization_id: "a" };
const props = () => ({ params: Promise.resolve({ id: "objective" }), searchParams: Promise.resolve({}) });
const form = (overrides: Record<string, string> = {}) => {
  const result = new FormData();
  Object.entries({ ...input, ...overrides }).forEach(([key, value]) => result.set(key, value === null ? "" : String(value)));
  return result;
};

beforeEach(() => {
  mock.requireIdentity.mockResolvedValue({ id: "caller" });
  mock.organizations.mockResolvedValue([organization]);
  mock.cookie.mockReturnValue(undefined);
  const query = { select: mock.select, eq: mock.eq, order: mock.order, maybeSingle: mock.single };
  mock.from.mockReturnValue(query); mock.select.mockReturnValue(query); mock.eq.mockReturnValue(query);
  mock.order.mockImplementation((column: string) => column === "created_at" ? query : Promise.resolve({ data: [objective], error: null }));
  mock.single.mockResolvedValue({ data: objective, error: null });
  mock.rpc.mockResolvedValue({ data: "objective", error: null });
});

it("requires authentication for list, create/edit pages and actions", async () => {
  mock.requireIdentity.mockRejectedValue(new Error("redirect:/login"));
  for (const operation of [Objectives, NewObjective, () => EditObjective(props()), () => saveObjective("a", null, { error: "" }, form())]) {
    await expect(operation()).rejects.toThrow("redirect:/login");
  }
  expect(mock.from).not.toHaveBeenCalled(); expect(mock.rpc).not.toHaveBeenCalled();
});
it("uses existing zero/one/multiple workspace selection behavior", async () => {
  mock.organizations.mockResolvedValue([]);
  await expect(Objectives()).rejects.toThrow("redirect:/onboarding/organization");
  mock.organizations.mockResolvedValue([organization]); mock.cookie.mockReturnValue({ value: "foreign" });
  expect(await currentObjectiveOrganization()).toEqual(organization);
  const other = { ...organization, id: "b" };
  mock.organizations.mockResolvedValue([organization, other]);
  await expect(Objectives()).rejects.toThrow("redirect:/organizations");
  mock.cookie.mockReturnValue({ value: "b" });
  expect(await currentObjectiveOrganization()).toEqual(other);
});
it("fails closed when memberships cannot be loaded", async () => {
  mock.organizations.mockResolvedValue(null);
  expect(renderToStaticMarkup(await Objectives())).toContain("Unable to load organizations");
  expect((await saveObjective("a", null, { error: "" }, form())).error).toContain("Unable to load organizations");
  expect(mock.rpc).not.toHaveBeenCalled(); expect(mock.from).not.toHaveBeenCalled();
});
it("scopes list and detail reads to the validated workspace", async () => {
  const html = renderToStaticMarkup(await Objectives());
  expect(html).toContain("Acme"); expect(html).toContain("Goal"); expect(html).toContain("New Objective"); expect(html).toContain("<progress");
  expect(mock.eq).toHaveBeenCalledWith("organization_id", "a");
  await getObjective("a", "objective");
  expect(mock.eq).toHaveBeenCalledWith("id", "objective");
});
it.each(["owner", "admin", "manager"])("allows %s to create and edit", async (role) => {
  mock.organizations.mockResolvedValue([{ ...organization, role }]);
  expect(renderToStaticMarkup(await NewObjective())).toContain('name="title"');
  expect(renderToStaticMarkup(await EditObjective(props()))).toContain("Save changes");
  await expect(saveObjective("a", null, { error: "" }, form())).rejects.toThrow("redirect:/objectives");
  await expect(saveObjective("a", "objective", { error: "" }, form())).rejects.toThrow("redirect:/objectives");
  expect(mock.rpc.mock.calls.map(([name]) => name)).toEqual(["create_strategic_objective", "update_strategic_objective"]);
});
it.each(["member", "viewer"])("blocks %s on pages and forged server actions", async (role) => {
  mock.organizations.mockResolvedValue([{ ...organization, role }]);
  const html = renderToStaticMarkup(await Objectives());
  expect(html).toContain("read-only"); expect(html).not.toContain("New Objective"); expect(html).not.toContain("/edit");
  await expect(NewObjective()).rejects.toThrow("redirect:/objectives");
  await expect(EditObjective(props())).rejects.toThrow("redirect:/objectives");
  for (const id of [null, "objective"]) expect((await saveObjective("a", id, { error: "" }, form({ role: "owner" }))).error).toContain("permission");
  expect(mock.rpc).not.toHaveBeenCalled();
});
it("rejects foreign/missing objectives identically and prevents update RPC calls", async () => {
  mock.single.mockResolvedValue({ data: null, error: null });
  await expect(EditObjective(props())).rejects.toThrow("notFound");
  expect((await saveObjective("a", "foreign", { error: "" }, form())).error).toBe("Objective unavailable or access denied.");
  expect(mock.rpc).not.toHaveBeenCalled();
});
it("rejects changed workspaces and invalid input before saving", async () => {
  expect((await saveObjective("b", null, { error: "" }, form())).error).toContain("workspace changed");
  expect((await saveObjective("a", null, { error: "" }, form({ title: " " }))).error).toContain("title");
  expect(mock.rpc).not.toHaveBeenCalled();
});
it("preserves every submitted editable value when date validation fails", async () => {
  const values = {
    title: "  Keep my title  ", description: "Details\nSecond line", priority: "critical", status: "at_risk",
    progress_percent: "37", start_date: "2026-10-20", target_date: "2026-10-01",
  };
  const result = await saveObjective("a", null, { error: "" }, form({ ...values, owner_id: "private", role: "owner" }));
  expect(result).toEqual({ error: "Target date must be on or after start date.", values });
  expect(mock.rpc).not.toHaveBeenCalled();
  expect(mock.revalidate).not.toHaveBeenCalled();
});
it("sends only allowlisted application inputs to RPCs", async () => {
  await expect(saveObjective("a", null, { error: "" }, form({ title: " Goal ", created_by: "spoof", owner_id: "spoof", organization_id: "foreign", user_id: "spoof", role: "owner" }))).rejects.toThrow("redirect:/objectives");
  const payload = { p_organization_id: "a", p_title: "Goal", p_description: "Details", p_priority: "medium", p_status: "draft", p_progress_percent: 0, p_start_date: null, p_target_date: null };
  expect(mock.rpc).toHaveBeenCalledWith("create_strategic_objective", payload);
  await updateObjective("objective", input);
  const { p_organization_id: omitted, ...fields } = payload;
  expect(omitted).toBe("a");
  expect(mock.rpc).toHaveBeenCalledWith("update_strategic_objective", { p_objective_id: "objective", ...fields });
  expect(mock.revalidate).toHaveBeenCalledWith("/objectives");
});
it("renders real empty states and distinguishes load errors", async () => {
  mock.order.mockReturnValue({ order: async () => ({ data: [], error: null }) });
  expect(renderToStaticMarkup(await Objectives())).toContain("No strategic objectives yet");
  mock.from.mockImplementation(() => { throw new Error("sensitive database details"); });
  const html = renderToStaticMarkup(await Objectives());
  expect(html).toContain("Unable to load objectives"); expect(html).not.toContain("No strategic objectives yet"); expect(html).not.toContain("sensitive");
});
it("uses safe errors for query, RPC and network failures", async () => {
  mock.single.mockResolvedValue({ data: null, error: { message: "sensitive SQL" } });
  expect(renderToStaticMarkup(await EditObjective(props()))).not.toContain("sensitive SQL");
  mock.rpc.mockResolvedValue({ data: null, error: { code: "42501", message: "sensitive SQL" } });
  expect((await createObjective("a", input)).error).toContain("permission");
  mock.rpc.mockRejectedValue(new Error("secret connection"));
  expect((await updateObjective("objective", input)).error).toBe("Unable to save objective. Please try again.");
  mock.from.mockImplementation(() => { throw new Error("private"); });
  expect(await listObjectives("a")).toBeNull();
});
it("uses creation defaults and exposes no attribution form fields", async () => {
  const html = renderToStaticMarkup(await NewObjective());
  expect(html).toContain('value="medium" selected'); expect(html).toContain('value="draft" selected');
  expect(html).toContain('name="progress_percent"');
  for (const field of ["organization_id", "owner_id", "created_by", "role"]) expect(html).not.toContain(`name="${field}"`);
});
