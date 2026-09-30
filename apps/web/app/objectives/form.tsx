"use client";

import { useActionState } from "react";
import Link from "next/link";
import { objectivePriorities, objectiveStatuses } from "@/lib/objective-input";
import type { Objective } from "@/lib/objectives";
import { saveObjective } from "./actions";

export function ObjectiveForm({ organizationId, objective }: { organizationId: string; objective?: Objective }) {
  const [state, action, pending] = useActionState(saveObjective.bind(null, organizationId, objective?.id ?? null), { error: "" });
  const inputClass = "mt-2 block w-full rounded border border-gray-300 px-3 py-2 focus:outline-2 focus:outline-blue-700";
  return <form action={action} className="mt-6 space-y-5">
    {state.error && <p role="alert" className="text-red-700">{state.error}</p>}
    <label className="block font-medium">Title
      <input name="title" required defaultValue={state.values?.title ?? objective?.title ?? ""} className={inputClass} />
    </label>
    <label className="block font-medium">Description
      <textarea name="description" rows={4} defaultValue={state.values?.description ?? objective?.description ?? ""} className={inputClass} />
    </label>
    <div className="grid gap-5 sm:grid-cols-2">
      <label className="block font-medium">Priority
        {/* Remount when the submitted default changes so native reset uses it. */}
        <select key={state.values?.priority ?? objective?.priority ?? "medium"} name="priority" defaultValue={state.values?.priority ?? objective?.priority ?? "medium"} className={inputClass}>
          {objectivePriorities.map((value) => <option key={value} value={value}>{value}</option>)}
        </select>
      </label>
      <label className="block font-medium">Status
        <select key={state.values?.status ?? objective?.status ?? "draft"} name="status" defaultValue={state.values?.status ?? objective?.status ?? "draft"} className={inputClass}>
          {objectiveStatuses.map((value) => <option key={value} value={value}>{value.replaceAll("_", " ")}</option>)}
        </select>
      </label>
    </div>
    <label className="block font-medium">Progress (%)
      <input name="progress_percent" type="number" min={0} max={100} step={1} required defaultValue={state.values?.progress_percent ?? objective?.progress_percent ?? 0} className={inputClass} />
    </label>
    <div className="grid gap-5 sm:grid-cols-2">
      <label className="block font-medium">Start date
        <input name="start_date" type="date" defaultValue={state.values?.start_date ?? objective?.start_date ?? ""} className={inputClass} />
      </label>
      <label className="block font-medium">Target date
        <input name="target_date" type="date" defaultValue={state.values?.target_date ?? objective?.target_date ?? ""} className={inputClass} />
      </label>
    </div>
    <div className="flex items-center gap-5">
      <button disabled={pending} className="rounded bg-gray-900 px-4 py-2 text-white disabled:opacity-50">
        {pending ? "Saving..." : objective ? "Save changes" : "Create objective"}
      </button>
      <Link href="/objectives" className="underline">Cancel</Link>
    </div>
  </form>;
}
