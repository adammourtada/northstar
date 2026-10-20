"use client";
import Link from "next/link";
import { useActionState } from "react";
import { saveMeasurement } from "./actions";

export function MeasurementForm({ organizationId, kpiId }: { organizationId: string; kpiId: string }) {
  const [state, action, pending] = useActionState(saveMeasurement.bind(null, organizationId, kpiId), { error: "" });
  const inputClass = "mt-2 block w-full rounded border border-gray-300 px-3 py-2 focus:outline-2 focus:outline-blue-700";
  return <form action={action} className="mt-6 space-y-5">
    {state.error && <p role="alert" className="text-red-700">{state.error}</p>}
    <label className="block font-medium">Measurement value<input name="value" type="text" inputMode="decimal" required pattern="-?[0-9]{1,20}([.][0-9]{1,10})?" defaultValue={state.values?.value ?? ""} className={inputClass} /></label>
    <p className="text-sm text-gray-600">Use a plain decimal with up to 20 integer and 10 fractional digits.</p>
    <label className="block font-medium">Measurement date and time<input name="measured_at" type="text" required placeholder="2026-10-20T14:30:00-04:00" aria-describedby="measurement-time-help" defaultValue={state.values?.measured_at ?? ""} className={inputClass} /></label>
    <p id="measurement-time-help" className="text-sm text-gray-600">Include Z for UTC or an explicit time-zone offset, such as -04:00. History displays all times in UTC.</p>
    <label className="block font-medium">Notes (optional)<textarea name="notes" maxLength={5000} rows={4} defaultValue={state.values?.notes ?? ""} className={inputClass} /></label>
    <p className="text-sm text-gray-600">Measurements cannot be edited or deleted. Check the value and time before saving.</p>
    <div className="flex items-center gap-5"><button disabled={pending} className="rounded bg-gray-900 px-4 py-2 text-white disabled:opacity-50">{pending ? "Saving..." : "Save measurement"}</button>
      <Link href={`/kpis/${kpiId}`} className="underline">Cancel</Link></div>
  </form>;
}
