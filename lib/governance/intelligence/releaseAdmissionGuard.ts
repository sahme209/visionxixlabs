import 'server-only';
import {z} from 'zod';
import {withGithubAbort} from '@/lib/connectors/github/boundedGithubRead';
import {sha256ContentHash as hash} from '@/lib/tauri/contentHash';
import {parseGovernanceAdmissionContext,type GovernanceAdmissionContext,type GovernanceGuardPorts,type GovernanceAdmissionReceipt} from './admissionGuard';
import {evaluateGovernanceClaimEligibility} from './releaseAdmission';
import {evaluateGovernanceAdmission} from './admission';
import type {CompiledBaseline} from './contracts';
export interface ReleaseProviderEligibilityAuthority {kind:'release_provider_eligibility_v1';assertFresh():void}
export interface ReleaseProviderWriteAuthority {kind:'release_provider_write_v1';assertFresh():void}
type ExistingFacts=Awaited<ReturnType<GovernanceGuardPorts['readVerifiedInputs']>>;
type CommonFacts=Omit<ExistingFacts,'providerAccessVerified'>;
export interface ReleaseGovernanceGuardPorts {
 now():number;
 readActive(context:GovernanceAdmissionContext,signal:AbortSignal):Promise<CompiledBaseline>;
 readCoverage:GovernanceGuardPorts['readCoverage'];
 readClaimInputs(context:GovernanceAdmissionContext,baseline:CompiledBaseline,signal:AbortSignal):Promise<CommonFacts&{providerEligibilityVerified:boolean;providerAuthority:ReleaseProviderEligibilityAuthority}>;
 readWriteInputs(context:GovernanceAdmissionContext,baseline:CompiledBaseline,signal:AbortSignal):Promise<ExistingFacts&{providerAuthority:ReleaseProviderWriteAuthority}>;
}
export interface ReleaseClaimReceipt extends GovernanceAdmissionReceipt {kind:'release_claim_admission_v1';phase:'before_claim';executionAuthorized:false}
export interface ReleaseWriteReceipt extends GovernanceAdmissionReceipt {kind:'release_write_admission_v1';phase:'before_write';executionAuthorized:false}
const authoritySchema=z.object({kind:z.enum(['release_provider_eligibility_v1','release_provider_write_v1']),assertFresh:z.custom<()=>void>(value=>typeof value==='function')}).strict();
/** Server composition only. Neither proof kind nor a successful claim grants
 * write access. Real provider authority closures cannot arrive through JSON;
 * original eligibility remains fresh through actual claim; final write uses fresh actual write authority. */
export function createReleaseGovernanceAdmissionGuard(ports:ReleaseGovernanceGuardPorts){
 const issued=new WeakMap<object,{digest:string;contextDigest:string;baselineDigest:string;checkedAt:number;assertFresh:()=>void;assertRunFresh:()=>void}>();
 function fail():never{throw Error('governance_release_admission_unavailable')}
 async function check(raw:unknown,phase:'before_claim'|'before_write',rawPrior:unknown,parent?:AbortSignal){try{
  const signal=AbortSignal.any([...(parent?[parent]:[]),AbortSignal.timeout(15000)]),started=ports.now(),context=parseGovernanceAdmissionContext(raw),contextDigest=hash(context);
  if(!['repository.merge','deployment.dispatch'].includes(context.action))fail();
  const prior=typeof rawPrior==='object'&&rawPrior!==null?issued.get(rawPrior):undefined;
  if(phase==='before_write'&&(!prior||prior.digest!==hash(rawPrior)||prior.contextDigest!==contextDigest))fail();
  const ready=()=>{signal.throwIfAborted();const time=ports.now();if(!Number.isFinite(started)||!Number.isFinite(time)||time<started||time-started>15000||prior&&(time<prior.checkedAt||time-prior.checkedAt>15000))fail();prior?.assertRunFresh()};ready();
  async function bounded<T>(read:()=>Promise<T>){ready();const result=await withGithubAbort(read(),signal);ready();return result}
  const baseline=structuredClone(await bounded(()=>ports.readActive(context,signal)));if(prior&&prior.baselineDigest!==baseline.digest)fail();
  const coverage=await bounded(()=>ports.readCoverage(context,signal));
  const facts=phase==='before_claim'?await bounded(()=>ports.readClaimInputs(context,baseline,signal)):await bounded(()=>ports.readWriteInputs(context,baseline,signal));
  const authority=authoritySchema.parse(facts.providerAuthority),expected=phase==='before_claim'?'release_provider_eligibility_v1':'release_provider_write_v1';if(authority.kind!==expected)fail();
  const providerFresh=()=>{ready();if(authority.assertFresh()!==undefined)fail();signal.throwIfAborted()};providerFresh();
  const requestBase={organizationId:context.organizationId,actorUserId:context.actorUserId,action:context.action,scope:context.scope,planDigest:context.planDigest,platformAllowed:facts.platformAllowed,autonomyLevel:facts.autonomyLevel,verifiedEvidence:facts.verifiedEvidence,rollbackVerified:facts.rollbackVerified};
  const inputBase={active:{baseline,activeDigest:baseline.digest,approvedDigest:baseline.digest,revoked:false},evidence:facts.evidence,coverage,now:ports.now(),approval:facts.approval,evidenceRefreshes:facts.evidenceRefreshes};
  if(phase==='before_claim'){if(!('providerEligibilityVerified'in facts)||!evaluateGovernanceClaimEligibility({...inputBase,request:{...requestBase,kind:'release_claim_eligibility_v1',providerEligibilityVerified:facts.providerEligibilityVerified}}).claimAllowed)fail()}
  else if(!('providerAccessVerified'in facts)||!evaluateGovernanceAdmission({...inputBase,request:{...requestBase,providerAccessVerified:facts.providerAccessVerified}}).allowed)fail();
  const finished=ports.now();ready();providerFresh();if(!Number.isFinite(finished)||finished<started||finished-started>15000)fail();
  if(phase==='before_claim'){const receipt:ReleaseClaimReceipt={kind:'release_claim_admission_v1',baselineDigest:baseline.digest,contextDigest,checkedAt:finished,phase:'before_claim',executionAuthorized:false};issued.set(receipt,{digest:hash(receipt),contextDigest,baselineDigest:baseline.digest,checkedAt:finished,assertFresh:providerFresh,assertRunFresh:()=>{parent?.throwIfAborted()}});return receipt}
  const receipt:ReleaseWriteReceipt={kind:'release_write_admission_v1',baselineDigest:baseline.digest,contextDigest,checkedAt:finished,phase:'before_write',executionAuthorized:false};return receipt;
 }catch{return fail()}}
 function assertClaimFresh(receipt:unknown){try{if(typeof receipt!=='object'||receipt===null)fail();const proof=issued.get(receipt);if(!proof||proof.digest!==hash(receipt))fail();proof.assertFresh()}catch{return fail()}}
 return{assertClaimFresh,async assertClaim(raw:unknown,parent?:AbortSignal):Promise<ReleaseClaimReceipt>{return await check(raw,'before_claim',undefined,parent) as ReleaseClaimReceipt},async assertWrite(raw:unknown,prior:unknown,parent?:AbortSignal):Promise<ReleaseWriteReceipt>{return await check(raw,'before_write',prior,parent) as ReleaseWriteReceipt}};
}
