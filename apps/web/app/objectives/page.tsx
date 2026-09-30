import Link from "next/link";
import { OrganizationLoadError } from "@/app/organizations/load-error";
import { canManageObjectives } from "@/lib/objective-input";
import { currentObjectiveOrganization, listObjectives } from "@/lib/objectives";

export const dynamic = "force-dynamic";

export default async function Objectives() {
  const organization = await currentObjectiveOrganization();
  if (!organization) return <OrganizationLoadError />;
  const objectives = await listObjectives(organization.id);
  const canManage = canManageObjectives(organization.role);
  return <main className="min-h-screen bg-gray-50 p-6 text-gray-900 sm:p-8">
    <section className="mx-auto max-w-4xl">
      <Link href="/app" className="font-semibold tracking-widest">Northstar</Link>
      <div className="mt-6 flex flex-wrap items-center justify-between gap-4">
        <div><h1 className="text-3xl font-semibold">Strategic Objectives</h1>
          <p className="mt-2 text-gray-600">Current organization: {organization.name}</p></div>
        {canManage && <Link href="/objectives/new" className="rounded bg-gray-900 px-4 py-2 text-white">New Objective</Link>}
      </div>
      {!canManage && <p className="mt-4 text-sm text-gray-600">You have read-only access to strategic objectives.</p>}
      {objectives === null ? <div role="alert" className="mt-8 rounded border p-6">
        <p>Unable to load objectives. Please try again.</p><Link href="/objectives" className="mt-3 inline-block underline">Try again</Link>
      </div> : objectives.length === 0 ? <div className="mt-8 rounded-lg border border-gray-200 bg-white p-8">
        <h2 className="text-lg font-semibold">No strategic objectives yet.</h2>
        <p className="mt-2 text-gray-600">{canManage ? "Create your first objective to begin translating strategy into measurable execution." : "An owner, admin, or manager can create your organization's first objective."}</p>
      </div> : <ul className="mt-8 space-y-5">
        {objectives.map((objective) => <li key={objective.id} className="rounded-lg border border-gray-200 bg-white p-6">
          <div className="flex items-start justify-between gap-4">
            <h2 className="break-words text-xl font-semibold">{objective.title}</h2>
            {canManage && <Link href={`/objectives/${objective.id}/edit`} className="underline" aria-label={`Edit ${objective.title}`}>Edit</Link>}
          </div>
          {objective.description && <p className="mt-3 whitespace-pre-wrap break-words text-gray-600">{objective.description}</p>}
          <div className="mt-4 flex flex-wrap gap-4 text-sm"><span>Priority: {objective.priority}</span><span>Status: {objective.status.replaceAll("_", " ")}</span></div>
          <div className="mt-4"><p className="text-sm">Progress: {objective.progress_percent}%</p>
            <progress max={100} value={objective.progress_percent} aria-label={`Progress for ${objective.title}`} className="mt-2 h-3 w-full accent-blue-700" /></div>
          <div className="mt-4 flex flex-wrap gap-4 text-sm text-gray-600">
            {objective.start_date && <p>Start: <time dateTime={objective.start_date}>{objective.start_date}</time></p>}
            {objective.target_date && <p>Target: <time dateTime={objective.target_date}>{objective.target_date}</time></p>}
          </div>
        </li>)}
      </ul>}
      <Link href="/app" className="mt-8 inline-block underline">Back to workspace</Link>
    </section>
  </main>;
}
