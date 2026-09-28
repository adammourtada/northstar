import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { NextRequest } from "next/server";

const auth = vi.hoisted(() => ({
  getClaims: vi.fn(), signInWithPassword: vi.fn(), signUp: vi.fn(),
  signOut: vi.fn(), exchangeCodeForSession: vi.fn(),
  origin: "http://localhost:3000",
}));
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn(async () => ({ auth })) }));
vi.mock("next/navigation", () => ({ redirect: (path: string) => { throw new Error(`redirect:${path}`); } }));
vi.mock("next/headers", () => ({ headers: async () => new Headers({ origin: auth.origin }) }));

import Login from "@/app/login/page";
import Signup from "@/app/signup/page";
import Application from "@/app/app/page";
import { credentials, getIdentity } from "@/lib/auth";
import { login, signup, logout } from "@/app/auth/actions";
import { GET } from "@/app/auth/confirm/route";

const props = () => ({ params: Promise.resolve({}), searchParams: Promise.resolve({}) });
function form(values: Record<string, string>) {
  const data = new FormData();
  Object.entries(values).forEach(([key, value]) => data.set(key, value));
  return data;
}

beforeEach(() => {
  auth.origin = "http://localhost:3000";
  auth.getClaims.mockResolvedValue({ data: null, error: null });
  auth.signInWithPassword.mockResolvedValue({ error: null });
  auth.signUp.mockResolvedValue({ error: null });
  auth.signOut.mockResolvedValue({ error: null });
  auth.exchangeCodeForSession.mockResolvedValue({ data: { session: {} }, error: null });
});

describe("server-rendered authentication", () => {
  it("renders login fields", async () => {
    const html = renderToStaticMarkup(await Login(props()));
    expect(html).toContain('name="email"');
    expect(html).toContain('name="password"');
    expect(html).not.toContain('name="confirmPassword"');
  });
  it("renders signup fields and confirmation guidance", async () => {
    const html = renderToStaticMarkup(await Signup(props()));
    expect(html).toContain('name="confirmPassword"');
    expect(html).toContain("confirm your account");
  });
  it("redirects unauthenticated protected requests", async () => {
    await expect(Application(props())).rejects.toThrow("redirect:/login");
    expect(auth.getClaims).toHaveBeenCalled();
  });
  it("rejects claims returned alongside a validation error", async () => {
    auth.getClaims.mockResolvedValue({ data: { claims: { sub: "test-id" } }, error: new Error("invalid") });
    expect(await getIdentity()).toBeNull();
  });
  it("redirects authenticated visitors away from auth pages and displays only email", async () => {
    auth.getClaims.mockResolvedValue({ data: { claims: { sub: "private-id", email: "person@example.com" } }, error: null });
    await expect(Login(props())).rejects.toThrow("redirect:/app");
    await expect(Signup(props())).rejects.toThrow("redirect:/app");
    const html = renderToStaticMarkup(await Application(props()));
    expect(html).toContain("person@example.com");
    expect(html).not.toContain("private-id");
  });
});

describe("actions and validation", () => {
  it("rejects missing fields, files and mismatched passwords", async () => {
    expect(credentials(form({}))).toBeNull();
    expect(credentials(form({ email: " ", password: "test" }))).toBeNull();
    expect(credentials(form({ email: "a@example.com", password: "" }))).toBeNull();
    const input = form({ email: "a@example.com", password: "test", confirmPassword: "other" });
    await expect(signup(input)).rejects.toThrow("redirect:/signup?error=validation");
    expect(auth.signUp).not.toHaveBeenCalled();
    input.set("password", new Blob(["test"]));
    expect(credentials(input)).toBeNull();
  });
  it("preserves password whitespace and trims email", () => {
    expect(credentials(form({ email: " a@example.com ", password: " test " }))).toEqual({ email: "a@example.com", password: " test " });
  });
  it("signs in and redirects", async () => {
    await expect(login(form({ email: "a@example.com", password: "test" }))).rejects.toThrow("redirect:/app");
    expect(auth.signInWithPassword).toHaveBeenCalledWith({ email: "a@example.com", password: "test" });
  });
  it("keeps provider errors out of redirects", async () => {
    auth.signInWithPassword.mockResolvedValue({ error: new Error("sensitive-provider-detail") });
    await expect(login(form({ email: "a@example.com", password: "test" }))).rejects.toThrow("redirect:/login?error=login");
  });
  it("sets the server confirmation URL and asks the user to check email", async () => {
    await expect(signup(form({ email: "a@example.com", password: "test", confirmPassword: "test" }))).rejects.toThrow("redirect:/login?message=check-email");
    expect(auth.signUp).toHaveBeenCalledWith(expect.objectContaining({ options: { emailRedirectTo: "http://localhost:3000/auth/confirm" } }));
  });
  it("signs out the current session", async () => {
    await expect(logout()).rejects.toThrow("redirect:/login");
    expect(auth.signOut).toHaveBeenCalledWith({ scope: "local" });
  });
  it("uses the application origin for deployed signup redirects", async () => {
    auth.origin = "https://northstar.example.com";
    await expect(signup(form({ email: "a@example.com", password: "test", confirmPassword: "test" }))).rejects.toThrow("redirect:/login?message=check-email");
    expect(auth.signUp).toHaveBeenCalledWith(expect.objectContaining({ options: { emailRedirectTo: "https://northstar.example.com/auth/confirm" } }));
  });
  it("reports a sign-out failure without claiming success", async () => {
    auth.signOut.mockResolvedValue({ error: new Error("failed") });
    await expect(logout()).rejects.toThrow("redirect:/app?error=logout");
  });
});

describe("confirmation", () => {
  it("rejects exchanges that do not establish a session", async () => {
    auth.exchangeCodeForSession.mockResolvedValue({ data: { session: null }, error: null });
    const response = await GET(new NextRequest("http://localhost:3000/auth/confirm?code=test-only"));
    expect(response.headers.get("location")).toBe("http://localhost:3000/login?error=confirmation");
  });
  it("exchanges the PKCE code and drops all input query parameters", async () => {
    const response = await GET(new NextRequest("http://localhost:3000/auth/confirm?code=test-only&next=https://example.com"));
    expect(auth.exchangeCodeForSession).toHaveBeenCalledWith("test-only");
    expect(response.headers.get("location")).toBe("http://localhost:3000/app");
    expect(response.headers.get("cache-control")).toContain("no-store");
    expect(response.headers.get("referrer-policy")).toBe("no-referrer");
  });
  it.each(["", "?code=", "?error=access_denied", "?token_hash=test-only&type=email"])("rejects invalid confirmation input: %s", async (query) => {
    const response = await GET(new NextRequest(`http://localhost:3000/auth/confirm${query}`));
    expect(response.headers.get("location")).toBe("http://localhost:3000/login?error=confirmation");
    expect(auth.exchangeCodeForSession).not.toHaveBeenCalled();
  });
  it("handles expired codes or missing PKCE verifier cookies safely", async () => {
    auth.exchangeCodeForSession.mockResolvedValue({ data: { session: null }, error: new Error("expired") });
    const response = await GET(new NextRequest("http://localhost:3000/auth/confirm?code=test-only"));
    expect(response.headers.get("location")).toBe("http://localhost:3000/login?error=confirmation");
  });
});
