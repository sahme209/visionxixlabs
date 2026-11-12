import {z} from 'zod';
import {sha256ContentHash} from '@/lib/tauri/contentHash';
import {platformEffectSchema} from '@/lib/governance/platform/contracts';
export interface PostingDraft{id:string;title:string;hook:string;body:string;cta:string|null;hashtags:string[];imageUrn:string|null;status:string;scheduledFor:Date|null;updatedAt:Date}
export interface PostingConnection{id:string;linkedinUrn:string;organizationUrn:string|null;scopes:string;status:string;expiresAt:Date;updatedAt:Date}
export const postingDraftSchema=z.object({id:z.string().min(1).max(256),title:z.string().max(512),hook:z.string().max(64000),body:z.string().max(64000),cta:z.string().max(64000).nullable(),hashtags:z.array(z.string().max(100)).max(100),imageUrn:z.string().max(512).nullable(),status:z.string(),scheduledFor:z.date().nullable(),updatedAt:z.date()}).strict();
export const postingConnectionSchema=z.object({id:z.string().min(1).max(256),linkedinUrn:z.string().max(256),organizationUrn:z.string().max(256).nullable(),scopes:z.string().max(4096),status:z.string(),expiresAt:z.date(),updatedAt:z.date()}).strict();
const fail=():never=>{throw Error('platform_posting_source_unavailable')};
function date(value:Date){if(!(value instanceof Date)||!Number.isSafeInteger(value.getTime())||value.getTime()<0)fail();return value.toISOString()}
export function renderPostText(draft:Pick<PostingDraft,'hook'|'body'|'cta'|'hashtags'>){
 const parts:string[]=[];if(draft.hook)parts.push(draft.hook);if(draft.body)parts.push(draft.body);if(draft.cta)parts.push(draft.cta);
 if(!Array.isArray(draft.hashtags)||draft.hashtags.some(t=>typeof t!=='string'))fail();
 if(draft.hashtags.length)parts.push(draft.hashtags.map(t=>t.startsWith('#')?t:'#'+t).join(' '));return parts.join('\n\n').trim();
}
export function linkedInConnectionRevision(connection:PostingConnection){
 return sha256ContentHash({kind:'platform_linkedin_connection_v1',id:connection.id,linkedinUrn:connection.linkedinUrn,organizationUrn:connection.organizationUrn,scopes:connection.scopes,status:connection.status,expiresAt:date(connection.expiresAt),updatedAt:date(connection.updatedAt)});
}
export function currentLinkedInVersion(){return process.env.LINKEDIN_REST_VERSION||'202605'}
/** Pure snapshot; hashes never include stored/decrypted credentials. This is
 * exact payload binding, not platform authorization or provider acceptance. */
export function preparePlatformLinkedInPost(draft:PostingDraft,connection:PostingConnection,version:string,now:number,effectId='platform-linkedin-post'){
 draft=postingDraftSchema.parse(draft);connection=postingConnectionSchema.parse(connection);
 if(!Number.isSafeInteger(now)||!/^\d{6}$/.test(version)||connection.status!=='connected'||connection.expiresAt.getTime()<=now||!['approved','scheduled'].includes(draft.status))fail();
 const author=connection.organizationUrn||connection.linkedinUrn,scopes=connection.scopes.split(/[\s,]+/);
 if(!/^urn:li:(person|organization):[A-Za-z0-9_-]+$/.test(author)||!scopes.includes(connection.organizationUrn?'w_organization_social':'w_member_social'))fail();
 const payload={author,commentary:renderPostText(draft),visibility:'PUBLIC',distribution:{feedDistribution:'MAIN_FEED',targetEntities:[],thirdPartyDistributionChannels:[]},lifecycleState:'PUBLISHED',isReshareDisabledByAuthor:false,...(draft.imageUrn?{content:{media:{id:draft.imageUrn,altText:draft.title.slice(0,200)}}}:{})};
 const body=JSON.stringify(payload);if(!payload.commentary||Buffer.byteLength(body)>64*1024)fail();
 const renderedPayloadDigest=sha256ContentHash({endpoint:'https://api.linkedin.com/rest/posts',version,body,draftRevision:date(draft.updatedAt),draftStatus:draft.status,scheduledFor:draft.scheduledFor?date(draft.scheduledFor):null});
 const effect=platformEffectSchema.parse({id:effectId,kind:'growth.post.publish',target:{connectionId:connection.id,connectionRevision:linkedInConnectionRevision(connection),author,draftId:draft.id,renderedPayloadDigest}});
 if(effect.kind!=='growth.post.publish')return fail();return Object.freeze({effect,body,version});
}
