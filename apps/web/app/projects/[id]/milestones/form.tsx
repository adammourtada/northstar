"use client";

import Link from "next/link";
import { useActionState } from "react";
import { milestoneStatuses } from "@/lib/milestone-input";
import type { Milestone } from "@/lib/milestones";
import { saveMilestone } from "./actions";

export function MilestoneForm({ organizationId, projectId, milestone }: { organizationId: string; projectId: string; milestone?: Milestone }) {
  const [state, action, pending] = useActionState(saveMilestone.bind(null, organizationId, projectId, milestone?.id ?? null), { error: "" });
  const inputClass = "mt-2 block w-full rounded border border-gray-300 px-3 py-2 focus:outline-2 focus:outline-blue-700";
  const status = state.values?.status ?? milestone?.status ?? "not_started";
  return <form action={action} className="mt-6 space-y-5">
    {state.error && <p role="alert" className="text-red-700">{state.error}</p>}
    <label className="block font-medium">Milestone name<input name="name" required defaultValue={state.values?.name ?? milestone?.name ?? ""} className={inputClass} /></label>
    <label className="block font-medium">Description<textarea name="description" rows={4} defaultValue={state.values?.description ?? milestone?.description ?? ""} className={inputClass} /></label>
    <label className="block font-medium">Status<select key={status} name="status" defaultValue={status} className={inputClass}>
      {milestoneStatuses.map((value) => <option key={value} value={value}>{value.replaceAll("_", " ")}</option>)}
    </select></label>
    <label className="block font-medium">Progress (%)<input name="progress_percent" type="number" min={0} max={100} step={1} required defaultValue={state.values?.progress_percent ?? milestone?.progress_percent ?? 0} className={inputClass} /></label>
    <p className="text-sm text-gray-600">Completed milestones are saved with 100% progress.</p>
    <label className="block font-medium">Due date<input name="due_date" type="date" defaultValue={state.values?.due_date ?? milestone?.due_date ?? ""} className={inputClass} /></label>
    <div className="flex items-center gap-5"><button disabled={pending} className="rounded bg-gray-900 px-4 py-2 text-white disabled:opacity-50">{pending ? "Saving..." : milestone ? "Save changes" : "Create milestone"}</button>
      <Link href={`/projects/${projectId}`} className="underline">Cancel</Link></div>
  </form>;
}
