"use server";

import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";

export type ForgotPasswordState = { error: string; sent?: boolean; email?: string };

export async function requestPasswordReset(_state: ForgotPasswordState, form: FormData): Promise<ForgotPasswordState> {
  const email = form.get("email");
  if (form.getAll("email").length !== 1 || typeof email !== "string" ||
      email.trim().length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
    return { error: "Enter a valid email address.", email: typeof email === "string" ? email : "" };
  }
  // Next.js Server Actions enforce Origin/Host matching. Never take the callback
  // origin or a redirect URL from form data; Supabase also allowlists redirects.
  const origin = (await headers()).get("origin");
  try {
    if (!origin) return { error: "Unable to request a reset. Refresh the page and try again." };
    const url = new URL(origin);
    if (!["http:", "https:"].includes(url.protocol) || url.origin !== origin) return { error: "Unable to request a reset. Refresh the page and try again." };
    const supabase = await createClient();
    await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo: new URL("/auth/recovery", origin).toString() });
  } catch { /* Do not disclose account existence or raw provider errors. */ }
  // Same response for existing/unknown accounts, rate limits and mail failures.
  return { error: "", sent: true };
}
