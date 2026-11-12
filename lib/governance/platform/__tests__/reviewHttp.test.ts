import {it,expect,vi} from 'vitest';
import {createPlatformReviewHttp} from '../reviewHttp';
import {compilePlatformPlan} from '../kernel';
const actionId='platform_action_11111111-1111-4111-8111-111111111111',digest='a'.repeat(64);
function fixture(){const inspect=vi.fn(async()=>({actionId,version:0,status:'proposed' as const,attemptCount:0,requesterUserId:'requester',reviewerUserId:null,plan:compilePlatformPlan({format:1,scope:'platform',sourceDigest:digest,expiresAt:'2026-11-13T00:00:00.000Z',effects:[{id:'one',kind:'settings.vercel',target:{projectId:'project',settingsDigest:digest}}]}),expired:false,effects:[{id:'one',status:'not_started'}],authority:'history_only' as const,sourceValidation:'not_checked' as const})),review=vi.fn(async()=>{});const factory=vi.fn(async()=>({inspect,review}));return {inspect,review,factory,handle:createPlatformReviewHttp(factory)}}
const request=(body:unknown)=>new Request('https://axiom.example.test/review',{method:'POST',headers:{authorization:'Bearer synthetic','content-type':'application/json'},body:JSON.stringify(body)});
it('inspects the saved action without claiming, proposing or accepting caller outcomes',async()=>{
 const f=fixture(),response=await f.handle(request({operation:'inspect',actionId}));expect(response.status).toBe(200);expect(response.headers.get('cache-control')).toContain('no-store');expect(f.inspect).toHaveBeenCalledWith(actionId);expect(f.review).not.toHaveBeenCalled();
 for(const body of [{operation:'claim',actionId},{operation:'observe',actionId,outcome:'confirmed'},{operation:'approve',actionId,expectedVersion:0,planDigest:digest,actor:'other'}])expect((await f.handle(request(body))).status).toBe(400);
 expect(f.review).not.toHaveBeenCalled();
});
it('authenticates before reading a decision and rejects excessive input',async()=>{
 const f=fixture();f.factory.mockRejectedValueOnce(Error('private raw authentication detail'));const denied=await f.handle(request({operation:'approve',actionId,expectedVersion:0,planDigest:digest}));expect(denied.status).toBe(401);expect(await denied.text()).not.toContain('private raw');expect(f.review).not.toHaveBeenCalled();
 expect((await f.handle(request({operation:'inspect',actionId,padding:'x'.repeat(5000)}))).status).toBe(400);expect(f.inspect).not.toHaveBeenCalled();
});
it('records exactly one exact decision then loads that same saved action',async()=>{
 const f=fixture(),response=await f.handle(request({operation:'approve',actionId,expectedVersion:0,planDigest:digest}));expect(response.status).toBe(200);expect(f.review).toHaveBeenCalledExactlyOnceWith(actionId,0,digest);expect(f.inspect).toHaveBeenCalledExactlyOnceWith(actionId);
});
it('uncertain decision recording never retries or invents an approved response',async()=>{
 const f=fixture();f.review.mockRejectedValueOnce(Error('possible commit, secret raw details'));const response=await f.handle(request({operation:'approve',actionId,expectedVersion:0,planDigest:digest}));expect(response.status).toBe(409);expect(await response.json()).toEqual({ok:false,error:'platform_decision_outcome_unconfirmed',recovery:'inspect_same_action_no_automatic_retry'});expect(f.review).toHaveBeenCalledTimes(1);expect(f.inspect).not.toHaveBeenCalled();
});
