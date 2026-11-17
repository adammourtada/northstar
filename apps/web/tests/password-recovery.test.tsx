import { beforeEach, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { NextRequest } from "next/server";

const mock = vi.hoisted(() => ({
  auth: { resetPasswordForEmail: vi.fn(), exchangeCodeForSession: vi.fn(), verifyOtp: vi.fn(), getClaims: vi.fn(), getUser: vi.fn(), updateUser: vi.fn(), signOut: vi.fn() },
  origin: "http://localhost:3000",
}));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => ({ auth: mock.auth }) }));
vi.mock("next/headers", () => ({ headers: async () => new Headers(mock.origin ? { origin: mock.origin } : {}) }));
vi.mock("next/navigation", () => ({ redirect: (path: string) => { throw new Error(`redirect:${path}`); } }));

import { GET } from "@/app/auth/recovery/route";
import { requestPasswordReset } from "@/app/forgot-password/actions";
import { updatePassword } from "@/app/reset-password/actions";
import ForgotPassword from "@/app/forgot-password/page";
import ResetPassword from "@/app/reset-password/page";
import { AuthForm } from "@/app/auth/form";

const auth = mock.auth;
const claims = () => ({ sub: "user-a", amr: [{ method: "recovery", timestamp: Math.floor(Date.now() / 1000) }] });
const form = (values: Record<string, string>) => { const form = new FormData(); Object.entries(values).forEach(([k,v]) => form.set(k,v)); return form; };
const passwordForm = () => form({ password: " new password ", confirmPassword: " new password ", user_id: "user-b", email: "other@example.com" });
const callback = (query: string) => GET(new NextRequest(`http://localhost:3000/auth/recovery?${query}`));

beforeEach(() => {
  vi.resetAllMocks();
  mock.origin = "http://localhost:3000";
  auth.resetPasswordForEmail.mockResolvedValue({ error: null });
  auth.exchangeCodeForSession.mockResolvedValue({ data: { session: {}, redirectType: "recovery" }, error: null });
  auth.verifyOtp.mockResolvedValue({ data: { session: {} }, error: null });
  auth.getClaims.mockResolvedValue({ data: { claims: claims() }, error: null });
  auth.getUser.mockResolvedValue({ data: { user: { id: "user-a" } }, error: null });
  auth.updateUser.mockResolvedValue({ error: null });
  auth.signOut.mockResolvedValue({ error: null });
});

it("requests recovery with a fixed same-origin callback and generic account responses", async () => {
  for (const result of [{ error: null }, { error: { message: "private account details" } }]) {
    auth.resetPasswordForEmail.mockResolvedValueOnce(result);
    expect(await requestPasswordReset({ error: "" }, form({ email: " person@example.com ", redirectTo: "https://evil.example" }))).toEqual({ error: "", sent: true });
  }
  expect(auth.resetPasswordForEmail).toHaveBeenCalledWith("person@example.com", { redirectTo: "http://localhost:3000/auth/recovery" });
  auth.resetPasswordForEmail.mockRejectedValueOnce(new Error("private network details"));
  expect(await requestPasswordReset({ error: "" }, form({ email: "missing@example.com" }))).toEqual({ error: "", sent: true });
  mock.origin = "https://northstar.example";
  await requestPasswordReset({ error: "" }, form({ email: "person@example.com" }));
  expect(auth.resetPasswordForEmail).toHaveBeenLastCalledWith("person@example.com", { redirectTo: "https://northstar.example/auth/recovery" });
});

it("rejects missing/malformed email fields and missing or malformed origins before sending", async () => {
  for (const data of [new FormData(), form({ email: "not-an-email" }), form({ email: " " })]) expect((await requestPasswordReset({ error: "" }, data)).error).toContain("valid email");
  const duplicate = form({ email: "a@example.com" }); duplicate.append("email", "b@example.com");
  expect((await requestPasswordReset({ error: "" }, duplicate)).error).toContain("valid email");
  for (const origin of ["", "javascript:alert(1)", "https://example.com/path"]) {
    mock.origin = origin;
    expect((await requestPasswordReset({ error: "" }, form({ email: "a@example.com" }))).error).toContain("Unable");
  }
  expect(auth.resetPasswordForEmail).not.toHaveBeenCalled();
});

