import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { OrganizationLoadError } from "@/app/organizations/load-error";
import { currentObjectiveOrganization, getObjective } from "@/lib/objectives";
import { canManageObjectives } from "@/lib/objective-input";
import { ObjectiveForm } from "../../form";

export const dynamic = "force-dynamic";

export default async function EditObjective({ params }: PageProps<"/objectives/[id]/edit">) {
  const organization = await currentObjectiveOrganization();
  if (!organization) return <OrganizationLoadError />;
  if (!canManageObjectives(organization.role)) redirect("/objectives");
  const { id } = await params;
  const result = await getObjective(organization.id, id);
  if (!result.error && !result.objective) notFound();
  return <main className="min-h-screen bg-gray-50 p-6 text-gray-900">
    <section className="mx-auto max-w-2xl rounded-lg border border-gray-200 bg-white p-8">
      <p className="font-semibold">Northstar</p><h1 className="mt-4 text-2xl font-semibold">Edit Objective</h1>
      <p className="mt-2 text-gray-600">Current organization: {organization.name}</p>
      {result.error ? <div className="mt-6"><p role="alert">{result.error}</p><Link href="/objectives" className="mt-4 inline-block underline">Back to objectives</Link></div>
        : result.objective && <ObjectiveForm organizationId={organization.id} objective={result.objective} />}
    </section>
  </main>;
}
