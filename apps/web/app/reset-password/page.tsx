import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { recoveryUser } from "@/lib/password-recovery";
import { ResetPasswordForm } from "./form";

export const dynamic = "force-dynamic";

export default async function ResetPassword() {
  const supabase = await createClient();
  if (!await recoveryUser(supabase)) redirect("/forgot-password?error=recovery");
  return <main className="flex min-h-screen items-center justify-center bg-gray-50 p-6 text-gray-900">
    <section className="w-full max-w-sm rounded-lg border border-gray-200 bg-white p-8 shadow-sm">
      <p className="text-sm font-semibold tracking-widest">NORTHSTAR</p><h1 className="mt-4 text-2xl font-semibold">Reset password</h1>
      <ResetPasswordForm />
    </section>
  </main>;
}
