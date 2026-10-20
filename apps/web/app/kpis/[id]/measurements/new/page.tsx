import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { OrganizationLoadError } from "@/app/organizations/load-error";
import { currentKpiOrganization, getKpi } from "@/lib/kpis";
import { canManageKpis } from "@/lib/kpi-input";
import { MeasurementForm } from "../form";

export const dynamic = "force-dynamic";
export default async function NewMeasurement({ params }: PageProps<"/kpis/[id]/measurements/new">) {
  const organization = await currentKpiOrganization();
  if (!organization) return <OrganizationLoadError />;
  if (!canManageKpis(organization.role)) redirect("/kpis");
  const { id } = await params;
  const { kpi, error } = await getKpi(organization.id, id);
  if (!error && !kpi) notFound();
  return <main className="min-h-screen bg-gray-50 p-6 text-gray-900"><section className="mx-auto max-w-2xl rounded-lg border border-gray-200 bg-white p-8">
    <p className="font-semibold">Northstar</p><h1 className="mt-4 text-2xl font-semibold">Record measurement</h1>
    <p className="mt-2 text-gray-600">Current organization: {organization.name}</p>
    {error ? <><p role="alert">{error}</p><Link href="/kpis" className="underline">Back to KPIs</Link></> : kpi && <>
      <h2 className="mt-4 break-words text-xl">{kpi.name}</h2><p>Unit: {kpi.unit} · Target: {kpi.target_value ?? "Not specified"}</p>
      <MeasurementForm organizationId={organization.id} kpiId={kpi.id} /></>}
  </section></main>;
}
