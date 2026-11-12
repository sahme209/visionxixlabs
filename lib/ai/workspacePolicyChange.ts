import {loadWorkspaceAIProviderPolicyWithState,gatewayPolicyModelIds,type WorkspaceAIProviderPolicy} from './workspaceProviderPolicy';
import {workspaceUnenrolled} from '@/lib/governance/intelligence/enrolledRefusal';
import {isProviderPolicyLoosening} from '@/lib/governance/intelligence/enrolledRefusalPolicy';
/** Include non-Gateway models: changing a customer-hosted model increases reach
 * just as adding a Gateway approval does. Provider prefixes prevent collisions. */
export function workspaceProviderPolicyReach(policy:WorkspaceAIProviderPolicy){
 return {enabled:policy.enabled,allowedProviders:policy.allowedProviders,approvedModels:[
  ...gatewayPolicyModelIds(policy).map(model=>'vercel_gateway:'+model),
  ...Object.entries(policy.modelSelections).filter(([provider])=>provider!=='vercel_gateway').map(([provider,model])=>provider+':'+model),
 ]};
}
/** M02 refusal only; this never grants access or replaces route authorization.
 * Disabling remains possible even when current policy/enrollment is unreadable. */
export async function providerPolicyChangeRefusal(organizationId:string,next:WorkspaceAIProviderPolicy):Promise<'provider_policy_unavailable'|'governance_enrolled_policy_loosening'|null>{
 if(!next.enabled)return null;
 const loaded=await loadWorkspaceAIProviderPolicyWithState(organizationId).catch(()=>null);
 if(!loaded||loaded.storageState!=='ready')return 'provider_policy_unavailable';
 if(isProviderPolicyLoosening(loaded.policy?workspaceProviderPolicyReach(loaded.policy):null,workspaceProviderPolicyReach(next))&&!await workspaceUnenrolled(organizationId))return 'governance_enrolled_policy_loosening';
 return null;
}