it("verifies explicitly supplied recovery token hashes and removes credentials and next URLs from redirects", async () => {
  const response = await callback("token_hash=one-time-token&type=recovery&next=https://evil.example");
  expect(auth.verifyOtp).toHaveBeenCalledWith({ token_hash: "one-time-token", type: "recovery" });
  expect(auth.exchangeCodeForSession).not.toHaveBeenCalled();
  expect(response.headers.get("location")).toBe("http://localhost:3000/reset-password");
  expect(response.headers.get("cache-control")).toContain("no-store");
  expect(response.headers.get("referrer-policy")).toBe("no-referrer");
});

it("exchanges browser PKCE recovery codes, including an explicit verifier flow ID", async () => {
  expect((await callback("code=pkce-code")).headers.get("location")).toBe("http://localhost:3000/reset-password");
  expect(auth.exchangeCodeForSession).toHaveBeenCalledWith("pkce-code", undefined);
  const flowId = "a".repeat(32);
  await callback(`code=pkce-code&sb_flow_id=${flowId}`);
  expect(auth.exchangeCodeForSession).toHaveBeenLastCalledWith("pkce-code", { flowId });
  expect(auth.verifyOtp).not.toHaveBeenCalled();
});

it("completes the default-template PKCE contract without a token hash or template override", async () => {
  await requestPasswordReset({ error: "" }, form({ email: "person@example.com" }));
  // Supabase's unmodified ConfirmationURL verifies the email link, then returns
  // a code to this allowlisted redirectTo. Real delivery is a manual smoke test.
  const [, options] = auth.resetPasswordForEmail.mock.calls[0];
  const response = await GET(new NextRequest(`${options.redirectTo}?code=provider-code`));
  expect(response.headers.get("location")).toBe("http://localhost:3000/reset-password");
  expect(auth.exchangeCodeForSession).toHaveBeenCalledWith("provider-code", undefined);
  expect(auth.verifyOtp).not.toHaveBeenCalled();
  expect(renderToStaticMarkup(await ResetPassword())).toContain("Reset password");
});

it("does not bypass a missing PKCE verifier using an existing recovery session", async () => {
  auth.exchangeCodeForSession.mockResolvedValueOnce({ data: { session: null }, error: new Error("missing verifier") });
  expect((await callback("code=from-another-browser")).headers.get("location")).toBe("http://localhost:3000/forgot-password?error=recovery");
  expect(auth.verifyOtp).not.toHaveBeenCalled();
  expect(auth.getClaims).not.toHaveBeenCalled();
  expect(auth.updateUser).not.toHaveBeenCalled();
});

it("rejects ambiguous, duplicate, wrong-type and missing callback credentials despite an existing session", async () => {
  for (const query of ["", "type=recovery", "token_hash=t&type=signup", "token_hash=t", "code=c&token_hash=t&type=recovery", "code=c&code=d", "token_hash=t&type=recovery&type=recovery", "error=access_denied&code=c", "code=c&sb_flow_id=", "code=c&type=recovery"]) {
    expect((await callback(query)).headers.get("location")).toBe("http://localhost:3000/forgot-password?error=recovery");
  }
  expect(auth.verifyOtp).not.toHaveBeenCalled();
  expect(auth.exchangeCodeForSession).not.toHaveBeenCalled();
  expect(auth.getClaims).not.toHaveBeenCalled();
});

it("rejects failed, expired, reused and non-recovery exchanges without falling back to existing login", async () => {
  for (const result of [{ data: { session: null }, error: null }, { data: { session: {} }, error: { message: "expired private token" } }]) {
    auth.verifyOtp.mockResolvedValueOnce(result);
    expect((await callback("token_hash=t&type=recovery")).headers.get("location")).toContain("error=recovery");
  }
  for (const result of [{ data: { session: {}, redirectType: null }, error: null }, { data: { session: null }, error: { message: "missing PKCE verifier" } }]) {
    auth.exchangeCodeForSession.mockResolvedValueOnce(result);
    auth.getClaims.mockResolvedValueOnce({ data: { claims: { sub: "user-a", amr: [{ method: "password", timestamp: Date.now()/1000 }] } }, error: null });
    expect((await callback("code=c")).headers.get("location")).toContain("error=recovery");
  }
  auth.verifyOtp.mockRejectedValueOnce(new Error("private"));
  expect((await callback("token_hash=t&type=recovery")).headers.get("location")).toContain("error=recovery");
});

