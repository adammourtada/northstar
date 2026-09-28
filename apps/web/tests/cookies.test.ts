import { expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({ createServerClient: vi.fn(), getClaims: vi.fn(), store: { getAll: vi.fn(() => []), set: vi.fn() } }));
vi.mock("@supabase/ssr", () => ({ createServerClient: mocks.createServerClient }));
vi.mock("next/headers", () => ({ cookies: async () => mocks.store }));
import { updateSession } from "@/lib/supabase/proxy";
import { createClient } from "@/lib/supabase/server";

it("forwards refreshed cookies to both server rendering and browser, preserving options and cache headers", async () => {
  mocks.createServerClient.mockImplementation((_url, _key, { cookies }) => ({ auth: { getClaims: async () => {
    mocks.getClaims();
    expect(cookies.getAll()).toEqual([]);
    cookies.setAll([{ name: "test-session", value: "test-refreshed", options: { path: "/", httpOnly: true, sameSite: "lax" } }], { Pragma: "no-cache", Expires: "0" });
    cookies.setAll([{ name: "test-verifier", value: "", options: { path: "/", maxAge: 0 } }], {});
    return { data: null, error: null };
  } } }));
  const request = new NextRequest("http://localhost:3000/app");
  const response = await updateSession(request);
  expect(mocks.getClaims).toHaveBeenCalled();
  expect(request.cookies.get("test-session")?.value).toBe("test-refreshed");
  expect(response.cookies.get("test-session")).toMatchObject({ value: "test-refreshed", httpOnly: true, sameSite: "lax", path: "/" });
  expect(response.headers.get("cache-control")).toContain("no-store");
  expect(response.headers.get("pragma")).toBe("no-cache");
  expect(response.headers.get("expires")).toBe("0");
});

it("writes and clears session cookies from actions and confirmation handlers", async () => {
  mocks.createServerClient.mockImplementation((_url, _key, { cookies }) => {
    cookies.setAll([{ name: "test-session", value: "", options: { path: "/", maxAge: 0 } }]);
    return {};
  });
  await createClient();
  expect(mocks.store.set).toHaveBeenCalledWith("test-session", "", { path: "/", maxAge: 0 });
});
