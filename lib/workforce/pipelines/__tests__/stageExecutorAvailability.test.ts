import { afterEach, expect, it, vi } from "vitest";
vi.mock("server-only",()=>({}));
import { __resetStageExecutorRegistry,bootstrapStageExecutorRegistry,getStageExecutor,registerStageExecutor,dryRunStageExecutor,type StageExecutionContext } from "../stageExecutorRegistry";
afterEach(__resetStageExecutorRegistry);
const context=(stageKind:StageExecutionContext['stageKind']):StageExecutionContext=>({organizationId:"org",runId:"run",stageRunId:"stage",pipelineId:"pipeline",stageId:"stage",stageKind,correlationId:"correlation",triggeredBy:"user",runMetadata:{}});
it.each(["notify","deploy","unit_test","schema_apply"] as const)("does not report an unimplemented %s stage as completed",async kind=>{
 bootstrapStageExecutorRegistry();const result=await getStageExecutor(kind)!(context(kind));expect(result.ok).toBe(false);expect(result.detail).toMatchObject({executorUnavailable:true,externalActionPerformed:false});
});
it("preserves an explicitly registered executor across bootstrap",async()=>{
 const executor=vi.fn().mockResolvedValue({ok:true,summary:"verified implementation result"});registerStageExecutor("notify",executor);bootstrapStageExecutorRegistry();expect(getStageExecutor("notify")).toBe(executor);expect((await getStageExecutor("notify")!(context("notify"))).ok).toBe(true);
});
it("retains the explicitly requested preview helper with an honest dry-run label",async()=>{
 const result=await dryRunStageExecutor(context("deploy"));expect(result.ok).toBe(true);if(result.ok)expect(result.summary).toContain("[dry-run]");expect(result.detail?.dryRun).toBe(true);
});
