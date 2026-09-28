import Link from "next/link";
import { login, signup } from "./actions";

const errors: Record<string, string> = {
  validation: "Enter your email and password. For signup, passwords must match.",
  login: "Unable to sign in. Check your details and confirm your email.",
  signup: "Unable to sign up. Check your details and try again.",
  confirmation: "This confirmation link is invalid or expired. Try signing in or sign up again.",
};

export function AuthForm({ mode, error, message }: {
  mode: "login" | "signup";
  error?: string;
  message?: string;
}) {
  const isSignup = mode === "signup";
  const title = isSignup ? "Create an account" : "Sign in";
  const inputClass = "mt-2 w-full rounded border border-gray-300 px-3 py-2 focus:outline-2 focus:outline-blue-700";
  return (
    <main className="flex min-h-screen items-center justify-center bg-gray-50 p-6 text-gray-900">
      <section className="w-full max-w-sm rounded-lg border border-gray-200 bg-white p-8 shadow-sm">
        <p className="text-sm font-semibold tracking-widest">NORTHSTAR</p>
        <h1 className="mt-4 text-2xl font-semibold">{title}</h1>
        {error && <p role="alert" className="mt-4 text-sm text-red-700">{errors[error] ?? "Unable to complete authentication. Please try again."}</p>}
        {message === "check-email" && <p role="status" className="mt-4 text-sm text-gray-600">Check your email for a confirmation link. Open it in this same browser to finish signing up.</p>}
        <form action={isSignup ? signup : login} className="mt-6 space-y-4">
          <label className="block text-sm font-medium">Email
            <input className={inputClass} name="email" type="email" autoComplete="email" required />
          </label>
          <label className="block text-sm font-medium">Password
            <input className={inputClass} name="password" type="password" autoComplete={isSignup ? "new-password" : "current-password"} required />
          </label>
          {isSignup && <label className="block text-sm font-medium">Confirm password
            <input className={inputClass} name="confirmPassword" type="password" autoComplete="new-password" required />
          </label>}
          {isSignup && <p className="text-sm text-gray-600">We will email you a link to confirm your account.</p>}
          <button className="w-full rounded bg-gray-900 px-4 py-2 font-medium text-white hover:bg-gray-700" type="submit">{title}</button>
        </form>
        <p className="mt-6 text-sm"><Link className="underline" href={isSignup ? "/login" : "/signup"}>{isSignup ? "Already have an account? Sign in" : "Create an account"}</Link></p>
      </section>
    </main>
  );
}
