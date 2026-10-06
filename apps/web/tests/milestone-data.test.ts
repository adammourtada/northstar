import { beforeEach, expect, it, vi } from "vitest";
const mock = vi.hoisted(() => ({ identity: vi.fn(), from: vi.fn(), eq: vi.fn(), rpc: vi.fn(), single: vi.fn(), rows: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/auth", () => ({ requireIdentity: mock.identity }));
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => ({ from: mock.from, rpc: mock.rpc }) }));
import { listMilestones, getMilestone, createMilestone, updateMilestone } from "@/lib/milestones";
const id = "11111111-1111-4111-8111-111111111111";
const input = { name: "Launch", description: null, status: "not_started", progress_percent: 0, due_date: null } as const;
beforeEach(() => {
  mock.identity.mockResolvedValue({ id: "caller" });
  mock.rows.mockResolvedValue({ data: [], error: null }); mock.single.mockResolvedValue({ data: null, error: null });
  mock.rpc.mockResolvedValue({ data: id, error: null });
  const query = { select: () => query, eq: (key: string, value: string) => { mock.eq(key, value); return query; }, order: (key: string) => key === "id" ? mock.rows() : query, maybeSingle: mock.single };
  mock.from.mockReturnValue(query);
});
it("scopes reads to organization and parent project", async () => {
  expect(await listMilestones("org", "project")).toEqual([]);
  await getMilestone("org", "project", id);
  expect(mock.eq).toHaveBeenCalledWith("organization_id", "org");
  expect(mock.eq).toHaveBeenCalledWith("project_id", "project");
  expect(mock.eq).toHaveBeenCalledWith("id", id);
});
it("requires identity before every database operation", async () => {
  mock.identity.mockRejectedValue(new Error("login"));
  for (const operation of [() => listMilestones("org", "project"), () => getMilestone("org", "project", id), () => createMilestone("project", input), () => updateMilestone(id, input)]) await expect(operation()).rejects.toThrow("login");
  expect(mock.from).not.toHaveBeenCalled(); expect(mock.rpc).not.toHaveBeenCalled();
});
it("uses restricted RPCs and sanitizes database failures", async () => {
  await createMilestone("project", input); await updateMilestone(id, input);
  expect(mock.rpc).toHaveBeenCalledWith("create_milestone", expect.objectContaining({ p_project_id: "project", p_progress_percent: 0 }));
  expect(mock.rpc).toHaveBeenCalledWith("update_milestone", expect.objectContaining({ p_milestone_id: id }));
  mock.rpc.mockResolvedValue({ error: { code: "42501", message: "private data" } });
  expect((await updateMilestone(id, input)).error).toContain("permission");
  mock.rows.mockRejectedValue(new Error("private data")); expect(await listMilestones("org", "project")).toBeNull();
});
