import Link from "next/link";
import { OrganizationLoadError } from "@/app/organizations/load-error";
import { canManageProjects } from "@/lib/project-input";
import { currentProjectOrganization, listProjects } from "@/lib/projects";

export const dynamic = "force-dynamic";

export default async function Projects() {
  const organization = await currentProjectOrganization();
  if (!organization) return <OrganizationLoadError />;
  const projects = await listProjects(organization.id);
  const canManage = canManageProjects(organization.role);
  return <main className="min-h-screen bg-gray-50 p-6 text-gray-900 sm:p-8">
    <section className="mx-auto max-w-4xl">
      <Link href="/app" className="font-semibold tracking-widest">Northstar</Link>
      <div className="mt-6 flex flex-wrap items-center justify-between gap-4">
        <div><h1 className="text-3xl font-semibold">Projects</h1>
          <p className="mt-2 text-gray-600">Current organization: {organization.name}</p></div>
        {canManage && <Link href="/projects/new" className="rounded bg-gray-900 px-4 py-2 text-white">New Project</Link>}
      </div>
      {!canManage && <p className="mt-4 text-sm text-gray-600">You have read-only access to projects.</p>}
      {projects === null ? <div role="alert" className="mt-8 rounded border p-6">
        <p>Unable to load projects. Please try again.</p><Link href="/projects" className="mt-3 inline-block underline">Try again</Link>
      </div> : projects.length === 0 ? <div className="mt-8 rounded-lg border border-gray-200 bg-white p-8">
        <h2 className="text-lg font-semibold">No projects yet.</h2>
        <p className="mt-2 text-gray-600">{canManage ? "Create your first project and connect execution to your strategic objectives." : "An owner, admin, or manager can create your organization's first project."}</p>
      </div> : <ul className="mt-8 space-y-5">
        {projects.map((project) => <li key={project.id} className="rounded-lg border border-gray-200 bg-white p-6">
          <div className="flex items-start justify-between gap-4">
            <h2 className="break-words text-xl font-semibold"><Link href={`/projects/${project.id}`} className="underline">{project.name}</Link></h2>
            {canManage && <Link href={`/projects/${project.id}/edit`} className="underline" aria-label={`Edit ${project.name}`}>Edit</Link>}
          </div>
          {project.description && <p className="mt-3 whitespace-pre-wrap break-words text-gray-600">{project.description}</p>}
          <div className="mt-4 flex flex-wrap gap-4 text-sm"><span>Priority: {project.priority}</span><span>Status: {project.status.replaceAll("_", " ")}</span></div>
          <div className="mt-4 text-sm">
            {project.linked_objectives.length ? <><p className="font-medium">Supports:</p><ul className="mt-2 list-inside list-disc">
              {project.linked_objectives.map((objective) => <li key={objective.id}>{objective.title}</li>)}
            </ul></> : <p className="text-gray-600">No strategic objectives linked.</p>}
          </div>
          <div className="mt-4 flex flex-wrap gap-4 text-sm text-gray-600">
            {project.start_date && <p>Start: <time dateTime={project.start_date}>{project.start_date}</time></p>}
            {project.target_date && <p>Target: <time dateTime={project.target_date}>{project.target_date}</time></p>}
            {project.completed_at && <p>Completed: <time dateTime={project.completed_at}>{project.completed_at.slice(0, 10)}</time></p>}
          </div>
        </li>)}
      </ul>}
      <Link href="/app" className="mt-8 inline-block underline">Back to workspace</Link>
    </section>
  </main>;
}
