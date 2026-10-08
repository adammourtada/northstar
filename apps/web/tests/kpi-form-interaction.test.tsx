// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, it, vi } from "vitest";
import { kpiInput } from "@/lib/kpi-input";

vi.mock("@/app/kpis/actions", () => ({
  saveKpi: async (_organization: string, _id: string | null, _state: unknown, form: FormData) => ({
    error: kpiInput(form).error,
    values: Object.fromEntries(form),
  }),
}));

import { KpiForm } from "@/app/kpis/form";

it("preserves text, numeric and select values across repeated failures and automatic resets", async () => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  try {
    await act(async () => root.render(<KpiForm organizationId="workspace" objectives={[{ id: "22222222-2222-2222-2222-222222222222", title: "Customer experience" }]} />));
    const form = container.querySelector("form")!;
    const field = (name: string) => form.elements.namedItem(name) as HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement;
    const submitted = {
      name: "Keep my KPI", description: "Keep my description", unit: "hours", direction: "maintain", status: "paused",
      target_value: "not a number", reporting_frequency: "quarterly", objective_id: "22222222-2222-2222-2222-222222222222",
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
    expect(container.querySelector('[role="alert"]')?.textContent).toBe("Enter a decimal target with at most 20 integer and 10 fractional digits (no exponent).");
    for (const [name, value] of Object.entries(submitted)) expect(field(name).value, name).toBe(value);
    // A second failure after clearing the objective must preserve the cleared selection too.
    field("objective_id").value = "";
    field("target_value").value = "0.1234567890";
    field("name").value = " ";
    await act(async () => form.requestSubmit());
    expect(field("objective_id").value).toBe("");
    expect(field("target_value").value).toBe("0.1234567890");
    expect(field("name").value).toBe(" ");
  } finally {
    await act(async () => root.unmount());
    container.remove();
    vi.unstubAllGlobals();
  }
});
