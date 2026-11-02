import {readVerifiedDirectMergeSupportEvidence} from '@/lib/tauri/releaseDirectMergeSupport';
import 'server-only';
import {z} from 'zod';
import {withGithubAbort} from '@/lib/connectors/github/boundedGithubRead';
import {sha256ContentHash} from '@/lib/tauri/contentHash';
import {parseReleaseOperationPlan,type ReleaseOperationPlan} from '@/lib/tauri/releaseOperationPlanContract';
import type {ProviderMergeTransportPorts} from '@/lib/tauri/releaseProviderMergeTransport';

const credentialSchema=z.object({
 organizationId:z.string(),connectionId:z.string(),connectionRevision:z.string(),
 repositoryFullName:z.string(),installationId:z.string().regex(/^[1-9][0-9]{0,19}$/),
 token:z.string().min(1).max(4096).regex(/^[^\s\x00-\x1f\x7f-\x9f]+$/),
 expiresAt:z.number().finite(),contentsWrite:z.literal(true),pullRequestsRead:z.literal(true),
}).strict();
const supportSchema=z.object({
 organizationId:z.string(),connectionId:z.string(),connectionRevision:z.string(),repositoryFullName:z.string(),
 pullRequestNumber:z.number().int().positive(),headSha:z.string(),baseSha:z.string(),
 mergeQueueRequired:z.literal(false),stacked:z.literal(false),sourcePolicy:z.literal('expected_head_observed_base'),
}).strict();

/** Private proof constructed using the existing fixed credential/policy adapters.
 * Tokens never enter receipts or audit. Reads finish outside store transactions;
 * every admission phase repeats the actual provider proof rather than trusting
 * source freshness, an earlier policy result or a caller Boolean. */
export function createMergeProviderPreflight(ports:{
 assertCurrent(plan:Readonly<ReleaseOperationPlan>,signal:AbortSignal):Promise<void|(()=>void)>;
 readCredential:NonNullable<ProviderMergeTransportPorts['readCredential']>;
 readDirectMergeSupport:NonNullable<ProviderMergeTransportPorts['readDirectMergeSupport']>;
 now?:()=>number;
}){
 const proofs=new WeakMap<object,{planDigest:string;observedAt:number;expiresAt:number;credential:z.infer<typeof credentialSchema>;support:z.infer<typeof supportSchema>;authorityFresh?:()=>void}>();
 const now=ports.now??Date.now;
 function bound(plan:ReleaseOperationPlan,v:{organizationId:string;connectionId:string;connectionRevision:string;repositoryFullName:string}){
  return v.organizationId===plan.organizationId&&v.connectionId===plan.connectionId&&v.connectionRevision===plan.connectionRevision&&v.repositoryFullName===plan.pullRequest.repositoryFullName;
 }
 function consume(proof:object,raw:Readonly<ReleaseOperationPlan>){
  const saved=proofs.get(proof),plan=parseReleaseOperationPlan(raw);proofs.delete(proof);
  const assertFresh=()=>{saved?.authorityFresh?.();const at=now();if(!saved||!Number.isFinite(at)||at<saved.observedAt||at>=saved.expiresAt||saved.planDigest!==sha256ContentHash(plan)||!bound(plan,saved.credential)||saved.credential.expiresAt<=at+20000)throw Error('governance_merge_provider_proof_unavailable')};
  assertFresh();return Object.freeze({facts:Object.freeze({providerAccessVerified:true as const,verifiedEvidence:bound(plan,saved!.support)&&saved!.support.pullRequestNumber===plan.pullRequest.number&&saved!.support.headSha===plan.pullRequest.headSha&&saved!.support.baseSha===plan.pullRequest.baseSha}),assertFresh});
 }
 return{
  async read(raw:Readonly<ReleaseOperationPlan>,parent:AbortSignal){
   const plan=parseReleaseOperationPlan(raw),signal=AbortSignal.any([parent,AbortSignal.timeout(15000)]);
   let authorityFresh:(()=>void)|undefined;async function current(){signal.throwIfAborted();authorityFresh?.();const fresh=await withGithubAbort(ports.assertCurrent(structuredClone(plan),signal),signal);if(fresh!==undefined&&typeof fresh!=='function')throw Error('governance_merge_provider_unavailable');if(typeof fresh==='function'){const prior=authorityFresh;authorityFresh=()=>{signal.throwIfAborted();prior?.();if(fresh()!==undefined)throw Error('governance_merge_provider_unavailable')}}authorityFresh?.();signal.throwIfAborted();}
   await current();
   const credential=credentialSchema.parse(await withGithubAbort(ports.readCredential(structuredClone(plan),signal),signal));
   if(!bound(plan,credential)||credential.expiresAt<=now()+20000)throw Error('governance_merge_provider_unavailable');
   const rawSupport=await withGithubAbort(ports.readDirectMergeSupport(structuredClone(plan),signal,credential),signal);
   const provenance=readVerifiedDirectMergeSupportEvidence(rawSupport,plan,credential);
   const support=supportSchema.parse(rawSupport);
   if(!bound(plan,support)||support.pullRequestNumber!==plan.pullRequest.number||support.headSha!==plan.pullRequest.headSha||support.baseSha!==plan.pullRequest.baseSha)throw Error('governance_merge_provider_unavailable');
   await current();
   const at=now();if(!Number.isFinite(at)||!Number.isFinite(Date.parse(provenance.observedAt))||!Number.isFinite(Date.parse(provenance.expiresAt))||Date.parse(provenance.observedAt)>at||at>=Date.parse(provenance.observedAt)+30000||Date.parse(provenance.expiresAt)<=at||credential.expiresAt<=at+20000)throw Error('governance_merge_provider_unavailable');
   const proof=Object.freeze({planDigest:sha256ContentHash(plan),observedAt:at,expiresAt:Math.min(at+5000,credential.expiresAt-20000,Date.parse(provenance.expiresAt),Date.parse(provenance.observedAt)+30000)});
   proofs.set(proof,{planDigest:proof.planDigest,observedAt:at,expiresAt:proof.expiresAt,credential,support,authorityFresh});
   return proof;
  },
  facts:(proof:object,raw:Readonly<ReleaseOperationPlan>)=>consume(proof,raw).facts,
  consume,
 };
}
