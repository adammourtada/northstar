import Link from "next/link";
import { notFound } from "next/navigation";
import { OrganizationLoadError } from "@/app/organizations/load-error";
import { currentRiskOrganization, getRisk } from "@/lib/risks";
import { canManageRisks } from "@/lib/risk-input";
import { RiskSummary } from "../summary";

export const dynamic = "force-dynamic";
export default async function RiskDetails({ params }: PageProps<"/risks/[id]">) {
  const organization = await currentRiskOrganization();
  if (!organization) return <OrganizationLoadError />;
  const { id } = await params;
  const { risk, error } = await getRisk(organization.id, id);
  if (!error && !risk) notFound();
  if (!risk) return <main className="p-8"><p role="alert">{error}</p><Link href="/risks" className="underline">Back to risks</Link></main>;
  return <main className="min-h-screen bg-gray-50 p-6 text-gray-900 sm:p-8"><section className="mx-auto max-w-4xl">
    <Link href="/risks" className="underline">Back to risks</Link>
    <h1 className="mt-6 break-words text-3xl font-semibold">{risk.title}</h1>
    <p className="mt-2 text-gray-600">Current organization: {organization.name}</p>
    {risk.description && <p className="mt-4 whitespace-pre-wrap break-words">{risk.description}</p>}
    <div className="mt-6 rounded-lg border bg-white p-6"><RiskSummary risk={risk} />
      <h2 className="mt-6 text-lg font-semibold">Mitigation plan</h2><p className="mt-2 whitespace-pre-wrap break-words">{risk.mitigation_plan ?? "No mitigation plan recorded."}</p>
      <p className="mt-6 text-sm text-gray-600">Identified (UTC): <time dateTime={risk.identified_at}>{new Date(risk.identified_at).toISOString().replace("T", " ").replace("Z", " UTC")}</time></p>
    </div>
    {canManageRisks(organization.role) ? <Link href={`/risks/${id}/edit`} className="mt-6 inline-block rounded bg-gray-900 px-4 py-2 text-white">Edit risk</Link>
      : <p className="mt-4 text-sm text-gray-600">You have read-only access to risks.</p>}
  </section></main>;
}
