"use client";
import { useActionState } from "react";
import Link from "next/link";
import { kpiDirections, kpiStatuses, kpiFrequencies } from "@/lib/kpi-input";
import type { Kpi } from "@/lib/kpis";
import { saveKpi } from "./actions";
export function KpiForm({ organizationId, kpi, objectives }: { organizationId: string; kpi?: Kpi; objectives: { id: string; title: string }[] }) {
  const [state, action, pending] = useActionState(saveKpi.bind(null, organizationId, kpi?.id ?? null), { error: "" });
  const inputClass = "mt-2 block w-full rounded border border-gray-300 px-3 py-2 focus:outline-2 focus:outline-blue-700";
  const value = (field: keyof NonNullable<typeof state.values>) => state.values?.[field] ?? kpi?.[field] ?? "";
  const select = (field: "direction" | "status" | "reporting_frequency", label: string, options: readonly string[], fallback: string) => {
    const selected = state.values?.[field] ?? kpi?.[field] ?? fallback;
    return <label className="block font-medium">{label}<select key={selected} name={field} defaultValue={selected} className={inputClass}>
      {selected && !options.includes(selected) && <option value={selected}>{selected}</option>}
      {field === "reporting_frequency" && <option value="">Not specified</option>}
      {options.map(v => <option key={v} value={v}>{v}</option>)}
    </select></label>;
  };
  const objective = value("objective_id");
  return <form action={action} className="mt-6 space-y-5">
    {state.error && <p role="alert" className="text-red-700">{state.error}</p>}
    <label className="block font-medium">KPI name<input name="name" required maxLength={200} defaultValue={value("name")} className={inputClass} /></label>
    <label className="block font-medium">Description<textarea name="description" rows={4} maxLength={5000} defaultValue={value("description")} className={inputClass} /></label>
    <label className="block font-medium">Unit<input name="unit" required maxLength={80} defaultValue={value("unit")} className={inputClass} /></label>
    <label className="block font-medium">Target value<input name="target_value" type="text" inputMode="decimal" defaultValue={value("target_value")} className={inputClass} aria-describedby="target-help" /></label>
    <p id="target-help" className="text-sm text-gray-600">Optional decimal: up to 20 integer and 10 fractional digits. Use a decimal point; exponents are unsupported.</p>
    {select("direction", "Direction", kpiDirections, "increase")}
    {select("reporting_frequency", "Reporting frequency", kpiFrequencies, "")}
    {select("status", "Status", kpiStatuses, "active")}
    <label className="block font-medium">Strategic objective<select key={objective} name="objective_id" defaultValue={objective} className={inputClass}>
      <option value="">No objective</option>
      {objective && !objectives.some(o => o.id === objective) && <option value={objective}>Unavailable objective — choose again</option>}
      {objectives.map(o => <option key={o.id} value={o.id}>{o.title}</option>)}
    </select></label>
    <div className="flex items-center gap-5"><button disabled={pending} className="rounded bg-gray-900 px-4 py-2 text-white disabled:opacity-50">{pending ? "Saving..." : kpi ? "Save changes" : "Create KPI"}</button><Link href="/kpis" className="underline">Cancel</Link></div>
  </form>;
}
