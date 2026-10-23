import { beforeEach, expect, it, vi } from "vitest";
import { createHash } from "node:crypto";
const f=vi.hoisted(()=>({prepare:vi.fn(),transaction:vi.fn(),snapshot:vi.fn(),gate:vi.fn(),run:vi.fn(),stage:vi.fn()}));
vi.mock("@/lib/db",()=>({prisma:{$transaction:f.transaction,pipelineRun:{findUnique:f.run},engineerApprovalSnapshot:{create:f.snapshot}}}));
vi.mock("../prepareCodingArtifact",()=>({prepareCodingArtifact:f.prepare}));
import { buildCodingArtifact } from "../codingArtifact";
import { mintCodingArtifactApproval } from "../mintCodingArtifactApproval";
const patch="--- a/file.txt\n+++ b/file.txt\n@@ -1 +1 @@\n-old\n+new\n";
const artifact=buildCodingArtifact({organizationId:"org",runId:"run",proposalStageRunId:"proposal",readStageRunId:"read",repositoryFullName:"owned/repo",baseBranch:"main",baseCommitSha:"a".repeat(40),patchText:patch,baseFiles:[{path:"file.txt",content:"old\n"}]});if(!artifact.ok)throw Error("fixture artifact required");
const input={organizationId:"org",pipelineId:"ai_coding",runId:"run",stageRunId:"gate",stageId:"code_gate",stageName:"PR approval",requestedBy:"member",correlationId:"corr"};
const validation={schema:1,repositoryFullName:"owned/repo",baseBranch:"main",baseCommitSha:"a".repeat(40),patchSha256:createHash("sha256").update(patch).digest("hex")};
beforeEach(()=>{vi.resetAllMocks();f.prepare.mockResolvedValue(artifact);f.run.mockResolvedValue({id:"run",organizationId:"org",pipelineId:"ai_coding",status:"running",metadata:{repoRef:"owned/repo"}});f.snapshot.mockImplementation(async({data})=>({id:"snapshot",...data}));f.gate.mockResolvedValue({count:1});f.transaction.mockImplementation(async fn=>fn({pipelineRun:{findUnique:f.run},pipelineStageRun:{findFirst:f.stage,updateMany:f.gate},engineerApprovalSnapshot:{create:f.snapshot}}));
 f.stage.mockImplementation(async({where})=>{
  if(where.id==="gate")return{id:"gate",status:"queued",approvalRequestId:null};
  if(where.stageKind==="code_read")return{id:"read",outputDetail:{owner:"owned",repo:"repo",branch:"main",headSha:"a".repeat(40)}};
  if(where.stageKind==="code_propose")return{id:"proposal",outputDetail:{proposedPatchText:patch}};
  return{id:where.stageKind,outputDetail:{codingValidation:validation}};
 });
});
it("stores exact artifact bytes with an approval action bound to its digest",async()=>{
 const result=await mintCodingArtifactApproval(input);expect(result.snapshotId).toBe("snapshot");
 expect(f.snapshot).toHaveBeenCalledWith(expect.objectContaining({data:expect.objectContaining({action:`pipeline_stage:ai_coding:code_gate:${artifact.digest}`,sourceKind:"pipeline_stage",pipelineStageRunId:"gate",requiredApprovers:2})}));
 expect(f.gate).toHaveBeenCalledWith(expect.objectContaining({where:expect.objectContaining({id:"gate",runId:"run",status:"queued",approvalRequestId:null}),data:expect.objectContaining({outputDetail:{codingArtifact:artifact.artifact,codingArtifactDigest:artifact.digest}})}));
});
it("refuses validation evidence for a different proposal before minting",async()=>{
 const original=f.stage.getMockImplementation()!;
 f.stage.mockImplementation(async(query)=>query.where.stageKind==="code_lint"?{id:"code_lint",outputDetail:{codingValidation:{...validation,patchSha256:"b".repeat(64)}}}:original(query));
 await expect(mintCodingArtifactApproval(input)).rejects.toThrow();expect(f.snapshot).not.toHaveBeenCalled();
});
it("refuses failed artifact capture before creating an approval",async()=>{f.prepare.mockResolvedValue({ok:false,error:"coding_artifact_invalid"});await expect(mintCodingArtifactApproval(input)).rejects.toThrow();expect(f.snapshot).not.toHaveBeenCalled();});
it("refuses a cross-workspace run before artifact capture",async()=>{f.run.mockResolvedValue({id:"run",organizationId:"other",pipelineId:"ai_coding",status:"running",metadata:{repoRef:"owned/repo"}});await expect(mintCodingArtifactApproval(input)).rejects.toThrow();expect(f.prepare).not.toHaveBeenCalled();});
it("requires the exact gate claim so a competing approval cannot substitute it",async()=>{f.gate.mockResolvedValue({count:0});await expect(mintCodingArtifactApproval(input)).rejects.toThrow();});

it("routes the coding gate through the artifact-bound minter",async()=>{
 const {mintPipelineStageApproval}=await import("../mintPipelineStageApproval");
 await mintPipelineStageApproval(input);expect(f.prepare).toHaveBeenCalledOnce();
 expect(f.snapshot).toHaveBeenCalledWith(expect.objectContaining({data:expect.objectContaining({action:`pipeline_stage:ai_coding:code_gate:${artifact.digest}`})}));
});
