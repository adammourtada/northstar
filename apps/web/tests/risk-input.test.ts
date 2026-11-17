import { expect, it } from "vitest";
import { riskInput, riskExposure } from "@/lib/risk-input";
const id = "11111111-1111-4111-8111-111111111111";
function form(changes: Record<string,string> = {}) {
  const form = new FormData();
  Object.entries({title:" Delivery delay ", description:"", owner_id:"", probability:"3", impact:"4", status:"open", mitigation_plan:"", review_date:"", ...changes}).forEach(([key,value])=>form.set(key,value));
  return form;
}
it("validates optional fields, exact integer scores, associations and exposure", () => {
  const data = form({owner_id:id, review_date:"2028-02-29", mitigation_plan:" Plan "});
  data.append("project_ids",id.toUpperCase()); data.append("project_ids",id);
  data.append("objective_ids",id);
  expect(riskInput(data).input).toEqual({title:"Delivery delay",description:null,owner_id:id,probability:3,impact:4,status:"open",mitigation_plan:"Plan",review_date:"2028-02-29",project_ids:[id],objective_ids:[id]});
  expect(riskExposure(3,4)).toBe(12); expect(riskExposure(1,1)).toBe(1); expect(riskExposure(5,5)).toBe(25);
  expect(riskInput(form()).input?.owner_id).toBeNull();
});
it("rejects invalid scores, titles, statuses, dates and overlong text", () => {
  for (const field of ["probability","impact"]) for(const value of ["", "0","6","1.5","1e0","NaN"]) expect(riskInput(form({[field]:value})).error).toContain("1 to 5");
  const invalid: Record<string,string>[] = [{title:" "},{title:"x".repeat(201)},{status:"invalid"},{review_date:"2026-02-29"},{description:"x".repeat(5001)},{mitigation_plan:"x".repeat(5001)}];
  for (const changes of invalid) expect(riskInput(form(changes)).error).toBeDefined();
});
it("rejects malformed association IDs, duplicate scalar fields, file inputs and missing fields", () => {
  for(const key of ["owner_id","project_ids","objective_ids"]) { const data=form(); data.set(key,"foreign"); expect(riskInput(data).error).toBeDefined(); }
  const duplicate=form(); duplicate.append("probability","5"); expect(riskInput(duplicate).error).toContain("valid risk");
  const file=form(); file.set("project_ids",new Blob(["x"]),"file"); expect(riskInput(file).error).toBeDefined();
  expect(riskInput(new FormData()).error).toBeDefined();
});
