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
