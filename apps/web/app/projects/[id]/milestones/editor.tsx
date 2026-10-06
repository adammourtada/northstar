import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { OrganizationLoadError } from "@/app/organizations/load-error";
import { currentProjectOrganization, getProject } from "@/lib/projects";
import { getMilestone } from "@/lib/milestones";
import { canManageMilestones } from "@/lib/milestone-input";
import { MilestoneForm } from "./form";

export async function MilestoneEditor({ projectId, milestoneId }: { projectId: string; milestoneId?: string }) {
  const organization = await currentProjectOrganization();
  if (!organization) return <OrganizationLoadError />;
  if (!canManageMilestones(organization.role)) redirect("/projects");
  const parent = await getProject(organization.id, projectId);
  if (!parent.error && !parent.project) notFound();
  const result = parent.project && milestoneId !== undefined ? await getMilestone(organization.id, parent.project.id, milestoneId) : null;
  if (result && !result.error && !result.milestone) notFound();
  const error = parent.error ?? result?.error;
  return <main className="min-h-screen bg-gray-50 p-6 text-gray-900"><section className="mx-auto max-w-2xl rounded border bg-white p-8">
    <h1 className="text-2xl font-semibold">{milestoneId === undefined ? "New Milestone" : "Edit Milestone"}</h1>
    <p className="mt-2 text-gray-600">Current organization: {organization.name}</p>
    {parent.project && <p className="mt-2 break-words">Project: {parent.project.name}</p>}
    {error ? <div className="mt-6"><p role="alert">{error}</p><Link href="/projects" className="underline">Back to projects</Link></div>
      : parent.project && <MilestoneForm organizationId={organization.id} projectId={parent.project.id} milestone={result?.milestone ?? undefined} />}
  </section></main>;
}
