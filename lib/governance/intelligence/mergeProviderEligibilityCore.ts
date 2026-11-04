import 'server-only';
import {z} from 'zod';
import {withGithubAbort} from '@/lib/connectors/github/boundedGithubRead';
import type {consumeReleaseInstallationEligibility} from '@/lib/connectors/github/githubAppAuth';
import {parseReleaseOperationPlan,type ReleaseOperationPlan} from '@/lib/tauri/releaseOperationPlanContract';
import {readVerifiedDirectMergeSupportEvidence,type ProviderMergeReadCredential,type createReleaseDirectMergeSupportReader} from '@/lib/tauri/releaseDirectMergeSupport';
import {sha256ContentHash as hash} from '@/lib/tauri/contentHash';
const credentialSchema=z.object({organizationId:z.string(),connectionId:z.string(),connectionRevision:z.string(),repositoryFullName:z.string(),installationId:z.string().regex(/^[1-9][0-9]{0,14}$/),token:z.string().min(1).max(4096).regex(/^[^\s\x00-\x1f\x7f-\x9f]+$/),expiresAt:z.number().finite(),contentsRead:z.literal(true),pullRequestsRead:z.literal(true)}).strict();
/** Claim-only evidence. No write credential is requested and no execution grant
 * is inferred from provider metadata. Actual write preflight remains separate. */
export function createMergeProviderEligibility(ports:{consumeReleaseInstallationEligibility:typeof consumeReleaseInstallationEligibility;assertCurrent(plan:Readonly<ReleaseOperationPlan>,signal:AbortSignal):Promise<void|(()=>void)>;readPolicyCredential(plan:Readonly<ReleaseOperationPlan>,signal:AbortSignal):Promise<ProviderMergeReadCredential|null>;readEligibility(plan:Readonly<ReleaseOperationPlan>,credential:Readonly<ProviderMergeReadCredential>,signal:AbortSignal):Promise<object|null>;readDirectMergeSupport:ReturnType<typeof createReleaseDirectMergeSupportReader>;now?:()=>number}){
 const proofs=new WeakMap<object,{digest:string;assertFresh:()=>void}>(),now=ports.now??Date.now;
 return{
 async read(raw:Readonly<ReleaseOperationPlan>,parent:AbortSignal){
  const plan=parseReleaseOperationPlan(raw),signal=AbortSignal.any([parent,AbortSignal.timeout(15000)]),started=now();
  let currentFresh:(()=>void)|undefined;const ready=()=>{signal.throwIfAborted();currentFresh?.();const at=now();if(!Number.isFinite(at)||at<started||at>=started+15000)throw Error('governance_merge_eligibility_unavailable')};
  const current=async()=>{ready();const fresh=await withGithubAbort(ports.assertCurrent(plan,signal),signal);if(fresh!==undefined&&typeof fresh!=='function')throw Error('release_eligibility_authority_unavailable');if(typeof fresh==='function'){const prior=currentFresh;currentFresh=()=>{prior?.();if(fresh()!==undefined)throw Error('release_eligibility_authority_unavailable')}}ready()};await current();
  const c=credentialSchema.parse(await withGithubAbort(ports.readPolicyCredential(structuredClone(plan),signal),signal));
  if(c.organizationId!==plan.organizationId||c.connectionId!==plan.connectionId||c.connectionRevision!==plan.connectionRevision||c.repositoryFullName!==plan.pullRequest.repositoryFullName||c.expiresAt<=now()+20000)throw Error('governance_merge_eligibility_unavailable');
  const support=await withGithubAbort(ports.readDirectMergeSupport(structuredClone(plan),signal,c),signal),source=readVerifiedDirectMergeSupportEvidence(support,plan,c);
  const metadata=await withGithubAbort(ports.readEligibility(structuredClone(plan),c,signal),signal);if(!metadata)throw Error('governance_merge_eligibility_unavailable');
  await current();const issued=ports.consumeReleaseInstallationEligibility(metadata,{organizationId:plan.organizationId,connectionId:plan.connectionId,connectionRevision:plan.connectionRevision,installationId:c.installationId,repositoryFullName:plan.pullRequest.repositoryFullName,purpose:'merge',planDigest:hash(plan)}),observed=now();
  const fresh=()=>{ready();issued.assertFresh();const at=now();if(at<observed||at>=observed+5000||at>=Date.parse(source.expiresAt)||at>=Date.parse(source.observedAt)+30000||Date.parse(source.observedAt)>at||c.expiresAt<=at+20000)throw Error('governance_merge_eligibility_unavailable')};fresh();
  const proof=Object.freeze({kind:'merge_provider_eligibility_v1'});proofs.set(proof,{digest:hash(plan),assertFresh:fresh});return proof;
 },
 consume(proof:object,raw:Readonly<ReleaseOperationPlan>){const saved=proofs.get(proof);proofs.delete(proof);if(!saved||saved.digest!==hash(parseReleaseOperationPlan(raw)))throw Error('governance_merge_eligibility_unavailable');saved.assertFresh();return{facts:{providerEligibilityVerified:true as const,verifiedEvidence:true},assertFresh:saved.assertFresh,authority:{kind:'release_provider_eligibility_v1' as const,assertFresh:saved.assertFresh}}},
 };
}
