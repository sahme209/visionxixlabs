import {z} from 'zod';
const identifier=z.string().min(1).max(256).refine(s=>s.trim()===s&&!/[\x00-\x1f]/.test(s));
export const digest=z.string().regex(/^[a-f0-9]{64}$/);
const accountId=z.string().regex(/^\d{12}$/),timestamp=z.string().datetime();
const cloud={accountId,region:identifier,bucket:identifier};
const social={connectionId:identifier,connectionRevision:identifier,author:identifier};
const origin=z.string().max(2048).refine(value=>{try{const u=new URL(value);return u.protocol==='https:'&&!u.username&&!u.password&&u.origin===value}catch{return false}});
const effect=<K extends string,T extends z.ZodRawShape>(kind:K,target:T)=>z.object({id:identifier,kind:z.literal(kind),target:z.object(target).strict()}).strict();
export const platformEffectSchema=z.discriminatedUnion('kind',[
 effect('deployment.vercel',{projectName:identifier,teamId:identifier,environment:z.enum(['preview','production']),projectCreation:z.literal('may_create_named_project'),filesDigest:digest,configurationDigest:digest}),
 effect('deployment.ecs',{accountId,region:identifier,cluster:identifier,service:identifier,taskDefinitionArn:identifier,operation:z.enum(['force','rollback']),configurationDigest:digest}),
 effect('settings.vercel',{projectId:identifier,settingsDigest:digest}),
 effect('template.bucket.create',cloud),
 effect('template.object.put',{...cloud,key:identifier,bytesDigest:digest}),
 effect('template.access.grant',{...cloud,key:identifier,objectVersion:identifier,bytesDigest:digest,recipientDigest:digest,ttlSeconds:z.number().int().min(1).max(3600)}),
 effect('growth.image.initialize',{...social,bytesDigest:digest}),
 effect('growth.image.put',{...social,bytesDigest:digest,uploadGrantDigest:digest,destinationOrigin:origin,destinationPathDigest:digest}),
 effect('growth.post.publish',{...social,draftId:identifier,renderedPayloadDigest:digest}),
 effect('growth.post.delete',{...social,postUrn:identifier}),
 effect('growth.schedule.change',{...social,draftId:identifier,scheduledFor:timestamp,renderedPayloadDigest:digest}),
]);
export const platformPlanSchema=z.object({format:z.literal(1),scope:z.literal('platform'),sourceDigest:digest,expiresAt:timestamp,effects:z.array(platformEffectSchema).min(1).max(32).refine(xs=>new Set(xs.map(x=>x.id)).size===xs.length)}).strict();
export const platformPrincipalSchema=z.object({userId:identifier,sessionId:identifier}).strict();
export type PlatformPrincipal=z.infer<typeof platformPrincipalSchema>;
export type PlatformEffect=z.infer<typeof platformEffectSchema>;
export type PlatformPlanInput=z.infer<typeof platformPlanSchema>;
export type PlatformPlan=Readonly<PlatformPlanInput & {digest:string}>;
export const platformStateSchema=z.object({plan:platformPlanSchema.extend({digest}),requester:platformPrincipalSchema,reviewer:platformPrincipalSchema.nullable(),status:z.enum(['proposed','approved','claimed','confirmed','refused','unknown']),attemptCount:z.number().int().min(0).max(1),version:z.number().int().min(0).max(3),createdAt:z.number().int().nonnegative().safe(),updatedAt:z.number().int().nonnegative().safe()}).strict();
export type PlatformAction=z.infer<typeof platformStateSchema>;
