"use client";

import Link from "next/link";
import { useActionState } from "react";
import { requestPasswordReset } from "./actions";

export function ForgotPasswordForm({ invalidLink }: { invalidLink: boolean }) {
  const [state, action, pending] = useActionState(requestPasswordReset, { error: "" });
  return <>
    {invalidLink && !state.sent && <p role="alert" className="mt-4 text-sm text-red-700">This recovery link is invalid or expired. Request a new link below.</p>}
    {state.error && <p role="alert" className="mt-4 text-sm text-red-700">{state.error}</p>}
    <p className="mt-4 text-sm text-gray-600">Request your reset here and open the email link in this same browser and profile.</p>
    {state.sent ? <p role="status" className="mt-4 text-sm text-gray-600">If that email is eligible for a reset, check your inbox and spam folder for a link. If it does not arrive, try again later.</p>
      : <form action={action} className="mt-6 space-y-4">
        <label className="block text-sm font-medium">Email<input name="email" type="email" autoComplete="email" required maxLength={254} defaultValue={state.email ?? ""} className="mt-2 w-full rounded border border-gray-300 px-3 py-2 focus:outline-2 focus:outline-blue-700" /></label>
        <button disabled={pending} className="w-full rounded bg-gray-900 px-4 py-2 font-medium text-white hover:bg-gray-700 disabled:opacity-50">{pending ? "Sending..." : "Send reset link"}</button>
      </form>}
    <p className="mt-6 text-sm"><Link href="/login" className="underline">Back to sign in</Link></p>
  </>;
}
