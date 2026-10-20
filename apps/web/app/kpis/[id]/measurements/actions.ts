"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { currentKpiOrganization, getKpi } from "@/lib/kpis";
import { canManageKpis } from "@/lib/kpi-input";
import { createKpiMeasurement } from "@/lib/kpi-measurements";
import { measurementFormValues, measurementInput, type MeasurementFormState } from "@/lib/measurement-input";

export async function saveMeasurement(expectedOrganization: string, kpiId: string, _state: MeasurementFormState, form: FormData): Promise<MeasurementFormState> {
  const failure = (error: string) => ({ error, values: measurementFormValues(form) });
  const organization = await currentKpiOrganization();
  if (!organization) return failure("Unable to load organizations. Please try again.");
  if (organization.id !== expectedOrganization) return failure("Your workspace changed. Return to KPIs and try again.");
  if (!canManageKpis(organization.role)) return failure("You do not have permission to record measurements.");
  const result = await getKpi(organization.id, kpiId);
  if (result.error) return failure(result.error);
  if (!result.kpi) return failure("KPI unavailable or access denied.");
  const parsed = measurementInput(form);
  if (!parsed.input) return failure(parsed.error);
  const saved = await createKpiMeasurement(organization.id, result.kpi.id, parsed.input);
  if (saved.error) return failure(saved.error);
  revalidatePath("/kpis");
  revalidatePath(`/kpis/${result.kpi.id}`);
  redirect(`/kpis/${result.kpi.id}`);
}
