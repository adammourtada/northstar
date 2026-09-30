import { expect, it } from "vitest";
import { canManageObjectives, objectiveError, objectiveInput, objectivePriorities, objectiveStatuses } from "@/lib/objective-input";

function form(overrides: Record<string, string> = {}) {
  const data = new FormData();
  Object.entries({ title: "Objective", priority: "medium", status: "draft", progress_percent: "0", ...overrides })
    .forEach(([key, value]) => data.set(key, value));
  return data;
}

it("normalizes input and ignores identity, tenant, and role fields", () => {
  expect(objectiveInput(form({ title: " \tGoal\n", description: " \nDetails\t", created_by: "other", owner_id: "other", organization_id: "foreign", role: "owner" })).input)
    .toEqual({ title: "Goal", description: "Details", priority: "medium", status: "draft", progress_percent: 0, start_date: null, target_date: null });
  expect(objectiveInput(form({ description: " \n " })).input?.description).toBeNull();
});
it.each(["", " ", "\t\n", "\u00a0"])("rejects blank title %j", (title) => {
  expect(objectiveInput(form({ title })).error).toBe("Enter an objective title.");
});
it.each(objectivePriorities)("accepts priority %s", (priority) => expect(objectiveInput(form({ priority })).input?.priority).toBe(priority));
it.each(["", "urgent", "HIGH"])("rejects priority %s", (priority) => expect(objectiveInput(form({ priority })).error).toBeTruthy());
it.each(objectiveStatuses)("accepts status %s", (status) => expect(objectiveInput(form({ status })).input?.status).toBe(status));
it.each(["", "on_hold", "ACTIVE"])("rejects status %s", (status) => expect(objectiveInput(form({ status })).error).toBeTruthy());
it.each(["0", "100", "52"])("accepts progress %s", (progress_percent) => expect(objectiveInput(form({ progress_percent })).input?.progress_percent).toBe(Number(progress_percent)));
it.each(["-1", "101", "1.5", "NaN", "Infinity", "", "1e2"])("rejects progress %s", (progress_percent) => expect(objectiveInput(form({ progress_percent })).error).toBeTruthy());
it.each([
  ["2026-09-01", "2026-09-30"], ["2026-09-01", "2026-09-01"], ["", "2028-02-29"], ["2026-09-01", ""],
])("accepts date range %s to %s", (start_date, target_date) => expect(objectiveInput(form({ start_date, target_date })).input).toBeTruthy());
it.each([
  ["2026-09-30", "2026-09-01"], ["2026-02-30", ""], ["", "2026-02-29"], ["invalid", ""], ["0000-01-01", ""],
])("rejects date range %s to %s", (start_date, target_date) => expect(objectiveInput(form({ start_date, target_date })).error).toBeTruthy());
it("rejects file-valued input", () => {
  const data = form(); data.set("title", new Blob(["title"]));
  expect(objectiveInput(data).error).toBeTruthy();
});
it.each([["owner", true], ["admin", true], ["manager", true], ["member", false], ["viewer", false], ["unknown", false]] as const)("role %s manage=%s", (role, allowed) => expect(canManageObjectives(role)).toBe(allowed));
it("maps only known error codes to safe messages", () => {
  expect(objectiveError("42501")).toContain("permission");
  for (const code of ["23502", "23514", "22007", "22008", "22P02"]) expect(objectiveError(code)).toContain("Check the objective details");
  expect(objectiveError("sensitive SQL")).toBe("Unable to save objective. Please try again.");
});
