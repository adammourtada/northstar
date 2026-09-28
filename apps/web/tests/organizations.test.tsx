import { beforeEach, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

const mock = vi.hoisted(() => ({
  identity: { id: "caller", email: "person@example.com" },
  requireIdentity: vi.fn(), from: vi.fn(), rpc: vi.fn(), eq: vi.fn(), in: vi.fn(), order: vi.fn(),
  cookieGet: vi.fn(), cookieSet: vi.fn(), cookieDelete: vi.fn(),
}));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/auth", () => ({ requireIdentity: mock.requireIdentity }));
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => ({ from: mock.from, rpc: mock.rpc }) }));
vi.mock("next/navigation", () => ({ redirect: (path: string) => { throw new Error(`redirect:${path}`); } }));
vi.mock("next/headers", () => ({ cookies: async () => ({ get: mock.cookieGet, set: mock.cookieSet, delete: mock.cookieDelete }) }));

import { listOrganizations, createOrganization } from "@/lib/organizations";
import { createOrganizationAction, selectOrganization } from "@/app/organizations/actions";
import Application from "@/app/app/page";
import Onboarding from "@/app/onboarding/organization/page";
import Organizations from "@/app/organizations/page";

const a = { id: "a", name: "Acme", slug: "acme" };
const b = { id: "b", name: "Other", slug: "other" };
const props = () => ({ params: Promise.resolve({}), searchParams: Promise.resolve({}) });
const form = (values: Record<string, string>) => {
  const result = new FormData(); Object.entries(values).forEach(([key, value]) => result.set(key, value)); return result;
};

beforeEach(() => {
  mock.requireIdentity.mockResolvedValue(mock.identity);
  mock.from.mockImplementation((table: string) => ({ select: () => table === "organization_members" ? { eq: mock.eq } : { in: mock.in } }));
  mock.eq.mockResolvedValue({ data: [{ organization_id: "a", role: "owner" }], error: null });
  mock.in.mockReturnValue({ order: mock.order });
  mock.order.mockResolvedValue({ data: [a], error: null });
  mock.rpc.mockResolvedValue({ data: "a", error: null });
  mock.cookieGet.mockReturnValue(undefined);
});

