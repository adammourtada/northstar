import { expect, it } from "vitest";
import { measurementInput, validMeasurementTimestamp } from "@/lib/measurement-input";
const form = (changes: Record<string, string> = {}) => {
  const form = new FormData();
  Object.entries({ value: "12345678901234567890.1234567890", measured_at: "2026-10-20T14:30:00-04:00", notes: "", ...changes }).forEach(([k,v]) => form.set(k,v));
  return form;
};
it.each(["0", "-80.1234567890", "99999999999999999999.9999999999", "-99999999999999999999.9999999999"])("preserves exact decimal %s", value => {
  expect(measurementInput(form({value})).input?.value).toBe(value);
});
it("preserves exact timestamp and trims optional notes", () => {
  expect(measurementInput(form()).input).toEqual({ value: "12345678901234567890.1234567890", measured_at: "2026-10-20T14:30:00-04:00", notes: null });
  expect(measurementInput(form({notes:" Notes "})).input?.notes).toBe("Notes");
});
it.each(["", " ", "NaN", "Infinity", "-Infinity", "1e3", "1.12345678901", "100000000000000000000", "-100000000000000000000", "1,000", ".5"])("rejects invalid decimal %s", value => {
  expect(measurementInput(form({value})).error).toContain("decimal");
});
it.each(["", "2026-02-29T12:00:00Z", "2026-04-31T12:00:00Z", "2026-10-20T14:30", "2026-10-20", "2026-10-20T24:00:00Z", "2026-10-20T12:60:00Z", "2026-10-20T12:00:00+14:01", "2026-10-20T12:00:00-00:00", "0000-01-01T00:00:00Z", "infinity"])("rejects invalid or ambiguous timestamp %s", measured_at => {
  expect(measurementInput(form({measured_at})).error).toContain("date and time");
});
it.each(["2024-02-29T12:00Z", "2026-10-20T12:00:00.123456+14:00", "2026-10-20T12:00:00-05:30"])("accepts explicit instant %s", value => {
  expect(validMeasurementTimestamp(value)).toBe(true);
});
it("rejects long notes, duplicates and file fields", () => {
  expect(measurementInput(form({notes:"x".repeat(5001)})).error).toContain("5000");
  for (const key of ["value", "measured_at", "notes"]) {
    const duplicate = form(); duplicate.append(key,"extra"); expect(measurementInput(duplicate).error).toContain("valid measurement");
    const file = form(); file.set(key,new Blob(["value"]),"file"); expect(measurementInput(file).error).toContain("valid measurement");
  }
  expect(measurementInput(new FormData()).error).toBeDefined();
});
