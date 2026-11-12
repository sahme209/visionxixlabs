import {sha256ContentHash} from '@/lib/tauri/contentHash';
import {platformPrincipalSchema,type PlatformPrincipal,type PlatformPlan} from './contracts';
import {growthPreparationSelection,platformPreparationRequestId} from './preparationContract';
export {platformPreparationRequestId} from './preparationContract';
/** A public correlation reference, NOT a credential or new authority. Only
 * the actual verified principal is supplied by the private request factory. */
export function preparationActionReference(raw:string,principal:PlatformPrincipal,purpose:'platform_growth_preparation_v1'|'platform_deployment_preparation_v1'|'platform_template_preparation_v1'|'platform_settings_preparation_v1'|'platform_ecs_preparation_v1'|'platform_custodian_drain_preparation_v1'='platform_growth_preparation_v1'){
 const requestId=platformPreparationRequestId.parse(raw).toLowerCase(),actor=platformPrincipalSchema.parse(principal),hex=sha256ContentHash({purpose,actor,requestId});
 return 'platform_action_'+hex.slice(0,8)+'-'+hex.slice(8,12)+'-8'+hex.slice(13,16)+'-a'+hex.slice(17,20)+'-'+hex.slice(20,32);
}
export function canonicalGrowthSelection(raw:unknown){const selected=growthPreparationSelection.parse(raw);return {...selected,expiresAt:new Date(selected.expiresAt).toISOString(),...(selected.operation==='schedule'?{scheduledFor:new Date(selected.scheduledFor).toISOString()}:{})}}
export function matchesPreparationSelection(plan:PlatformPlan,raw:unknown){
 const selected=canonicalGrowthSelection(raw);if(plan.effects.length!==1)return false;const e=plan.effects[0];
 if(e.kind!=='growth.post.publish'&&e.kind!=='growth.post.delete'&&e.kind!=='growth.schedule.change')return false;
 const operation=e.kind==='growth.post.publish'?'publish':e.kind==='growth.post.delete'?'delete':'schedule';
 const original=canonicalGrowthSelection({operation,draftId:e.target.draftId,connectionId:e.target.connectionId,expiresAt:plan.expiresAt,...(e.kind==='growth.schedule.change'?{scheduledFor:e.target.scheduledFor}:{})});
 return sha256ContentHash(original)===sha256ContentHash(selected);
}
