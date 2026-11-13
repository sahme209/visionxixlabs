import 'server-only';
import {z} from 'zod';
import {generateSiteFiles} from '@/lib/scaffoldGenerator';
import {sha256ContentHash} from '@/lib/tauri/contentHash';
import {compilePlatformPlan} from '@/lib/governance/platform/kernel';
import {platformDeploymentSelection} from '@/lib/governance/platform/deploymentContract';
import {platformSourceId} from '@/lib/governance/platform/sourceCatalog';
import {preparePlatformVercelDeployment} from './platformDeployment';
const text=z.string().max(32768),nonempty=text.min(1);
const packageSchema=z.object({companyName:nonempty,tagline:nonempty,aboutText:nonempty,services:z.array(text).max(20),faqItems:z.array(z.object({q:text,a:text}).strict()).max(20).optional(),contactEmail:nonempty,contactPhone:text.optional(),metaTitle:text.optional(),metaDescription:text.optional(),brandTone:text.optional(),homepageHero:text.optional(),aboutDraft:text.optional(),servicesDraft:text.optional(),contactContent:text.optional()}).strict();
const sourceSchema=z.object({id:platformSourceId,updatedAt:z.date(),aiPackage:packageSchema}).strict();
const fail=():never=>{throw Error('platform_deployment_source_unavailable')};
/** Reads only a supplied existing server record. No AI generation, caller files,
 * credential, provider request or assertion of native artifact qualification. */
export function preparePlatformLeadDeploymentSource(raw:unknown,input:unknown,teamId:string,now:number,effectId='platform-lead-deployment'){
 const source=sourceSchema.parse(raw),selection=platformDeploymentSelection.omit({expiresAt:true}).parse(input);
 if(!Number.isSafeInteger(now)||now<0||source.id!==selection.leadId||source.updatedAt.getTime()>now)fail();
 const files=generateSiteFiles(source.aiPackage).map(file=>Object.freeze({...file}));
 // Full escaped file text can be reviewed without running HTML. Larger sources
 // remain unavailable in this bounded review profile, never hash-only approved.
 if(Buffer.byteLength(JSON.stringify(files))>128*1024)fail();
 const prepared=preparePlatformVercelDeployment(files,{projectName:selection.projectName,teamId,...(selection.environment==='production'?{target:'production' as const}:{}),effectId,source:{leadId:source.id,leadRevision:source.updatedAt.toISOString()}});
 const sourceDigest=sha256ContentHash({kind:'platform_lead_deployment_source_v1',leadId:source.id,leadRevision:source.updatedAt.toISOString(),effect:prepared.effect});
 return Object.freeze({sourceDigest,effect:prepared.effect,files:Object.freeze(files),package:source.aiPackage});
}

export function preparePlatformLeadDeployment(raw:unknown,input:unknown,teamId:string,now:number,effectId?:string){
 const {expiresAt,...selected}=platformDeploymentSelection.parse(input);if(Date.parse(expiresAt)<=now)fail();
 const source=preparePlatformLeadDeploymentSource(raw,selected,teamId,now,effectId),plan=compilePlatformPlan({format:1,scope:'platform',sourceDigest:source.sourceDigest,expiresAt,effects:[source.effect]});
 return Object.freeze({...source,plan});
}
