import {executionPolicyRecoveryReferenceSchema,type ExecutionPolicyRecoveryReference} from './executionPolicyRecoveryStore';
import {z} from 'zod';
import {releaseOperationPlanRequest,type ReleasePlanResult} from './releaseOperationPlanTransport';
const identity=z.string().min(1).max(256).refine(v=>v.trim()===v&&!/[\x00-\x1f*]/.test(v)),digest=z.string().regex(/^[a-f0-9]{64}$/),nonce=z.string().uuid(),version=z.number().int().min(0).max(999);
export const executionPolicyId=z.string().regex(/^governance_execution_policy_[a-f0-9]{64}$/);
export const executionPolicyScope=z.object({repositoryId:identity,resourceId:identity,environment:z.enum(['production','staging','development','qa'])}).strict();
export const executionPolicyActions=['discovery.read','recommendation.create','repository.merge','deployment.dispatch','integration.slack.send','integration.teams.send','integration.linear.create','integration.linear.update','integration.linear.close','integration.outlook.send','integration.outlook.event.create','computer.replace_text'] as const;
export const executionPolicyProposalSchema=z.object({scope:executionPolicyScope,parentDigest:digest.nullable(),autonomyLevel:z.number().int().min(0).max(5),actions:z.array(z.enum(executionPolicyActions)).min(1).max(12).refine(v=>new Set(v).size===v.length),executorUserIds:z.array(identity).min(1).max(100).refine(v=>new Set(v).size===v.length),expiresAt:z.string().datetime()}).strict();
export const executionPolicyRevisionSchema=z.object({id:executionPolicyId,version:z.number().int().min(0).max(2),status:z.enum(['proposed','approved','revoked']),policy:executionPolicyProposalSchema.extend({organizationId:identity,digest}).strict(),requesterUserId:identity,approval:z.object({userId:identity,sessionId:identity,digest,clientRequestId:nonce,at:z.string().datetime()}).strict().nullable(),executionAuthorized:z.literal(false)}).strict().superRefine((v,c)=>{if(v.status==='proposed'&&(v.version!==0||v.approval)||v.status==='approved'&&(v.version!==1||!v.approval)||v.status==='revoked'&&v.version!==(v.approval?2:1)||v.approval&&(v.approval.userId===v.requesterUserId||v.policy.executorUserIds.includes(v.approval.userId)||v.approval.digest!==v.policy.digest))c.addIssue({code:'custom',message:'Invalid historical execution-policy review'})});
export const executionPolicyActivationSchema=z.object({digest,pointerVersion:version,executionAuthorized:z.literal(false)}).strict();
const pointerSchema=z.discriminatedUnion('found',[z.object({found:z.literal(false),scope:executionPolicyScope,executionAuthorized:z.literal(false)}).strict(),z.object({found:z.literal(true),scope:executionPolicyScope,revisionId:executionPolicyId,digest,pointerVersion:version,parentDigest:digest.nullable(),policyStatus:z.enum(['proposed','approved','revoked']),expiresAt:z.string().datetime(),executionAuthorized:z.literal(false)}).strict()]);
export const executionPolicyDirectorySchema=z.object({items:z.array(z.object({id:executionPolicyId,version:z.number().int().min(0).max(2),status:z.enum(['proposed','approved','revoked']),digest,scope:executionPolicyScope,autonomyLevel:z.number().int().min(0).max(5),expiresAt:z.string().datetime(),requesterUserId:identity,createdAt:z.string().datetime()}).strict()).max(20),truncated:z.boolean(),executionAuthorized:z.literal(false)}).strict();
export type ExecutionPolicyDirectory=z.infer<typeof executionPolicyDirectorySchema>;
export const executionPolicyRequestsSchema=z.object({items:z.array(z.object({requestId:nonce,operation:z.enum(['propose','approve','activate','revoke']),createdAt:z.string().datetime(),digest,revisionId:executionPolicyId.optional()}).strict().refine(v=>v.operation==='activate'?!v.revisionId:Boolean(v.revisionId))).max(20),truncated:z.boolean(),historical:z.literal(true),executionAuthorized:z.literal(false)}).strict();
export type ExecutionPolicyRequests=z.infer<typeof executionPolicyRequestsSchema>;
const mutationSchema=z.discriminatedUnion('operation',[
 z.object({operation:z.literal('propose'),policy:executionPolicyProposalSchema,requestId:nonce}).strict(),
 z.object({operation:z.literal('approve'),id:executionPolicyId,version:z.literal(0),digest,requestId:nonce}).strict(),
 z.object({operation:z.literal('activate'),id:executionPolicyId,digest,pointerVersion:version.nullable(),parentDigest:digest.nullable(),requestId:nonce}).strict(),
 z.object({operation:z.literal('revoke'),id:executionPolicyId,version:z.union([z.literal(0),z.literal(1)]),requestId:nonce}).strict(),
]);
export type ExecutionPolicyRevision=z.infer<typeof executionPolicyRevisionSchema>;
export type ExecutionPolicyMutation=z.infer<typeof mutationSchema>;
export type ExecutionPolicyPointer=z.infer<typeof pointerSchema>;
export type ExecutionPolicyResult=ExecutionPolicyRevision|z.infer<typeof executionPolicyActivationSchema>;
/** A sparse locator cannot verify original proposal content or restore authority. */
export type ExecutionPolicyHistoricalObservation={found:boolean;historical:true;exactProposalContentVerified:false;executionAuthorized:false;revisionId?:string;status?:'proposed'|'approved'|'revoked'|'activation_recorded'};
export type ExecutionPolicyLookup={found:false;historical:true;executionAuthorized:false}|{found:true;result:ExecutionPolicyResult;historical:true;executionAuthorized:false};
const equal=(a:unknown,b:unknown)=>JSON.stringify(a)===JSON.stringify(b);
function matches(raw:unknown,request:ExecutionPolicyMutation):raw is ExecutionPolicyResult{
 if(request.operation==='activate'){const r=executionPolicyActivationSchema.safeParse(raw);return r.success&&r.data.digest===request.digest&&r.data.pointerVersion===(request.pointerVersion===null?0:request.pointerVersion+1)}
 const r=executionPolicyRevisionSchema.safeParse(raw);if(!r.success)return false;const v=r.data;
 if(request.operation==='propose'){const{organizationId:ignored,digest:ignoredDigest,...proposal}=v.policy;return v.status==='proposed'&&equal(proposal,request.policy)}
 return v.id===request.id&&(request.operation==='approve'?v.policy.digest===request.digest&&v.status==='approved'&&v.version===1&&v.approval?.clientRequestId===request.requestId:v.status==='revoked'&&v.version===request.version+1);
}
/** Fixed paired paths, exact acknowledgements and inert original-outcome lookup.
 * Nothing here dispatches a provider action or changes baseline enrollment. */
