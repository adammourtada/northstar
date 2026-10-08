import { redirect } from "next/navigation";
import { OrganizationLoadError } from "@/app/organizations/load-error";
import { listKpiObjectives, currentKpiOrganization } from "@/lib/kpis";
import { canManageKpis } from "@/lib/kpi-input";
import { KpiForm } from "../form";

export const dynamic = "force-dynamic";

export default async function NewKpi() {
  const organization = await currentKpiOrganization();
  if (!organization) return <OrganizationLoadError />;
  if (!canManageKpis(organization.role)) redirect("/kpis");
  const objectives = await listKpiObjectives(organization.id);
  if (!objectives) return <main className="p-8"><p role="alert">Unable to load objectives. Please try again.</p></main>;
  return <main className="min-h-screen bg-gray-50 p-6 text-gray-900">
    <section className="mx-auto max-w-2xl rounded-lg border border-gray-200 bg-white p-8">
      <p className="font-semibold">Northstar</p><h1 className="mt-4 text-2xl font-semibold">New KPI</h1>
      <p className="mt-2 text-gray-600">Current organization: {organization.name}</p>
      <KpiForm objectives={objectives} organizationId={organization.id} />
    </section>
  </main>;
}
