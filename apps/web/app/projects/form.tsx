"use client";

import { useActionState } from "react";
import Link from "next/link";
import { projectPriorities, projectStatuses } from "@/lib/project-input";
import type { Project } from "@/lib/projects";
import { saveProject } from "./actions";

export function ProjectForm({ organizationId, project, objectives }: { organizationId: string; project?: Project; objectives: { id: string; title: string }[] }) {
  const [state, action, pending] = useActionState(saveProject.bind(null, organizationId, project?.id ?? null), { error: "" });
  const selectedObjectives = state.values?.objective_ids ?? project?.objective_ids ?? [];
  const inputClass = "mt-2 block w-full rounded border border-gray-300 px-3 py-2 focus:outline-2 focus:outline-blue-700";
  return <form action={action} className="mt-6 space-y-5">
    {state.error && <p role="alert" className="text-red-700">{state.error}</p>}
    <label className="block font-medium">Project name
      <input name="name" required defaultValue={state.values?.name ?? project?.name ?? ""} className={inputClass} />
    </label>
    <label className="block font-medium">Description
      <textarea name="description" rows={4} defaultValue={state.values?.description ?? project?.description ?? ""} className={inputClass} />
    </label>
    <div className="grid gap-5 sm:grid-cols-2">
      <label className="block font-medium">Priority
        {/* Remount when the submitted default changes so native reset uses it. */}
        <select key={state.values?.priority ?? project?.priority ?? "medium"} name="priority" defaultValue={state.values?.priority ?? project?.priority ?? "medium"} className={inputClass}>
          {projectPriorities.map((value) => <option key={value} value={value}>{value}</option>)}
        </select>
      </label>
      <label className="block font-medium">Status
        <select key={state.values?.status ?? project?.status ?? "planned"} name="status" defaultValue={state.values?.status ?? project?.status ?? "planned"} className={inputClass}>
          {projectStatuses.map((value) => <option key={value} value={value}>{value.replaceAll("_", " ")}</option>)}
        </select>
      </label>
    </div>
    <div className="grid gap-5 sm:grid-cols-2">
      <label className="block font-medium">Start date
        <input name="start_date" type="date" defaultValue={state.values?.start_date ?? project?.start_date ?? ""} className={inputClass} />
      </label>
      <label className="block font-medium">Target date
        <input name="target_date" type="date" defaultValue={state.values?.target_date ?? project?.target_date ?? ""} className={inputClass} />
      </label>
    </div>
    <fieldset className="space-y-3">
      <legend className="font-medium">Strategic objectives</legend>
      <p className="text-sm text-gray-600">Choose zero or more objectives this project supports.</p>
      {objectives.length === 0 ? <p className="text-sm text-gray-600">No strategic objectives available to link. You can still create a project.</p>
        : objectives.map((objective) => {
          const checked = selectedObjectives.includes(objective.id);
          return <label key={objective.id} className="flex items-start gap-3">
            <input key={`${objective.id}:${checked}`} type="checkbox" name="objective_ids" value={objective.id} defaultChecked={checked} className="mt-1" />
            <span>{objective.title}</span>
          </label>;
        })}
    </fieldset>
    <div className="flex items-center gap-5">
      <button disabled={pending} className="rounded bg-gray-900 px-4 py-2 text-white disabled:opacity-50">
        {pending ? "Saving..." : project ? "Save changes" : "Create project"}
      </button>
      <Link href="/projects" className="underline">Cancel</Link>
    </div>
  </form>;
}
