import { expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

const mock = vi.hoisted(() => ({ useActionState: vi.fn() }));
vi.mock("react", async (importOriginal) => ({ ...await importOriginal<typeof import("react")>(), useActionState: mock.useActionState }));
vi.mock("@/app/objectives/actions", () => ({ saveObjective: vi.fn() }));

import { ObjectiveForm } from "@/app/objectives/form";

it("redisplays all submitted values alongside the safe validation error", () => {
  mock.useActionState.mockReturnValue([{
    error: "Target date must be on or after start date.",
    values: {
      title: "Preserved title", description: "Preserved description\nSecond line", priority: "critical", status: "at_risk",
      progress_percent: "37", start_date: "2026-10-20", target_date: "2026-10-01",
    },
  }, vi.fn(), false]);
  const html = renderToStaticMarkup(<ObjectiveForm organizationId="workspace" />);
  expect(html).toContain("Target date must be on or after start date.");
  expect(html).toContain('value="Preserved title"');
  expect(html).toContain("Preserved description\nSecond line</textarea>");
  expect(html).toContain('value="critical" selected');
  expect(html).toContain('value="at_risk" selected');
  expect(html).toContain('value="37"');
  expect(html).toContain('value="2026-10-20"');
  expect(html).toContain('value="2026-10-01"');
});
