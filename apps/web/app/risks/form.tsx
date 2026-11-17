"use client";
import Link from "next/link";
import { useActionState } from "react";
import { riskStatuses } from "@/lib/risk-input";
import type { Risk, RiskChoices } from "@/lib/risks";
import { saveRisk } from "./actions";

export function RiskForm({ organizationId, risk, choices }: { organizationId: string; risk?: Risk; choices: RiskChoices }) {
  const [state, action, pending] = useActionState(saveRisk.bind(null, organizationId, risk?.id ?? null), { error: "" });
  const inputClass = "mt-2 block w-full rounded border border-gray-300 px-3 py-2 focus:outline-2 focus:outline-blue-700";
  const value = (name: "title" | "description" | "owner_id" | "status" | "mitigation_plan" | "review_date") => state.values?.[name] ?? risk?.[name] ?? "";
  const probability = state.values?.probability ?? String(risk?.probability ?? 1);
  const impact = state.values?.impact ?? String(risk?.impact ?? 1);
  const owner = value("owner_id"), status = value("status") || "open";
  return <form action={action} className="mt-6 space-y-5">
    {state.error && <p role="alert" className="text-red-700">{state.error}</p>}
    <label className="block font-medium">Risk title<input name="title" required maxLength={200} defaultValue={value("title")} className={inputClass} /></label>
    <label className="block font-medium">Description<textarea name="description" rows={4} maxLength={5000} defaultValue={value("description")} className={inputClass} /></label>
    <label className="block font-medium">Owner<select key={owner} name="owner_id" defaultValue={owner} className={inputClass}>
      <option value="">Unassigned</option>
      {choices.owners.map(member => <option key={member.user_id} value={member.user_id}>{member.user_id} ({member.role})</option>)}
    </select></label>
    <div className="grid gap-5 sm:grid-cols-2">
      {[["probability", probability], ["impact", impact]].map(([name, selected]) => <label key={name} className="block font-medium">
        {name === "probability" ? "Probability (1–5)" : "Impact (1–5)"}
        <select key={selected} name={name} defaultValue={selected} className={inputClass}>{[1,2,3,4,5].map(score => <option key={score} value={score}>{score}</option>)}</select>
      </label>)}
    </div>
    <p className="text-sm text-gray-600">Exposure is calculated as probability × impact, from 1 to 25.</p>
    <label className="block font-medium">Status<select key={status} name="status" defaultValue={status} className={inputClass}>
      {riskStatuses.map(status => <option key={status} value={status}>{status}</option>)}
    </select></label>
    <label className="block font-medium">Mitigation plan<textarea name="mitigation_plan" rows={4} maxLength={5000} defaultValue={value("mitigation_plan")} className={inputClass} /></label>
    <label className="block font-medium">Review date<input name="review_date" type="date" defaultValue={value("review_date")} className={inputClass} /></label>
    <fieldset className="space-y-3"><legend className="font-medium">Projects</legend>
      {choices.projects.length === 0 && <p className="text-sm text-gray-600">No projects available to link.</p>}
      {choices.projects.map(project => {
        const checked = (state.values?.project_ids ?? risk?.project_ids ?? []).includes(project.id);
        return <label key={project.id} className="flex items-start gap-3"><input key={`${project.id}:${checked}`} type="checkbox" name="project_ids" value={project.id} defaultChecked={checked} className="mt-1" /><span>{project.name}</span></label>;
      })}
    </fieldset>
    <fieldset className="space-y-3"><legend className="font-medium">Strategic objectives</legend>
      {choices.objectives.length === 0 && <p className="text-sm text-gray-600">No strategic objectives available to link.</p>}
      {choices.objectives.map(objective => {
        const checked = (state.values?.objective_ids ?? risk?.objective_ids ?? []).includes(objective.id);
        return <label key={objective.id} className="flex items-start gap-3"><input key={`${objective.id}:${checked}`} type="checkbox" name="objective_ids" value={objective.id} defaultChecked={checked} className="mt-1" /><span>{objective.title}</span></label>;
      })}
    </fieldset>
    <p className="text-sm text-gray-600">Project and objective links are optional. Clear all selections to remove links.</p>
    <div className="flex items-center gap-5"><button disabled={pending} className="rounded bg-gray-900 px-4 py-2 text-white disabled:opacity-50">{pending ? "Saving..." : risk ? "Save changes" : "Create risk"}</button>
      <Link href={risk ? `/risks/${risk.id}` : "/risks"} className="underline">Cancel</Link></div>
  </form>;
}
