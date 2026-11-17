import "server-only";
import { requireIdentity } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { isUuid } from "@/lib/project-input";
import { riskError, type RiskInput } from "@/lib/risk-input";
import { listProjects } from "@/lib/projects";
import { listObjectives } from "@/lib/objectives";
export { currentObjectiveOrganization as currentRiskOrganization } from "@/lib/objectives";

export type RiskOwner = { user_id: string; role: string };
export type Risk = RiskInput & {
  id: string; organization_id: string; identified_at: string; created_at: string; updated_at: string;
  owner: RiskOwner | null; linked_projects: { id: string; name: string }[]; linked_objectives: { id: string; title: string }[];
};
export type RiskChoices = { owners: RiskOwner[]; projects: { id: string; name: string }[]; objectives: { id: string; title: string }[] };
type RiskRow = Omit<Risk, "project_ids" | "objective_ids" | "linked_projects" | "linked_objectives"> & {
  risk_projects: { project_id: string; projects: { id: string; name: string } | null }[];
  risk_objectives: { objective_id: string; strategic_objectives: { id: string; title: string } | null }[];
};
const columns = "id, organization_id, title, description, owner_id, probability, impact, status, mitigation_plan, identified_at, review_date, created_at, updated_at, owner:organization_members!risks_owner_tenant_fkey(user_id, role), risk_projects(project_id, projects(id, name)), risk_objectives(objective_id, strategic_objectives(id, title))";
function fromRow(row: RiskRow): Risk {
  const { risk_projects, risk_objectives, ...risk } = row;
  if ((risk.owner_id && !risk.owner) || risk_projects.some(link => !link.projects) || risk_objectives.some(link => !link.strategic_objectives)) throw new Error("Unavailable risk association");
  return { ...risk, project_ids: risk_projects.map(link => link.project_id), objective_ids: risk_objectives.map(link => link.objective_id),
    linked_projects: risk_projects.map(link => link.projects!).sort((a,b) => a.name.localeCompare(b.name)),
    linked_objectives: risk_objectives.map(link => link.strategic_objectives!).sort((a,b) => a.title.localeCompare(b.title)) };
}
export async function listRisks(organizationId: string): Promise<Risk[] | null> {
  await requireIdentity();
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.from("risks").select(columns).eq("organization_id", organizationId)
      .order("created_at", { ascending: false }).order("id");
    return error || !data ? null : (data as unknown as RiskRow[]).map(fromRow);
  } catch { return null; }
}
export async function getRisk(organizationId: string, id: string): Promise<{ risk: Risk | null; error?: string }> {
  await requireIdentity();
  if (!isUuid(id)) return { risk: null };
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.from("risks").select(columns).eq("organization_id", organizationId).eq("id", id).maybeSingle();
    if (error) return { risk: null, error: "Unable to load risk. Please try again." };
    return { risk: data ? fromRow(data as unknown as RiskRow) : null };
  } catch { return { risk: null, error: "Unable to load risk. Please try again." }; }
}
export async function listRiskChoices(organizationId: string): Promise<RiskChoices | null> {
  await requireIdentity();
  try {
    const supabase = await createClient();
    const [owners, projects, objectives] = await Promise.all([
      supabase.from("organization_members").select("user_id, role").eq("organization_id", organizationId).order("user_id"),
      listProjects(organizationId), listObjectives(organizationId),
    ]);
    if (owners.error || !owners.data || !projects || !objectives) return null;
    return { owners: owners.data as RiskOwner[], projects: projects.map(({id,name}) => ({id,name})), objectives: objectives.map(({id,title}) => ({id,title})) };
  } catch { return null; }
}
function rpcInput(input: RiskInput) {
  return { p_title: input.title, p_description: input.description, p_owner_id: input.owner_id,
    p_probability: input.probability, p_impact: input.impact, p_status: input.status,
    p_mitigation_plan: input.mitigation_plan, p_review_date: input.review_date,
    p_project_ids: input.project_ids, p_objective_ids: input.objective_ids };
}
export async function createRisk(organizationId: string, input: RiskInput) {
  await requireIdentity();
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("create_risk", { p_organization_id: organizationId, ...rpcInput(input) });
    if (error || typeof data !== "string") return { error: riskError(error?.code) };
    return { id: data };
  } catch { return { error: riskError() }; }
}
export async function updateRisk(id: string, input: RiskInput) {
  await requireIdentity();
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("update_risk", { p_risk_id: id, ...rpcInput(input) });
    if (error || typeof data !== "string") return { error: riskError(error?.code) };
    return { id: data };
  } catch { return { error: riskError() }; }
}
