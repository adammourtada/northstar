"use client";

import Link from "next/link";
import { useActionState } from "react";
import { updatePassword } from "./actions";

export function ResetPasswordForm() {
  const [state, action, pending] = useActionState(updatePassword, { error: "" });
  const inputClass = "mt-2 w-full rounded border border-gray-300 px-3 py-2 focus:outline-2 focus:outline-blue-700";
  return <>
    {state.error && <p role="alert" className="mt-4 text-sm text-red-700">{state.error}</p>}
    {state.updated ? <Link href="/app" className="mt-6 inline-block underline">Go to workspace</Link>
      : <form action={action} className="mt-6 space-y-4">
        <label className="block text-sm font-medium">New password<input name="password" type="password" autoComplete="new-password" required minLength={8} maxLength={128} className={inputClass} /></label>
        <label className="block text-sm font-medium">Confirm new password<input name="confirmPassword" type="password" autoComplete="new-password" required minLength={8} maxLength={128} className={inputClass} /></label>
        <p className="text-sm text-gray-600">Use 8 to 128 characters and meet the password requirements for your account. Complete this reset within 15 minutes of opening the email link.</p>
        <button disabled={pending} className="w-full rounded bg-gray-900 px-4 py-2 font-medium text-white hover:bg-gray-700 disabled:opacity-50">{pending ? "Saving..." : "Update password"}</button>
      </form>}
  </>;
}
