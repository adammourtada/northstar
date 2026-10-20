import Link from "next/link";
import { notFound } from "next/navigation";
import { OrganizationLoadError } from "@/app/organizations/load-error";
import { currentKpiOrganization } from "@/lib/kpis";
import { getKpiPerformance } from "@/lib/kpi-measurements";
import { canManageKpis } from "@/lib/kpi-input";

export const dynamic = "force-dynamic";
function utcTime(value: string) { return new Date(value).toISOString().replace("T", " ").replace("Z", " UTC"); }
export default async function KpiDetails({ params }: PageProps<"/kpis/[id]">) {
  const organization = await currentKpiOrganization();
  if (!organization) return <OrganizationLoadError />;
  const { id } = await params;
  const result = await getKpiPerformance(organization.id, id);
  const { kpi, error } = result;
  if (!error && !kpi) notFound();
  if (!kpi) return <main className="p-8"><p role="alert">{error}</p><Link href="/kpis" className="underline">Back to KPIs</Link></main>;
  const measurements = "measurements" in result ? result.measurements : null;
  const latest = "latest" in result ? result.latest : null;
  const canManage = canManageKpis(organization.role);
  return <main className="min-h-screen bg-gray-50 p-6 text-gray-900 sm:p-8"><section className="mx-auto max-w-4xl">
    <Link href="/kpis" className="underline">Back to KPIs</Link>
    <h1 className="mt-6 break-words text-3xl font-semibold">{kpi.name}</h1>
    <p className="mt-2 text-gray-600">Current organization: {organization.name}</p>
    {kpi.description && <p className="mt-4 whitespace-pre-wrap break-words">{kpi.description}</p>}
    <dl className="mt-6 grid gap-4 rounded border bg-white p-6 sm:grid-cols-2">
      <div><dt>Target value</dt><dd className="break-words font-semibold">{kpi.target_value ?? "Not specified"} {kpi.unit}</dd></div>
      <div><dt>Latest actual value</dt><dd className="break-words font-semibold">{measurements === null ? "Unavailable" : latest ? `${latest.value} ${kpi.unit}` : "No measurements yet."}</dd>
        {latest && <time dateTime={latest.measured_at}>{utcTime(latest.measured_at)}</time>}</div>
      <div><dt>Unit</dt><dd>{kpi.unit}</dd></div><div><dt>Status</dt><dd>{kpi.status}</dd></div>
      <div><dt>Direction</dt><dd>{kpi.direction}</dd></div><div><dt>Reporting frequency</dt><dd>{kpi.reporting_frequency ?? "Not specified"}</dd></div>
      <div><dt>Strategic objective</dt><dd>{kpi.objective_title ?? "No objective"}</dd></div>
    </dl>
    {canManage && <Link href={`/kpis/${id}/edit`} className="mt-4 inline-block underline">Edit KPI</Link>}
    <div className="mt-8 flex flex-wrap items-center justify-between gap-4"><h2 className="text-2xl font-semibold">Measurement history</h2>
      {canManage && <Link href={`/kpis/${id}/measurements/new`} className="rounded bg-gray-900 px-4 py-2 text-white">Record measurement</Link>}</div>
    <p className="mt-3 text-sm text-gray-600">Newest measurement time first. All times are UTC.</p>
    {!canManage && <p className="mt-3 text-sm text-gray-600">You have read-only access to measurements.</p>}
    {measurements === null ? <div className="mt-6"><p role="alert">Unable to load measurements. Please try again.</p><Link href={`/kpis/${id}`} className="underline">Try again</Link></div>
      : measurements.length === 0 ? <p className="mt-6 rounded border bg-white p-6">No measurements yet. {canManage ? "Record a measurement to compare actual performance with the target." : "An owner, admin, or manager can record a measurement."}</p>
      : <ul className="mt-6 space-y-4">{measurements.map(measurement => <li key={measurement.id} className="rounded border bg-white p-6">
        <p className="break-words text-lg font-semibold">{measurement.value} {kpi.unit}</p>
        <time dateTime={measurement.measured_at}>{utcTime(measurement.measured_at)}</time>
        {measurement.notes && <p className="mt-3 whitespace-pre-wrap break-words">{measurement.notes}</p>}
      </li>)}</ul>}
  </section></main>;
}
