import {it,expect,vi,afterEach} from 'vitest';
import {createPlatformReviewClient} from '../../../desktop/src/lib/platformReview';
import {releaseOperationPlanRequest} from '../../../desktop/src/lib/releaseOperationPlanTransport';
import {platformInspectionSchema} from '../../governance/platform/viewContract';
const digest='a'.repeat(64),saved=()=>platformInspectionSchema.parse({actionId:'platform_action_11111111-1111-4111-8111-111111111111',version:0,status:'proposed',attemptCount:0,requesterUserId:'requester',reviewerUserId:null,plan:{format:1,scope:'platform',digest,sourceDigest:digest,expiresAt:'2099-01-01T00:00:00Z',effects:[{id:'post',kind:'growth.post.publish',target:{draftId:'draft',connectionId:'connection',connectionRevision:digest,author:'urn:li:person:author',renderedPayloadDigest:digest}}]},expired:false,effects:[{id:'post',status:'not_started'}],authority:'history_only',sourceValidation:'not_checked'});
function context(){const config={apiBase:'https://example.test',sessionToken:'axm.desk.synthetic'};return {getConfig:()=>config,getRevision:()=>0,subscribe:()=>()=>{}}}
afterEach(()=>vi.unstubAllGlobals());
it('actual shared transport carries only the exact paired inspect/preview/review path',async()=>{
 const record=saved(),http=vi.fn(async()=>Response.json({ok:true,data:record}));vi.stubGlobal('fetch',http);expect((await createPlatformReviewClient(context()).inspect(record.actionId)).ok).toBe(true);expect(http).toHaveBeenCalledExactlyOnceWith('https://example.test/api/desktop/platform-governance/review',expect.objectContaining({method:'POST',credentials:'omit',redirect:'error'}));
});
it('lost reads are not labeled uncertain writes; unconfirmed approval is held without retry',async()=>{
 const http=vi.fn(async()=>{throw Error('lost response')});vi.stubGlobal('fetch',http);const c=createPlatformReviewClient(context()),record=saved();expect(await c.inspect(record.actionId)).toMatchObject({ok:false,outcomeUnconfirmed:false});expect(await c.preview(record)).toMatchObject({ok:false,outcomeUnconfirmed:false});expect(await c.approve(record)).toMatchObject({ok:false,outcomeUnconfirmed:true});expect(http).toHaveBeenCalledTimes(3);
 http.mockClear();for(const body of [{operation:'claim',actionId:record.actionId},{operation:'approve',actionId:record.actionId,expectedVersion:0,planDigest:digest,actor:'invented'}])expect((await releaseOperationPlanRequest(context(),'POST','/api/desktop/platform-governance/review',body,(_raw):_raw is never=>false)).ok).toBe(false);expect(http).not.toHaveBeenCalled();
});

it('a server-reported uncertain approval stays uncertain even with a conflict status',async()=>{
 const http=vi.fn(async()=>Response.json({ok:false,error:'platform_decision_outcome_unconfirmed'},{status:409}));vi.stubGlobal('fetch',http);expect(await createPlatformReviewClient(context()).approve(saved())).toMatchObject({ok:false,outcomeUnconfirmed:true});expect(http).toHaveBeenCalledTimes(1);
});
