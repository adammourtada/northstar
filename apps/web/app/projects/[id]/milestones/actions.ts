"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { currentProjectOrganization, getProject } from "@/lib/projects";
import { createMilestone, getMilestone, updateMilestone } from "@/lib/milestones";
import { canManageMilestones, milestoneInput, milestoneFormValues, type MilestoneFormState } from "@/lib/milestone-input";

export async function saveMilestone(expectedOrganization: string, projectId: string, id: string | null, _state: MilestoneFormState, form: FormData): Promise<MilestoneFormState> {
  const failure = (error: string): MilestoneFormState => ({ error, values: milestoneFormValues(form) });
  const organization = await currentProjectOrganization();
  if (!organization) return failure("Unable to load organizations. Please try again.");
  if (organization.id !== expectedOrganization) return failure("Your workspace changed. Return to projects and try again.");
  if (!canManageMilestones(organization.role)) return failure("You do not have permission to manage milestones.");
  const parent = await getProject(organization.id, projectId);
  if (parent.error) return failure(parent.error);
  if (!parent.project) return failure("Project unavailable or access denied.");
  if (id !== null) {
    const result = await getMilestone(organization.id, parent.project.id, id);
    if (result.error) return failure(result.error);
    if (!result.milestone) return failure("Milestone unavailable or access denied.");
  }
  const parsed = milestoneInput(form);
  if (!parsed.input) return failure(parsed.error);
  const result = id !== null ? await updateMilestone(id, parsed.input) : await createMilestone(parent.project.id, parsed.input);
  if (result.error) return failure(result.error);
  revalidatePath(`/projects/${parent.project.id}`);
  if (id) revalidatePath(`/projects/${parent.project.id}/milestones/${id}/edit`);
  redirect(`/projects/${parent.project.id}`);
}
