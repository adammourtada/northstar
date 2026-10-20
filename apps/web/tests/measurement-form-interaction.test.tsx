// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, it, vi } from "vitest";
vi.mock("@/app/kpis/[id]/measurements/actions", () => ({
  saveMeasurement: async (_org: string, _id: string, _state: unknown, form: FormData) => ({
    error: "Unable to record measurement. Please try again.", values: Object.fromEntries(form),
  }),
}));
import { MeasurementForm } from "@/app/kpis/[id]/measurements/form";
it("preserves decimal, offset timestamp and notes after repeated failures and form resets", async () => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT",true);
  const container = document.createElement("div"); document.body.append(container);
  const root = createRoot(container);
  try {
    await act(async()=>root.render(<MeasurementForm organizationId="workspace" kpiId="kpi" />));
    const form = container.querySelector("form")!;
    const field = (name:string) => form.elements.namedItem(name) as HTMLInputElement;
    const submitted = {value:"-12345678901234567890.1234567890",measured_at:"2026-10-20T12:30:00-04:00",notes:"Keep my notes"};
    for(const [key,value] of Object.entries(submitted)) field(key).value=value;
    const reset = vi.spyOn(form,"reset");
    await act(async()=>form.requestSubmit());
    expect(reset).toHaveBeenCalled();
    expect(container.querySelector('[role="alert"]')?.textContent).toContain("Unable to record");
    for(const [key,value] of Object.entries(submitted)) expect(field(key).value).toBe(value);
    field("notes").value=""; field("value").value="0";
    await act(async()=>form.requestSubmit());
    expect(field("notes").value).toBe(""); expect(field("value").value).toBe("0");
    expect(container.querySelector("button")?.disabled).toBe(false);
    expect(container.querySelector("a")?.getAttribute("href")).toBe("/kpis/kpi");
  } finally { await act(async()=>root.unmount()); container.remove(); vi.unstubAllGlobals(); }
});
