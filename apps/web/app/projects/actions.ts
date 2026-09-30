"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { canManageProjects, projectInput, projectFormValues, type ProjectFormState } from "@/lib/project-input";
import { currentProjectOrganization, createProject, getProject, listProjectObjectives, updateProject } from "@/lib/projects";

export async function saveProject(expectedOrganization: string, id: string | null, _state: ProjectFormState, form: FormData): Promise<ProjectFormState> {
  const failure = (error: string): ProjectFormState => ({ error, values: projectFormValues(form) });
  const organization = await currentProjectOrganization();
  if (!organization) return failure("Unable to load organizations. Please try again.");
  if (organization.id !== expectedOrganization) return failure("Your workspace changed. Return to projects and try again.");
  if (!canManageProjects(organization.role)) return failure("You do not have permission to manage projects.");
  const parsed = projectInput(form);
  if (!parsed.input) return failure(parsed.error);
  if (id !== null) {
    const result = await getProject(organization.id, id);
    if (result.error) return failure(result.error);
    if (!result.project) return failure("Project unavailable or access denied.");
  }
  const objectives = await listProjectObjectives(organization.id);
  if (!objectives) return failure("Unable to load strategic objectives. Please try again.");
  const available = new Set(objectives.map((objective) => objective.id));
  if (parsed.input.objective_ids.some((objectiveId) => !available.has(objectiveId))) {
    return failure("Selected objectives are unavailable. Refresh the form and choose again.");
  }
  // The RPC independently checks membership, role, and every selected objective.
  const result = id !== null ? await updateProject(id, parsed.input) : await createProject(organization.id, parsed.input);
  if (result.error) return failure(result.error);
  revalidatePath("/projects");
  if (id) revalidatePath(`/projects/${id}/edit`);
  redirect("/projects");
}
