import { expect, it } from "vitest";
import { kpiInput, canManageKpis, kpiError } from "@/lib/kpi-input";
const details = { name: "Response time", unit: "hours", description: "Details", target_value: "48.125", direction: "decrease", status: "active", reporting_frequency: "monthly", objective_id: "" };
const form = (changes: Record<string, string> = {}) => {
  const result = new FormData(); Object.entries({ ...details, ...changes }).forEach(([k,v]) => result.set(k,v)); return result;
};
it("validates creation and replacement update fields without numeric coercion", () => {
  expect(kpiInput(form()).input).toEqual({ ...details, objective_id: null });
  expect(kpiInput(form({ name: " Updated ", status: "paused", direction: "maintain", target_value: "99999999999999999999.1234567890" })).input).toMatchObject({ name: "Updated", status: "paused", direction: "maintain", target_value: "99999999999999999999.1234567890" });
});
it.each(["", " ", "\t\n"])("rejects blank names and units: %j", value => {
  expect(kpiInput(form({ name: value })).error).toContain("name");
  expect(kpiInput(form({ unit: value })).error).toContain("unit");
});
it.each(["direction", "status", "reporting_frequency"])("rejects invalid %s", field => expect(kpiInput(form({ [field]: "invalid" })).error).toBeTruthy());
it("accepts absent optional fields and cleared objective links", () => {
  const result = form({ description: "", target_value: "", reporting_frequency: "", objective_id: "" });
  result.delete("target_value");
  expect(kpiInput(result).input).toMatchObject({ description: null, target_value: null, reporting_frequency: null, objective_id: null });
});
it.each(["0", "-0.125", "12345678901234567890.1234567890", "001.20"])("keeps exact decimal %s", target_value => expect(kpiInput(form({ target_value })).input?.target_value).toBe(target_value));
it.each(["NaN", "Infinity", "-Infinity", "1e2", "12abc", "1,000", ".5", "1.", "+1", "--1", "1 2", "100000000000000000000", "0.12345678901"])("rejects malformed or unbounded target %s", target_value => expect(kpiInput(form({ target_value })).error).toContain("decimal"));
it("validates objective IDs", () => {
  expect(kpiInput(form({ objective_id: "11111111-1111-1111-1111-111111111111" })).input?.objective_id).toBe("11111111-1111-1111-1111-111111111111");
  expect(kpiInput(form({ objective_id: "foreign" })).error).toContain("objective");
});
it.each([["name", 201], ["unit", 81], ["description", 5001]] as const)("bounds %s length", (field, length) => expect(kpiInput(form({ [field]: "x".repeat(length) })).error).toBeTruthy());
it("rejects duplicate fields and file payloads", () => {
  const data = form(); data.append("target_value", "20"); expect(kpiInput(data).error).toBeTruthy();
  const file = form(); file.set("name", new Blob(["bad"])); expect(kpiInput(file).error).toBeTruthy();
});
it.each(["owner", "admin", "manager"])("allows %s management", role => expect(canManageKpis(role)).toBe(true));
it.each(["member", "viewer", "unknown"])("denies %s management", role => expect(canManageKpis(role)).toBe(false));
it("maps errors without exposing provider details", () => {
  expect(kpiError("42501")).toContain("permission"); expect(kpiError("23503")).toContain("objective");
  expect(kpiError("23514")).toContain("details"); expect(kpiError("secret")).not.toContain("secret");
});
