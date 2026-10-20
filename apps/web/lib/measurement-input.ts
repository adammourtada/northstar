export const measurementFields = ["value", "measured_at", "notes"] as const;
export type MeasurementInput = { value: string; measured_at: string; notes: string | null };
export type MeasurementFormState = { error: string; values?: Record<typeof measurementFields[number], string> };
export function measurementFormValues(form: FormData) {
  return Object.fromEntries(measurementFields.map(field => [field, typeof form.get(field) === "string" ? form.get(field) : ""])) as Record<typeof measurementFields[number], string>;
}
// Require an explicit offset; reject calendar normalization and ambiguous local times.
export function validMeasurementTimestamp(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})T([01]\d|2[0-3]):([0-5]\d)(?::([0-5]\d)(?:\.(\d{1,6}))?)?(Z|[+-](?:0\d|1[0-4]):[0-5]\d)$/.exec(value);
  if (!match) return false;
  const year = Number(match[1]), month = Number(match[2]), day = Number(match[3]);
  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const days = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  if (year < 1 || month < 1 || month > 12 || day < 1 || day > days[month - 1]) return false;
  if (/^[+-]14:/.test(match[8]) && !match[8].endsWith(":00")) return false;
  if (match[8] === "-00:00") return false; // RFC 3339 unknown offset is not an instant.
  return Number.isFinite(Date.parse(value));
}
export function measurementInput(form: FormData): { input: MeasurementInput; error?: never } | { error: string; input?: never } {
  const values = measurementFormValues(form);
  for (const field of measurementFields) {
    if (form.getAll(field).length > 1 || (form.get(field) !== null && typeof form.get(field) !== "string")) return { error: "Enter valid measurement details." };
    values[field] = values[field].trim();
  }
  if (!/^-?[0-9]{1,20}(\.[0-9]{1,10})?$/.test(values.value)) return { error: "Enter a decimal value with at most 20 integer and 10 fractional digits (no exponent)." };
  if (!validMeasurementTimestamp(values.measured_at)) return { error: "Enter a valid measurement date and time with Z or an offset, for example 2026-10-20T14:30:00-04:00." };
  if (values.notes.length > 5000) return { error: "Notes must be at most 5000 characters." };
  return { input: { value: values.value, measured_at: values.measured_at, notes: values.notes || null } };
}
export function measurementError(code?: string) {
  if (code === "42501") return "KPI unavailable or you no longer have permission to record measurements.";
  if (["23502", "23503", "23514", "22P02", "22003", "22007", "22008"].includes(code ?? "")) return "Check the measurement details and try again.";
  return "Unable to record measurement. Please try again.";
}
