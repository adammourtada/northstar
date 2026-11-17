import Link from "next/link";
import { riskExposure } from "@/lib/risk-input";
import type { Risk } from "@/lib/risks";

export function RiskSummary({ risk }: { risk: Risk }) {
  return <>
    <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
      <div><dt>Probability</dt><dd>{risk.probability}/5</dd></div><div><dt>Impact</dt><dd>{risk.impact}/5</dd></div>
      <div><dt>Exposure</dt><dd className="font-semibold">{riskExposure(risk.probability, risk.impact)}/25</dd></div>
      <div><dt>Status</dt><dd>{risk.status}</dd></div>
      <div className="break-words"><dt>Owner</dt><dd>{risk.owner ? `${risk.owner.user_id} (${risk.owner.role})` : "Unassigned"}</dd></div>
      <div><dt>Review date</dt><dd>{risk.review_date ? <time dateTime={risk.review_date}>{risk.review_date}</time> : "Not scheduled"}</dd></div>
    </dl>
    <div className="mt-4"><h3 className="font-medium">Projects</h3>
      {risk.linked_projects.length ? <ul>{risk.linked_projects.map(project => <li key={project.id}><Link href={`/projects/${project.id}`} className="break-words underline">{project.name}</Link></li>)}</ul> : <p className="text-sm text-gray-600">No projects linked.</p>}
    </div>
    <div className="mt-4"><h3 className="font-medium">Strategic objectives</h3>
      {risk.linked_objectives.length ? <ul>{risk.linked_objectives.map(objective => <li key={objective.id} className="break-words">{objective.title}</li>)}</ul> : <p className="text-sm text-gray-600">No strategic objectives linked.</p>}
    </div>
  </>;
}
