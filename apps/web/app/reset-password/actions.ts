"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { recoveryUser } from "@/lib/password-recovery";

export type ResetPasswordState = { error: string; updated?: boolean };

export async function updatePassword(_state: ResetPasswordState, form: FormData): Promise<ResetPasswordState> {
  const supabase = await createClient();
  if (!await recoveryUser(supabase)) redirect("/forgot-password?error=recovery");
  const password = form.get("password"), confirmation = form.get("confirmPassword");
  if (form.getAll("password").length !== 1 || form.getAll("confirmPassword").length !== 1 ||
      typeof password !== "string" || typeof confirmation !== "string" || password.length < 8 || password.length > 128) {
    return { error: "Enter a new password of 8 to 128 characters." };
  }
  if (password !== confirmation) return { error: "Passwords must match." };
  try {
    const { error } = await supabase.auth.updateUser({ password });
    if (error) return { error: "Unable to update your password. Use a different password that meets your account's password requirements and try again." };
  } catch { return { error: "Unable to update your password. Please try again." }; }
  try {
    const { error } = await supabase.auth.signOut({ scope: "local" });
    if (error) return { error: "Your password was updated, but sign-out failed. Use Sign out in your workspace before signing in again.", updated: true };
  } catch { return { error: "Your password was updated, but sign-out failed. Use Sign out in your workspace before signing in again.", updated: true }; }
  redirect("/login?message=password-reset");
}
