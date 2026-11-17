import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { recoveryUser } from "@/lib/password-recovery";

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  let destination = "/forgot-password?error=recovery";
  const code = params.get("code");
  const tokenHash = params.get("token_hash");
  // Reject ambiguous input and provider errors instead of falling back to an
  // existing session. Destinations are fixed; no client-controlled next URL.
  if (!params.has("error") && !params.has("error_code") &&
      ["code", "token_hash", "type", "sb_flow_id"].every(key => params.getAll(key).length <= 1) &&
      Boolean(code) !== Boolean(tokenHash)) {
    try {
      const supabase = await createClient();
      let verified = false;
      if (tokenHash && !params.has("code") && params.get("type") === "recovery" && !params.has("sb_flow_id")) {
        const { data, error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type: "recovery" });
        verified = !error && Boolean(data.session);
      } else if (code && !params.has("token_hash") && !params.has("type")) {
        const flowId = params.get("sb_flow_id");
        if (!params.has("sb_flow_id") || (flowId && /^[a-f0-9]{32}$/i.test(flowId))) {
          const { data, error } = await supabase.auth.exchangeCodeForSession(code, flowId ? { flowId } : undefined);
          // Recovery authority comes from the signed claims checked below,
          // not an SDK event or an untrusted type query parameter.
          verified = !error && Boolean(data.session);
        }
      }
      if (verified && await recoveryUser(supabase)) destination = "/reset-password";
    } catch { /* Invalid links and provider failures share a safe response. */ }
  }
  const response = NextResponse.redirect(new URL(destination, request.url));
  response.headers.set("Cache-Control", "private, no-store");
  response.headers.set("Referrer-Policy", "no-referrer");
  return response;
}
