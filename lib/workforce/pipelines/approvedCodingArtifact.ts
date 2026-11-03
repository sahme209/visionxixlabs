import "server-only";
import type {Prisma} from "@prisma/client";
import { prisma } from "@/lib/db";
import { hasPermission } from "@/lib/axiom/agent/rbacEngine";
import type { OrgRole } from "@/lib/axiom/enums";
import { hasBoundApprovalVoteIdentity } from "@/lib/workforce/persistApprovalVote";
import { buildCodingArtifact, verifyCodingArtifact, type CodingArtifact } from "./codingArtifact";
type Result={ok:true;artifact:CodingArtifact;digest:string}|{ok:false;error:"coding_artifact_approval_unavailable"};
const deny=():Result=>({ok:false,error:"coding_artifact_approval_unavailable"});
/** A current evidence check, never a reusable capability. Call again before each provider operation. */
export async function loadApprovedCodingArtifact(input:{organizationId:string;runId:string;actorUserId:string},repo:Pick<Prisma.TransactionClient,"pipelineRun"|"orgMembership"|"pipelineStageRun">=prisma):Promise<Result>{
  try{
    // Coding generation does not support machine billing principals. Never
    // substitute a workspace owner for an API-key label here.
    if(!input.actorUserId || input.actorUserId.startsWith("api_key:"))return deny();
    const run=await repo.pipelineRun.findUnique({where:{id:input.runId}});
    if(!run || run.organizationId!==input.organizationId || run.pipelineId!=="ai_coding" || run.status!=="running" || run.triggeredBy!==input.actorUserId)return deny();
    const member=await repo.orgMembership.findUnique({where:{userId_organizationId:{userId:input.actorUserId,organizationId:input.organizationId}},select:{acceptedAt:true,role:true}});
    if(!member?.acceptedAt || !hasPermission(member.role as OrgRole,"actions:apply"))return deny();
    const gate=await repo.pipelineStageRun.findFirst({where:{runId:input.runId,run:{organizationId:input.organizationId},stageId:"code_gate",stageKind:"approval_gate",status:"succeeded",approvalRequestId:{not:null}},include:{approvals:{include:{decisions:true}}}});
    if(!gate || gate.status!=="succeeded" || !gate.approvalRequestId)return deny();
    const data=gate.outputDetail as {codingArtifact?:unknown;codingArtifactDigest?:unknown}|null;
    if(typeof data?.codingArtifactDigest!=="string" || !verifyCodingArtifact(data.codingArtifact,data.codingArtifactDigest,input))return deny();
    const snapshot=gate.approvals.find(row=>row.approvalRequestId===gate.approvalRequestId);
    if(!snapshot || snapshot.organizationId!==input.organizationId || snapshot.pipelineStageRunId!==gate.id || snapshot.sourceKind!=="pipeline_stage" || snapshot.status!=="approved" || snapshot.effectiveRule!=="two_step_approval" || !Number.isSafeInteger(snapshot.requiredApprovers) || snapshot.requiredApprovers<2 || snapshot.action!==`pipeline_stage:ai_coding:code_gate:${data.codingArtifactDigest}`)return deny();
    if(snapshot.decisions.some(v=>v.organizationId!==input.organizationId || !hasBoundApprovalVoteIdentity(v) || v.decision!=="approved"))return deny();
    if(new Set(snapshot.decisions.map(v=>v.approverUserId)).size<snapshot.requiredApprovers)return deny();
    const original=data.codingArtifact as CodingArtifact;
    const owned=buildCodingArtifact({...original,baseFiles:original.files.map(file=>({path:file.path,content:file.before}))});
    if(!owned.ok || owned.digest!==data.codingArtifactDigest)return deny();
    return{ok:true,artifact:owned.artifact,digest:owned.digest};
  }catch{return deny();}
}
