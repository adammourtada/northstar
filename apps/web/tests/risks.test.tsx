import { beforeEach, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
const mock=vi.hoisted(()=>({identity:vi.fn(),organizations:vi.fn(),cookie:vi.fn(),from:vi.fn(),eq:vi.fn(),select:vi.fn(),rows:vi.fn(),single:vi.fn(),choices:vi.fn(),rpc:vi.fn(),revalidate:vi.fn()}));
vi.mock("server-only",()=>({}));
vi.mock("@/lib/auth",()=>({requireIdentity:mock.identity}));
vi.mock("@/lib/organizations",()=>({listOrganizations:async()=>{await mock.identity();return mock.organizations();}}));
vi.mock("@/lib/supabase/server",()=>({createClient:async()=>({from:mock.from,rpc:mock.rpc})}));
vi.mock("next/headers",()=>({cookies:async()=>({get:mock.cookie})}));
vi.mock("next/cache",()=>({revalidatePath:mock.revalidate}));
vi.mock("next/navigation",()=>({redirect:(path:string)=>{throw new Error("redirect:"+path);},notFound:()=>{throw new Error("notFound");}}));
import { listRisks, getRisk, listRiskChoices, createRisk, updateRisk } from "@/lib/risks";
import { saveRisk } from "@/app/risks/actions";
import Risks from "@/app/risks/page";
import Details from "@/app/risks/[id]/page";
import NewRisk from "@/app/risks/new/page";
import EditRisk from "@/app/risks/[id]/edit/page";
const id="11111111-1111-4111-8111-111111111111", ownerId="22222222-2222-4222-8222-222222222222", projectId="33333333-3333-4333-8333-333333333333", objectiveId="44444444-4444-4444-8444-444444444444", foreignId="55555555-5555-4555-8555-555555555555";
const organization={id:"workspace",name:"Acme",slug:"acme",role:"owner"};
const input={title:"Delivery delay",description:"Vendor delay",owner_id:ownerId,probability:3,impact:4,status:"monitoring",mitigation_plan:"Alternate supplier",review_date:"2026-11-01",project_ids:[projectId],objective_ids:[objectiveId]} as const;
const row={...input,id,organization_id:"workspace",identified_at:"2026-10-20T12:00:00Z",created_at:"2026-10-20T12:00:00Z",updated_at:"2026-10-20T12:00:00Z",owner:{user_id:ownerId,role:"member"},risk_projects:[{project_id:projectId,projects:{id:projectId,name:"New portal"}}],risk_objectives:[{objective_id:objectiveId,strategic_objectives:{id:objectiveId,title:"Better service"}}]};
function form(changes:Record<string,string>={},projects=[projectId],objectives=[objectiveId]) {
  const form=new FormData();
  Object.entries({title:input.title,description:input.description,owner_id:ownerId,probability:"3",impact:"4",status:"monitoring",mitigation_plan:input.mitigation_plan,review_date:input.review_date,...changes}).forEach(([k,v])=>form.set(k,v));
  projects.forEach(id=>form.append("project_ids",id));objectives.forEach(id=>form.append("objective_ids",id));return form;
}
const props=()=>({params:Promise.resolve({id}),searchParams:Promise.resolve({})});
beforeEach(()=>{
  mock.identity.mockResolvedValue({id:"caller"});mock.organizations.mockResolvedValue([organization]);mock.cookie.mockReturnValue(undefined);
  mock.rows.mockResolvedValue({data:[row],error:null});mock.single.mockResolvedValue({data:row,error:null});mock.rpc.mockResolvedValue({data:id,error:null});
  mock.choices.mockImplementation((table:string)=>({data:table==="organization_members"?[{user_id:ownerId,role:"member"}]:table==="projects"?[{id:projectId,name:"New portal",project_objectives:[]}]:[{id:objectiveId,title:"Better service"}],error:null}));
  mock.from.mockImplementation((table:string)=>{
    const query={select:(columns:string)=>{mock.select(columns);return query;},eq:(key:string,value:string)=>{mock.eq(key,value);return query;},
      order:(key:string)=>key==="created_at"?query:table==="risks"?mock.rows():mock.choices(table),maybeSingle:mock.single};
    return query;
  });
});
it("requires authentication before all routes, actions and data operations",async()=>{
  mock.identity.mockRejectedValue(new Error("redirect:/login"));
  for(const operation of [Risks,NewRisk,()=>Details(props()),()=>EditRisk(props()),()=>saveRisk("workspace",null,{error:""},form()),()=>listRisks("workspace"),()=>getRisk("workspace",id),()=>listRiskChoices("workspace"),()=>createRisk("workspace",{...input,project_ids:[projectId],objective_ids:[objectiveId]}),()=>updateRisk(id,{...input,project_ids:[],objective_ids:[]})]) await expect(operation()).rejects.toThrow("redirect:/login");
  expect(mock.from).not.toHaveBeenCalled();expect(mock.rpc).not.toHaveBeenCalled();
});
it("allows owner/admin/manager create and update with server-derived scope and allowlisted fields",async()=>{
  for(const role of ["owner","admin","manager"]) {
    mock.organizations.mockResolvedValue([{...organization,role}]);
    expect(renderToStaticMarkup(await NewRisk())).toContain('name="owner_id"');
    expect(renderToStaticMarkup(await EditRisk(props()))).toContain("Save changes");
    await expect(saveRisk("workspace",null,{error:""},form({organization_id:"foreign",exposure:"25",identified_at:"spoof",role:"owner"}))).rejects.toThrow("redirect:/risks/"+id);
    await expect(saveRisk("workspace",id,{error:""},form())).rejects.toThrow("redirect:/risks/"+id);
  }
  const payload={p_title:input.title,p_description:input.description,p_owner_id:ownerId,p_probability:3,p_impact:4,p_status:"monitoring",p_mitigation_plan:input.mitigation_plan,p_review_date:input.review_date,p_project_ids:[projectId],p_objective_ids:[objectiveId]};
  expect(mock.rpc).toHaveBeenCalledWith("create_risk",{p_organization_id:"workspace",...payload});
  expect(mock.rpc).toHaveBeenCalledWith("update_risk",{p_risk_id:id,...payload});
  expect(mock.revalidate).toHaveBeenCalledWith("/risks/"+id);
});
it("keeps members/viewers read-only including direct URLs and forged server actions",async()=>{
  for(const role of ["member","viewer"]) {
    mock.organizations.mockResolvedValue([{...organization,role}]);
    const html=renderToStaticMarkup(await Risks());expect(html).toContain("read-only");expect(html).not.toContain("/edit");expect(html).not.toContain("/risks/new");
    expect(renderToStaticMarkup(await Details(props()))).toContain("12/25");
    await expect(NewRisk()).rejects.toThrow("redirect:/risks");await expect(EditRisk(props())).rejects.toThrow("redirect:/risks");
    for(const riskId of [null,id]) expect((await saveRisk("workspace",riskId,{error:""},form({role:"owner"}))).error).toContain("permission");
  }
  expect(mock.rpc).not.toHaveBeenCalled();
});
it("scopes risk and association reads and renders linked titles, owner and calculated exposure",async()=>{
  const html=renderToStaticMarkup(await Risks());const details=renderToStaticMarkup(await Details(props()));
  for(const text of ["Delivery delay","New portal","Better service",ownerId,"12/25","monitoring","2026-11-01"]) {expect(html).toContain(text);expect(details).toContain(text);}
  expect(details).toContain("Alternate supplier");expect(html).toContain('/risks/'+id);expect(details).toContain('/projects/'+projectId);
  await listRiskChoices("workspace");
  expect(mock.eq).toHaveBeenCalledWith("organization_id","workspace");expect(mock.eq).toHaveBeenCalledWith("id",id);
  expect(mock.from.mock.calls.map(([name])=>name)).toEqual(expect.arrayContaining(["risks","organization_members","projects","strategic_objectives"]));
});
it("rejects foreign owners/projects/objectives and preserves selections before any RPC",async()=>{
  for(const kind of ["owner","project","objective"]) {
    const data=form(kind==="owner"?{owner_id:foreignId}:{},kind==="project"?[foreignId]:[projectId],kind==="objective"?[foreignId]:[objectiveId]);
    const result=await saveRisk("workspace",null,{error:""},data);
    expect(result.error).toContain("unavailable");
    expect(result.values?.owner_id).toBe(data.get("owner_id"));expect(result.values?.project_ids).toEqual(data.getAll("project_ids"));expect(result.values?.objective_ids).toEqual(data.getAll("objective_ids"));
  }
  expect(mock.rpc).not.toHaveBeenCalled();
});
it("supports multiple links, deduplicates them, and clears links and owner on update",async()=>{
  mock.choices.mockImplementation((table:string)=>({data:table==="organization_members"?[{user_id:ownerId,role:"member"}]:table==="projects"?[projectId,foreignId].map(id=>({id,name:id,project_objectives:[]})):[objectiveId,foreignId].map(id=>({id,title:id})),error:null}));
  await expect(saveRisk("workspace",null,{error:""},form({},[projectId,foreignId,projectId],[objectiveId,foreignId,objectiveId]))).rejects.toThrow("redirect:/risks/"+id);
  expect(mock.rpc).toHaveBeenCalledWith("create_risk",expect.objectContaining({p_project_ids:[projectId,foreignId],p_objective_ids:[objectiveId,foreignId]}));
  await expect(saveRisk("workspace",id,{error:""},form({owner_id:""},[],[]))).rejects.toThrow("redirect:/risks/"+id);
  expect(mock.rpc).toHaveBeenCalledWith("update_risk",expect.objectContaining({p_owner_id:null,p_project_ids:[],p_objective_ids:[]}));
  const html=renderToStaticMarkup(await EditRisk(props()));expect(html.match(/checked=""/g)).toHaveLength(2);
});
it("fails closed for switched workspaces, missing memberships and unavailable risks",async()=>{
  expect((await saveRisk("foreign",null,{error:""},form())).error).toContain("workspace changed");
  mock.single.mockResolvedValue({data:null,error:null});
  await expect(Details(props())).rejects.toThrow("notFound");await expect(EditRisk(props())).rejects.toThrow("notFound");
  expect((await saveRisk("workspace",id,{error:""},form())).error).toContain("unavailable");
  expect(await getRisk("workspace","invalid")).toEqual({risk:null});
  mock.organizations.mockResolvedValue(null);expect(renderToStaticMarkup(await Risks())).toContain("Unable to load organizations");
  expect((await saveRisk("workspace",null,{error:""},form())).error).toContain("Unable to load organizations");
  expect(mock.rpc).not.toHaveBeenCalled();
});
it("preserves all submitted fields on validation and RPC failures and sanitizes errors",async()=>{
  for(const title of [" "," Keep title "]) {
    mock.rpc.mockResolvedValue({data:null,error:{code:"23503",message:"private database detail"}});
    const data=form({title});const result=await saveRisk("workspace",id,{error:""},data);
    expect(result.values).toEqual({...Object.fromEntries(data),project_ids:[projectId],objective_ids:[objectiveId]});
    expect(result.error).toBeTruthy();expect(result.error).not.toContain("private");
  }
  expect(mock.revalidate).not.toHaveBeenCalled();
  mock.rpc.mockRejectedValue(new Error("private connection"));expect((await updateRisk(id,{...input,project_ids:[],objective_ids:[]})).error).toBe("Unable to save risk. Please try again.");
});
it("distinguishes empty/error states and fails closed on hidden associations",async()=>{
  mock.rows.mockResolvedValue({data:[],error:null});expect(renderToStaticMarkup(await Risks())).toContain("No risks yet.");
  mock.rows.mockResolvedValue({data:[{...row,risk_projects:[{project_id:projectId,projects:null}]}],error:null});
  expect(renderToStaticMarkup(await Risks())).toContain("Unable to load risks");
  mock.single.mockResolvedValue({data:{...row,owner:null},error:null});expect((await getRisk("workspace",id)).error).toContain("Unable to load risk");
  mock.choices.mockResolvedValue({data:null,error:{message:"private"}});expect(renderToStaticMarkup(await NewRisk())).toContain("Unable to load risk associations");
  expect((await saveRisk("workspace",null,{error:""},form())).error).toContain("Unable to load risk associations");
});
