import "server-only";
import { currentKpiOrganization, getKpi } from "@/lib/kpis";
import { createClient } from "@/lib/supabase/server";
import { isUuid } from "@/lib/project-input";
import { canManageKpis } from "@/lib/kpi-input";
import { measurementError, type MeasurementInput } from "@/lib/measurement-input";

export type KpiMeasurement = MeasurementInput & { id: string; organization_id: string; kpi_id: string; recorded_by: string; created_at: string };
export async function listKpiMeasurements(organizationId: string, kpiId: string): Promise<KpiMeasurement[] | null> {
  const organization = await currentKpiOrganization();
  if (!organization || organization.id !== organizationId || !isUuid(kpiId)) return null;
  try {
    const supabase = await createClient();
    const measurements: KpiMeasurement[] = [];
    // Fetch bounded pages so Supabase's default row cap cannot silently truncate history.
    const pageSize = 500;
    for (let offset = 0; ; offset += pageSize) {
      const { data, error } = await supabase.from("kpi_measurements")
        .select("id, organization_id, kpi_id, value::text, measured_at, notes, recorded_by, created_at")
        .eq("organization_id", organization.id).eq("kpi_id", kpiId)
        .order("measured_at", { ascending: false }).order("created_at", { ascending: false }).order("id", { ascending: false })
        .range(offset, offset + pageSize - 1);
      if (error || !data) return null;
      measurements.push(...data as KpiMeasurement[]);
      if (data.length < pageSize) return measurements;
    }
  } catch { return null; }
}
// Both history and latest use the same deterministic database ordering.
export async function getKpiPerformance(organizationId: string, kpiId: string) {
  const organization = await currentKpiOrganization();
  if (!organization || organization.id !== organizationId) return { kpi: null };
  const result = await getKpi(organization.id, kpiId);
  if (!result.kpi) return result;
  const measurements = await listKpiMeasurements(organization.id, kpiId);
  return { ...result, measurements, latest: measurements?.[0] ?? null };
}
export async function createKpiMeasurement(organizationId: string, kpiId: string, input: MeasurementInput) {
  const organization = await currentKpiOrganization();
  if (!organization || organization.id !== organizationId || !canManageKpis(organization.role) || !isUuid(kpiId)) return { error: measurementError("42501") };
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("create_kpi_measurement", {
      p_organization_id: organization.id, p_kpi_id: kpiId,
      p_value: input.value, p_measured_at: input.measured_at, p_notes: input.notes,
    });
    if (error || typeof data !== "string") return { error: measurementError(error?.code) };
    return { id: data };
  } catch { return { error: measurementError() }; }
}
