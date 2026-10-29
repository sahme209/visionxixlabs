import 'server-only';
import {randomBytes} from 'node:crypto';
import {sha256ContentHash} from './contentHash';
import {releaseOperationPlanSchema,type ReleaseOperationPlan} from './releaseOperationPlanContract';
export interface ReleaseOperationPreviewScope {organizationId:string;userId:string;sessionId:string;requestId:string;requestVersion:number}
/** Short-lived server-only evidence handoff, never approval or execution authority.
 * A process restart/cache miss requires an explicit fresh read. No client metadata fallback. */
export function createReleaseOperationPreviewCache(now=()=>Date.now(),maxEntries=128){
 const entries=new Map<string,{scope:string;planJson:string;digest:string;expiresAt:number}>();
 const refuse=():never=>{throw Error('release_plan_preview_required')};
 const key=(scope:ReleaseOperationPreviewScope)=>{if(!Number.isSafeInteger(scope.requestVersion)||scope.requestVersion<1||[scope.organizationId,scope.userId,scope.sessionId,scope.requestId].some(v=>!v||v.length>240||v!==v.trim()||/[\0\r\n]/.test(v)))return refuse();return JSON.stringify([scope.organizationId,scope.userId,scope.sessionId,scope.requestId,scope.requestVersion])};
 function cleanup(at:number){for(const [token,value]of entries)if(value.expiresAt<=at)entries.delete(token)}
 return {
  issue(scope:ReleaseOperationPreviewScope,input:unknown){
   const scopeKey=key(scope),at=now();if(!Number.isSafeInteger(at))return refuse();cleanup(at);
   if(!Number.isSafeInteger(maxEntries)||maxEntries<1||maxEntries>128||entries.size>=maxEntries)return refuse();
   const plan=releaseOperationPlanSchema.parse(input),planJson=JSON.stringify(plan);
   if(Buffer.byteLength(planJson)>16384||plan.organizationId!==scope.organizationId||plan.requestId!==scope.requestId||plan.requestVersion!==scope.requestVersion||Date.parse(plan.window.endUtc)<=at)return refuse();
   const digest=sha256ContentHash(plan),previewToken='rpv_'+randomBytes(32).toString('hex'),expiresAt=Math.min(at+300000,Date.parse(plan.window.endUtc));
   entries.set(previewToken,{scope:scopeKey,planJson,digest,expiresAt});
   return{authority:'evidence_only' as const,plan:JSON.parse(planJson) as ReleaseOperationPlan,digest,previewToken,expiresAt:new Date(expiresAt).toISOString(),executionAvailable:false as const};
  },
  consume(scope:ReleaseOperationPreviewScope,token:string){
   const entry=entries.get(token);entries.delete(token);
   if(!entry||!/^rpv_[a-f0-9]{64}$/.test(token)||entry.scope!==key(scope)||entry.expiresAt<=now())return refuse();
   const plan=releaseOperationPlanSchema.parse(JSON.parse(entry.planJson));if(sha256ContentHash(plan)!==entry.digest)return refuse();
   return{plan,digest:entry.digest};
  },
 };
}
export const releaseOperationPreviewCache=createReleaseOperationPreviewCache();
