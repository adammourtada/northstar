import { requireIdentity } from "@/lib/auth";
import { logout } from "@/app/auth/actions";

export const dynamic = "force-dynamic";

export default async function Application({ searchParams }: PageProps<"/app">) {
  const identity = await requireIdentity();
  const params = await searchParams;
  return (
    <main className="min-h-screen bg-white p-8 text-gray-900">
      <h1 className="text-2xl font-semibold">Northstar</h1>
      <p className="mt-2">Authenticated application area</p>
      <p className="mt-4">Signed in as: {identity.email}</p>
      {params.error === "logout" && <p role="alert" className="mt-4 text-red-700">Unable to sign out. Please try again.</p>}
      <form action={logout} className="mt-6">
        <button type="submit" className="rounded bg-gray-900 px-4 py-2 text-white">Sign out</button>
      </form>
    </main>
  );
}