export function createExecutionPolicyClient(context:Parameters<typeof releaseOperationPlanRequest>[0]){
 const path='/api/desktop/governance-intelligence/execution-policy';
 const fail=<T>():Promise<ReleasePlanResult<T>>=>Promise.resolve({ok:false,error:'Load the exact policy and workspace before taking this step.',outcomeUnconfirmed:false});
 return{
  async observeOriginal(raw:ExecutionPolicyRecoveryReference,rawOwner:{organizationId:string;userId:string},signal?:AbortSignal):Promise<ReleasePlanResult<ExecutionPolicyHistoricalObservation>>{
   const selected=executionPolicyRecoveryReferenceSchema.safeParse(raw),owner=z.object({organizationId:identity,userId:identity}).strict().safeParse(rawOwner);
   if(!selected.success||!owner.success)return fail<ExecutionPolicyHistoricalObservation>();const reference=selected.data;
   const result=await releaseOperationPlanRequest(context,'POST',path,{operation:'lookup',recordedOperation:reference.operation,requestId:reference.requestId},(value):value is ExecutionPolicyLookup=>{
    if(!value||typeof value!=='object'||Array.isArray(value))return false;const row=value as ExecutionPolicyLookup;
    if(row.historical!==true||row.executionAuthorized!==false||typeof row.found!=='boolean'||Object.keys(row).sort().join(',')!==(row.found?'executionAuthorized,found,historical,result':'executionAuthorized,found,historical'))return false;
    if(!row.found)return true;
    if(reference.operation==='activate'){const r=executionPolicyActivationSchema.safeParse(row.result);return r.success&&r.data.digest===reference.digest&&r.data.pointerVersion===reference.expectedPointerVersion}
    const r=executionPolicyRevisionSchema.safeParse(row.result);if(!r.success||r.data.policy.organizationId!==owner.data.organizationId)return false;const saved=r.data;
    if(reference.operation==='propose')return saved.status==='proposed'&&saved.requesterUserId===owner.data.userId;
    if(saved.id!==reference.id)return false;
    return reference.operation==='approve'?saved.status==='approved'&&saved.policy.digest===reference.digest&&saved.approval?.clientRequestId===reference.requestId&&saved.approval.userId===owner.data.userId:saved.status==='revoked'&&saved.version===reference.expectedVersion;
   },signal);
   if(!result.ok)return result;
   const summary:ExecutionPolicyHistoricalObservation={found:result.data.found,historical:true,exactProposalContentVerified:false,executionAuthorized:false};
   if(result.data.found){if('policy' in result.data.result){summary.revisionId=result.data.result.id;summary.status=result.data.result.status}else summary.status='activation_recorded'}
   return{ok:true,data:summary};
  },
  list(signal?:AbortSignal){return releaseOperationPlanRequest(context,'POST',path,{operation:'list_saved'},(v):v is ExecutionPolicyDirectory=>executionPolicyDirectorySchema.safeParse(v).success,signal)},
  requests(signal?:AbortSignal){return releaseOperationPlanRequest(context,'POST',path,{operation:'list_requests'},(v):v is ExecutionPolicyRequests=>executionPolicyRequestsSchema.safeParse(v).success,signal)},
  read(id:string,signal?:AbortSignal){if(!executionPolicyId.safeParse(id).success)return fail<ExecutionPolicyRevision>();return releaseOperationPlanRequest(context,'POST',path,{operation:'read',id},(v):v is ExecutionPolicyRevision=>executionPolicyRevisionSchema.safeParse(v).success&&(v as ExecutionPolicyRevision).id===id,signal)},
  active(raw:unknown,signal?:AbortSignal){const selection=executionPolicyScope.safeParse(raw);if(!selection.success)return fail<ExecutionPolicyPointer>();return releaseOperationPlanRequest(context,'POST',path,{operation:'read_active',selection:selection.data},(v):v is ExecutionPolicyPointer=>{const r=pointerSchema.safeParse(v);return r.success&&equal(r.data.scope,selection.data)},signal)},
  mutate(raw:unknown,signal?:AbortSignal){const selected=mutationSchema.safeParse(raw);if(!selected.success)return fail<ExecutionPolicyResult>();const request=selected.data,body=request.operation==='activate'?(({digest:ignored,...rest})=>rest)(request):request;return releaseOperationPlanRequest(context,'POST',path,body,(v):v is ExecutionPolicyResult=>matches(v,request),signal)},
  lookup(raw:unknown,signal?:AbortSignal){const selected=mutationSchema.safeParse(raw);if(!selected.success)return fail<ExecutionPolicyLookup>();const request=selected.data;return releaseOperationPlanRequest(context,'POST',path,{operation:'lookup',recordedOperation:request.operation,requestId:request.requestId},(v):v is ExecutionPolicyLookup=>{if(!v||typeof v!=='object'||Array.isArray(v))return false;const r=v as ExecutionPolicyLookup;if(r.historical!==true||r.executionAuthorized!==false||typeof r.found!=='boolean')return false;return equal(Object.keys(r).sort(),(r.found?['found','historical','executionAuthorized','result']:['found','historical','executionAuthorized']).sort())&&(!r.found||matches(r.result,request))},signal)},
 };
}
