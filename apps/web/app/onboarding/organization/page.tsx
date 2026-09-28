import { redirect } from "next/navigation";
import { listOrganizations } from "@/lib/organizations";
import { OrganizationForm } from "./form";
import { OrganizationLoadError } from "@/app/organizations/load-error";
import { logout } from "@/app/auth/actions";

export const dynamic = "force-dynamic";

export default async function OrganizationOnboarding() {
  const organizations = await listOrganizations();
  if (!organizations) return <OrganizationLoadError />;
  if (organizations.length) redirect("/app");
  return <main className="flex min-h-screen items-center justify-center bg-gray-50 p-6 text-gray-900">
    <section className="w-full max-w-md rounded-lg border border-gray-200 bg-white p-8 shadow-sm">
      <p className="text-sm font-semibold tracking-widest">NORTHSTAR</p>
      <h1 className="mt-4 text-2xl font-semibold">Create your organization</h1>
      <p className="mt-2 text-sm text-gray-600">Set up your first workspace to get started.</p>
      <OrganizationForm />
      <form action={logout} className="mt-6"><button type="submit" className="text-sm underline">Sign out</button></form>
    </section>
  </main>;
}
