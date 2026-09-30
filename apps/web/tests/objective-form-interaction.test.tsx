// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, it, vi } from "vitest";
import { objectiveInput } from "@/lib/objective-input";

vi.mock("@/app/objectives/actions", () => ({
  saveObjective: async (_organization: string, _id: string | null, _state: unknown, form: FormData) => ({
    error: objectiveInput(form).error,
    values: Object.fromEntries(form),
  }),
}));

import { ObjectiveForm } from "@/app/objectives/form";

it("keeps high and active selected after a failed submission and automatic form reset", async () => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  try {
    await act(async () => root.render(<ObjectiveForm organizationId="workspace" />));
    const form = container.querySelector("form")!;
    const field = (name: string) => form.elements.namedItem(name) as HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement;
    expect(field("priority").value).toBe("medium");
    expect(field("status").value).toBe("draft");
    expect(field("progress_percent").value).toBe("0");
    const submitted = {
      title: "Keep my objective", description: "Keep my description", priority: "high", status: "active",
      progress_percent: "37", start_date: "2026-10-20", target_date: "2026-10-01",
    };
    await act(async () => {
      for (const [name, value] of Object.entries(submitted)) {
        field(name).value = value;
        field(name).dispatchEvent(new Event("change", { bubbles: true }));
      }
    });
    const reset = vi.spyOn(form, "reset");
    await act(async () => form.requestSubmit());
    expect(reset).toHaveBeenCalled();
    expect(container.querySelector('[role="alert"]')?.textContent).toBe("Target date must be on or after start date.");
    for (const [name, value] of Object.entries(submitted)) expect(field(name).value, name).toBe(value);
    expect((field("priority") as HTMLSelectElement).selectedOptions[0].value).toBe("high");
    expect((field("status") as HTMLSelectElement).selectedOptions[0].value).toBe("active");
  } finally {
    await act(async () => root.unmount());
    container.remove();
    vi.unstubAllGlobals();
  }
});
