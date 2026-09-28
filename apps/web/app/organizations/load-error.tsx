import Link from "next/link";
import { logout } from "@/app/auth/actions";

export function OrganizationLoadError() {
  return <main className="min-h-screen bg-white p-8 text-gray-900">
    <h1 className="text-2xl font-semibold">Northstar</h1>
    <p role="alert" className="mt-4">Unable to load organizations. Please try again.</p>
    <Link href="/app" className="mt-4 inline-block underline">Try again</Link>
    <form action={logout} className="mt-4"><button type="submit" className="underline">Sign out</button></form>
  </main>;
}
