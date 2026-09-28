import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function getIdentity() {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();
  if (error || !data?.claims.sub) return null;
  return { id: data.claims.sub, email: typeof data.claims.email === "string" ? data.claims.email : "" };
}

export async function requireIdentity() {
  const identity = await getIdentity();
  if (!identity) redirect("/login");
  return identity;
}

export function credentials(formData: FormData, signup = false) {
  const email = formData.get("email");
  const password = formData.get("password");
  if (typeof email !== "string" || !email.trim() ||
      typeof password !== "string" || !password) return null;
  if (signup && password !== formData.get("confirmPassword")) return null;
  return { email: email.trim(), password };
}