it("loads the caller's memberships and derives roles from those rows", async () => {
  expect(await listOrganizations()).toEqual([{ ...a, role: "owner" }]);
  expect(mock.eq).toHaveBeenCalledWith("user_id", "caller");
  expect(mock.in).toHaveBeenCalledWith("id", ["a"]);
});
it("fails closed on database errors without leaking details", async () => {
  mock.eq.mockResolvedValue({ data: null, error: { message: "private database details" } });
  expect(await listOrganizations()).toBeNull();
  const html = renderToStaticMarkup(await Application(props()));
  expect(html).toContain("Unable to load organizations");
  expect(html).not.toContain("private database details");
});
it("treats an organization query failure as an error rather than no memberships", async () => {
  mock.order.mockResolvedValue({ data: null, error: { message: "private" } });
  expect(await listOrganizations()).toBeNull();
});
it("requires identity before database calls on pages and actions", async () => {
  mock.requireIdentity.mockRejectedValue(new Error("redirect:/login"));
  for (const operation of [() => Application(props()), Onboarding, () => Organizations(props()),
    () => createOrganizationAction({ error: "" }, form({})), () => selectOrganization(form({ organization: "a" }))]) {
    await expect(operation()).rejects.toThrow("redirect:/login");
  }
  expect(mock.from).not.toHaveBeenCalled();
  expect(mock.rpc).not.toHaveBeenCalled();
});
it("routes zero memberships to onboarding and renders the creation form", async () => {
  mock.eq.mockResolvedValue({ data: [], error: null });
  await expect(Application(props())).rejects.toThrow("redirect:/onboarding/organization");
  await expect(Organizations(props())).rejects.toThrow("redirect:/onboarding/organization");
  const html = renderToStaticMarkup(await Onboarding());
  expect(html).toContain('name="name"'); expect(html).toContain('name="slug"');
  expect(html).not.toContain('name="role"');
});
it("automatically enters the only organization and excludes identity internals", async () => {
  mock.cookieGet.mockReturnValue({ value: "foreign" });
  const html = renderToStaticMarkup(await Application(props()));
  expect(html).toContain("Acme"); expect(html).toContain("owner"); expect(html).toContain("person@example.com");
  expect(html).not.toContain("caller"); expect(html).not.toContain("Switch organization");
  await expect(Onboarding()).rejects.toThrow("redirect:/app");
});
it("requires a valid selection for multiple memberships and permits switching", async () => {
  mock.eq.mockResolvedValue({ data: [{ organization_id: "a", role: "owner" }, { organization_id: "b", role: "viewer" }], error: null });
  mock.order.mockResolvedValue({ data: [a, b], error: null });
  mock.cookieGet.mockReturnValue({ value: "foreign" });
  await expect(Application(props())).rejects.toThrow("redirect:/organizations");
  const chooser = renderToStaticMarkup(await Organizations(props()));
  expect(chooser).toContain("Acme"); expect(chooser).toContain("Other"); expect(chooser).toContain("viewer");
  mock.cookieGet.mockReturnValue({ value: "b" });
  const html = renderToStaticMarkup(await Application(props()));
  expect(html).toContain("Other"); expect(html).toContain("viewer"); expect(html).toContain("Switch organization");
});
it("rejects a guessed workspace and clears the preference", async () => {
  await expect(selectOrganization(form({ organization: "foreign", user_id: "other-user" }))).rejects.toThrow("redirect:/organizations?error=selection");
  expect(mock.cookieSet).not.toHaveBeenCalled();
  expect(mock.cookieDelete).toHaveBeenCalledWith("northstar-organization");
  expect(mock.eq).toHaveBeenCalledWith("user_id", "caller");
});
it("sets a secure preference only after membership validation", async () => {
  await expect(selectOrganization(form({ organization: "a" }))).rejects.toThrow("redirect:/app");
  expect(mock.cookieSet).toHaveBeenCalledWith("northstar-organization", "a", expect.objectContaining({ httpOnly: true, sameSite: "lax", path: "/" }));
});
it("creates only via RPC with the two application fields", async () => {
  await createOrganization({ name: "Acme", slug: "acme" });
  expect(mock.requireIdentity).toHaveBeenCalled();
  expect(mock.rpc).toHaveBeenCalledWith("create_organization", { p_name: "Acme", p_slug: "acme" });
  expect(mock.from).not.toHaveBeenCalled();
});
it("validates before RPC and ignores client ownership fields", async () => {
  mock.eq.mockResolvedValue({ data: [], error: null });
  const result = await createOrganizationAction({ error: "" }, form({ name: " ", slug: "bad slug" }));
  expect(result.error).toContain("Enter an organization name"); expect(mock.rpc).not.toHaveBeenCalled();
  await expect(createOrganizationAction({ error: "" }, form({ name: " Acme ", slug: "acme", created_by: "other", role: "admin" }))).rejects.toThrow("redirect:/app");
  expect(mock.rpc).toHaveBeenCalledWith("create_organization", { p_name: "Acme", p_slug: "acme" });
  expect(mock.cookieSet).toHaveBeenCalledWith("northstar-organization", "a", expect.any(Object));
});
it("redirects existing members out of first-organization creation", async () => {
  await expect(createOrganizationAction({ error: "" }, form({ name: "Acme", slug: "acme" }))).rejects.toThrow("redirect:/app");
  expect(mock.rpc).not.toHaveBeenCalled();
});
it.each([
  ["23505", "This organization URL is already in use."],
  ["42501", "Unable to create organization. Please try again."],
])("maps RPC error %s to a safe message", async (code, message) => {
  mock.rpc.mockResolvedValue({ data: null, error: { code, message: "sensitive SQL" } });
  expect(await createOrganization({ name: "Acme", slug: "acme" })).toEqual({ error: message });
});
it("handles network failures without exposing exceptions", async () => {
  mock.rpc.mockRejectedValue(new Error("private connection details"));
  expect(await createOrganization({ name: "Acme", slug: "acme" })).toEqual({ error: "Unable to create organization. Please try again." });
});
