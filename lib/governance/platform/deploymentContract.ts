import {z} from 'zod';
import {platformSourceId} from './sourceCatalog';
export const platformDeploymentSelection=z.object({leadId:platformSourceId,projectName:z.string().regex(/^[a-z0-9][a-z0-9-]{0,99}$/),environment:z.enum(['preview','production']),expiresAt:z.string().datetime()}).strict();
import {platformActionId} from './viewContract';
import {digest} from './contracts';
export const platformDeploymentPreview=z.object({kind:z.literal('deployment.vercel'),actionId:platformActionId,planDigest:digest,sourceDigest:digest,effectId:platformSourceId,files:z.array(z.object({path:z.string().min(1).max(512),content:z.string().max(131072)}).strict()).min(1).max(6),authority:z.literal('review_preview_only')}).strict().superRefine((value,c)=>{if(new TextEncoder().encode(JSON.stringify(value.files)).byteLength>128*1024)c.addIssue({code:'custom',message:'Deployment source exceeds review profile'})});
import {platformPreparationRequestId} from './preparationContract';
export const platformDeploymentCommand=z.discriminatedUnion('operation',[
 z.object({operation:z.literal('prepare_deployment'),requestId:platformPreparationRequestId,selection:platformDeploymentSelection}).strict(),
 z.object({operation:z.literal('lookup_deployment'),requestId:platformPreparationRequestId}).strict(),
 z.object({operation:z.literal('preview_deployment'),actionId:platformActionId}).strict(),
]);
