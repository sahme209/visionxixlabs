import {it,expect} from 'vitest';
import {preparePlatformLinkedInPost,linkedInConnectionRevision} from '../platformPostingPlan';
const now=Date.parse('2026-11-12T00:00:00Z');
const draft=()=>({id:'draft',title:'Title',hook:'Hook',body:'Body',cta:'Reply',hashtags:['governance'],imageUrn:null,status:'approved',scheduledFor:null,updatedAt:new Date(now-1000)});
const connection=()=>({id:'connection',linkedinUrn:'urn:li:person:abc',organizationUrn:null,scopes:'openid,w_member_social',status:'connected',expiresAt:new Date(now+60000),updatedAt:new Date(now-1000)});
it('binds exact selected connection, author, rendered bytes, draft revision and API version',()=>{
 const c=connection(),d=draft(),p=preparePlatformLinkedInPost(d,c,'202605',now);expect(p.effect.target).toMatchObject({connectionId:c.id,connectionRevision:linkedInConnectionRevision(c),author:c.linkedinUrn,draftId:d.id});
 expect(JSON.parse(p.body)).toMatchObject({author:c.linkedinUrn,commentary:'Hook\n\nBody\n\nReply\n\n#governance',visibility:'PUBLIC'});
 for(const change of [{...d,body:'different'},{...d,updatedAt:new Date(now)}])expect(preparePlatformLinkedInPost(change,c,'202605',now).effect.target.renderedPayloadDigest).not.toBe(p.effect.target.renderedPayloadDigest);
 expect(preparePlatformLinkedInPost(d,c,'202606',now).effect.target.renderedPayloadDigest).not.toBe(p.effect.target.renderedPayloadDigest);
});
it('identity/revision changes cannot redirect the original approval',()=>{
 const d=draft(),c=connection(),p=preparePlatformLinkedInPost(d,c,'202605',now);
 for(const change of [{...c,id:'other'},{...c,linkedinUrn:'urn:li:person:other'},{...c,updatedAt:new Date(now)}])expect(preparePlatformLinkedInPost(d,change,'202605',now).effect).not.toEqual(p.effect);
});
it('rejects expired/revoked/unreadable connection, unapproved draft or missing posting scope',()=>{
 for(const c of [{...connection(),expiresAt:new Date(now)},{...connection(),status:'revoked'},{...connection(),scopes:'openid'},{...connection(),updatedAt:new Date(NaN)}])expect(()=>preparePlatformLinkedInPost(draft(),c,'202605',now)).toThrow();
 for(const status of ['drafted','rejected','published','failed'])expect(()=>preparePlatformLinkedInPost({...draft(),status},connection(),'202605',now)).toThrow();
});
it('company posting requires its own granted scope and captured author',()=>{
 const c={...connection(),organizationUrn:'urn:li:organization:123'};expect(()=>preparePlatformLinkedInPost(draft(),c,'202605',now)).toThrow();
 expect(preparePlatformLinkedInPost(draft(),{...c,scopes:'w_organization_social'},'202605',now).effect.target.author).toBe(c.organizationUrn);
});

it('refuses an arbitrary stored image URN without a confirmed compatible managed-upload lineage',()=>{
 expect(()=>preparePlatformLinkedInPost({...draft(),imageUrn:'urn:li:image:unverified'},connection(),'202605',now)).toThrow('platform_posting_source_unavailable');
});
it('binds a separately confirmed compatible upload lineage into the reviewed post and refuses substituted provenance',async()=>{
 const {compileImagePublicationLineage}=await import('@/lib/governance/platform/imagePublicationLineage'),c=connection(),d=draft(),digest='a'.repeat(64);
 const lineage=compileImagePublicationLineage({format:1,purpose:'platform_image_publication_lineage_v1',uploadActionId:'platform_action_11111111-1111-4111-8111-111111111111',uploadPlanDigest:digest,bindingDigest:digest,artifactId:'platform_image_artifact_11111111-1111-4111-8111-111111111111',bytesDigest:digest,connectionId:c.id,connectionRevision:linkedInConnectionRevision(c),author:c.linkedinUrn,providerImageReference:'urn:li:image:managed',grantReference:'platform_image_grant_'+digest,putReceiptDigest:digest});
 const imageDraft={...d,imageUrn:'urn:li:image:managed'},post=preparePlatformLinkedInPost(imageDraft,c,'202605',now,undefined,lineage);expect(post.effect.target.imageLineageDigest).toBe(lineage.lineageDigest);expect(JSON.parse(post.body).content.media.id).toBe('urn:li:image:managed');
 const {lineageDigest:originalDigest,...lineageBody}=lineage;expect(originalDigest).toMatch(/^[a-f0-9]{64}$/);for(const wrong of [{...lineage,lineageDigest:'b'.repeat(64)},compileImagePublicationLineage({...lineageBody,author:'urn:li:person:other'})])expect(()=>preparePlatformLinkedInPost(imageDraft,c,'202605',now,undefined,wrong)).toThrow();
 expect(()=>preparePlatformLinkedInPost(d,c,'202605',now,undefined,lineage)).toThrow();
});
it('selects a confirmed upload in a NEW post without rewriting draft media or accepting conflicting/provenance swaps',async()=>{
 const {compileImagePublicationLineage}=await import('@/lib/governance/platform/imagePublicationLineage'),c=connection(),original=draft(),d='a'.repeat(64),selected='platform_action_11111111-1111-4111-8111-111111111111';
 const lineage=compileImagePublicationLineage({format:1,purpose:'platform_image_publication_lineage_v1',uploadActionId:selected,uploadPlanDigest:d,bindingDigest:d,artifactId:'platform_image_artifact_11111111-1111-4111-8111-111111111111',bytesDigest:d,connectionId:c.id,connectionRevision:linkedInConnectionRevision(c),author:c.linkedinUrn,providerImageReference:'urn:li:image:managed',grantReference:'platform_image_grant_'+d,putReceiptDigest:d});
 const post=preparePlatformLinkedInPost(original,c,'202605',now,undefined,lineage,selected);
 expect(JSON.parse(post.body).content.media.id).toBe('urn:li:image:managed');expect(original.imageUrn).toBeNull();expect(post.effect.target).toMatchObject({imageUploadActionId:selected,imageLineageDigest:lineage.lineageDigest});
 expect(()=>preparePlatformLinkedInPost(original,c,'202605',now,undefined,lineage,'platform_action_22222222-2222-4222-8222-222222222222')).toThrow();
 expect(()=>preparePlatformLinkedInPost({...original,imageUrn:'urn:li:image:other'},c,'202605',now,undefined,lineage,selected)).toThrow();
 expect(preparePlatformLinkedInPost({...original,imageUrn:'urn:li:image:managed'},c,'202605',now,undefined,lineage,selected).effect.target.renderedPayloadDigest).not.toBe(post.effect.target.renderedPayloadDigest);
});
