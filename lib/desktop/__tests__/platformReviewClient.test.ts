import {it,expect,vi,beforeEach} from 'vitest';
const m=vi.hoisted(()=>({request:vi.fn()}));vi.mock('../../../desktop/src/lib/releaseOperationPlanTransport',()=>({releaseOperationPlanRequest:m.request}));
import {createPlatformReviewClient} from '../../../desktop/src/lib/platformReview';
import {platformInspectionSchema} from '../../governance/platform/viewContract';
const digest='a'.repeat(64),action=()=>platformInspectionSchema.parse({actionId:'platform_action_11111111-1111-4111-8111-111111111111',version:0,status:'proposed',attemptCount:0,requesterUserId:'requester',reviewerUserId:null,plan:{format:1,scope:'platform',digest,sourceDigest:digest,expiresAt:'2099-01-01T00:00:00Z',effects:[{id:'one',kind:'settings.vercel',target:{projectId:'project',settingsDigest:digest}}]},expired:false,effects:[{id:'one',status:'not_started'}],authority:'history_only',sourceValidation:'not_checked'});
const client=()=>createPlatformReviewClient({getConfig:()=>({apiBase:'https://example.test',sessionToken:'synthetic'}),getRevision:()=>0,subscribe:()=>()=>{}});
beforeEach(()=>{m.request.mockReset()});
it('refuses invalid, expired or consumed actions without transport',async()=>{
 const c=client();for(const raw of [{}, {...action(),expired:true},{...action(),status:'claimed',attemptCount:1,version:2,reviewerUserId:'reviewer'}])expect((await c.approve(raw)).ok).toBe(false);expect(m.request).not.toHaveBeenCalled();
});
it('binds approval reply to this exact action, plan and version rather than any approved result',async()=>{
 const saved=action(),approved={...saved,status:'approved',version:1,reviewerUserId:'reviewer'};
 m.request.mockImplementation(async(_context,_method,_path,body,validate)=>{
  expect(body).toEqual({operation:'approve',actionId:saved.actionId,expectedVersion:0,planDigest:digest});expect(validate(approved)).toBe(true);
  for(const different of [{...approved,actionId:'platform_action_22222222-2222-4222-8222-222222222222'},{...approved,plan:{...approved.plan,sourceDigest:'b'.repeat(64)}},{...approved,version:0}])expect(validate(different)).toBe(false);
  return {ok:true,data:approved};
 });expect((await client().approve(saved)).ok).toBe(true);expect(m.request).toHaveBeenCalledTimes(1);
});
it('inspect rejects another saved action and accepts no execution-authority label',async()=>{
 const saved=action();m.request.mockImplementation(async(_context,_method,_path,_body,validate)=>{expect(validate(saved)).toBe(true);expect(validate({...saved,authority:'execution_approved'})).toBe(false);expect(validate({...saved,actionId:'platform_action_22222222-2222-4222-8222-222222222222'})).toBe(false);return {ok:true,data:saved}});
 expect((await client().inspect(saved.actionId)).ok).toBe(true);
});
it('source preview must match exact saved plan, effect, source and author',async()=>{
 const saved=platformInspectionSchema.parse({...action(),plan:{...action().plan,effects:[{id:'post',kind:'growth.post.publish',target:{draftId:'draft',connectionId:'connection',connectionRevision:digest,author:'urn:li:person:author',renderedPayloadDigest:digest}}]},effects:[{id:'post',status:'not_started'}]});
 const preview={actionId:saved.actionId,planDigest:digest,sourceDigest:digest,effectId:'post',renderedPost:JSON.stringify({author:'urn:li:person:author',commentary:'Exact text',visibility:'PUBLIC'}),authority:'review_preview_only'};
 m.request.mockImplementation(async(_context,_method,_path,body,validate)=>{expect(body).toEqual({operation:'preview',actionId:saved.actionId});expect(validate(preview)).toBe(true);
  for(const wrong of [{...preview,sourceDigest:'b'.repeat(64)},{...preview,effectId:'other'},{...preview,renderedPost:JSON.stringify({author:'urn:li:person:other',commentary:'Other author',visibility:'PUBLIC'})},{...preview,renderedPost:undefined}])expect(validate(wrong)).toBe(false);return {ok:true,data:preview};
 });expect((await client().preview(saved)).ok).toBe(true);
});
