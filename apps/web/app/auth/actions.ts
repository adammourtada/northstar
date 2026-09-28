"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { credentials } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export async function login(formData: FormData) {
  const input = credentials(formData);
  if (!input) redirect("/login?error=validation");
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(input);
  if (error) redirect("/login?error=login");
  redirect("/app");
}

export async function signup(formData: FormData) {
  const input = credentials(formData, true);
  if (!input) redirect("/signup?error=validation");
  // Server Actions validate Origin against Host; Supabase also allowlists redirects.
  const origin = (await headers()).get("origin");
  if (!origin) redirect("/signup?error=signup");
  const supabase = await createClient();
  const { error } = await supabase.auth.signUp({
    ...input,
    options: { emailRedirectTo: new URL("/auth/confirm", origin).toString() },
  });
  if (error) redirect("/signup?error=signup");
  redirect("/login?message=check-email");
}

export async function logout() {
  const supabase = await createClient();
  const { error } = await supabase.auth.signOut({ scope: "local" });
  if (error) redirect("/app?error=logout");
  redirect("/login");
}
