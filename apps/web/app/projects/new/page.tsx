import Link from "next/link";
import { redirect } from "next/navigation";
import { OrganizationLoadError } from "@/app/organizations/load-error";
import { currentProjectOrganization, listProjectObjectives } from "@/lib/projects";
import { canManageProjects } from "@/lib/project-input";
import { ProjectForm } from "../form";

export const dynamic = "force-dynamic";

export default async function NewProject() {
  const organization = await currentProjectOrganization();
  if (!organization) return <OrganizationLoadError />;
  if (!canManageProjects(organization.role)) redirect("/projects");
  const objectives = await listProjectObjectives(organization.id);
  return <main className="min-h-screen bg-gray-50 p-6 text-gray-900">
    <section className="mx-auto max-w-2xl rounded-lg border border-gray-200 bg-white p-8">
      <p className="font-semibold">Northstar</p><h1 className="mt-4 text-2xl font-semibold">New Project</h1>
      <p className="mt-2 text-gray-600">Current organization: {organization.name}</p>
      {objectives ? <ProjectForm organizationId={organization.id} objectives={objectives} /> : <div className="mt-6"><p role="alert">Unable to load strategic objectives. Please try again.</p><Link href="/projects/new" className="underline">Try again</Link></div>}
    </section>
  </main>;
}
