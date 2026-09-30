export const projectPriorities = ["low", "medium", "high", "critical"] as const;
export const projectStatuses = ["planned", "active", "on_hold", "at_risk", "completed", "cancelled"] as const;

export type ProjectInput = {
  name: string;
  description: string | null;
  priority: typeof projectPriorities[number];
  status: typeof projectStatuses[number];
  objective_ids: string[];
  start_date: string | null;
  target_date: string | null;
};

export function canManageProjects(role: string) {
  return ["owner", "admin", "manager"].includes(role);
}

function validDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || value.startsWith("0000")) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

export function projectInput(form: FormData): { input: ProjectInput; error?: never } | { error: string; input?: never } {
  const fields = ["name", "description", "priority", "status", "start_date", "target_date"] as const;
  const values: Record<string, string> = {};
  for (const field of fields) {
    const value = form.get(field);
    if (value !== null && typeof value !== "string") return { error: "Enter valid project details." };
    values[field] = value?.trim() ?? "";
  }
  if (!values.name) return { error: "Enter a project name." };
  const priority = values.priority;
  const status = values.status;
  if (!projectPriorities.some((item) => item === priority)) return { error: "Choose a valid priority." };
  if (!projectStatuses.some((item) => item === status)) return { error: "Choose a valid status." };
  const selections = form.getAll("objective_ids");
  if (selections.some((value) => typeof value !== "string" || !isUuid(value))) {
    return { error: "Choose valid strategic objectives." };
  }
  const objectiveIds = [...new Set((selections as string[]).map((id) => id.toLowerCase()))];
  const start = values.start_date || null;
  const target = values.target_date || null;
  if ((start && !validDate(start)) || (target && !validDate(target))) return { error: "Enter valid dates." };
  if (start && target && target < start) return { error: "Target date must be on or after start date." };
  return { input: {
    name: values.name, description: values.description || null,
    priority: priority as ProjectInput["priority"], status: status as ProjectInput["status"],
    objective_ids: objectiveIds, start_date: start, target_date: target,
  } };
}

export function projectError(code?: string) {
  if (["22023", "23503"].includes(code ?? "")) return "Selected objectives are unavailable. Refresh the form and choose again.";
  if (code === "42501") return "Project unavailable or you no longer have permission to manage it.";
  if (["23502", "23514", "22007", "22008", "22P02"].includes(code ?? "")) return "Check the project details and try again.";
  return "Unable to save project. Please try again.";
}

export function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}

export type ProjectFormValues = Record<Exclude<keyof ProjectInput, "objective_ids">, string> & { objective_ids: string[] };
export type ProjectFormState = { error: string; values?: ProjectFormValues };

export function projectFormValues(form: FormData): ProjectFormValues {
  const text = (field: string) => { const value = form.get(field); return typeof value === "string" ? value : ""; };
  return {
    name: text("name"), description: text("description"), priority: text("priority"), status: text("status"),
    start_date: text("start_date"), target_date: text("target_date"),
    objective_ids: form.getAll("objective_ids").filter((value): value is string => typeof value === "string"),
  };
}
