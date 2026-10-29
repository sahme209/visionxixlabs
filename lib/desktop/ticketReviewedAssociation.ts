import 'server-only';
import {z} from 'zod';
import {sha256ContentHash} from '@/lib/tauri/contentHash';
import {withGithubAbort} from '@/lib/connectors/github/boundedGithubRead';
import {releaseWorkflowObservationSchema,type ReleaseWorkflowEvidenceBinding} from '@/lib/tauri/releaseWorkflowEvidenceContract';
import {ticketReviewScopeSchema,ticketReleaseAssociationSchema,type TicketReviewScope,type TicketReleaseAssociation} from '@/lib/releaseops/ticketGovernanceReviewContract';
export interface ReviewedTicketAssociationPorts {
 readApprovedAssociation?:(scope:Readonly<TicketReviewScope>,reviewId:string,signal:AbortSignal)=>Promise<unknown>;
 /** Rebuild from original ticket history, current connection, accepted deployment ledger and current release head. Never echo the supplied proposal or impersonate its requester. */
 readCurrentAssociation?:(scope:Readonly<TicketReviewScope>,association:Readonly<TicketReleaseAssociation>,signal:AbortSignal)=>Promise<unknown>;
 /** Fixed read-only run verification. Does not dispatch, renew an execution lease or rewrite historical evidence. */
 verifyRun?:(scope:Readonly<TicketReviewScope>,binding:Readonly<ReleaseWorkflowEvidenceBinding>,signal:AbortSignal)=>Promise<unknown>;
 assertCurrent?:(scope:Readonly<TicketReviewScope>,signal:AbortSignal)=>Promise<void>;
 now?:()=>number;
}
const proofSchema=z.object({kind:z.literal('verified_ticket_governance_review_v1'),reviewId:z.string().regex(/^ticket_review_[a-f0-9]{64}$/),bindingDigest:z.string().regex(/^[a-f0-9]{64}$/),approverUserId:z.string().min(1),binding:ticketReleaseAssociationSchema}).strict();
export function createReviewedTicketAssociationReader(ports:ReviewedTicketAssociationPorts={}){
 return async(rawScope:TicketReviewScope,reviewId:string,parent:AbortSignal)=>{
  if(!ports.readApprovedAssociation||!ports.readCurrentAssociation||!ports.verifyRun||!ports.assertCurrent)throw Error('ticket_association_unavailable');
  const scope=Object.freeze(ticketReviewScopeSchema.parse(rawScope)),now=ports.now??Date.now,signal=AbortSignal.any([parent,AbortSignal.timeout(15000)]);
  const current=async()=>{signal.throwIfAborted();await withGithubAbort(ports.assertCurrent!(scope,signal),signal);signal.throwIfAborted()};
  const readProof=async()=>{
   await current();const proof=proofSchema.parse(await withGithubAbort(ports.readApprovedAssociation!(scope,reviewId,signal),signal));
   if(proof.reviewId!==reviewId||proof.binding.organizationId!==scope.organizationId||proof.bindingDigest!==sha256ContentHash(proof.binding)||[proof.binding.requesterUserId,proof.binding.executorUserId].includes(proof.approverUserId)||Date.parse(proof.binding.expiresAt)<=now())throw Error('ticket_association_changed');return proof;
  };
  const proof=await readProof(),association=proof.binding,binding=association.deployment.binding;
  const verifySource=async()=>{const rebuilt=ticketReleaseAssociationSchema.parse(await withGithubAbort(ports.readCurrentAssociation!(scope,Object.freeze(structuredClone(association)),signal),signal));if(sha256ContentHash(rebuilt)!==proof.bindingDigest)throw Error('ticket_association_changed')};
  await verifySource();
  const observation=releaseWorkflowObservationSchema.parse(await withGithubAbort(ports.verifyRun(scope,Object.freeze(structuredClone(binding)),signal),signal));
  const fresh=()=>{const at=now(),observed=Date.parse(observation.observedAt);if(!Number.isFinite(at)||observed>at||at-observed>60000||Date.parse(association.expiresAt)<=at||observation.bindingDigest!==sha256ContentHash(binding)||observation.status!=='completed'||observation.conclusion!=='success')throw Error('ticket_association_evidence_unavailable')};
  fresh();await verifySource();const final=await readProof();if(sha256ContentHash(final)!==sha256ContentHash(proof))throw Error('ticket_association_changed');await current();fresh();
  return Object.freeze({reviewId,bindingDigest:proof.bindingDigest,originalReleaseId:association.original.releaseId,deployedReleaseId:binding.releaseId,deployedReleaseVersion:binding.releaseVersion,currentHeadVersion:association.deployment.headReleaseVersion,providerExecutionAvailable:false as const,evidence:Object.freeze({id:association.deployment.evidenceId,digest:sha256ContentHash({kind:'reviewed_ticket_association_evidence_v1',association,reviewId,observation:{bindingDigest:observation.bindingDigest,status:observation.status,conclusion:observation.conclusion}}),provider:'github_actions' as const,runId:binding.runId,runAttempt:binding.runAttempt,headSha:binding.sourceCommit,conclusion:'success' as const,url:`https://github.com/${binding.repositoryFullName}/actions/runs/${binding.runId}`})});
 };
}
