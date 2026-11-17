import { isUuid } from "@/lib/project-input";

export const riskStatuses = ["open", "monitoring", "mitigated", "accepted", "closed"] as const;
export type RiskInput = {
  title: string; description: string | null; owner_id: string | null;
  probability: number; impact: number; status: typeof riskStatuses[number];
  mitigation_plan: string | null; review_date: string | null;
  project_ids: string[]; objective_ids: string[];
};
const textFields = ["title", "description", "owner_id", "probability", "impact", "status", "mitigation_plan", "review_date"] as const;
export type RiskFormValues = Record<typeof textFields[number], string> & { project_ids: string[]; objective_ids: string[] };
export type RiskFormState = { error: string; values?: RiskFormValues };
export function canManageRisks(role: string) { return ["owner", "admin", "manager"].includes(role); }
export function riskExposure(probability: number, impact: number) { return probability * impact; }
export function riskFormValues(form: FormData): RiskFormValues {
  const values = Object.fromEntries(textFields.map(field => [field, typeof form.get(field) === "string" ? form.get(field) : ""]));
  return { ...values, project_ids: form.getAll("project_ids").filter((v): v is string => typeof v === "string"),
    objective_ids: form.getAll("objective_ids").filter((v): v is string => typeof v === "string") } as RiskFormValues;
}
function validDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || value.startsWith("0000")) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}
export function riskInput(form: FormData): { input: RiskInput; error?: never } | { error: string; input?: never } {
  const values = riskFormValues(form);
  for (const field of textFields) {
    if (form.getAll(field).length > 1 || (form.get(field) !== null && typeof form.get(field) !== "string")) return { error: "Enter valid risk details." };
    values[field] = values[field].trim();
  }
  if (!values.title || values.title.length > 200) return { error: "Enter a risk title of 1 to 200 characters." };
  if (values.description.length > 5000 || values.mitigation_plan.length > 5000) return { error: "Description and mitigation plan must each be at most 5000 characters." };
  if (!/^[1-5]$/.test(values.probability) || !/^[1-5]$/.test(values.impact)) return { error: "Choose probability and impact from 1 to 5." };
  if (!riskStatuses.some(status => status === values.status)) return { error: "Choose a valid risk status." };
  if (values.owner_id && !isUuid(values.owner_id)) return { error: "Choose an available risk owner." };
  if (values.review_date && !validDate(values.review_date)) return { error: "Enter a valid review date." };
  for (const field of ["project_ids", "objective_ids"] as const) {
    if (form.getAll(field).some(value => typeof value !== "string" || !isUuid(value))) return { error: "Choose available projects and strategic objectives." };
    values[field] = [...new Set(values[field].map(id => id.toLowerCase()))];
  }
  return { input: { title: values.title, description: values.description || null, owner_id: values.owner_id.toLowerCase() || null,
    probability: Number(values.probability), impact: Number(values.impact), status: values.status as RiskInput["status"],
    mitigation_plan: values.mitigation_plan || null, review_date: values.review_date || null,
    project_ids: values.project_ids, objective_ids: values.objective_ids } };
}
export function riskError(code?: string) {
  if (code === "42501") return "Risk unavailable or you no longer have permission to manage it.";
  if (["22023", "23503"].includes(code ?? "")) return "Selected owner, projects, or objectives are unavailable. Refresh the form and choose again.";
  if (["23502", "23514", "22P02", "22003", "22007", "22008"].includes(code ?? "")) return "Check the risk details and try again.";
  return "Unable to save risk. Please try again.";
}
