import {z} from 'zod';
import {sha256ContentHash} from '@/lib/tauri/contentHash';
import {platformEffectSchema} from '@/lib/governance/platform/contracts';
import {readPlatformAction} from '@/lib/governance/platform/kernel';
import {postingConnectionSchema,linkedInConnectionRevision} from './platformPostingPlan';
const sourceSchema=z.object({
 draft:z.object({id:z.string().min(1).max(256),status:z.literal('published'),linkedinPostUrn:z.string().regex(/^urn:li:(share|ugcPost):[A-Za-z0-9_-]+$/),updatedAt:z.date()}).strict(),
 connection:postingConnectionSchema,
 publication:z.object({actionId:z.string().regex(/^platform_action_[a-f0-9-]{36}$/),state:z.unknown(),outcome:z.literal('success'),postUrn:z.string()}).strict(),
}).strict();
const fail=():never=>{throw Error('platform_deletion_source_unavailable')};
/** Only known successful managed publications are a deletion source. This
 * does not reconcile unknown/historical posts or prove live provider ownership. */
export function preparePlatformLinkedInDeletion(raw:unknown,version:string,now:number,effectId='platform-linkedin-delete'){
 const source=sourceSchema.parse(raw),{draft,connection,publication}=source;
 if(!Number.isSafeInteger(now)||!/^\d{6}$/.test(version)||connection.status!=='connected'||connection.expiresAt.getTime()<=now||publication.postUrn!==draft.linkedinPostUrn)fail();
 const author=connection.organizationUrn||connection.linkedinUrn;
 if(!/^urn:li:(person|organization):[A-Za-z0-9_-]+$/.test(author)||!connection.scopes.split(/[\s,]+/).includes(connection.organizationUrn?'w_organization_social':'w_member_social'))fail();
 const original=readPlatformAction(publication.state);
 if(original.status!=='confirmed'||original.attemptCount!==1)fail();
 const matching=original.plan.effects.filter(effect=>effect.kind==='growth.post.publish'&&effect.target.draftId===draft.id&&effect.target.connectionId===connection.id&&effect.target.author===author);
 if(matching.length!==1)fail();
 const effect=platformEffectSchema.parse({id:effectId,kind:'growth.post.delete',target:{connectionId:connection.id,connectionRevision:linkedInConnectionRevision(connection),author,draftId:draft.id,postUrn:draft.linkedinPostUrn,draftRevision:draft.updatedAt.toISOString(),publicationActionId:publication.actionId,publicationPlanDigest:original.plan.digest,apiVersion:version}});
 if(effect.kind!=='growth.post.delete')return fail();
 return Object.freeze({effect,url:'https://api.linkedin.com/rest/posts/'+encodeURIComponent(draft.linkedinPostUrn),connectionUpdatedAt:connection.updatedAt.getTime(),sourceDigest:sha256ContentHash(effect.target)});
}
