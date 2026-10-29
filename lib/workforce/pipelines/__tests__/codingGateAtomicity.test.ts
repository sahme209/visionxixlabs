import { beforeEach, expect, it, vi } from "vitest";
const f=vi.hoisted(()=>({read:vi.fn(),runUpdate:vi.fn(),stageUpdate:vi.fn(),claim:vi.fn(),mint:vi.fn()}));
vi.mock("@/lib/db",()=>({prisma:{pipelineRun:{findUnique:f.read,update:f.runUpdate},pipelineStageRun:{updateMany:f.claim,update:f.stageUpdate}}}));
vi.mock("@/lib/audit/secureAudit",()=>({record:vi.fn()}));vi.mock("@/lib/webhooks/dispatchWebhookEvent",()=>({dispatchWebhookEvent:vi.fn()}));
vi.mock("../stageExecutorRegistry",()=>({bootstrapStageExecutorRegistry:vi.fn(),getStageExecutor:vi.fn()}));
vi.mock("../mintPipelineStageApproval",()=>({mintPipelineStageApproval:f.mint}));
import { advancePipelineRun } from "../pipelineRunner";
let stage:Record<string,unknown>,run:Record<string,unknown>;
beforeEach(()=>{vi.resetAllMocks();stage={id:"gate",stageId:"code_gate",stageKind:"approval_gate",ordering:0,status:"queued",requiresApproval:true,approvalRequestId:null};run={id:"run",organizationId:"org",pipelineId:"ai_coding",triggeredBy:"member",correlationId:"corr",status:"running",stages:[stage],startedAt:new Date()};f.read.mockImplementation(async()=>run);f.stageUpdate.mockImplementation(async({data})=>Object.assign(stage,data));f.runUpdate.mockImplementation(async({data})=>Object.assign(run,data));f.claim.mockImplementation(async({data})=>{Object.assign(stage,data);return{count:1};});f.mint.mockImplementation(async()=>{Object.assign(stage,{status:"awaiting_approval",approvalRequestId:"approval"});return{approvalRequestId:"approval",snapshotId:"snapshot"};});});
it("lets the artifact minter atomically store the gate and snapshot without an earlier orphan claim",async()=>{
 await advancePipelineRun("run");expect(f.mint).toHaveBeenCalledOnce();expect(f.claim).not.toHaveBeenCalled();expect(stage).toMatchObject({status:"awaiting_approval",approvalRequestId:"approval"});
});
it("fails a still-queued gate when artifact capture is unavailable instead of stranding an unbound approval",async()=>{
 f.mint.mockRejectedValue(Error("coding_artifact_approval_unavailable"));await expect(advancePipelineRun("run")).resolves.toBeUndefined();
 expect(stage).toMatchObject({status:"failed",approvalRequestId:null});expect(run.status).toBe("failed");expect(f.claim).toHaveBeenCalledWith(expect.objectContaining({where:expect.objectContaining({id:"gate",status:"queued",approvalRequestId:null}),data:expect.objectContaining({status:"failed"})}));
});
