// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { expect,it,vi } from "vitest";
import { riskFormValues } from "@/lib/risk-input";
vi.mock("@/app/risks/actions",()=>({saveRisk:async(_org:string,_id:string|null,_state:unknown,form:FormData)=>({error:"Unable to save risk. Please try again.",values:riskFormValues(form)})}));
import { RiskForm } from "@/app/risks/form";
it("preserves every field and both link sets through native resets and repeated save failures",async()=>{
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT",true);
  const container=document.createElement("div");document.body.append(container);const root=createRoot(container);
  try {
    await act(async()=>root.render(<RiskForm organizationId="workspace" choices={{owners:[{user_id:"owner",role:"member"}],projects:[{id:"project",name:"Portal"}],objectives:[{id:"objective",title:"Service"}]}}/>));
    const form=container.querySelector("form")!;
    const field=(name:string)=>form.elements.namedItem(name) as HTMLInputElement;
    const values={title:"Keep title",description:"Keep description",owner_id:"owner",probability:"4",impact:"5",status:"accepted",mitigation_plan:"Keep plan",review_date:"2026-11-01"};
    for(const [name,value] of Object.entries(values)) field(name).value=value;
    field("project_ids").checked=true;field("objective_ids").checked=true;
    const reset=vi.spyOn(form,"reset");
    await act(async()=>form.requestSubmit());
    expect(reset).toHaveBeenCalled();expect(container.querySelector('[role="alert"]')?.textContent).toContain("Unable to save");
    for(const [name,value] of Object.entries(values)) expect(field(name).value,name).toBe(value);
    expect(field("project_ids").checked).toBe(true);expect(field("objective_ids").checked).toBe(true);
    field("owner_id").value="";field("project_ids").checked=false;field("objective_ids").checked=false;
    await act(async()=>form.requestSubmit());
    expect(field("owner_id").value).toBe("");expect(field("project_ids").checked).toBe(false);expect(field("objective_ids").checked).toBe(false);
    expect(container.querySelector("button")?.disabled).toBe(false);
    expect(form.elements.namedItem("exposure")).toBeNull();
  }finally{await act(async()=>root.unmount());container.remove();vi.unstubAllGlobals();}
});
