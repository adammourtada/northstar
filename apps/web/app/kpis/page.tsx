import Link from "next/link";
import { OrganizationLoadError } from "@/app/organizations/load-error";
import { canManageKpis } from "@/lib/kpi-input";
import { currentKpiOrganization, listKpis } from "@/lib/kpis";

export const dynamic = "force-dynamic";

export default async function Kpis() {
  const organization = await currentKpiOrganization();
  if (!organization) return <OrganizationLoadError />;
  const kpis = await listKpis(organization.id);
  const canManage = canManageKpis(organization.role);
  return <main className="min-h-screen bg-gray-50 p-6 text-gray-900 sm:p-8">
    <section className="mx-auto max-w-4xl">
      <Link href="/app" className="font-semibold tracking-widest">Northstar</Link>
      <div className="mt-6 flex flex-wrap items-center justify-between gap-4">
        <div><h1 className="text-3xl font-semibold">KPIs</h1>
          <p className="mt-2 text-gray-600">Current organization: {organization.name}</p></div>
        {canManage && <Link href="/kpis/new" className="rounded bg-gray-900 px-4 py-2 text-white">New KPI</Link>}
      </div>
      {!canManage && <p className="mt-4 text-sm text-gray-600">You have read-only access to KPIs.</p>}
      {kpis === null ? <div role="alert" className="mt-8 rounded border p-6">
        <p>Unable to load KPIs. Please try again.</p><Link href="/kpis" className="mt-3 inline-block underline">Try again</Link>
      </div> : kpis.length === 0 ? <div className="mt-8 rounded-lg border border-gray-200 bg-white p-8">
        <h2 className="text-lg font-semibold">No KPIs yet.</h2>
        <p className="mt-2 text-gray-600">{canManage ? "Define your first KPI and performance target." : "An owner, admin, or manager can create your organization's first KPI."}</p>
      </div> : <ul className="mt-8 space-y-5">
        {kpis.map((kpi) => <li key={kpi.id} className="rounded-lg border border-gray-200 bg-white p-6">
          <div className="flex items-start justify-between gap-4">
            <h2 className="break-words text-xl font-semibold">{kpi.name}</h2>
            {canManage && <Link href={`/kpis/${kpi.id}/edit`} className="underline" aria-label={`Edit ${kpi.name}`}>Edit</Link>}
          </div>
          {kpi.description && <p className="mt-3 whitespace-pre-wrap break-words text-gray-600">{kpi.description}</p>}
          <div className="mt-4 flex flex-wrap gap-4 text-sm">
            <span>Target: {kpi.target_value ?? "Not specified"} {kpi.unit}</span>
            <span>Direction: {kpi.direction}</span><span>Reporting: {kpi.reporting_frequency ?? "Not specified"}</span>
            <span>Status: {kpi.status}</span><span>Objective: {kpi.objective_title ?? "No objective"}</span>
          </div>
        </li>)}
      </ul>}
      <Link href="/app" className="mt-8 inline-block underline">Back to workspace</Link>
    </section>
  </main>;
}
