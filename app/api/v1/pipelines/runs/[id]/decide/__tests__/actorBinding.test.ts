import { beforeEach, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { Prisma } from "@prisma/client";
const m = vi.hoisted(() => ({ auth: vi.fn(), run: vi.fn(), stage: vi.fn(), snapshot: vi.fn(), create: vi.fn(), update: vi.fn(), transition: vi.fn(), audit: vi.fn(), webhook: vi.fn(), advance: vi.fn(), lock: vi.fn(), votes: [] as Array<{id?:string;approverUserId:string;decision:string}> }));
vi.mock("@/lib/security/authenticateApiKey", () => ({ authenticateApiKey: m.auth }));
vi.mock("@/lib/db", () => ({ prisma: { $transaction: async (work: (tx: unknown) => Promise<unknown>) => work({ $executeRaw:m.lock, engineerApprovalSnapshot:{findUnique:m.snapshot,update:m.update},engineerApprovalDecision:{create:m.create},pipelineStageRun:{updateMany:m.transition} }), pipelineRun: {findFirst:m.run}, pipelineStageRun:{findFirst:m.stage,updateMany:m.transition}, engineerApprovalSnapshot:{findUnique:m.snapshot,update:m.update},engineerApprovalDecision:{create:m.create} } }));
vi.mock("@/lib/audit/secureAudit",()=>({record:m.audit}));
vi.mock("@/lib/workforce/pipelines/pipelineRunner",()=>({advancePipelineRun:m.advance}));
vi.mock("@/lib/webhooks/dispatchWebhookEvent",()=>({dispatchWebhookEvent:m.webhook}));
import {POST} from "../route";
beforeEach(()=>{
 vi.clearAllMocks();m.votes=[];
 m.auth.mockResolvedValue({ok:true,apiKeyId:"credential_one",organizationId:"org_one",scopes:["pipeline:trigger"],env:"test"});
 m.run.mockResolvedValue({id:"run_one",organizationId:"org_one",pipelineId:"pipeline_one",status:"running",correlationId:"corr_one"});
 m.stage.mockResolvedValue({id:"stage_one",stageId:"gate_one",approvalRequestId:"approval_one",ordering:0});
 m.snapshot.mockImplementation(async()=>({id:"snapshot_one",organizationId:"org_one",status:"pending",requiredApprovers:2,decisions:[...m.votes]}));
 m.create.mockImplementation(async({data})=>{if(m.votes.some(v=>v.approverUserId===data.approverUserId))throw new Prisma.PrismaClientKnownRequestError("duplicate fixture vote",{code:"P2002",clientVersion:"fixture"});m.votes.push({id:data.id,approverUserId:data.approverUserId,decision:data.decision});return data;});
 m.transition.mockResolvedValue({count:1});
});
function post(body:unknown){return POST(new NextRequest("https://example.invalid/api/v1/pipelines/runs/run_one/decide",{method:"POST",body:JSON.stringify(body)}),{params:Promise.resolve({id:"run_one"})});}
it("binds a vote to the authenticated credential despite a claimed human identity",async()=>{
 const response=await post({decision:"approved",approverUserId:"claimed_other_human"});expect(response.status).toBe(200);
 expect(m.votes).toMatchObject([{approverUserId:"api_key:credential_one",decision:"approved"}]);
 expect(m.update).not.toHaveBeenCalled();expect(m.advance).not.toHaveBeenCalled();
});
it("cannot fill two quorum slots by changing the claimed actor on the same credential",async()=>{
 expect((await post({decision:"approved",approverUserId:"person_a"})).status).toBe(200);
 const second=await post({decision:"approved",approverUserId:"person_b"});expect(second.status).toBe(409);expect(await second.json()).toMatchObject({error:"already_voted"});
 expect(m.votes).toHaveLength(1);expect(m.update).not.toHaveBeenCalled();expect(m.advance).not.toHaveBeenCalled();
});
it("preserves independent authenticated credentials and the existing quorum transition",async()=>{
 await post({decision:"approved"});m.auth.mockResolvedValue({ok:true,apiKeyId:"credential_two",organizationId:"org_one",scopes:["pipeline:trigger"],env:"test"});
 const result=await post({decision:"approved"});expect(await result.json()).toMatchObject({ok:true,isTerminal:true,approvedCount:2});expect(m.advance).toHaveBeenCalledOnce();
});

it.each(["desktop_tray","claimed_human","api_key:credential_one"])("refuses an ambiguous legacy vote labelled %s without rewriting it",async approverUserId=>{
 m.votes=[{id:"clegacy_fixture",approverUserId,decision:"approved"}];const before=JSON.stringify(m.votes);
 const result=await post({decision:"approved"});expect(result.status).toBe(409);expect(await result.json()).toMatchObject({error:"approval_actor_provenance_required"});
 expect(JSON.stringify(m.votes)).toBe(before);expect(m.create).not.toHaveBeenCalled();expect(m.update).not.toHaveBeenCalled();expect(m.advance).not.toHaveBeenCalled();
});
