import Link from "next/link";
import { OrganizationLoadError } from "@/app/organizations/load-error";
import { currentRiskOrganization, listRisks } from "@/lib/risks";
import { canManageRisks } from "@/lib/risk-input";
import { RiskSummary } from "./summary";

export const dynamic = "force-dynamic";
export default async function Risks() {
  const organization = await currentRiskOrganization();
  if (!organization) return <OrganizationLoadError />;
  const risks = await listRisks(organization.id);
  const canManage = canManageRisks(organization.role);
  return <main className="min-h-screen bg-gray-50 p-6 text-gray-900 sm:p-8"><section className="mx-auto max-w-4xl">
    <Link href="/app" className="font-semibold tracking-widest">Northstar</Link>
    <div className="mt-6 flex flex-wrap items-center justify-between gap-4"><div><h1 className="text-3xl font-semibold">Risk register</h1>
      <p className="mt-2 text-gray-600">Current organization: {organization.name}</p></div>
      {canManage && <Link href="/risks/new" className="rounded bg-gray-900 px-4 py-2 text-white">New risk</Link>}
    </div>
    {!canManage && <p className="mt-4 text-sm text-gray-600">You have read-only access to risks.</p>}
    {risks === null ? <div className="mt-8 rounded border p-6"><p role="alert">Unable to load risks. Please try again.</p><Link href="/risks" className="underline">Try again</Link></div>
      : risks.length === 0 ? <div className="mt-8 rounded-lg border bg-white p-8"><h2 className="text-lg font-semibold">No risks yet.</h2>
        <p className="mt-2 text-gray-600">{canManage ? "Record your first risk to assess exposure and plan mitigation." : "An owner, admin, or manager can record your organization's first risk."}</p></div>
      : <ul className="mt-8 space-y-5">{risks.map(risk => <li key={risk.id} className="rounded-lg border border-gray-200 bg-white p-6">
        <div className="flex items-start justify-between gap-4"><h2 className="break-words text-xl font-semibold"><Link href={`/risks/${risk.id}`} className="underline">{risk.title}</Link></h2>
          {canManage && <Link href={`/risks/${risk.id}/edit`} className="underline" aria-label={`Edit ${risk.title}`}>Edit</Link>}</div>
        {risk.description && <p className="mt-3 whitespace-pre-wrap break-words text-gray-600">{risk.description}</p>}
        <RiskSummary risk={risk} />
      </li>)}</ul>}
    <Link href="/app" className="mt-8 inline-block underline">Back to workspace</Link>
  </section></main>;
}
