/** @vitest-environment node */
import {afterEach,beforeEach,expect,it,vi} from "vitest";
const m=vi.hoisted(()=>({create:vi.fn()}));
vi.mock("@/lib/db",()=>({prisma:{auditLog:{create:m.create}}}));
import {logAudit} from "../auditLog";
const secret="ARBITRARY_PRIVATE_AUDIT_DATABASE_DIAGNOSTIC";
beforeEach(()=>{vi.resetAllMocks();vi.spyOn(console,"error").mockImplementation(()=>{});m.create.mockResolvedValue({id:"synthetic-audit"});});
afterEach(()=>vi.restoreAllMocks());
for(const [kind,failure] of [["Error",new Error(secret)],["structured throw",{message:secret,query:{password:secret}}]] as const){
 it(`does not pass ${kind} diagnostics to console and preserves best-effort behavior`,async()=>{
  m.create.mockRejectedValueOnce(failure);
  await expect(logAudit({leadId:"fixture-lead",action:"fixture.action",actor:"user",metadata:{safe:"fixture"}})).resolves.toBeUndefined();
  expect(m.create).toHaveBeenCalledOnce();
  expect(console.error).toHaveBeenCalledOnce();
  const calls=vi.mocked(console.error).mock.calls;
  expect(calls[0][0]).toBe("[audit] log failed:");
  expect(calls.flat().every(value=>typeof value==="string")).toBe(true);
  expect(JSON.stringify(calls)).not.toContain(secret);
 });
}
it("preserves exact successful audit payload without logging failure",async()=>{
 await expect(logAudit({leadId:"fixture-lead",action:"fixture.action",actor:"admin",metadata:{safe:"fixture"}})).resolves.toBeUndefined();
 expect(m.create).toHaveBeenCalledExactlyOnceWith({data:{leadId:"fixture-lead",action:"fixture.action",actor:"admin",metadata:{safe:"fixture"}}});
 expect(console.error).not.toHaveBeenCalled();
});
it("preserves optional lead and metadata defaults",async()=>{
 await logAudit({action:"fixture.system",actor:"system"});
 expect(m.create).toHaveBeenCalledExactlyOnceWith({data:{leadId:null,action:"fixture.system",actor:"system",metadata:undefined}});
 expect(console.error).not.toHaveBeenCalled();
});
