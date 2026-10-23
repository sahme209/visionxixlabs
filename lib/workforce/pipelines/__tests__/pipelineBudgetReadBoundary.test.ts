import { beforeEach, expect, it, vi } from "vitest";
const m=vi.hoisted(()=>({run:vi.fn(),stageUpdate:vi.fn(),claim:vi.fn(),aggregate:vi.fn(),config:vi.fn(),execute:vi.fn(),audit:vi.fn(),webhook:vi.fn()}));
vi.mock("server-only",()=>({}));
vi.mock("@/lib/db",()=>({prisma:{pipelineRun:{findUnique:m.run,update:vi.fn()},pipelineStageRun:{updateMany:m.claim,update:m.stageUpdate,aggregate:m.aggregate},organizationBudgetConfig:{findUnique:m.config}}}));
vi.mock("@/lib/audit/secureAudit",()=>({record:m.audit}));
vi.mock("@/lib/webhooks/dispatchWebhookEvent",()=>({dispatchWebhookEvent:m.webhook}));
vi.mock("../stageExecutorRegistry",()=>({bootstrapStageExecutorRegistry:vi.fn(),getStageExecutor:()=>m.execute}));
vi.mock("../mintPipelineStageApproval",()=>({mintPipelineStageApproval:vi.fn()}));
import { advancePipelineRun } from "../pipelineRunner";
let stage:Record<string,unknown>;
beforeEach(()=>{
 vi.clearAllMocks();stage={id:"stage-budget",stageId:"proposal",stageKind:"code_propose",ordering:0,status:"queued",requiresApproval:false};
 m.run.mockImplementation(async()=>({id:"run-budget",organizationId:"org-budget",pipelineId:"ai_coding",triggeredBy:"user-budget",correlationId:"budget-test",status:"running",startedAt:new Date(),metadata:{},stages:[stage]}));
 m.claim.mockImplementation(async()=>{stage.status="running";return {count:1};});
 m.stageUpdate.mockImplementation(async({data})=>{Object.assign(stage,data);return stage;});
 m.aggregate.mockResolvedValue({_sum:{costCents:0}});m.config.mockResolvedValue(null);m.execute.mockResolvedValue({ok:true,summary:"synthetic stage"});m.audit.mockResolvedValue(undefined);m.webhook.mockResolvedValue(undefined);
});
it("refuses execution when cumulative spend cannot be read",async()=>{
 m.aggregate.mockRejectedValue(new Error("synthetic database unavailable"));await advancePipelineRun("run-budget");
 expect(m.execute).not.toHaveBeenCalled();expect(stage.status).toBe("failed");expect(stage.errorMessage).toContain("budget");
});
it("refuses execution when a configured budget cannot be read",async()=>{
 m.config.mockRejectedValue(new Error("synthetic database unavailable"));await advancePipelineRun("run-budget");
 expect(m.execute).not.toHaveBeenCalled();expect(stage.status).toBe("failed");
});
it.each([NaN,-1,Infinity,1.5])("refuses invalid cumulative spend %s",async costCents=>{
 m.aggregate.mockResolvedValue({_sum:{costCents}});await advancePipelineRun("run-budget");expect(m.execute).not.toHaveBeenCalled();expect(stage.status).toBe("failed");
});
it("allows a verified zero spend and absent optional workspace override",async()=>{
 await advancePipelineRun("run-budget");expect(m.execute).toHaveBeenCalledTimes(1);expect(stage.status).toBe("succeeded");
});
