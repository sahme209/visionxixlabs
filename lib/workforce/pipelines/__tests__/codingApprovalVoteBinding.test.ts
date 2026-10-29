import { beforeEach, expect, it, vi } from "vitest";
const f=vi.hoisted(()=>({transaction:vi.fn(),snapshot:vi.fn(),gate:vi.fn(),create:vi.fn(),update:vi.fn()}));
vi.mock("@/lib/db",()=>({prisma:{$transaction:f.transaction}}));
import { buildCodingArtifact } from "../codingArtifact";
import { persistApprovalVote } from "@/lib/workforce/persistApprovalVote";
const built=buildCodingArtifact({organizationId:"org",runId:"run",proposalStageRunId:"proposal",readStageRunId:"read",repositoryFullName:"owned/repo",baseBranch:"main",baseCommitSha:"a".repeat(40),patchText:"--- a/file.txt\n+++ b/file.txt\n@@ -1 +1 @@\n-old\n+new\n",baseFiles:[{path:"file.txt",content:"old\n"}]});if(!built.ok)throw Error("fixture artifact required");
let gate:any;
beforeEach(()=>{vi.resetAllMocks();gate={id:"gate",runId:"run",status:"awaiting_approval",approvalRequestId:"approval",outputDetail:{codingArtifact:structuredClone(built.artifact),codingArtifactDigest:built.digest}};
 f.snapshot.mockResolvedValue({id:"snapshot",organizationId:"org",approvalRequestId:"approval",status:"pending",sourceKind:"pipeline_stage",pipelineStageRunId:"gate",action:`pipeline_stage:ai_coding:code_gate:${built.digest}`,requiredApprovers:2,decisions:[]});
 f.gate.mockImplementation(async()=>gate);f.transaction.mockImplementation(async fn=>fn({$executeRaw:vi.fn(),engineerApprovalSnapshot:{findUnique:f.snapshot,update:f.update},engineerApprovalDecision:{create:f.create},pipelineStageRun:{findFirst:f.gate}}));
});
const vote={approvalRequestId:"approval",organizationId:"org",principal:{kind:"user" as const,id:"approver"},rawDecision:"approved",engineSourceId:null};
it.each([undefined,"b".repeat(64)])("requires the exact reviewed digest before recording approval %s",async reviewDigest=>{
 expect(await persistApprovalVote({...vote,reviewDigest} as never)).toMatchObject({kind:"reject",reason:"coding_review_required"});expect(f.create).not.toHaveBeenCalled();
});
it("rejects changed artifact bytes even when the client echoed the earlier digest",async()=>{
 gate.outputDetail.codingArtifact.files[0].after="substituted\n";
 expect(await persistApprovalVote({...vote,reviewDigest:built.digest} as never)).toMatchObject({kind:"reject",reason:"coding_review_required"});expect(f.create).not.toHaveBeenCalled();
});
it("records a vote only for the unchanged bound artifact",async()=>{expect(await persistApprovalVote({...vote,reviewDigest:built.digest} as never)).toMatchObject({kind:"accepted"});expect(f.create).toHaveBeenCalledOnce();});
it("allows rejecting an unavailable review without granting approval",async()=>{gate.outputDetail=null;expect(await persistApprovalVote({...vote,rawDecision:"rejected"})).toMatchObject({kind:"accepted",decision:"rejected"});});
