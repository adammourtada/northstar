import { redirect } from "next/navigation";
import { OrganizationLoadError } from "@/app/organizations/load-error";
import { currentObjectiveOrganization } from "@/lib/objectives";
import { canManageObjectives } from "@/lib/objective-input";
import { ObjectiveForm } from "../form";

export const dynamic = "force-dynamic";

export default async function NewObjective() {
  const organization = await currentObjectiveOrganization();
  if (!organization) return <OrganizationLoadError />;
  if (!canManageObjectives(organization.role)) redirect("/objectives");
  return <main className="min-h-screen bg-gray-50 p-6 text-gray-900">
    <section className="mx-auto max-w-2xl rounded-lg border border-gray-200 bg-white p-8">
      <p className="font-semibold">Northstar</p><h1 className="mt-4 text-2xl font-semibold">New Objective</h1>
      <p className="mt-2 text-gray-600">Current organization: {organization.name}</p>
      <ObjectiveForm organizationId={organization.id} />
    </section>
  </main>;
}
