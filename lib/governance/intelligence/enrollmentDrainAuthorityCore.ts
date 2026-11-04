import 'server-only';
import type {NextRequest} from 'next/server';
import {z} from 'zod';
import type {DesktopRequestPrincipal,ResolveOptions} from '@/lib/desktop/desktopSessionResolverCore';
export type CapturedSessionResolver=(request:NextRequest,options:ResolveOptions)=>Promise<DesktopRequestPrincipal|null|undefined>;
import {hasDesktopCapability,type DesktopCapability,type DesktopWorkspaceRole} from '@/lib/desktop/desktopAuthorization';
import {withGithubAbort} from '@/lib/connectors/github/boundedGithubRead';
import type {ReleaseOperationPlanTransaction as Tx} from '@/lib/agent/workflows/releaseOperationPlanStore';
import {identifier} from './contracts';
import type {RevisionScope} from './revisionStore';
const scopeSchema=z.object({organizationId:identifier,actorUserId:identifier,sessionId:identifier}).strict();
const roleSchema=z.enum(['reader','administrator','reviewer']);
export type EnrollmentDrainAuthorityRole=z.infer<typeof roleSchema>;
const capability:Record<EnrollmentDrainAuthorityRole,DesktopCapability>={reader:'workspace:read',administrator:'policy:manage',reviewer:'agent:approve'};
const roles=['owner','admin','operator','security_reviewer','finance_viewer','read_only'];
const refuse=():never=>{throw Error('enrollment_drain_authority_unavailable')};
/** Request-bound DB-only participant authority, never source/manifest/drain proof.
 * The store must derive subjectScope from its canonical exact plan and validated
 * original decision history, not request JSON. Caller and original subject are
 * distinct identities during administrator execution of an independent review.
 * Caller owns org-first locking and must retain/call the returned private closure
 * after later DB/commit awaits and at its actual consequential boundary. */
export function createPrivateEnrollmentDrainAuthority(request:NextRequest,resolveRequestDesktopSession:CapturedSessionResolver,now:()=>number=Date.now){
 return async(tx:Tx,rawCaller:RevisionScope,rawCallerRole:EnrollmentDrainAuthorityRole,rawSubject:RevisionScope,rawSubjectRole:EnrollmentDrainAuthorityRole):Promise<()=>void>=>{
  try{
   const caller=scopeSchema.parse(rawCaller),subject=scopeSchema.parse(rawSubject),callerRole=roleSchema.parse(rawCallerRole),subjectRole=roleSchema.parse(rawSubjectRole),started=now();
   const signal=AbortSignal.any([request.signal,AbortSignal.timeout(15000)]);
   const ready=()=>{signal.throwIfAborted();const at=now();if(!Number.isFinite(started)||!Number.isFinite(at)||at<started||at>=started+15000)refuse()};
   ready();if(caller.organizationId!==subject.organizationId||(callerRole==='administrator'&&subjectRole==='reviewer'||callerRole==='reviewer'&&subjectRole==='administrator')&&caller.actorUserId===subject.actorUserId)refuse();
   async function current(){
    ready();const p=await withGithubAbort(resolveRequestDesktopSession(request,{requiredScope:'pipeline:read',requiredCapability:capability[callerRole],requireWorkspaceMembership:true,requireActiveAccess:true,allowApiKey:false,recordHeartbeat:false,route:'governance enrollment drain authority'}),signal);ready();
    if(!p||p.credentialKind!=='desktop_session'||p.id!==caller.sessionId||p.userId!==caller.actorUserId||p.organizationId!==caller.organizationId||!p.capabilities.includes(capability[callerRole]))refuse();
   }
   async function participant(s:RevisionScope,role:EnrollmentDrainAuthorityRole){
    ready();const rows=await withGithubAbort(tx.$queryRaw<Array<{organizationId:string;userId:string;role:string;acceptedAt:Date|null;sessionId:string;sessionOrganizationId:string;sessionUserId:string;expiresAt:Date;live:boolean}>>`SELECT m."organizationId",m."userId",m."role",m."acceptedAt",s."id" AS "sessionId",s."organizationId" AS "sessionOrganizationId",s."userId" AS "sessionUserId",s."expiresAt",(s."revokedAt" IS NULL AND s."expiresAt">clock_timestamp()) AS "live" FROM "OrgMembership" m JOIN "DesktopSessionRecord" s ON s."organizationId"=m."organizationId" AND s."userId"=m."userId" WHERE m."organizationId"=${s.organizationId} AND m."userId"=${s.actorUserId} AND s."id"=${s.sessionId} FOR SHARE OF m,s`,signal);ready();
    const r=rows[0];if(rows.length!==1||!r||r.organizationId!==s.organizationId||r.userId!==s.actorUserId||!roles.includes(r.role)||role==='administrator'&&!['owner','admin'].includes(r.role)||!hasDesktopCapability(r.role as DesktopWorkspaceRole,capability[role])||!(r.acceptedAt instanceof Date)||!Number.isFinite(r.acceptedAt.getTime())||r.sessionId!==s.sessionId||r.sessionOrganizationId!==s.organizationId||r.sessionUserId!==s.actorUserId||r.live!==true||!(r.expiresAt instanceof Date)||!Number.isFinite(r.expiresAt.getTime()))refuse();
    return r.expiresAt.getTime();
   }
   await current();const callerExpiry=await participant(caller,callerRole),subjectExpiry=await participant(subject,subjectRole);await current();
   const assertFresh=()=>{ready();const at=now();if(at>=callerExpiry||at>=subjectExpiry)refuse();ready()};assertFresh();return assertFresh;
  }catch{return refuse()}
 };
}

export function createEnrollmentDrainAuthorityCore(request:NextRequest,dependencies:{resolveSession:CapturedSessionResolver;now:()=>number}){return createPrivateEnrollmentDrainAuthority(request,dependencies.resolveSession,dependencies.now)}