it("protects both reset page and action with verified, recent recovery evidence", async () => {
  for (const value of [null, { sub: "user-a", amr: [{ method: "password", timestamp: Date.now()/1000 }] }, { sub: "user-a", user_metadata: { recovery: true } }, { sub: "user-a", amr: [{ method: "recovery", timestamp: Date.now()/1000 - 901 }] }]) {
    auth.getClaims.mockResolvedValue({ data: { claims: value }, error: null });
    await expect(ResetPassword()).rejects.toThrow("redirect:/forgot-password?error=recovery");
    await expect(updatePassword({ error: "" }, passwordForm())).rejects.toThrow("redirect:/forgot-password?error=recovery");
  }
  auth.getClaims.mockResolvedValue({ data: { claims: claims() }, error: new Error("invalid signature") });
  await expect(updatePassword({ error: "" }, passwordForm())).rejects.toThrow("error=recovery");
  expect(auth.updateUser).not.toHaveBeenCalled();
});

it("rejects mismatched or revoked users and fails closed on Auth connection errors", async () => {
  for (const result of [{ data: { user: { id: "user-b" } }, error: null }, { data: { user: null }, error: new Error("revoked") }]) {
    auth.getUser.mockResolvedValueOnce(result);
    await expect(updatePassword({ error: "" }, passwordForm())).rejects.toThrow("error=recovery");
  }
  auth.getClaims.mockRejectedValueOnce(new Error("private"));
  await expect(ResetPassword()).rejects.toThrow("error=recovery");
  expect(auth.updateUser).not.toHaveBeenCalled();
});

it("validates password inputs without echoing them in action state", async () => {
  for (const data of [new FormData(), form({ password: "short", confirmPassword: "short" }), form({ password: "long enough", confirmPassword: "different" }), form({ password: "x".repeat(129), confirmPassword: "x".repeat(129) })]) {
    const result = await updatePassword({ error: "" }, data);
    expect(Object.keys(result)).toEqual(["error"]);
    expect(result.error).toBeTruthy();
  }
  const duplicate = passwordForm(); duplicate.append("password", "extra password");
  expect((await updatePassword({ error: "" }, duplicate)).error).toBeTruthy();
  const file = passwordForm(); file.set("password", new Blob(["password"]), "file");
  expect((await updatePassword({ error: "" }, file)).error).toBeTruthy();
  expect(auth.updateUser).not.toHaveBeenCalled();
});

it("updates only the recovery-session user, preserves password whitespace and signs out locally", async () => {
  await expect(updatePassword({ error: "" }, passwordForm())).rejects.toThrow("redirect:/login?message=password-reset");
  expect(auth.updateUser).toHaveBeenCalledWith({ password: " new password " });
  expect(auth.signOut).toHaveBeenCalledWith({ scope: "local" });
});

it("handles password policy, network and post-update sign-out errors without leaking secrets", async () => {
  auth.updateUser.mockResolvedValueOnce({ error: { message: "private password" } });
  expect((await updatePassword({ error: "" }, passwordForm())).error).toContain("requirements");
  expect(auth.signOut).not.toHaveBeenCalled();
  auth.updateUser.mockRejectedValueOnce(new Error("private network"));
  expect((await updatePassword({ error: "" }, passwordForm())).error).not.toContain("private");
  auth.signOut.mockResolvedValueOnce({ error: new Error("private signout") });
  const result = await updatePassword({ error: "" }, passwordForm());
  expect(result.updated).toBe(true); expect(result.error).toContain("sign-out failed");
});

it("renders minimal forms, recovery errors and the sign-in link and success notice", async () => {
  const props = { params: Promise.resolve({}), searchParams: Promise.resolve({ error: "recovery" }) };
  expect(renderToStaticMarkup(await ForgotPassword(props))).toContain("invalid or expired");
  expect(renderToStaticMarkup(await ForgotPassword(props))).toContain("same browser and profile");
  const reset = renderToStaticMarkup(await ResetPassword());
  expect(reset).toContain('name="confirmPassword"'); expect(reset).toContain('autoComplete="new-password"');
  expect(renderToStaticMarkup(<AuthForm mode="login" message="password-reset" />)).toContain('href="/forgot-password"');
  expect(renderToStaticMarkup(<AuthForm mode="login" message="password-reset" />)).toContain("Your password has been updated");
  expect(renderToStaticMarkup(<AuthForm mode="signup" />)).not.toContain("Forgot password?");
});
