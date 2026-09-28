import { loadEnvFile } from "node:process";
import { fileURLToPath } from "node:url";

try {
  loadEnvFile(fileURLToPath(new URL("../.env.local", import.meta.url)));

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key?.startsWith("sb_publishable_")) {
    throw new Error("Missing or invalid public configuration");
  }

  // Initialization only: never send requests or inspect sessions or tables.
  globalThis.fetch = async () => {
    throw new Error("Network access is disabled for this check");
  };
  const { createClient } = await import("../lib/supabase/client.ts");
  createClient();
  console.log("Supabase client initialization passed (no network requests).");
} catch {
  // Do not print SDK errors: they may contain configuration values.
  console.error(
    "Supabase initialization failed. Check apps/web/.env.local for NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY and use Node.js 24 LTS.",
  );
  process.exitCode = 1;
}
