import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { OrganizationLoadError } from "@/app/organizations/load-error";
import { currentProjectOrganization, getProject, listProjectObjectives } from "@/lib/projects";
import { canManageProjects } from "@/lib/project-input";
import { ProjectForm } from "../../form";

export const dynamic = "force-dynamic";

export default async function EditProject({ params }: PageProps<"/projects/[id]/edit">) {
  const organization = await currentProjectOrganization();
  if (!organization) return <OrganizationLoadError />;
  if (!canManageProjects(organization.role)) redirect("/projects");
  const { id } = await params;
  const result = await getProject(organization.id, id);
  if (!result.error && !result.project) notFound();
  const objectives = result.project ? await listProjectObjectives(organization.id) : null;
  return <main className="min-h-screen bg-gray-50 p-6 text-gray-900">
    <section className="mx-auto max-w-2xl rounded-lg border border-gray-200 bg-white p-8">
      <p className="font-semibold">Northstar</p><h1 className="mt-4 text-2xl font-semibold">Edit Project</h1>
      <p className="mt-2 text-gray-600">Current organization: {organization.name}</p>
      {result.error || !objectives ? <div className="mt-6"><p role="alert">{result.error ?? "Unable to load strategic objectives. Please try again."}</p><Link href="/projects" className="mt-4 inline-block underline">Back to projects</Link></div>
        : result.project && <ProjectForm organizationId={organization.id} project={result.project} objectives={objectives} />}
    </section>
  </main>;
}
