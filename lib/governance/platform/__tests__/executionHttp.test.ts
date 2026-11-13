import {it,expect,vi,beforeEach} from 'vitest';
const effects=vi.hoisted(()=>({post:vi.fn(),schedule:vi.fn(),remove:vi.fn()}));
vi.mock('@/lib/growth/linkedin/posting',()=>({publishDraft:effects.post}));vi.mock('@/lib/growth/linkedin/platformSchedule',()=>({schedulePlatformLinkedInDraft:effects.schedule}));vi.mock('@/lib/growth/linkedin/platformDeletion',()=>({deletePlatformLinkedInPost:effects.remove}));
import {createPlatformExecutionHttp} from '../executionHttp';
import {platformInspectionSchema} from '../viewContract';
const d='a'.repeat(64),id='platform_action_11111111-1111-4111-8111-111111111111';
function fixture(actor='requester'){
 let saved=platformInspectionSchema.parse({actionId:id,version:1,status:'approved',attemptCount:0,requesterUserId:'requester',reviewerUserId:'reviewer',plan:{format:1,scope:'platform',digest:d,sourceDigest:d,expiresAt:'2099-01-01T00:00:00Z',effects:[{id:'post',kind:'growth.post.publish',target:{draftId:'saved-draft',connectionId:'saved-account',connectionRevision:d,author:'urn:li:person:author',renderedPayloadDigest:d}}]},expired:false,effects:[{id:'post',status:'not_started'}],authority:'history_only',sourceValidation:'not_checked'});
 const service={actorUserId:actor,createGrowthExecutionBinding:vi.fn(()=>Object.freeze({})),inspect:vi.fn(async()=>saved),claim:vi.fn(async()=>{saved={...saved,status:'claimed',version:2,attemptCount:1}}),claimNextEffect:vi.fn(),beforeEffectSend:vi.fn(),observeEffect:vi.fn()};
 effects.post.mockImplementation(async()=>{saved={...saved,status:'confirmed',version:3,effects:[{id:'post',status:'confirmed'}]};return {kind:'success'}});
 return {service,handle:createPlatformExecutionHttp(async()=>service),saved:()=>saved};
}
const req=(extra={})=>new Request('https://example.test/execute',{method:'POST',body:JSON.stringify({operation:'execute',actionId:id,expectedVersion:1,planDigest:d,...extra})});
beforeEach(()=>{vi.resetAllMocks()});
it('executes only stored targets after the original requester claim; extra targets refuse',async()=>{
 const f=fixture();expect((await f.handle(req({connectionId:'substitute'}))).status).toBe(400);expect(f.service.claim).not.toHaveBeenCalled();
 const response=await f.handle(req());expect(response.status).toBe(200);expect(f.service.claim).toHaveBeenCalledExactlyOnceWith(id,1);expect(effects.post).toHaveBeenCalledWith(expect.objectContaining({draftId:'saved-draft',connectionId:'saved-account',effectId:'post'}));expect(f.saved().status).toBe('confirmed');
});
it('reviewer or mismatched plan cannot claim or reach an effect',async()=>{
 const reviewer=fixture('reviewer');expect((await reviewer.handle(req())).status).toBe(409);expect(reviewer.service.claim).not.toHaveBeenCalled();expect(effects.post).not.toHaveBeenCalled();
 const requester=fixture();expect((await requester.handle(req({planDigest:'b'.repeat(64)}))).status).toBe(409);expect(requester.service.claim).not.toHaveBeenCalled();
});
it('uncertain execution never repeats the claim or dispatch',async()=>{
 const f=fixture();effects.post.mockRejectedValueOnce(Error('raw provider detail'));const response=await f.handle(req());expect(response.status).toBe(409);expect(await response.text()).not.toContain('raw provider');expect((await f.handle(req())).status).toBe(409);expect(f.service.claim).toHaveBeenCalledTimes(1);expect(effects.post).toHaveBeenCalledTimes(1);
});
it('unsupported effect families and expired approvals refuse before a claim',async()=>{
 const unsupported=fixture();unsupported.saved().plan.effects=[{id:'post',kind:'settings.vercel',target:{projectId:'project',settingsDigest:d}}];expect((await unsupported.handle(req())).status).toBe(409);expect(unsupported.service.claim).not.toHaveBeenCalled();
 const expired=fixture();expired.saved().expired=true;expect((await expired.handle(req())).status).toBe(409);expect(expired.service.claim).not.toHaveBeenCalled();expect(effects.post).not.toHaveBeenCalled();expect(effects.schedule).not.toHaveBeenCalled();expect(effects.remove).not.toHaveBeenCalled();
});

it('a missing qualified private growth attachment refuses before the parent claim',async()=>{const f=fixture();f.service.createGrowthExecutionBinding.mockImplementationOnce(()=>{throw Error('unqualified')});expect((await f.handle(req())).status).toBe(409);expect(f.service.claim).not.toHaveBeenCalled();expect(effects.post).not.toHaveBeenCalled();expect(f.saved().status).toBe('approved')});
