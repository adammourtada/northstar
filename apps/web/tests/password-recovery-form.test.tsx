// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, it, vi } from "vitest";

const mock = vi.hoisted(() => ({ update: vi.fn() }));
vi.mock("@/app/reset-password/actions", () => ({ updatePassword: mock.update }));
import { ResetPasswordForm } from "@/app/reset-password/form";

it("disables pending saves and clears passwords after a failed update", async () => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  let finish!: (state: { error: string }) => void;
  mock.update.mockImplementation(() => new Promise(resolve => { finish = resolve; }));
  const container = document.createElement("div"); document.body.append(container);
  const root = createRoot(container);
  try {
    await act(async () => root.render(<ResetPasswordForm />));
    const form = container.querySelector("form")!;
    const password = form.elements.namedItem("password") as HTMLInputElement;
    const confirmation = form.elements.namedItem("confirmPassword") as HTMLInputElement;
    password.value = confirmation.value = "private password";
    await act(async () => form.requestSubmit());
    expect(container.querySelector("button")?.disabled).toBe(true);
    await act(async () => finish({ error: "Password policy rejected the update." }));
    expect(container.querySelector('[role="alert"]')?.textContent).toContain("Password policy");
    expect(password.value).toBe(""); expect(confirmation.value).toBe("");
    expect(container.querySelector("button")?.disabled).toBe(false);
  } finally {
    await act(async () => root.unmount()); container.remove(); vi.unstubAllGlobals();
  }
});
