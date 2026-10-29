import "server-only";
import { prisma } from "@/lib/db";
import { parseRepoRef } from "./parseRepoRef";
import { parseUnifiedDiff } from "./parseUnifiedDiff";
import { readCodingGithubFile } from "./codingGithubCredential";
import { buildCodingArtifact, isSafeCodingArtifactPath, type CodingArtifactResult } from "./codingArtifact";

const unavailable = (): CodingArtifactResult => ({ok:false,error:"coding_artifact_invalid"});
/** Read-only capture. This does not mint approval or authorize a repository write. */
export async function prepareCodingArtifact(input: {organizationId:string;runId:string;repositoryFullName:string}): Promise<CodingArtifactResult> {
  try {
    const target=parseRepoRef(input.repositoryFullName);if(!target)return unavailable();
    const load=async(stageKind:"code_read"|"code_propose")=>prisma.pipelineStageRun.findFirst({where:{runId:input.runId,run:{organizationId:input.organizationId},stageKind,status:"succeeded"},orderBy:{completedAt:"desc"},select:{id:true,outputDetail:true}});
    const read=await load("code_read"),proposal=await load("code_propose");
    const base=read?.outputDetail as Record<string,unknown>|null;
    const proposed=proposal?.outputDetail as {proposedPatchText?:unknown}|null;
    if(!read?.id || !proposal?.id || !base || base.owner!==target.owner || base.repo!==target.repo || typeof base.branch!=="string" || !base.branch.trim() || typeof base.headSha!=="string" || !/^[a-f0-9]{40}$/.test(base.headSha) || typeof proposed?.proposedPatchText!=="string" || Buffer.byteLength(proposed.proposedPatchText,"utf8")>262144)return unavailable();
    const patchText=proposed.proposedPatchText,baseBranch=base.branch,baseCommitSha=base.headSha;
    const parsed=parseUnifiedDiff(patchText);
    if(!parsed.ok || parsed.files.length===0 || parsed.files.length>20 || new Set(parsed.files.map(file=>file.path)).size!==parsed.files.length || parsed.files.some(file=>!isSafeCodingArtifactPath(file.path)))return unavailable();
    const baseFiles:Array<{path:string;content:string|null}>=[];
    for(const file of parsed.files){
      const observed=await readCodingGithubFile(input.organizationId,target,file.path,baseCommitSha);
      if(!observed.ok)return unavailable();baseFiles.push({path:file.path,content:observed.content});
    }
    // A mutable source row must not silently substitute a new proposal or base
    // while the remote reads are in flight. The resulting artifact owns bytes.
    const currentRead=await load("code_read"),currentProposal=await load("code_propose");
    const currentBase=currentRead?.outputDetail as Record<string,unknown>|null;
    const currentPatch=currentProposal?.outputDetail as {proposedPatchText?:unknown}|null;
    if(currentRead?.id!==read.id || currentProposal?.id!==proposal.id || currentPatch?.proposedPatchText!==patchText || !currentBase || currentBase.owner!==target.owner || currentBase.repo!==target.repo || currentBase.branch!==baseBranch || currentBase.headSha!==baseCommitSha)return unavailable();
    return buildCodingArtifact({...input,readStageRunId:read.id,proposalStageRunId:proposal.id,baseBranch,baseCommitSha,patchText,baseFiles});
  }catch{return unavailable();}
}
