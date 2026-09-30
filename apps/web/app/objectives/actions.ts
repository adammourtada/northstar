"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { canManageObjectives, objectiveInput, type ObjectiveInput } from "@/lib/objective-input";
import { currentObjectiveOrganization, createObjective, getObjective, updateObjective } from "@/lib/objectives";

export type ObjectiveFormState = {
  error: string;
  values?: Record<keyof ObjectiveInput, string>;
};

export async function saveObjective(expectedOrganization: string, id: string | null, _state: ObjectiveFormState, form: FormData): Promise<ObjectiveFormState> {
  // Return only editable text fields, preserving the original input even when invalid.
  const fields = ["title", "description", "priority", "status", "progress_percent", "start_date", "target_date"] as const;
  const values = Object.fromEntries(fields.map((field) => {
    const value = form.get(field);
    return [field, typeof value === "string" ? value : ""];
  })) as Record<keyof ObjectiveInput, string>;
  const failure = (error: string): ObjectiveFormState => ({ error, values });
  const organization = await currentObjectiveOrganization();
  if (!organization) return failure("Unable to load organizations. Please try again.");
  // A workspace switch in another tab must not silently save into the wrong tenant.
  if (organization.id !== expectedOrganization) return failure("Your workspace changed. Return to objectives and try again.");
  if (!canManageObjectives(organization.role)) return failure("You do not have permission to manage objectives.");
  const parsed = objectiveInput(form);
  if (parsed.error) return failure(parsed.error);
  if (!parsed.input) return failure("Enter valid objective details.");
  if (id) {
    const result = await getObjective(organization.id, id);
    if (result.error) return failure(result.error);
    if (!result.objective) return failure("Objective unavailable or access denied.");
  }
  const result = id ? await updateObjective(id, parsed.input) : await createObjective(organization.id, parsed.input);
  if (result.error) return failure(result.error);
  revalidatePath("/objectives");
  if (id) revalidatePath(`/objectives/${id}/edit`);
  redirect("/objectives");
}
