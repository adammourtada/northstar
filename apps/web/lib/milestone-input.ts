export const milestoneStatuses = ["not_started", "in_progress", "completed", "blocked", "cancelled"] as const;

export type MilestoneInput = {
  name: string;
  description: string | null;
  status: typeof milestoneStatuses[number];
  progress_percent: number;
  due_date: string | null;
};

export function canManageMilestones(role: string) {
  return ["owner", "admin", "manager"].includes(role);
}

function validDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || value.startsWith("0000")) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

export function milestoneInput(form: FormData): { input: MilestoneInput; error?: never } | { error: string; input?: never } {
  const fields = ["name", "description", "status", "progress_percent", "due_date"] as const;
  const values: Record<string, string> = {};
  for (const field of fields) {
    const value = form.get(field);
    if (value !== null && typeof value !== "string") return { error: "Enter valid milestone details." };
    values[field] = value?.trim() ?? "";
  }
  if (!values.name) return { error: "Enter a milestone name." };
  const status = values.status;
  if (!milestoneStatuses.some((item) => item === status)) return { error: "Choose a valid status." };
  if (!/^\d+$/.test(values.progress_percent) || Number(values.progress_percent) > 100) {
    return { error: "Progress must be a whole number from 0 to 100." };
  }
  const due = values.due_date || null;
  if (due && !validDate(due)) return { error: "Enter a valid due date." };
  return { input: {
    name: values.name, description: values.description || null,
    status: status as MilestoneInput["status"],
    progress_percent: status === "completed" ? 100 : Number(values.progress_percent), due_date: due,
  } };
}

export function milestoneError(code?: string) {
  if (code === "42501") return "Milestone unavailable or you no longer have permission to manage it.";
  if (["23502", "23514", "22007", "22008", "22P02"].includes(code ?? "")) return "Check the milestone details and try again.";
  return "Unable to save milestone. Please try again.";
}

export type MilestoneFormValues = Record<keyof MilestoneInput, string>;
export type MilestoneFormState = { error: string; values?: MilestoneFormValues };
export function milestoneFormValues(form: FormData): MilestoneFormValues {
  const text = (key: string) => { const value = form.get(key); return typeof value === "string" ? value : ""; };
  return { name: text("name"), description: text("description"), status: text("status"), progress_percent: text("progress_percent"), due_date: text("due_date") };
}
