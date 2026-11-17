import "server-only";
import { createClient } from "@/lib/supabase/server";

// A normal login session is not authorization for the recovery form. Use only
// signature-verified AMR claims, never decoded JWTs, URL flags, or user metadata.
export async function recoveryUser(supabase: Awaited<ReturnType<typeof createClient>>) {
  try {
    const { data, error } = await supabase.auth.getClaims();
    const claims = data?.claims;
    const now = Math.floor(Date.now() / 1000);
    if (error || !claims?.sub || !Array.isArray(claims.amr) || !claims.amr.some(
      (entry: { method?: string; timestamp?: number }) => entry?.method === "recovery" &&
        typeof entry.timestamp === "number" && Number.isFinite(entry.timestamp) &&
        entry.timestamp <= now + 60 && entry.timestamp >= now - 15 * 60,
    )) return null;
    // Also check the user with Auth, rather than trusting cookie session data.
    const { data: userData, error: userError } = await supabase.auth.getUser();
    return !userError && userData.user?.id === claims.sub ? userData.user : null;
  } catch { return null; }
}
