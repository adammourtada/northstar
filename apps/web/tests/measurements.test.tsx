import { beforeEach, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
const mock = vi.hoisted(() => ({ identity: vi.fn(), organizations: vi.fn(), cookie: vi.fn(), from: vi.fn(), select: vi.fn(), eq: vi.fn(), order: vi.fn(), range: vi.fn(), single: vi.fn(), rpc: vi.fn(), revalidate: vi.fn(), rows: [] as Record<string,string>[] }));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/auth", () => ({ requireIdentity: mock.identity }));
vi.mock("@/lib/organizations", () => ({ listOrganizations: async () => { await mock.identity(); return mock.organizations(); } }));
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => ({ from: mock.from, rpc: mock.rpc }) }));
vi.mock("next/headers", () => ({ cookies: async () => ({ get: mock.cookie }) }));
vi.mock("next/cache", () => ({ revalidatePath: mock.revalidate }));
vi.mock("next/navigation", () => ({ redirect: (path: string) => { throw new Error(`redirect:${path}`); }, notFound: () => { throw new Error("notFound"); } }));
import { listKpiMeasurements, getKpiPerformance, createKpiMeasurement } from "@/lib/kpi-measurements";
import { saveMeasurement } from "@/app/kpis/[id]/measurements/actions";
import Details from "@/app/kpis/[id]/page";
import NewMeasurement from "@/app/kpis/[id]/measurements/new/page";
const id = "11111111-1111-4111-8111-111111111111";
const organization = { id: "a", name: "Acme", slug: "acme", role: "owner" };
const kpi = { id, organization_id:"a", name:"Satisfaction", description:"Customer feedback", target_value:"99.1234567890", unit:"points", direction:"increase", status:"active", reporting_frequency:"monthly", objective_id:null, strategic_objectives:null };
const input = { value:"90.1234567890", measured_at:"2026-10-15T12:30:00-04:00", notes:" Keep these notes " };
const form = (changes: Record<string,string> = {}) => { const data = new FormData(); Object.entries({...input,...changes}).forEach(([k,v])=>data.set(k,v)); return data; };
const props = () => ({ params: Promise.resolve({id}), searchParams:Promise.resolve({}) });
const measurement = (key: string, value: string, measured_at: string, created_at: string) => ({id:key, value, measured_at, created_at, organization_id:"a", kpi_id:id, notes:"History note", recorded_by:"caller"});
beforeEach(() => {
  mock.identity.mockResolvedValue({id:"caller"}); mock.organizations.mockResolvedValue([organization]); mock.cookie.mockReturnValue(undefined);
  mock.rows = [
    measurement("a","80","2026-10-10T00:00:00+00:00","2026-10-10T00:00:00Z"),
    measurement("b","90.1234567890","2026-10-15T00:00:00+00:00","2026-10-15T00:00:00Z"),
    measurement("c","70","2026-10-05T00:00:00+00:00","2026-10-20T00:00:00Z"),
  ];
  // Execute the requested ORDER BY against unsorted fixtures, rather than handing
  // the implementation an already sorted result that would hide a query regression.
  let orders: { key:string; ascending:boolean }[] = [];
  const query = { select:mock.select, eq:mock.eq, order:mock.order, range:mock.range, maybeSingle:mock.single };
  mock.from.mockImplementation(() => { orders = []; return query; });
  mock.select.mockReturnValue(query); mock.eq.mockReturnValue(query);
  mock.order.mockImplementation((key:string, options:{ascending:boolean}) => {
    orders.push({key,ascending:options.ascending});
    return query;
  });
  mock.range.mockImplementation((start:number,end:number) => {
    const data = [...mock.rows].sort((a,b) => {
      for(const {key,ascending} of orders) { const cmp = a[key].localeCompare(b[key]); if(cmp) return ascending ? cmp : -cmp; } return 0;
    });
    return Promise.resolve({data:data.slice(start,end+1),error:null});
  });
  mock.single.mockResolvedValue({data:kpi,error:null}); mock.rpc.mockResolvedValue({data:id,error:null});
});
it("orders by measurement time, keeping later inserted backdated data out of latest actual", async () => {
  const result = await getKpiPerformance("a",id);
  expect("latest" in result && result.latest?.value).toBe("90.1234567890");
  expect("measurements" in result && result.measurements?.map(row=>row.value)).toEqual(["90.1234567890","80","70"]);
  expect(mock.order.mock.calls).toEqual([["measured_at",{ascending:false}],["created_at",{ascending:false}],["id",{ascending:false}]]);
});
it("breaks timestamp ties by creation time and finally id", async () => {
  mock.rows = ["a","c","b"].map(key=>measurement(key,key,"2026-10-15T00:00:00Z","2026-10-16T00:00:00Z"));
  mock.rows.push(measurement("d","older","2026-10-15T00:00:00Z","2026-10-15T00:00:00Z"));
  expect((await listKpiMeasurements("a",id))?.map(row=>row.id)).toEqual(["c","b","a","d"]);
});
it("scopes reads to validated workspace and KPI and requests decimal text", async () => {
  await listKpiMeasurements("a",id);
  expect(mock.eq).toHaveBeenCalledWith("organization_id","a"); expect(mock.eq).toHaveBeenCalledWith("kpi_id",id);
  expect(mock.select).toHaveBeenCalledWith(expect.stringContaining("value::text"));
  mock.from.mockClear();
  expect(await listKpiMeasurements("foreign",id)).toBeNull(); expect(await getKpiPerformance("foreign",id)).toEqual({kpi:null});
  expect(mock.from).not.toHaveBeenCalled();
});
it.each(["owner","admin","manager"])("allows %s recording with an allowlisted RPC payload", async role => {
  mock.organizations.mockResolvedValue([{...organization,role}]);
  expect(renderToStaticMarkup(await NewMeasurement(props()))).toContain('name="measured_at"');
  await expect(saveMeasurement("a",id,{error:""},form({organization_id:"foreign",recorded_by:"spoof",role:"owner"}))).rejects.toThrow(`redirect:/kpis/${id}`);
  expect(mock.rpc).toHaveBeenCalledWith("create_kpi_measurement",{p_organization_id:"a",p_kpi_id:id,p_value:input.value,p_measured_at:input.measured_at,p_notes:"Keep these notes"});
  expect(mock.revalidate).toHaveBeenCalledWith(`/kpis/${id}`);
});
it.each(["member","viewer"])("keeps %s history readable and protects direct URLs and actions", async role => {
  mock.organizations.mockResolvedValue([{...organization,role}]);
  const html = renderToStaticMarkup(await Details(props()));
  expect(html).toContain("History note"); expect(html).toContain("read-only"); expect(html).not.toContain("/measurements/new");
  await expect(NewMeasurement(props())).rejects.toThrow("redirect:/kpis");
  expect((await saveMeasurement("a",id,{error:""},form({role:"owner"}))).error).toContain("permission");
  expect((await createKpiMeasurement("a",id,input)).error).toContain("permission");
  expect(mock.rpc).not.toHaveBeenCalled();
});
it("requires authentication for routes, action and measurement operations", async () => {
  mock.identity.mockRejectedValue(new Error("redirect:/login"));
  for(const operation of [()=>Details(props()),()=>NewMeasurement(props()),()=>saveMeasurement("a",id,{error:""},form()),()=>listKpiMeasurements("a",id),()=>createKpiMeasurement("a",id,input)]) await expect(operation()).rejects.toThrow("redirect:/login");
  expect(mock.from).not.toHaveBeenCalled(); expect(mock.rpc).not.toHaveBeenCalled();
});
it("rejects unavailable or foreign KPIs and malformed identifiers", async () => {
  mock.single.mockResolvedValue({data:null,error:null});
  await expect(Details(props())).rejects.toThrow("notFound"); await expect(NewMeasurement(props())).rejects.toThrow("notFound");
  expect((await saveMeasurement("a",id,{error:""},form())).error).toContain("unavailable");
  expect(await listKpiMeasurements("a","bad")).toBeNull(); expect(mock.rpc).not.toHaveBeenCalled();
});
it("fails closed for missing memberships and workspace switches", async () => {
  expect((await saveMeasurement("other",id,{error:""},form())).error).toContain("workspace changed");
  mock.organizations.mockResolvedValue(null);
  expect(renderToStaticMarkup(await Details(props()))).toContain("Unable to load organizations");
  expect(renderToStaticMarkup(await NewMeasurement(props()))).toContain("Unable to load organizations");
  expect((await saveMeasurement("a",id,{error:""},form())).error).toContain("Unable to load organizations");
  expect(mock.rpc).not.toHaveBeenCalled();
});
it.each(["validation","database"])("preserves fields after %s errors without disclosing internals", async kind => {
  mock.rpc.mockResolvedValue({error:{code:"23514",message:"private internals"}});
  const data = form({value:kind === "validation" ? "NaN" : input.value});
  const result = await saveMeasurement("a",id,{error:""},data);
  expect(result.values).toEqual(Object.fromEntries(data)); expect(result.error).not.toContain("private");
  expect(mock.revalidate).not.toHaveBeenCalled();
});
it("renders separate exact target and latest actual with UTC times and history", async () => {
  const html = renderToStaticMarkup(await Details(props()));
  for(const text of ["Target value","Latest actual value",kpi.target_value,input.value,"2026-10-15 00:00:00.000 UTC","Measurement history","Customer feedback","increase","monthly"]) expect(html).toContain(text);
  expect(html.indexOf("90.1234567890",html.indexOf("Measurement history"))).toBeLessThan(html.indexOf(">80 points"));
});
it("distinguishes absent measurements from load failures without inventing an actual", async () => {
  mock.rows = [];
  expect(renderToStaticMarkup(await Details(props()))).toContain("No measurements yet.");
  const result = await getKpiPerformance("a",id); expect("latest" in result && result.latest).toBeNull();
  mock.order.mockRejectedValue(new Error("private"));
  const html = renderToStaticMarkup(await Details(props()));
  expect(html).toContain("Unable to load measurements"); expect(html).toContain("Unavailable"); expect(html).not.toContain("No measurements yet.");
});
it("sanitizes thrown RPC and parent lookup failures", async () => {
  mock.rpc.mockRejectedValue(new Error("private"));
  expect((await createKpiMeasurement("a",id,input)).error).toBe("Unable to record measurement. Please try again.");
  mock.single.mockResolvedValue({data:null,error:{message:"private"}});
  expect((await saveMeasurement("a",id,{error:""},form())).error).toContain("Unable to load KPI");
  expect(renderToStaticMarkup(await Details(props()))).toContain("Unable to load KPI");
});

it("loads history beyond the default response cap and fails closed on a later page error", async () => {
  mock.rows = Array.from({length:501},(_,i)=>measurement(String(i).padStart(4,"0"),String(i),"2026-10-15T00:00:00Z","2026-10-15T00:00:00Z"));
  expect((await listKpiMeasurements("a",id))?.length).toBe(501);
  expect(mock.range.mock.calls).toEqual([[0,499],[500,999]]);
  mock.range.mockResolvedValueOnce({data:mock.rows.slice(0,500),error:null}).mockResolvedValueOnce({data:null,error:{message:"private"}});
  expect(await listKpiMeasurements("a",id)).toBeNull();
});
