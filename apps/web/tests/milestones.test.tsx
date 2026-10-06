import { beforeEach, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
const mock = vi.hoisted(() => ({ organization: vi.fn(), project: vi.fn(), get: vi.fn(), list: vi.fn(), create: vi.fn(), update: vi.fn(), revalidate: vi.fn() }));
vi.mock("@/lib/projects", () => ({ currentProjectOrganization: mock.organization, getProject: mock.project }));
vi.mock("@/lib/milestones", () => ({ getMilestone: mock.get, listMilestones: mock.list, createMilestone: mock.create, updateMilestone: mock.update }));
vi.mock("next/cache", () => ({ revalidatePath: mock.revalidate }));
vi.mock("next/navigation", () => ({ redirect: (path: string) => { throw new Error(`redirect:${path}`); }, notFound: () => { throw new Error("notFound"); } }));
import { saveMilestone } from "@/app/projects/[id]/milestones/actions";
import { MilestoneEditor } from "@/app/projects/[id]/milestones/editor";
import ProjectDetails from "@/app/projects/[id]/page";
import { milestoneInput } from "@/lib/milestone-input";

function form(values: Record<string, string> = {}) {
  const data = new FormData();
  Object.entries({ name: " Launch ", description: "", status: "in_progress", progress_percent: "45", due_date: "2028-02-29", ...values }).forEach(([key, value]) => data.set(key, value));
  return data;
}
beforeEach(() => {
  mock.organization.mockResolvedValue({ id: "org", name: "Acme", role: "owner" });
  mock.project.mockResolvedValue({ project: { id: "project", name: "Project", status: "planned", priority: "medium" } });
  mock.get.mockResolvedValue({ milestone: { id: "milestone" } }); mock.list.mockResolvedValue([]);
  mock.create.mockResolvedValue({ id: "milestone" }); mock.update.mockResolvedValue({ id: "milestone" });
});
it.each(["-1", "101", "1.5", "", "NaN", "1e2"])("rejects invalid progress %s", (progress_percent) => {
  expect(milestoneInput(form({ progress_percent })).error).toBeTruthy();
});
it("normalizes completion and validates dates, status, and names", () => {
  expect(milestoneInput(form({ status: "completed" })).input).toMatchObject({ name: "Launch", progress_percent: 100, description: null });
  const invalid: Record<string, string>[] = [{ due_date: "2026-02-29" }, { name: "  " }, { status: "other" }];
  for (const values of invalid) expect(milestoneInput(form(values)).error).toBeTruthy();
});
it.each(["member", "viewer"])("blocks %s writes and edit routes", async (role) => {
  mock.organization.mockResolvedValue({ id: "org", role });
  expect((await saveMilestone("org", "project", null, { error: "" }, form())).error).toContain("permission");
  await expect(MilestoneEditor({ projectId: "project" })).rejects.toThrow("redirect:/projects");
  const html = renderToStaticMarkup(await ProjectDetails({ params: Promise.resolve({ id: "project" }), searchParams: Promise.resolve({}) }));
  expect(html).toContain("read-only"); expect(html).not.toContain("New Milestone"); expect(mock.create).not.toHaveBeenCalled();
});
it("rejects changed workspaces and missing or foreign parent/milestone", async () => {
  expect((await saveMilestone("other", "project", null, { error: "" }, form())).error).toContain("workspace changed");
  mock.project.mockResolvedValue({ project: null });
  expect((await saveMilestone("org", "foreign", null, { error: "" }, form())).error).toContain("unavailable");
  mock.project.mockResolvedValue({ project: { id: "project" } }); mock.get.mockResolvedValue({ milestone: null });
  expect((await saveMilestone("org", "project", "foreign", { error: "" }, form())).error).toContain("unavailable");
  expect(mock.get).toHaveBeenCalledWith("org", "project", "foreign");
  expect(mock.create).not.toHaveBeenCalled(); expect(mock.update).not.toHaveBeenCalled();
});
it("creates and edits then refreshes the parent page", async () => {
  for (const id of [null, "milestone"]) await expect(saveMilestone("org", "project", id, { error: "" }, form())).rejects.toThrow("redirect:/projects/project");
  expect(mock.create).toHaveBeenCalledWith("project", expect.objectContaining({ progress_percent: 45 }));
  expect(mock.update).toHaveBeenCalledWith("milestone", expect.objectContaining({ name: "Launch" }));
  expect(mock.revalidate).toHaveBeenCalledWith("/projects/project");
});
it("retains submitted values on save errors", async () => {
  mock.create.mockResolvedValue({ error: "Try again" });
  expect(await saveMilestone("org", "project", null, { error: "" }, form())).toMatchObject({ error: "Try again", values: { name: " Launch ", progress_percent: "45" } });
});
it("distinguishes empty lists from load failures", async () => {
  const props = { params: Promise.resolve({ id: "project" }), searchParams: Promise.resolve({}) };
  expect(renderToStaticMarkup(await ProjectDetails(props))).toContain("No milestones yet"); mock.list.mockResolvedValue(null);
  expect(renderToStaticMarkup(await ProjectDetails(props))).toContain("Unable to load milestones");
});
