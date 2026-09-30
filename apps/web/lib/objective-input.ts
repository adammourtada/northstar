export const objectivePriorities = ["low", "medium", "high", "critical"] as const;
export const objectiveStatuses = ["draft", "active", "at_risk", "completed", "cancelled"] as const;

export type ObjectiveInput = {
  title: string;
  description: string | null;
  priority: typeof objectivePriorities[number];
  status: typeof objectiveStatuses[number];
  progress_percent: number;
  start_date: string | null;
  target_date: string | null;
};

export function canManageObjectives(role: string) {
  return ["owner", "admin", "manager"].includes(role);
}

function validDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || value.startsWith("0000")) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

export function objectiveInput(form: FormData): { input: ObjectiveInput; error?: never } | { error: string; input?: never } {
  const fields = ["title", "description", "priority", "status", "progress_percent", "start_date", "target_date"] as const;
  const values: Record<string, string> = {};
  for (const field of fields) {
    const value = form.get(field);
    if (value !== null && typeof value !== "string") return { error: "Enter valid objective details." };
    values[field] = value?.trim() ?? "";
  }
  if (!values.title) return { error: "Enter an objective title." };
  const priority = values.priority;
  const status = values.status;
  if (!objectivePriorities.some((item) => item === priority)) return { error: "Choose a valid priority." };
  if (!objectiveStatuses.some((item) => item === status)) return { error: "Choose a valid status." };
  if (!/^\d+$/.test(values.progress_percent) || Number(values.progress_percent) > 100) {
    return { error: "Progress must be a whole number from 0 to 100." };
  }
  const start = values.start_date || null;
  const target = values.target_date || null;
  if ((start && !validDate(start)) || (target && !validDate(target))) return { error: "Enter valid dates." };
  if (start && target && target < start) return { error: "Target date must be on or after start date." };
  return { input: {
    title: values.title, description: values.description || null,
    priority: priority as ObjectiveInput["priority"], status: status as ObjectiveInput["status"],
    progress_percent: Number(values.progress_percent), start_date: start, target_date: target,
  } };
}

export function objectiveError(code?: string) {
  if (code === "42501") return "Objective unavailable or you no longer have permission to manage it.";
  if (["23502", "23514", "22007", "22008", "22P02"].includes(code ?? "")) return "Check the objective details and try again.";
  return "Unable to save objective. Please try again.";
}
