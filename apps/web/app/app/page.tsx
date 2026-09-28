import { requireIdentity } from "@/lib/auth";
import { logout } from "@/app/auth/actions";
import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { listOrganizations } from "@/lib/organizations";
import { organizationDestination } from "@/lib/organization-input";
import { organizationCookie } from "@/lib/organization-cookie";
import { OrganizationLoadError } from "@/app/organizations/load-error";

export const dynamic = "force-dynamic";

export default async function Application({ searchParams }: PageProps<"/app">) {
  const identity = await requireIdentity();
  const organizations = await listOrganizations();
  if (!organizations) return <OrganizationLoadError />;
  const selected = (await cookies()).get(organizationCookie)?.value;
  const destination = organizationDestination(organizations, selected);
  if (destination.redirect) redirect(destination.redirect);
  const organization = destination.organization;
  const params = await searchParams;
  return (
    <main className="min-h-screen bg-white p-8 text-gray-900">
      <h1 className="text-2xl font-semibold">Northstar</h1>
      <p className="mt-4">Current organization: {organization.name}</p>
      <p className="mt-2">Role: {organization.role}</p>
      <p className="mt-4">Signed in as: {identity.email}</p>
      {params.error === "logout" && <p role="alert" className="mt-4 text-red-700">Unable to sign out. Please try again.</p>}
      {organizations.length > 1 && <Link href="/organizations" className="mt-6 inline-block underline">Switch organization</Link>}
      <form action={logout} className="mt-6">
        <button type="submit" className="rounded bg-gray-900 px-4 py-2 text-white">Sign out</button>
      </form>
    </main>
  );
}
