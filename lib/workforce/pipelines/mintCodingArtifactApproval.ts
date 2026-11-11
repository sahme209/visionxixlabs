import "server-only";
import { randomUUID, createHash } from "node:crypto";
import { Prisma } from "@/lib/prismaClient";
import { prisma } from "@/lib/db";
import { record as recordAudit } from "@/lib/audit/secureAudit";
import { id as idFactory } from "@/lib/domain/ids";
import { parseRepoRef } from "./parseRepoRef";
import { prepareCodingArtifact } from "./prepareCodingArtifact";
import { verifyCodingArtifact, type CodingArtifact } from "./codingArtifact";
import type { MintPipelineStageApprovalInput, MintPipelineStageApprovalResult } from "./mintPipelineStageApproval";

function deny(): never {throw Error("coding_artifact_approval_unavailable");}
export function codingValidationMatches(detail: unknown, artifact: CodingArtifact): boolean {
  if(!detail || typeof detail!=="object")return false;
  const v=(detail as {codingValidation?:unknown}).codingValidation;
  if(!v || typeof v!=="object")return false;
  const stamp=v as Record<string,unknown>;
  return stamp.schema===1 && stamp.repositoryFullName===artifact.repositoryFullName && stamp.baseBranch===artifact.baseBranch && stamp.baseCommitSha===artifact.baseCommitSha && stamp.patchSha256===createHash("sha256").update(artifact.patchText).digest("hex");
}
/** One frozen artifact and its approval snapshot are stored in the same transaction. */
export async function mintCodingArtifactApproval(input: MintPipelineStageApprovalInput): Promise<MintPipelineStageApprovalResult> {
  if(input.pipelineId!=="ai_coding" || input.stageId!=="code_gate")deny();
  const observed=await prisma.pipelineRun.findUnique({where:{id:input.runId}});
  if(!observed || observed.organizationId!==input.organizationId || observed.pipelineId!=="ai_coding" || observed.status!=="running")deny();
  const metadata=observed.metadata as {repoRef?:unknown}|null;
  const target=typeof metadata?.repoRef==="string"?parseRepoRef(metadata.repoRef):null;if(!target)deny();
  const prepared=await prepareCodingArtifact({organizationId:input.organizationId,runId:input.runId,repositoryFullName:`${target.owner}/${target.repo}`});
  if(!prepared.ok || !verifyCodingArtifact(prepared.artifact,prepared.digest,input))deny();
  const a=prepared.artifact;
  const result = await prisma.$transaction(async tx=>{
    const current=await tx.pipelineRun.findUnique({where:{id:input.runId}});
    const currentMetadata=current?.metadata as {repoRef?:unknown}|null;
    const currentTarget=typeof currentMetadata?.repoRef==="string"?parseRepoRef(currentMetadata.repoRef):null;
    if(!current || current.organizationId!==input.organizationId || current.status!=="running" || current.pipelineId!=="ai_coding" || !currentTarget || `${currentTarget.owner}/${currentTarget.repo}`!==a.repositoryFullName)deny();
    const stage=(stageKind:string,id?:string)=>tx.pipelineStageRun.findFirst({where:{...(id?{id}:{}),runId:input.runId,run:{organizationId:input.organizationId},stageKind,status:"succeeded"},orderBy:{completedAt:"desc"}});
    const read=await stage("code_read",a.readStageRunId),proposal=await stage("code_propose",a.proposalStageRunId);
    const base=read?.outputDetail as Record<string,unknown>|null,patch=proposal?.outputDetail as {proposedPatchText?:unknown}|null;
    if(read?.id!==a.readStageRunId || proposal?.id!==a.proposalStageRunId || !base || base.owner!==target.owner || base.repo!==target.repo || base.branch!==a.baseBranch || base.headSha!==a.baseCommitSha || patch?.proposedPatchText!==a.patchText)deny();
    for(const kind of ["code_lint","code_test"]){const checked=await stage(kind);if(!checked || !codingValidationMatches(checked.outputDetail,a))deny();}
    const gate=await tx.pipelineStageRun.findFirst({where:{id:input.stageRunId,runId:input.runId,stageId:"code_gate",stageKind:"approval_gate",status:"queued",approvalRequestId:null}});
    if(!gate || gate.status!=="queued" || gate.approvalRequestId!==null)deny();
    const approvalRequestId=`apr_coding_${randomUUID()}`;
    const snapshot=await tx.engineerApprovalSnapshot.create({data:{organizationId:input.organizationId,approvalRequestId,engineerId:"pipeline_orchestrator",action:`pipeline_stage:ai_coding:code_gate:${prepared.digest}`,attemptId:null,riskLevel:"critical",effectiveRule:"two_step_approval",requiredApprovers:2,correlationId:input.correlationId,status:"pending",requestedBy:input.requestedBy,sourceKind:"pipeline_stage",pipelineStageRunId:input.stageRunId}});
    const claimed=await tx.pipelineStageRun.updateMany({where:{id:input.stageRunId,runId:input.runId,status:"queued",approvalRequestId:null},data:{status:"awaiting_approval",approvalRequestId,outputDetail:JSON.parse(JSON.stringify({codingArtifact:a,codingArtifactDigest:prepared.digest})) as Prisma.InputJsonValue}});
    if(claimed.count!==1)deny();
    return {approvalRequestId,snapshotId:snapshot.id};
  },{isolationLevel:"Serializable"});
  try {
    await recordAudit({organizationId:idFactory.organization(input.organizationId),actorUserId:idFactory.user(input.requestedBy),actorKind:"user",action:"engineer.approval_created",outcome:"success",entityRef:`approval:${result.approvalRequestId}`,correlationId:idFactory.correlation(input.correlationId),source:"live",detail:{approvalId:result.approvalRequestId,sourceKind:"pipeline_stage",pipelineId:input.pipelineId,runId:input.runId,stageId:input.stageId,requiredApprovers:2,codingArtifactDigest:prepared.digest,repositoryFullName:a.repositoryFullName,baseCommitSha:a.baseCommitSha,fileCount:a.files.length}});
  } catch { /* the committed approval remains authoritative if audit is unavailable */ }
  return result;
}
