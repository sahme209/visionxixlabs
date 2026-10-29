import 'server-only';
import {z} from 'zod';
import {awsGuidedChoiceSchema} from './contract';
import {awsGuidedTemplateSchema,buildAwsGuidedLaunch} from './launch';
import type {EnrollmentPrincipal} from '../enrollment/service';
/** Explicit administrator-installed configuration, not provider evidence or a
 * request body. A valid registry still requires separate live resource approval. */
const registrySchema=z.object({version:z.literal(1),organizationId:z.string().min(1).max(160).regex(/^[A-Za-z0-9_-]+$/),template:awsGuidedTemplateSchema,choices:z.array(awsGuidedChoiceSchema).min(1).max(50)}).strict();
export function loadAwsGuidedRegistry(raw:unknown,scope:EnrollmentPrincipal){
 try{if(typeof raw!=='string'||Buffer.byteLength(raw,'utf8')>65536)return null;const x=registrySchema.parse(JSON.parse(raw));if(x.organizationId!==scope.organizationId||x.template.roleName.length>30||new Set(x.choices.map(c=>c.id)).size!==x.choices.length||new Set(x.choices.map(c=>`${c.accountId}:${c.region}`)).size!==x.choices.length)return null;
 for(const c of x.choices)buildAwsGuidedLaunch({selection:{choiceId:c.id,accountId:c.accountId,region:c.region,roleName:x.template.roleName},template:x.template,challenge:{attemptId:'registry_validation',externalId:'axiom-'+'0'.repeat(32),expiresAt:new Date(Date.now()+60000).toISOString()}});
 return{template:x.template,choices:x.choices.map(c=>({...c,roleName:x.template.roleName}))};
 }catch{return null}
}
