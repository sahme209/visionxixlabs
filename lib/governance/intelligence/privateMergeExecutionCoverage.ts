import 'server-only';
import type {NextRequest} from 'next/server';
import type {ReleaseOperationPlanRepo,ReleaseOperationPlanTransaction} from '@/lib/agent/workflows/releaseOperationPlanStore';
import type {ReleaseOperationPlan} from '@/lib/tauri/releaseOperationPlanContract';
import {createReleaseProviderMergeCoordinatorCore} from '@/lib/desktop/releaseProviderMergeCoordinatorCore';
import {createGovernedProviderMergeExecutor} from './governedProviderMerge';
import {createReleaseProviderMergeToken} from '@/lib/desktop/releaseProviderMergeTokenCore';
import {createReleaseMergeCredentialExposure} from '@/lib/desktop/releaseMergeCredentialExposure';
import {createMergeOutboundDrain} from './mergeOutboundDrainCore';
import type {createPrivateGithubAppAuth} from '@/lib/connectors/github/privateGithubAppAuth';
import type {ProviderMergeTransportPorts} from '@/lib/tauri/releaseProviderMergeTransport';
import type {CapturedSessionResolver} from './requestAuthorityCore';
import type {RevisionScope} from './revisionStore';
import type {CompiledBaseline} from './contracts';
import {scopeSchema,identifier} from './contracts';
import {z} from 'zod';
import {readIssuerIdentity} from '@axiom/verified-issuer-runtime';
import {sha256ContentHash} from '@/lib/tauri/contentHash';
import {readReleaseOperationPlanInTransaction} from '@/lib/agent/workflows/releaseOperationPlanStore';
import {createPrivateGovernanceRequestAuthority} from './requestAuthorityCore';
import {governanceContextFromReviewedRelease} from './releaseScope';
import {compileBaseline} from './contracts';
import {readEnrollmentDrainBlockersLocked} from './enrollmentDrainStore';
import {readNativeGitCredentialLeaseBlockers} from './nativeGitCredentialLeaseStore';
import {captureCurrentDesktopSessionFreshness} from '@/lib/desktop/currentSessionFreshness';
import {releaseProviderMergeExecutionId} from '@/lib/tauri/releaseProviderMergeStore';

type Handler=(request:NextRequest,requestId:string,planId:string)=>Promise<Response>;
export interface PrivateMergeExecutionGraph {
 readonly repo:ReleaseOperationPlanRepo;
 readonly resolveSession:CapturedSessionResolver;
 readonly releaseAuth:Pick<ReturnType<typeof createPrivateGithubAppAuth>,'resolveReleaseInstallationToken'|'readReleaseInstallationEligibility'|'consumeReleaseInstallationEligibility'>;
 readonly transport:typeof fetch;
 readonly handlers:Readonly<{execution:Handler;operation:Handler}>;
 readonly forRequest:(request:NextRequest)=>ReturnType<typeof createReleaseProviderMergeCoordinatorCore>;
 readonly factories:Readonly<{
  coordinator:typeof createReleaseProviderMergeCoordinatorCore;
  executor:typeof createGovernedProviderMergeExecutor;
  credential:typeof createReleaseProviderMergeToken;
  exposure:typeof createReleaseMergeCredentialExposure;
  outbound:typeof createMergeOutboundDrain;
 }>;
}
export interface PrivateMergeAttempt {
 readonly operationId:string;
 readonly plan:Readonly<ReleaseOperationPlan>;
 readonly store:object;
 readonly guard:object;
 readonly readCredential:NonNullable<ProviderMergeTransportPorts['readCredential']>;
 readonly transport:ProviderMergeTransportPorts;
 readonly factories:PrivateMergeExecutionGraph['factories'];
}
export interface PrivateMergeRequestCoverage {
 readCoverage(selection:unknown,signal:AbortSignal,tx?:ReleaseOperationPlanTransaction):Promise<Readonly<{coveredActions:readonly string[]}>>;
 verifyBaselineActivation(tx:ReleaseOperationPlanTransaction,scope:RevisionScope,baseline:CompiledBaseline):Promise<boolean>;
 bindAttempt(attempt:PrivateMergeAttempt):()=>void;
}
export interface PrivateMergeExecutionCoverage {
 forRequest(request:NextRequest,scope:RevisionScope):PrivateMergeRequestCoverage;
}
export const PRIVATE_MERGE_EXECUTION_FACTORIES:PrivateMergeExecutionGraph['factories']=Object.freeze({coordinator:createReleaseProviderMergeCoordinatorCore,executor:createGovernedProviderMergeExecutor,credential:createReleaseProviderMergeToken,exposure:createReleaseMergeCredentialExposure,outbound:createMergeOutboundDrain});

