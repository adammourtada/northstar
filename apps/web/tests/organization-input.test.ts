import { describe, expect, it } from "vitest";
import { normalizeSlug, isValidSlug, organizationInput, organizationDestination } from "@/lib/organization-input";

describe("organization input", () => {
  it.each([
    ["Acme Consulting", "acme-consulting"],
    ["  Northstar Strategy Group  ", "northstar-strategy-group"],
    ["Crème & Café__Group---", "creme-cafe-group"],
    ["--- A   B _ C !!!", "a-b-c"],
    ["你好 !!!", ""],
  ])("normalizes %s", (input, expected) => expect(normalizeSlug(input)).toBe(expected));
  it.each(["a", "acme-123", "northstar-strategy-group"])("accepts %s", (slug) => expect(isValidSlug(slug)).toBe(true));
  it.each(["", " ", "Acme", "-acme", "acme-", "a--b", "a_b", "a/b", "a.b", "café", "a\nb"])("rejects %s", (slug) => expect(isValidSlug(slug)).toBe(false));
  it("trims valid input and ignores ownership fields", () => {
    const form = new FormData();
    form.set("name", " Acme "); form.set("slug", " acme "); form.set("created_by", "attacker"); form.set("role", "admin");
    expect(organizationInput(form)).toEqual({ name: "Acme", slug: "acme" });
  });
  it.each([["", "acme"], ["  ", "acme"], ["Acme", ""], ["Acme", "NOT VALID"]])("rejects invalid form input", (name, slug) => {
    const form = new FormData(); form.set("name", name); form.set("slug", slug);
    expect(organizationInput(form)).toBeNull();
  });
  it("rejects missing and file inputs", () => {
    const form = new FormData();
    expect(organizationInput(form)).toBeNull();
    form.set("name", new Blob(["Acme"])); form.set("slug", "acme");
    expect(organizationInput(form)).toBeNull();
  });
});

describe("workspace decisions", () => {
  const a = { id: "a", name: "A", slug: "a", role: "owner" };
  const b = { id: "b", name: "B", slug: "b", role: "viewer" };
  it("routes zero memberships to onboarding even with a saved ID", () => {
    expect(organizationDestination([], "a")).toEqual({ redirect: "/onboarding/organization" });
  });
  it("automatically chooses the only membership", () => {
    expect(organizationDestination([a])).toEqual({ organization: a });
    expect(organizationDestination([a], "foreign")).toEqual({ organization: a });
  });
  it("requires selection for multiple memberships without a valid preference", () => {
    expect(organizationDestination([a, b])).toEqual({ redirect: "/organizations" });
    expect(organizationDestination([a, b], "foreign")).toEqual({ redirect: "/organizations" });
  });
  it("uses only a current membership, including its current role", () => {
    expect(organizationDestination([a, b], "b")).toEqual({ organization: b });
  });
});
