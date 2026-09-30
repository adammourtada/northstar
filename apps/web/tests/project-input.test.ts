import { expect, it } from "vitest";
import { canManageProjects, projectError, projectInput, projectPriorities, projectStatuses } from "@/lib/project-input";

function form(overrides: Record<string, string> = {}) {
  const data = new FormData();
  Object.entries({ name: "Project", priority: "medium", status: "planned", ...overrides })
    .forEach(([key, value]) => data.set(key, value));
  return data;
}

it("normalizes input and ignores identity, tenant, and role fields", () => {
  expect(projectInput(form({ name: " \tGoal\n", description: " \nDetails\t", created_by: "other", owner_id: "other", organization_id: "foreign", role: "owner" })).input)
    .toEqual({ name: "Goal", description: "Details", priority: "medium", status: "planned", objective_ids: [], start_date: null, target_date: null });
  expect(projectInput(form({ description: " \n " })).input?.description).toBeNull();
});
it.each(["", " ", "\t\n", "\u00a0"])("rejects blank name %j", (name) => {
  expect(projectInput(form({ name })).error).toBe("Enter a project name.");
});
it.each(projectPriorities)("accepts priority %s", (priority) => expect(projectInput(form({ priority })).input?.priority).toBe(priority));
it.each(["", "urgent", "HIGH"])("rejects priority %s", (priority) => expect(projectInput(form({ priority })).error).toBeTruthy());
it.each(projectStatuses)("accepts status %s", (status) => expect(projectInput(form({ status })).input?.status).toBe(status));
it.each(["", "draft", "ACTIVE"])("rejects status %s", (status) => expect(projectInput(form({ status })).error).toBeTruthy());
it.each([
  ["2026-09-01", "2026-09-30"], ["2026-09-01", "2026-09-01"], ["", "2028-02-29"], ["2026-09-01", ""],
])("accepts date range %s to %s", (start_date, target_date) => expect(projectInput(form({ start_date, target_date })).input).toBeTruthy());
it.each([
  ["2026-09-30", "2026-09-01"], ["2026-02-30", ""], ["", "2026-02-29"], ["invalid", ""], ["0000-01-01", ""],
])("rejects date range %s to %s", (start_date, target_date) => expect(projectInput(form({ start_date, target_date })).error).toBeTruthy());
it("rejects file-valued input", () => {
  const data = form(); data.set("name", new Blob(["name"]));
  expect(projectInput(data).error).toBeTruthy();
});
it.each([["owner", true], ["admin", true], ["manager", true], ["member", false], ["viewer", false], ["unknown", false]] as const)("role %s manage=%s", (role, allowed) => expect(canManageProjects(role)).toBe(allowed));
it("maps only known error codes to safe messages", () => {
  expect(projectError("42501")).toContain("permission");
  for (const code of ["23502", "23514", "22007", "22008", "22P02"]) expect(projectError(code)).toContain("Check the project details");
  expect(projectError("sensitive SQL")).toBe("Unable to save project. Please try again.");
});

const first = "11111111-1111-4111-8111-111111111111";
const second = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
it.each([[], [first], [first, second], [first, second, first, second.toUpperCase()]])("normalizes objective selection %j", (...args) => {
  const ids = args.flat() as string[];
  const data = form(); ids.forEach((id) => data.append("objective_ids", id));
  expect(projectInput(data).input?.objective_ids).toEqual([...new Set(ids.map((id) => id.toLowerCase()))]);
});
it.each(["", "not-a-uuid", "11111111", "null"])("rejects malformed selection %s", (id) => {
  const data = form(); data.append("objective_ids", id);
  expect(projectInput(data).error).toBe("Choose valid strategic objectives.");
});
it("rejects file-valued objective selection", () => {
  const data = form(); data.append("objective_ids", new Blob(["id"]));
  expect(projectInput(data).error).toBeTruthy();
});
it.each(["22023", "23503"])("maps unavailable relationship %s without revealing existence", (code) => {
  expect(projectError(code)).toBe("Selected objectives are unavailable. Refresh the form and choose again.");
});
