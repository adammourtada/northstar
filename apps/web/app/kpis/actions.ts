"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { canManageKpis, kpiInput, kpiFormValues, type KpiFormState } from "@/lib/kpi-input";
import { listKpiObjectives, currentKpiOrganization, createKpi, getKpi, updateKpi } from "@/lib/kpis";

export async function saveKpi(expectedOrganization: string, id: string | null, _state: KpiFormState, form: FormData): Promise<KpiFormState> {
  const values = kpiFormValues(form);
  const failure = (error: string): KpiFormState => ({ error, values });
  const organization = await currentKpiOrganization();
  if (!organization) return failure("Unable to load organizations. Please try again.");
  // A workspace switch in another tab must not silently save into the wrong tenant.
  if (organization.id !== expectedOrganization) return failure("Your workspace changed. Return to KPIs and try again.");
  if (!canManageKpis(organization.role)) return failure("You do not have permission to manage KPIs.");
  const parsed = kpiInput(form);
  if (parsed.error) return failure(parsed.error);
  if (!parsed.input) return failure("Enter valid KPI details.");
  if (id) {
    const result = await getKpi(organization.id, id);
    if (result.error) return failure(result.error);
    if (!result.kpi) return failure("KPI unavailable or access denied.");
  }
  if (parsed.input.objective_id) {
    const objectives = await listKpiObjectives(organization.id);
    if (!objectives) return failure("Unable to load objectives. Please try again.");
    if (!objectives.some(objective => objective.id === parsed.input.objective_id)) return failure("Selected objective is unavailable. Refresh the form and choose again.");
  }
  const result = id ? await updateKpi(id, parsed.input) : await createKpi(organization.id, parsed.input);
  if (result.error) return failure(result.error);
  revalidatePath("/kpis");
  if (id) revalidatePath(`/kpis/${id}/edit`);
  redirect("/kpis");
}
