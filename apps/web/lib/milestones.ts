import "server-only";
import { requireIdentity } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { isUuid } from "@/lib/project-input";
import { milestoneError, type MilestoneInput } from "@/lib/milestone-input";

export type Milestone = MilestoneInput & { id: string; organization_id: string; project_id: string; completed_at: string | null };
const columns = "id, organization_id, project_id, name, description, status, progress_percent, due_date, completed_at";

export async function listMilestones(organizationId: string, projectId: string): Promise<Milestone[] | null> {
  await requireIdentity();
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.from("milestones").select(columns)
      .eq("organization_id", organizationId).eq("project_id", projectId)
      .order("due_date", { ascending: true, nullsFirst: false }).order("id");
    return error ? null : data as Milestone[] | null;
  } catch { return null; }
}

export async function getMilestone(organizationId: string, projectId: string, id: string): Promise<{ milestone: Milestone | null; error?: string }> {
  await requireIdentity();
  if (!isUuid(id)) return { milestone: null };
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.from("milestones").select(columns)
      .eq("organization_id", organizationId).eq("project_id", projectId).eq("id", id).maybeSingle();
    if (error) return { milestone: null, error: "Unable to load milestone. Please try again." };
    return { milestone: data as Milestone | null };
  } catch { return { milestone: null, error: "Unable to load milestone. Please try again." }; }
}

function rpcInput(input: MilestoneInput) {
  return { p_name: input.name, p_description: input.description, p_status: input.status,
    p_progress_percent: input.progress_percent, p_due_date: input.due_date };
}
export async function createMilestone(projectId: string, input: MilestoneInput) {
  await requireIdentity();
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("create_milestone", { p_project_id: projectId, ...rpcInput(input) });
    if (error || typeof data !== "string") return { error: milestoneError(error?.code) };
    return { id: data };
  } catch { return { error: milestoneError() }; }
}
export async function updateMilestone(id: string, input: MilestoneInput) {
  await requireIdentity();
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("update_milestone", { p_milestone_id: id, ...rpcInput(input) });
    if (error || typeof data !== "string") return { error: milestoneError(error?.code) };
    return { id: data };
  } catch { return { error: milestoneError() }; }
}
