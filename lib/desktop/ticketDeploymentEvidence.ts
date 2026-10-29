import 'server-only';
import {z} from 'zod';
import {sha256ContentHash} from '@/lib/tauri/contentHash';
import {withGithubAbort} from '@/lib/connectors/github/boundedGithubRead';
import {parseReleaseWorkflowEvidenceDto,releaseWorkflowEvidenceBindingSchema} from '@/lib/tauri/releaseWorkflowEvidenceContract';
import type {ReleaseWorkflowEvidenceBinding} from '@/lib/tauri/releaseWorkflowEvidenceContract';
export interface TicketEvidenceScope {organizationId:string;actorUserId:string;sessionId:string}
export interface TicketEvidenceExpectation {releaseId:string;releaseVersion:number;intakeDigest:string;planId:string;planDigest:string;connectionId:string;connectionRevision:string}
export interface TicketEvidencePorts {
 readEvidence?:(scope:Readonly<TicketEvidenceScope>,id:string,signal:AbortSignal)=>Promise<unknown>;
 readCurrentBinding?:(scope:Readonly<TicketEvidenceScope>,binding:Readonly<ReleaseWorkflowEvidenceBinding>,signal:AbortSignal)=>Promise<unknown>;
 assertCurrent?:(scope:Readonly<TicketEvidenceScope>,signal:AbortSignal)=>Promise<void>;
 now?:()=>number;
}
const text=z.string().min(1).max(240).refine(v=>v===v.trim()&&!/[\x00-\x1f\x7f-\x9f]/.test(v));
const scopeSchema=z.object({organizationId:text,actorUserId:text,sessionId:text}).strict();
const expectedSchema=releaseWorkflowEvidenceBindingSchema.pick({releaseId:true,releaseVersion:true,intakeDigest:true,planId:true,planDigest:true,connectionId:true,connectionRevision:true});
/** Trusted server ports only: never install these from request payloads or accept a caller-supplied run URL.
 * The evidence store must enforce tenant/session ownership; the current-binding port must rebuild
 * provenance from the accepted deployment ledger, not merely echo the supplied binding.
 * Success attests a workflow conclusion only, not deployed artifact, application health or ticket closure. */
export function createTicketDeploymentEvidenceReader(ports:TicketEvidencePorts={}){
 const refuse=():never=>{throw Error('ticket_deployment_evidence_unavailable')};
 const now=ports.now??Date.now;
 return async(rawScope:TicketEvidenceScope,rawExpected:TicketEvidenceExpectation,id:string,signal:AbortSignal)=>{
  signal.throwIfAborted();
  if(!ports.readEvidence||!ports.readCurrentBinding||!ports.assertCurrent||!/^release_workflow_evidence_[a-f0-9]{64}$/.test(id))refuse();
  const scope=Object.freeze(scopeSchema.parse(rawScope)),expected=Object.freeze(expectedSchema.parse(rawExpected));
  const authority=async()=>{signal.throwIfAborted();await withGithubAbort(ports.assertCurrent!(scope,signal),signal);signal.throwIfAborted()};
  await authority();
  const evidence=parseReleaseWorkflowEvidenceDto(await withGithubAbort(ports.readEvidence!(scope,id,signal),signal));
  const binding=evidence.binding,observation=evidence.observation;
  const fresh=()=>{const time=now();if(!Number.isFinite(time)||Date.parse(binding.expiresAt)<=time||!observation||Date.parse(observation.observedAt)>time||time-Date.parse(observation.observedAt)>900000)refuse()};
  if(evidence.id!==id||binding.organizationId!==scope.organizationId||evidence.state!=='observed'||!observation||observation.status!=='completed'||observation.conclusion!=='success'||observation.bindingDigest!==sha256ContentHash(binding))refuse();
  for(const key of Object.keys(expected) as Array<keyof TicketEvidenceExpectation>)if(binding[key]!==expected[key])refuse();
  fresh();
  const checkBinding=async()=>{const current=releaseWorkflowEvidenceBindingSchema.parse(await withGithubAbort(ports.readCurrentBinding!(scope,Object.freeze(structuredClone(binding)),signal),signal));if(sha256ContentHash(current)!==sha256ContentHash(binding))refuse();fresh()};
  await checkBinding();
  const final=parseReleaseWorkflowEvidenceDto(await withGithubAbort(ports.readEvidence!(scope,id,signal),signal));
  if(sha256ContentHash(final)!==sha256ContentHash(evidence))refuse();
  await checkBinding();await authority();fresh();
  return Object.freeze({id:evidence.id,digest:sha256ContentHash({kind:'ticket_workflow_evidence_v1',evidence}),provider:'github_actions' as const,runId:binding.runId,runAttempt:binding.runAttempt,headSha:binding.sourceCommit,conclusion:'success' as const,url:`https://github.com/${binding.repositoryFullName}/actions/runs/${binding.runId}`});
 };
}
