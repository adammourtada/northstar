"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { canManageRisks, riskInput, riskFormValues, type RiskFormState } from "@/lib/risk-input";
import { currentRiskOrganization, createRisk, updateRisk, getRisk, listRiskChoices } from "@/lib/risks";

export async function saveRisk(expectedOrganization: string, id: string | null, _state: RiskFormState, form: FormData): Promise<RiskFormState> {
  const failure = (error: string) => ({ error, values: riskFormValues(form) });
  const organization = await currentRiskOrganization();
  if (!organization) return failure("Unable to load organizations. Please try again.");
  if (organization.id !== expectedOrganization) return failure("Your workspace changed. Return to risks and try again.");
  if (!canManageRisks(organization.role)) return failure("You do not have permission to manage risks.");
  const parsed = riskInput(form);
  if (!parsed.input) return failure(parsed.error);
  if (id !== null) {
    const result = await getRisk(organization.id, id);
    if (result.error) return failure(result.error);
    if (!result.risk) return failure("Risk unavailable or access denied.");
  }
  const choices = await listRiskChoices(organization.id);
  if (!choices) return failure("Unable to load risk associations. Please try again.");
  const input = parsed.input;
  if ((input.owner_id && !choices.owners.some(owner => owner.user_id === input.owner_id)) ||
      input.project_ids.some(id => !choices.projects.some(project => project.id === id)) ||
      input.objective_ids.some(id => !choices.objectives.some(objective => objective.id === id))) {
    return failure("Selected owner, projects, or objectives are unavailable. Refresh the form and choose again.");
  }
  // The RPC independently checks authorization and all associations in one transaction.
  const result = id !== null ? await updateRisk(id, input) : await createRisk(organization.id, input);
  if (result.error) return failure(result.error);
  revalidatePath("/risks");
  revalidatePath(`/risks/${result.id}`);
  if (id) revalidatePath(`/risks/${id}/edit`);
  redirect(`/risks/${result.id}`);
}
