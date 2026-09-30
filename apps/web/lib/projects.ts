import "server-only";
import { requireIdentity } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { isUuid, projectError, type ProjectInput } from "@/lib/project-input";

// Reuse the membership-validated workspace flow and RLS-protected objective list.
export { currentObjectiveOrganization as currentProjectOrganization, listObjectives as listProjectObjectives } from "@/lib/objectives";

export type LinkedObjective = { id: string; title: string };
export type Project = ProjectInput & {
  id: string; organization_id: string; completed_at: string | null; linked_objectives: LinkedObjective[];
};
type ProjectRow = Omit<Project, "objective_ids" | "linked_objectives"> & {
  project_objectives: { objective_id: string; strategic_objectives: LinkedObjective | null }[];
};
const columns = "id, organization_id, name, description, status, priority, start_date, target_date, completed_at, project_objectives(objective_id, strategic_objectives(id, title))";

function projectFromRow(row: ProjectRow): Project {
  const { project_objectives: links, ...project } = row;
  // Never silently present a failed/hidden relationship lookup as no alignment.
  if (links.some((link) => !link.strategic_objectives)) throw new Error("Unavailable alignment");
  return { ...project, objective_ids: links.map((link) => link.objective_id),
    linked_objectives: links.map((link) => link.strategic_objectives!).sort((a, b) => a.title.localeCompare(b.title)) };
}

export async function listProjects(organizationId: string): Promise<Project[] | null> {
  await requireIdentity();
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.from("projects").select(columns)
      .eq("organization_id", organizationId).order("created_at", { ascending: false }).order("id");
    if (error || !data) return null;
    return (data as unknown as ProjectRow[]).map(projectFromRow);
  } catch { return null; }
}

export async function getProject(organizationId: string, id: string): Promise<{ project: Project | null; error?: string }> {
  await requireIdentity();
  if (!isUuid(id)) return { project: null };
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.from("projects").select(columns)
      .eq("organization_id", organizationId).eq("id", id).maybeSingle();
    if (error) return { project: null, error: "Unable to load project. Please try again." };
    return { project: data ? projectFromRow(data as unknown as ProjectRow) : null };
  } catch { return { project: null, error: "Unable to load project. Please try again." }; }
}

function rpcInput(input: ProjectInput) {
  return {
    p_name: input.name, p_description: input.description, p_status: input.status, p_priority: input.priority,
    p_start_date: input.start_date, p_target_date: input.target_date, p_objective_ids: input.objective_ids,
  };
}

export async function createProject(organizationId: string, input: ProjectInput) {
  await requireIdentity();
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("create_project", { p_organization_id: organizationId, ...rpcInput(input) });
    if (error || typeof data !== "string") return { error: projectError(error?.code) };
    return { id: data };
  } catch { return { error: projectError() }; }
}

export async function updateProject(id: string, input: ProjectInput) {
  await requireIdentity();
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("update_project", { p_project_id: id, ...rpcInput(input) });
    if (error || typeof data !== "string") return { error: projectError(error?.code) };
    return { id: data };
  } catch { return { error: projectError() }; }
}
