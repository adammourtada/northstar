import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { OrganizationLoadError } from "@/app/organizations/load-error";
import { listKpiObjectives, currentKpiOrganization, getKpi } from "@/lib/kpis";
import { canManageKpis } from "@/lib/kpi-input";
import { KpiForm } from "../../form";

export const dynamic = "force-dynamic";

export default async function EditKpi({ params }: PageProps<"/kpis/[id]/edit">) {
  const organization = await currentKpiOrganization();
  if (!organization) return <OrganizationLoadError />;
  if (!canManageKpis(organization.role)) redirect("/kpis");
  const { id } = await params;
  const result = await getKpi(organization.id, id);
  if (!result.error && !result.kpi) notFound();
  const objectives = await listKpiObjectives(organization.id);
  if (!objectives) return <main className="p-8"><p role="alert">Unable to load objectives. Please try again.</p></main>;
  return <main className="min-h-screen bg-gray-50 p-6 text-gray-900">
    <section className="mx-auto max-w-2xl rounded-lg border border-gray-200 bg-white p-8">
      <p className="font-semibold">Northstar</p><h1 className="mt-4 text-2xl font-semibold">Edit KPI</h1>
      <p className="mt-2 text-gray-600">Current organization: {organization.name}</p>
      {result.error ? <div className="mt-6"><p role="alert">{result.error}</p><Link href="/kpis" className="mt-4 inline-block underline">Back to KPIs</Link></div>
        : result.kpi && <KpiForm objectives={objectives} organizationId={organization.id} kpi={result.kpi} />}
    </section>
  </main>;
}
