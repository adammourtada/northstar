import { redirect } from "next/navigation";
import { listOrganizations } from "@/lib/organizations";
import { selectOrganization } from "./actions";
import { OrganizationLoadError } from "./load-error";
import { logout } from "@/app/auth/actions";

export const dynamic = "force-dynamic";

export default async function Organizations({ searchParams }: PageProps<"/organizations">) {
  const organizations = await listOrganizations();
  if (!organizations) return <OrganizationLoadError />;
  if (!organizations.length) redirect("/onboarding/organization");
  if (organizations.length === 1) redirect("/app");
  const params = await searchParams;
  return <main className="min-h-screen bg-gray-50 p-8 text-gray-900">
    <section className="mx-auto max-w-lg">
      <p className="text-sm font-semibold tracking-widest">NORTHSTAR</p>
      <h1 className="mt-4 text-2xl font-semibold">Choose an organization</h1>
      {params.error && <p role="alert" className="mt-4 text-red-700">Unable to select that organization. Please choose an available workspace.</p>}
      <ul className="mt-6 space-y-4">
        {organizations.map((organization) => <li key={organization.id} className="rounded-lg border border-gray-200 bg-white p-5">
          <h2 className="font-semibold">{organization.name}</h2>
          <p className="mt-1 text-sm text-gray-600">{organization.slug} · {organization.role}</p>
          <form action={selectOrganization} className="mt-4">
            <input type="hidden" name="organization" value={organization.id} />
            <button type="submit" className="rounded bg-gray-900 px-4 py-2 text-white" aria-label={`Enter ${organization.name}`}>Enter workspace</button>
          </form>
        </li>)}
      </ul>
      <form action={logout} className="mt-6"><button type="submit" className="underline">Sign out</button></form>
    </section>
  </main>;
}
