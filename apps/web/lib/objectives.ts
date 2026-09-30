import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { requireIdentity } from "@/lib/auth";
import { listOrganizations } from "@/lib/organizations";
import { organizationCookie } from "@/lib/organization-cookie";
import { organizationDestination } from "@/lib/organization-input";
import { createClient } from "@/lib/supabase/server";
import { objectiveError, type ObjectiveInput } from "@/lib/objective-input";

export type Objective = ObjectiveInput & { id: string; organization_id: string };
const columns = "id, organization_id, title, description, priority, status, progress_percent, start_date, target_date";

export async function currentObjectiveOrganization() {
  // listOrganizations requires identity and obtains membership from the database.
  const organizations = await listOrganizations();
  if (!organizations) return null;
  const selected = (await cookies()).get(organizationCookie)?.value;
  const destination = organizationDestination(organizations, selected);
  if (destination.redirect) redirect(destination.redirect);
  return destination.organization;
}

export async function listObjectives(organizationId: string): Promise<Objective[] | null> {
  await requireIdentity();
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.from("strategic_objectives").select(columns)
      .eq("organization_id", organizationId).order("created_at", { ascending: false }).order("id");
    return error ? null : data as Objective[] | null;
  } catch { return null; }
}

export async function getObjective(organizationId: string, id: string): Promise<{ objective: Objective | null; error?: string }> {
  await requireIdentity();
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.from("strategic_objectives").select(columns)
      .eq("organization_id", organizationId).eq("id", id).maybeSingle();
    if (error) return { objective: null, error: "Unable to load objective. Please try again." };
    return { objective: data as Objective | null };
  } catch { return { objective: null, error: "Unable to load objective. Please try again." }; }
}

function rpcInput(input: ObjectiveInput) {
  // Explicit allowlist: never spread user input into RPC parameters.
  return {
    p_title: input.title, p_description: input.description, p_priority: input.priority,
    p_status: input.status, p_progress_percent: input.progress_percent,
    p_start_date: input.start_date, p_target_date: input.target_date,
  };
}

export async function createObjective(organizationId: string, input: ObjectiveInput) {
  await requireIdentity();
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("create_strategic_objective", {
      p_organization_id: organizationId, ...rpcInput(input),
    });
    if (error || typeof data !== "string") return { error: objectiveError(error?.code) };
    return { id: data };
  } catch { return { error: objectiveError() }; }
}

export async function updateObjective(id: string, input: ObjectiveInput) {
  await requireIdentity();
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("update_strategic_objective", {
      p_objective_id: id, ...rpcInput(input),
    });
    if (error || typeof data !== "string") return { error: objectiveError(error?.code) };
    return { id: data };
  } catch { return { error: objectiveError() }; }
}
