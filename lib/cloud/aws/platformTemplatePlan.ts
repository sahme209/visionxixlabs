import {platformEffectSchema} from '@/lib/governance/platform/contracts';
const fail=():never=>{throw Error('platform_template_plan_unavailable')};
export function templateRegion(value:string):'us-east-1'|'us-east-2'{if(value!=='us-east-1'&&value!=='us-east-2')fail();return value as 'us-east-1'|'us-east-2'}
export function templateBucketName(accountId:string){if(!/^\d{12}$/.test(accountId))fail();return 'axiom-cfn-templates-'+accountId}
export function templateObjectKey(bytesDigest:string){if(!/^[a-f0-9]{64}$/.test(bytesDigest))fail();return 'templates/axiom-agent-quick-deploy-'+bytesDigest+'.yaml'}
export function templateBucketEffect(accountId:string,region:string,effectId='platform-template-bucket'){
 const parsed=platformEffectSchema.parse({id:effectId,kind:'template.bucket.create',target:{accountId,region:templateRegion(region),bucket:templateBucketName(accountId)}});
 if(parsed.kind!=='template.bucket.create')return fail();return parsed;
}
export function templateObjectEffect(accountId:string,region:string,bytesDigest:string,effectId='platform-template-object'){
 const parsed=platformEffectSchema.parse({id:effectId,kind:'template.object.put',target:{accountId,region:templateRegion(region),bucket:templateBucketName(accountId),key:templateObjectKey(bytesDigest),bytesDigest}});
 if(parsed.kind!=='template.object.put')return fail();return parsed;
}
export interface TemplateAccessInput{accountId:string;region:string;bytesDigest:string;objectVersion:string;recipientDigest:string;ttlSeconds:number;effectId?:string}
export function templateAccessEffect(input:TemplateAccessInput){
 if(input.objectVersion==='null')fail();
 const parsed=platformEffectSchema.parse({id:input.effectId??'platform-template-access',kind:'template.access.grant',target:{accountId:input.accountId,region:templateRegion(input.region),bucket:templateBucketName(input.accountId),key:templateObjectKey(input.bytesDigest),bytesDigest:input.bytesDigest,objectVersion:input.objectVersion,recipientDigest:input.recipientDigest,ttlSeconds:input.ttlSeconds}});
 if(parsed.kind!=='template.access.grant')return fail();return parsed;
}
