import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { OrganizationLoadError } from "@/app/organizations/load-error";
import { currentRiskOrganization, getRisk, listRiskChoices } from "@/lib/risks";
import { canManageRisks } from "@/lib/risk-input";
import { RiskForm } from "./form";

export async function RiskEditor({ id }: { id?: string }) {
  const organization = await currentRiskOrganization();
  if (!organization) return <OrganizationLoadError />;
  if (!canManageRisks(organization.role)) redirect("/risks");
  const result = id === undefined ? null : await getRisk(organization.id, id);
  if (result && !result.error && !result.risk) notFound();
  const choices = result?.error ? null : await listRiskChoices(organization.id);
  return <main className="min-h-screen bg-gray-50 p-6 text-gray-900"><section className="mx-auto max-w-2xl rounded-lg border border-gray-200 bg-white p-8">
    <p className="font-semibold">Northstar</p><h1 className="mt-4 text-2xl font-semibold">{id === undefined ? "New risk" : "Edit risk"}</h1>
    <p className="mt-2 text-gray-600">Current organization: {organization.name}</p>
    {result?.error || !choices ? <div className="mt-6"><p role="alert">{result?.error ?? "Unable to load risk associations. Please try again."}</p><Link href="/risks" className="mt-4 inline-block underline">Back to risks</Link></div>
      : <RiskForm organizationId={organization.id} risk={result?.risk ?? undefined} choices={choices} />}
  </section></main>;
}
