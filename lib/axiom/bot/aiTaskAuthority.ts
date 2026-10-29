import 'server-only';
import {createHash} from 'node:crypto';
import {readWorkspaceAgentIdentity} from '@/lib/axiom/agentRuntime/agentIdentityPolicy';
import {loadWorkspaceAIProviderPolicyWithState,gatewayPolicyModelIds} from '@/lib/ai/workspaceProviderPolicy';
import {workspaceReadinessReaders} from './workspaceReadinessReaders';
import type {SavedBotTaskScope} from './savedTaskRepo';
/** Current accepted membership/commercial access and workspace AI policy only.
 * No tool profile is resolved and no connector credential or provider is read.
 * The governed adapter independently checks service/model readiness and credits. */
export async function readAiTaskAuthority(scope:SavedBotTaskScope,modelId:string,signal:AbortSignal):Promise<string|null>{
 signal.throwIfAborted();
 if(!scope.organizationId.trim()||!scope.userId.trim()||!modelId.trim())return null;
 try{
  const identity=await readWorkspaceAgentIdentity(scope.organizationId);signal.throwIfAborted();
  if(!identity||identity.organizationId!==scope.organizationId||!identity.enabled||!Number.isFinite(Date.parse(identity.updatedAt)))return null;
  const loaded=await loadWorkspaceAIProviderPolicyWithState(scope.organizationId);signal.throwIfAborted();
  const policy=loaded.policy;
  if(loaded.storageState!=='ready'||!policy||!policy.enabled||!policy.allowedProviders.includes('vercel_gateway')||!gatewayPolicyModelIds(policy).includes(modelId))return null;
  // Read membership closest to the resulting authority decision. Model/credit
  // admission also rereads its own policy before any paid dispatch.
  const access=await workspaceReadinessReaders().readAccess(scope,signal);signal.throwIfAborted();
  if(!access.accepted||!access.canRead||access.commercialCode!=='active')return null;
  return createHash('sha256').update(JSON.stringify(['bot-ai-authority-v1',scope.organizationId,scope.userId,modelId,access.role,identity.updatedAt,policy.enabled,[...policy.allowedProviders].sort(),[...gatewayPolicyModelIds(policy)].sort(),policy.modelSelections.vercel_gateway??null,[]])).digest('hex');
 }catch(error){signal.throwIfAborted();return null}
}
