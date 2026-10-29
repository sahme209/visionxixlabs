import {z} from 'zod';
export const AZURE_GUIDED_CALLBACK='https://visionxixlabs.com/api/integrations/azure-cloud/callback';
export const AZURE_ARM_SCOPE='https://management.azure.com/user_impersonation';
export const azureGuidedId=z.string().uuid();
const label=z.string().min(1).max(200).refine(x=>!/[\u0000-\u001f\u007f-\u009f]/.test(x));
export const azureGuidedResourceSchema=z.object({id:azureGuidedId,label,tenantId:azureGuidedId}).strict();
export const azureGuidedStatusSchema=z.object({available:z.boolean(),status:z.enum(['not_connected','awaiting_consent','working','selection_required','connected_read_only','outcome_unknown','expired','cancelled']),attemptId:azureGuidedId.optional(),expiresAt:z.string().datetime().optional(),resources:z.array(azureGuidedResourceSchema).max(100).optional(),truncated:z.boolean().optional(),connection:z.object({id:z.string().min(1).max(240),resourceId:azureGuidedId,version:z.number().int().positive(),authMode:z.enum(['delegated','service_principal'])}).strict().optional()}).strict().superRefine((v,c)=>{const issue=()=>c.addIssue({code:'custom',message:'incoherent Azure connection status'});if(v.status==='connected_read_only'&&!v.connection||v.status!=='connected_read_only'&&v.connection)issue();if(!!v.attemptId!==!!v.expiresAt)issue();if(!['not_connected','connected_read_only'].includes(v.status)&&(!v.attemptId||!v.expiresAt))issue();if(v.status==='selection_required'&&!v.resources||v.status!=='selection_required'&&(v.resources!==undefined||v.truncated!==undefined))issue();if(v.resources&&new Set(v.resources.map(x=>x.id)).size!==v.resources.length)issue()});
export type AzureGuidedStatus=z.infer<typeof azureGuidedStatusSchema>;
export const azureGuidedStartSchema=z.object({}).strict();
export const azureGuidedCompleteSchema=z.object({attemptId:azureGuidedId,subscriptionId:azureGuidedId}).strict();
export const azureGuidedCancelSchema=z.object({attemptId:azureGuidedId}).strict();
export interface AzureGuidedPrincipal{organizationId:string;userId:string;sessionId:string}
export class AzureGuidedError extends Error{constructor(public code:'azure_guided_unavailable'|'azure_guided_invalid'|'azure_guided_authority_required'|'azure_guided_conflict'|'azure_guided_outcome_unknown'|'cloud_account_limit_reached'){super(code)}}
