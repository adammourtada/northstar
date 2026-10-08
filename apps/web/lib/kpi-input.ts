import { isUuid } from "@/lib/project-input";

export const kpiDirections = ["increase", "decrease", "maintain"] as const;
export const kpiStatuses = ["active", "paused", "archived"] as const;
export const kpiFrequencies = ["daily", "weekly", "monthly", "quarterly", "annually"] as const;
export const kpiFields = ["name", "description", "unit", "target_value", "direction", "reporting_frequency", "status", "objective_id"] as const;
export type KpiInput = {
  name: string; description: string | null; unit: string; target_value: string | null;
  direction: typeof kpiDirections[number]; status: typeof kpiStatuses[number];
  reporting_frequency: typeof kpiFrequencies[number] | null; objective_id: string | null;
};
export type KpiFormState = { error: string; values?: Record<keyof KpiInput, string> };
export function canManageKpis(role: string) { return ["owner", "admin", "manager"].includes(role); }
export function kpiFormValues(form: FormData): Record<keyof KpiInput, string> {
  return Object.fromEntries(kpiFields.map(field => {
    const value = form.get(field); return [field, typeof value === "string" ? value : ""];
  })) as Record<keyof KpiInput, string>;
}
// Plain decimal strings: at most 20 integer and 10 fractional digits. Never use Number.
// PostgreSQL stores unrestricted numeric with matching bounds, avoiding scale rounding.
export function kpiInput(form: FormData): { input: KpiInput; error?: never } | { error: string; input?: never } {
  const values = kpiFormValues(form);
  for (const field of kpiFields) {
    if (form.getAll(field).length > 1 || (form.get(field) !== null && typeof form.get(field) !== "string")) return { error: "Enter valid KPI details." };
    values[field] = values[field].trim();
  }
  if (!values.name || values.name.length > 200) return { error: "Enter a KPI name of 1 to 200 characters." };
  if (!values.unit || values.unit.length > 80) return { error: "Enter a unit of 1 to 80 characters." };
  if (values.description.length > 5000) return { error: "Description must be at most 5000 characters." };
  if (!kpiDirections.some(v => v === values.direction)) return { error: "Choose a valid direction." };
  if (!kpiStatuses.some(v => v === values.status)) return { error: "Choose a valid status." };
  if (values.reporting_frequency && !kpiFrequencies.some(v => v === values.reporting_frequency)) return { error: "Choose a valid reporting frequency." };
  if (values.target_value && !/^-?[0-9]{1,20}(\.[0-9]{1,10})?$/.test(values.target_value)) return { error: "Enter a decimal target with at most 20 integer and 10 fractional digits (no exponent)." };
  if (values.objective_id && !isUuid(values.objective_id)) return { error: "Choose a valid strategic objective." };
  return { input: { name: values.name, description: values.description || null, unit: values.unit,
    target_value: values.target_value || null, direction: values.direction as KpiInput["direction"],
    status: values.status as KpiInput["status"], reporting_frequency: (values.reporting_frequency || null) as KpiInput["reporting_frequency"],
    objective_id: values.objective_id.toLowerCase() || null } };
}
export function kpiError(code?: string) {
  if (code === "42501") return "KPI unavailable or you no longer have permission to manage it.";
  if (["22023", "23503"].includes(code ?? "")) return "Selected objective is unavailable. Refresh the form and choose again.";
  if (["23502", "23514", "22P02", "22003"].includes(code ?? "")) return "Check the KPI details and try again.";
  return "Unable to save KPI. Please try again.";
}
