import { ForgotPasswordForm } from "./form";

export const dynamic = "force-dynamic";

export default async function ForgotPassword({ searchParams }: PageProps<"/forgot-password">) {
  const params = await searchParams;
  return <main className="flex min-h-screen items-center justify-center bg-gray-50 p-6 text-gray-900">
    <section className="w-full max-w-sm rounded-lg border border-gray-200 bg-white p-8 shadow-sm">
      <p className="text-sm font-semibold tracking-widest">NORTHSTAR</p><h1 className="mt-4 text-2xl font-semibold">Forgot password?</h1>
      <p className="mt-4 text-sm text-gray-600">Enter your account email to request a password reset.</p>
      <ForgotPasswordForm invalidLink={params.error === "recovery"} />
    </section>
  </main>;
}
