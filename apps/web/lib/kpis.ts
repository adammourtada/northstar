import "server-only";
import { isUuid } from "@/lib/project-input";
import { requireIdentity } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { kpiError, type KpiInput } from "@/lib/kpi-input";

export type Kpi = KpiInput & { id: string; organization_id: string; objective_title: string | null };
const columns = "id, organization_id, name, description, unit, target_value::text, direction, status, reporting_frequency, objective_id, strategic_objectives(id, title)";
type KpiRow = Kpi & { strategic_objectives: { id: string; title: string } | null };
function fromRow(row: KpiRow): Kpi {
  if (row.objective_id && !row.strategic_objectives) throw new Error("Unavailable alignment");
  const { strategic_objectives, ...kpi } = row;
  return { ...kpi, objective_title: strategic_objectives?.title ?? null };
}
export { currentObjectiveOrganization as currentKpiOrganization, listObjectives as listKpiObjectives } from "@/lib/objectives";

export async function listKpis(organizationId: string): Promise<Kpi[] | null> {
  await requireIdentity();
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.from("kpis").select(columns)
      .eq("organization_id", organizationId).order("created_at", { ascending: false }).order("id");
    return error || !data ? null : (data as unknown as KpiRow[]).map(fromRow);
  } catch { return null; }
}

export async function getKpi(organizationId: string, id: string): Promise<{ kpi: Kpi | null; error?: string }> {
  await requireIdentity();
  if (!isUuid(id)) return { kpi: null };
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.from("kpis").select(columns)
      .eq("organization_id", organizationId).eq("id", id).maybeSingle();
    if (error) return { kpi: null, error: "Unable to load KPI. Please try again." };
    return { kpi: data ? fromRow(data as unknown as KpiRow) : null };
  } catch { return { kpi: null, error: "Unable to load KPI. Please try again." }; }
}

function rpcInput(input: KpiInput) {
  // Explicit allowlist: never spread user input into RPC parameters.
  return {
    p_name: input.name, p_description: input.description, p_unit: input.unit,
    p_target_value: input.target_value, p_direction: input.direction,
    p_status: input.status, p_reporting_frequency: input.reporting_frequency, p_objective_id: input.objective_id,
  };
}

export async function createKpi(organizationId: string, input: KpiInput) {
  await requireIdentity();
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("create_kpi", {
      p_organization_id: organizationId, ...rpcInput(input),
    });
    if (error || typeof data !== "string") return { error: kpiError(error?.code) };
    return { id: data };
  } catch { return { error: kpiError() }; }
}

export async function updateKpi(id: string, input: KpiInput) {
  await requireIdentity();
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("update_kpi", {
      p_kpi_id: id, ...rpcInput(input),
    });
    if (error || typeof data !== "string") return { error: kpiError(error?.code) };
    return { id: data };
  } catch { return { error: kpiError() }; }
}