const registrations=new WeakSet<object>(),requests=new WeakSet<object>();
const compositionBindings=new WeakMap<object,{repo:ReleaseOperationPlanRepo;resolveSession:CapturedSessionResolver;releaseAuth:object;transport:typeof fetch}>();
const principalSchema=z.object({organizationId:identifier,actorUserId:identifier,sessionId:identifier}).strict();
function fail():never{throw Error('governance_private_coverage_unavailable')}
function plainData(value:unknown,names:readonly string[]):value is Record<string,unknown>{
 if(!value||typeof value!=='object'||Object.getPrototypeOf(value)!==Object.prototype)return false;
 const fields=Object.getOwnPropertyDescriptors(value);
 return Reflect.ownKeys(fields).length===names.length&&names.every(name=>fields[name]&&'value'in fields[name]);
}
/** Trusted lexical composition only. Matching source/DTO fields do not create a
 * runtime: every use reads the actual canonical object and its native challenge. */
export function createPrivateMergeExecutionCoverage(repo:ReleaseOperationPlanRepo,authority:Readonly<{resolveSession:CapturedSessionResolver;now:()=>number}>,graph:PrivateMergeExecutionGraph):PrivateMergeExecutionCoverage {
 const graphKeys=['repo','resolveSession','releaseAuth','transport','handlers','forRequest','factories'];
 const factoryKeys=Object.keys(PRIVATE_MERGE_EXECUTION_FACTORIES) as Array<keyof PrivateMergeExecutionGraph['factories']>;
 if(!plainData(graph,graphKeys)||!Object.isFrozen(graph)||graph.repo!==repo||graph.resolveSession!==authority.resolveSession||typeof authority.now!=='function'||typeof graph.transport!=='function'||typeof graph.forRequest!=='function'||!plainData(graph.handlers,['execution','operation'])||!Object.isFrozen(graph.handlers)||typeof graph.handlers.execution!=='function'||typeof graph.handlers.operation!=='function'||!plainData(graph.factories,factoryKeys)||factoryKeys.some(key=>graph.factories[key]!==PRIVATE_MERGE_EXECUTION_FACTORIES[key]))fail();
 const auth=graph.releaseAuth;
 const authFields:Record<string,PropertyDescriptor>=auth?Object.getOwnPropertyDescriptors(auth):{};
 if(!auth||!Object.isFrozen(auth)||['resolveReleaseInstallationToken','readReleaseInstallationEligibility','consumeReleaseInstallationEligibility'].some(key=>!authFields[key]||!('value'in authFields[key])||typeof authFields[key].value!=='function'))fail();
 const origin=readIssuerIdentity();
 const current=()=>{
  const next=readIssuerIdentity();
  if(origin.status!=='current'||next!==origin||next.status!=='current'||next.executingIssuerIdentity!=='current'||!/^[a-f0-9]{64}$/.test(next.issuerArtifactDigest)||graph.repo!==repo||graph.resolveSession!==authority.resolveSession||graph.releaseAuth!==auth||factoryKeys.some(key=>graph.factories[key]!==PRIVATE_MERGE_EXECUTION_FACTORIES[key]))fail();
 };
 const registration:PrivateMergeExecutionCoverage=Object.freeze({
  forRequest(request:NextRequest,rawScope:RevisionScope){
   const scope=principalSchema.parse(rawScope),url=new URL(request.url);
   const route=/^\/api\/desktop\/deployments\/([A-Za-z0-9_-]{1,160})\/operation-plans\/(release_plan_[a-f0-9]{64})\/provider-execution$/.exec(url.pathname);
   const routeBound=url.origin==='https://axiom.invalid'&&!url.search&&!url.hash&&route?route:null;
   const requestId=routeBound?.[1],planId=routeBound?.[2],assertAuthority=createPrivateGovernanceRequestAuthority(request,authority.resolveSession);
   const ready=(signal:AbortSignal)=>{request.signal.throwIfAborted();signal.throwIfAborted();current()};
   async function derive(tx:ReleaseOperationPlanTransaction,signal:AbortSignal){
    ready(signal);if(!requestId||!planId)fail();await assertAuthority(tx,scope,'reader');ready(signal);
    const saved=await readReleaseOperationPlanInTransaction(tx,{organizationId:scope.organizationId,actorUserId:scope.actorUserId,id:planId,canManage:false,assertCurrent:t=>assertAuthority(t,scope,'reader')},new Date(authority.now()));ready(signal);
    if(saved.id!==planId||saved.requestId!==requestId||saved.version!==1||saved.status!=='reviewed')fail();
    const rows=await tx.$queryRaw<Array<{id:string;organizationId:string;version:number;status:string;intakeJson:unknown}>>`SELECT "id","organizationId","version","status","intakeJson" FROM "TauriDeploymentRequest" WHERE "id"=${requestId} AND "organizationId"=${scope.organizationId} FOR SHARE`;ready(signal);
    if(rows.length!==1)fail();
    const row=rows[0],context=governanceContextFromReviewedRelease({scope,row:{id:row.id,organizationId:row.organizationId,version:row.version,status:row.status,intakeJson:row.intakeJson},plan:saved.plan});
    await assertAuthority(tx,scope,'reader');ready(signal);return{context,plan:saved.plan};
   }
   const inTransaction=<T>(tx:ReleaseOperationPlanTransaction|undefined,run:(t:ReleaseOperationPlanTransaction)=>Promise<T>)=>tx?run(tx):repo.$transaction(async t=>{
    await t.$queryRaw`SELECT 1 AS locked FROM pg_advisory_xact_lock(hashtext(${'governance_org_'+sha256ContentHash(scope.organizationId)}))`;return run(t);
   });
   const handle=Object.freeze<PrivateMergeRequestCoverage>({
    async readCoverage(rawSelection:unknown,signal:AbortSignal,tx?:ReleaseOperationPlanTransaction){
     const selection=scopeSchema.parse(rawSelection);ready(signal);
     const bound=await inTransaction(tx,t=>derive(t,signal));ready(signal);
     if(sha256ContentHash(selection)!==sha256ContentHash(bound.context.scope))fail();
     return Object.freeze({coveredActions:['repository.merge']});
    },
    async verifyBaselineActivation(tx,raw,baseline){
     const signal=request.signal;ready(signal);
     if(sha256ContentHash(principalSchema.parse(raw))!==sha256ContentHash(scope))fail();
     const {digest,compilerVersion,...input}=baseline,checked=compileBaseline(input);
     if(sha256ContentHash(checked)!==sha256ContentHash(baseline)||baseline.organizationId!==scope.organizationId)fail();
     await assertAuthority(tx,scope,'policy_admin');ready(signal);
     const bound=await derive(tx,signal);
     if(baseline.scopes.length!==1||sha256ContentHash(baseline.scopes[0])!==sha256ContentHash(bound.context.scope)||baseline.rules.some(rule=>rule.actions.some(action=>action!=='repository.merge')))fail();
     // Existing private-claim/credential metadata must be observed under this
     // same org lock. Zero rows are not fleet qualification or authority.
     const assertReader=async(t:ReleaseOperationPlanTransaction,organizationId:string)=>{
      ready(signal);if(t!==tx||organizationId!==scope.organizationId)fail();
      await assertAuthority(t,scope,'policy_admin');ready(signal);
      const sessionFresh=await captureCurrentDesktopSessionFreshness(t,scope,signal,authority.now);ready(signal);
      return()=>{ready(signal);sessionFresh();};
     };
     const native=await readNativeGitCredentialLeaseBlockers(tx,scope.organizationId,{signal,assertCurrent:assertReader,now:()=>new Date(authority.now())});ready(signal);
     const effects=await readEnrollmentDrainBlockersLocked(tx,scope.organizationId,{signal,assertCurrent:assertReader});ready(signal);
     if(native.pendingCount||native.liveIssuedCount||native.expiredIssuedCount||effects.blockingCount||effects.transition&&effects.transition.status!=='aborted')fail();
     await assertAuthority(tx,scope,'policy_admin');ready(signal);return true;
    },
    bindAttempt(attempt){
     const signal=request.signal;ready(signal);if(!requestId||!planId)fail();
     const fields=['operationId','plan','store','guard','readCredential','transport','factories'];
     if(!plainData(attempt,fields)||attempt.operationId!==releaseProviderMergeExecutionId(scope.organizationId,planId)||attempt.plan.organizationId!==scope.organizationId||attempt.plan.requestId!==requestId||attempt.transport.fetch!==graph.transport||typeof attempt.readCredential!=='function'||factoryKeys.some(key=>attempt.factories[key]!==graph.factories[key]))fail();
     const store=attempt.store as Record<string,unknown>,guard=attempt.guard as Record<string,unknown>;
     if(!store||!guard||['validatePrepared','beforeDispatch','claimWithAdmission','beforeDispatchWithAdmission'].some(key=>typeof store[key]!=='function')||['assert','assertClaim','assertFinal'].some(key=>typeof guard[key]!=='function'))fail();
     const digest=sha256ContentHash(attempt.plan),credential=attempt.readCredential,transport=attempt.transport,operationId=attempt.operationId;
     const functions={store:Object.fromEntries(['validatePrepared','beforeDispatch','claimWithAdmission','beforeDispatchWithAdmission'].map(key=>[key,store[key]])),guard:Object.fromEntries(['assert','assertClaim','assertFinal'].map(key=>[key,guard[key]]))};
     return()=>{
      ready(signal);
      if(attempt.operationId!==operationId||attempt.store!==store||attempt.guard!==guard||attempt.readCredential!==credential||attempt.transport!==transport||transport.fetch!==graph.transport||sha256ContentHash(attempt.plan)!==digest||factoryKeys.some(key=>attempt.factories[key]!==graph.factories[key])||Object.entries(functions.store).some(([key,value])=>store[key]!==value)||Object.entries(functions.guard).some(([key,value])=>guard[key]!==value))fail();
     };
    },
   });
   requests.add(handle);return handle;
  },
 });
 registrations.add(registration);compositionBindings.set(registration,{repo,resolveSession:authority.resolveSession,releaseAuth:graph.releaseAuth,transport:graph.transport});return registration;
}
export function isPrivateMergeExecutionCoverage(value:unknown):value is PrivateMergeExecutionCoverage{return!!value&&typeof value==='object'&&registrations.has(value)}
export function isPrivateMergeRequestCoverage(value:unknown):value is PrivateMergeRequestCoverage{return!!value&&typeof value==='object'&&requests.has(value)}
export function assertPrivateMergeExecutionComposition(value:PrivateMergeExecutionCoverage,repo:ReleaseOperationPlanRepo,resolveSession:CapturedSessionResolver,releaseAuth:object,transport:typeof fetch){
 const captured=compositionBindings.get(value);
 if(!isPrivateMergeExecutionCoverage(value)||!captured||captured.repo!==repo||captured.resolveSession!==resolveSession||captured.releaseAuth!==releaseAuth||captured.transport!==transport)fail();
}
