// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, it, vi } from "vitest";
import type { Project } from "@/lib/projects";

const mock = vi.hoisted(() => ({ write: vi.fn() }));
vi.mock("@/lib/projects", () => ({
  currentProjectOrganization: async () => ({ id: "workspace", role: "owner" }),
  createProject: mock.write, updateProject: mock.write, getProject: vi.fn(), listProjectObjectives: vi.fn(),
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));
import { ProjectForm } from "@/app/projects/form";

const objectives = [
  { id: "11111111-1111-4111-8111-111111111111", title: "Improve service" },
  { id: "22222222-2222-4222-8222-222222222222", title: "Reduce delays" },
];
it.each([false, true])("preserves every field and checkbox across repeated failures (editing=%s)", async (editing) => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  const container = document.createElement("div"); document.body.append(container);
  const root = createRoot(container);
  const project: Project | undefined = editing ? {
    id: "33333333-3333-4333-8333-333333333333", organization_id: "workspace", name: "Original", description: null,
    priority: "medium", status: "planned", start_date: null, target_date: null, completed_at: null,
    objective_ids: [objectives[0].id], linked_objectives: [objectives[0]],
  } : undefined;
  try {
    await act(async () => root.render(<ProjectForm organizationId="workspace" project={project} objectives={objectives} />));
    const form = container.querySelector("form")!;
    const field = (name: string) => form.elements.namedItem(name) as HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement;
    const boxes = () => Array.from(form.querySelectorAll<HTMLInputElement>('input[type="checkbox"]'));
    expect(field("priority").value).toBe("medium"); expect(field("status").value).toBe("planned");
    expect(boxes().map((box) => box.checked)).toEqual([editing, false]);
    const submitted = { name: "  Keep name  ", description: "Keep\nDescription", priority: "high", status: "active", start_date: "2026-10-20", target_date: "2026-10-01" };
    // Change selections twice, including clearing all selections from an edit form.
    for (const selected of [[true, true], [false, false], [false, true]]) {
      await act(async () => {
        for (const [name, value] of Object.entries(submitted)) {
          field(name).value = value;
          field(name).dispatchEvent(new Event("change", { bubbles: true }));
        }
        boxes().forEach((box, index) => { box.checked = selected[index]; box.dispatchEvent(new Event("change", { bubbles: true })); });
      });
      const reset = vi.spyOn(form, "reset");
      await act(async () => form.requestSubmit());
      expect(reset).toHaveBeenCalled();
      expect(container.querySelector('[role="alert"]')?.textContent).toBe("Target date must be on or after start date.");
      for (const [name, value] of Object.entries(submitted)) expect(field(name).value, name).toBe(value);
      expect(boxes().map((box) => box.checked)).toEqual(selected);
    }
    expect(mock.write).not.toHaveBeenCalled();
  } finally {
    await act(async () => root.unmount()); container.remove(); vi.unstubAllGlobals();
  }
});
