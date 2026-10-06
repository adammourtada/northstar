import Link from "next/link";
import { notFound } from "next/navigation";
import { OrganizationLoadError } from "@/app/organizations/load-error";
import { currentProjectOrganization, getProject } from "@/lib/projects";
import { listMilestones } from "@/lib/milestones";
import { canManageMilestones } from "@/lib/milestone-input";

export const dynamic = "force-dynamic";

export default async function ProjectDetails({ params }: PageProps<"/projects/[id]">) {
  const organization = await currentProjectOrganization();
  if (!organization) return <OrganizationLoadError />;
  const { id } = await params;
  const { project, error } = await getProject(organization.id, id);
  if (!error && !project) notFound();
  if (!project) return <main className="p-8"><p role="alert">{error}</p><Link href="/projects" className="underline">Back to projects</Link></main>;
  const milestones = await listMilestones(organization.id, project.id);
  const canManage = canManageMilestones(organization.role);
  return <main className="min-h-screen bg-gray-50 p-6 text-gray-900 sm:p-8"><section className="mx-auto max-w-4xl">
    <Link href="/projects" className="underline">Back to projects</Link>
    <h1 className="mt-6 break-words text-3xl font-semibold">{project.name}</h1>
    <p className="mt-2 text-gray-600">Current organization: {organization.name}</p>
    {project.description && <p className="mt-4 whitespace-pre-wrap break-words">{project.description}</p>}
    <p className="mt-4">Status: {project.status.replaceAll("_", " ")} · Priority: {project.priority}</p>
    {canManage && <Link href={`/projects/${id}/edit`} className="mt-4 inline-block underline">Edit project</Link>}
    <div className="mt-8 flex flex-wrap items-center justify-between gap-4"><h2 className="text-2xl font-semibold">Milestones</h2>
      {canManage && <Link href={`/projects/${id}/milestones/new`} className="rounded bg-gray-900 px-4 py-2 text-white">New Milestone</Link>}
    </div>
    {!canManage && <p className="mt-4 text-sm text-gray-600">You have read-only access to milestones.</p>}
    {milestones === null ? <div className="mt-6"><p role="alert">Unable to load milestones. Please try again.</p><Link href={`/projects/${id}`} className="underline">Try again</Link></div>
      : milestones.length === 0 ? <p className="mt-6 rounded border bg-white p-6">No milestones yet.</p>
      : <ul className="mt-6 space-y-4">{milestones.map((milestone) => <li key={milestone.id} className="rounded border bg-white p-6">
        <div className="flex items-start justify-between gap-4"><h3 className="break-words text-lg font-semibold">{milestone.name}</h3>
          {canManage && <Link href={`/projects/${id}/milestones/${milestone.id}/edit`} className="underline" aria-label={`Edit ${milestone.name}`}>Edit</Link>}</div>
        {milestone.description && <p className="mt-3 whitespace-pre-wrap break-words">{milestone.description}</p>}
        <p className="mt-3">Status: {milestone.status.replaceAll("_", " ")} · Progress: {milestone.progress_percent}%</p>
        {milestone.due_date && <p className="mt-2">Due: <time dateTime={milestone.due_date}>{milestone.due_date}</time></p>}
        {milestone.completed_at && <p className="mt-2">Completed: <time dateTime={milestone.completed_at}>{milestone.completed_at.slice(0, 10)}</time></p>}
      </li>)}</ul>}
  </section></main>;
}
