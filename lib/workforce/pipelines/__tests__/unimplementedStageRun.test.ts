import { afterEach, expect, it, vi } from "vitest";
const m=vi.hoisted(()=>({read:vi.fn(),updateRun:vi.fn(),updateStage:vi.fn(),aggregate:vi.fn(),claim:vi.fn()}));
vi.mock("server-only",()=>({}));
vi.mock("@/lib/db",()=>({prisma:{pipelineRun:{findUnique:m.read,update:m.updateRun},pipelineStageRun:{updateMany:m.claim,update:m.updateStage,aggregate:m.aggregate},organizationBudgetConfig:{findUnique:vi.fn().mockResolvedValue(null)}}}));
vi.mock("@/lib/audit/secureAudit",()=>({record:vi.fn().mockResolvedValue(undefined)}));
vi.mock("@/lib/webhooks/dispatchWebhookEvent",()=>({dispatchWebhookEvent:vi.fn().mockResolvedValue(undefined)}));
vi.mock("../mintPipelineStageApproval",()=>({mintPipelineStageApproval:vi.fn()}));
import { advancePipelineRun } from "../pipelineRunner";
import { bootstrapStageExecutorRegistry,__resetStageExecutorRegistry } from "../stageExecutorRegistry";
afterEach(__resetStageExecutorRegistry);
it("records an unavailable notification as failed and never marks the run completed",async()=>{
 const stage={id:"stage",stageId:"notify",stageKind:"notify",ordering:0,status:"queued",requiresApproval:false};
 const run={id:"run",organizationId:"org",pipelineId:"ai_coding",triggeredBy:"user",correlationId:"correlation",status:"running",startedAt:new Date(),metadata:{},stages:[stage]};
 m.read.mockImplementation(async()=>run);m.aggregate.mockResolvedValue({_sum:{costCents:0}});m.claim.mockImplementation(async()=>{stage.status="running";return {count:1};});m.updateStage.mockImplementation(async({data})=>Object.assign(stage,data));m.updateRun.mockImplementation(async({data})=>Object.assign(run,data));
 bootstrapStageExecutorRegistry();await advancePipelineRun("run");expect(stage.status).toBe("failed");expect(run.status).toBe("failed");expect(m.updateRun).not.toHaveBeenCalledWith(expect.objectContaining({data:expect.objectContaining({status:"succeeded"})}));expect(m.updateStage).toHaveBeenCalledWith(expect.objectContaining({data:expect.objectContaining({outputDetail:expect.objectContaining({executorUnavailable:true,externalActionPerformed:false})})}));
});
