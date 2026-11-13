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
it('actual execution client sends only the approved reference and never retries an unknown result',async()=>{
 const {createPlatformExecutionClient}=await import('../../../desktop/src/lib/platformReview'),approved=platformInspectionSchema.parse({...saved(),version:1,status:'approved',reviewerUserId:'reviewer'}),http=vi.fn(async()=>{throw Error('lost execution response')});vi.stubGlobal('fetch',http);
 const result=await createPlatformExecutionClient(context()).execute(approved);expect(result).toMatchObject({ok:false,outcomeUnconfirmed:true});expect(http).toHaveBeenCalledExactlyOnceWith('https://example.test/api/desktop/platform-governance/execute',expect.objectContaining({method:'POST',body:JSON.stringify({operation:'execute',actionId:approved.actionId,expectedVersion:1,planDigest:approved.plan.digest})}));
});
it('execution accepts only the exact confirmed history and blocks consumed or substituted inputs',async()=>{
 const {createPlatformExecutionClient}=await import('../../../desktop/src/lib/platformReview'),approved=platformInspectionSchema.parse({...saved(),status:'approved',version:1,reviewerUserId:'reviewer'}),confirmed={...approved,status:'confirmed',version:3,attemptCount:1,effects:[{id:'post',status:'confirmed'}]},http=vi.fn(async()=>Response.json({ok:true,data:confirmed}));vi.stubGlobal('fetch',http);const c=createPlatformExecutionClient(context());
 expect((await c.execute(approved)).ok).toBe(true);http.mockResolvedValueOnce(Response.json({ok:true,data:{...confirmed,plan:{...confirmed.plan,sourceDigest:'b'.repeat(64)}}}));expect(await c.execute(approved)).toMatchObject({ok:false,outcomeUnconfirmed:true});
 http.mockClear();expect((await c.execute(confirmed)).ok).toBe(false);expect(http).not.toHaveBeenCalled();expect('approve' in c).toBe(false);
 for(const body of [{operation:'execute',actionId:approved.actionId,expectedVersion:1,planDigest:digest,connectionId:'other'},{operation:'execute',actionId:approved.actionId,expectedVersion:2,planDigest:digest}])expect((await releaseOperationPlanRequest(context(),'POST','/api/desktop/platform-governance/execute',body,(_raw):_raw is never=>false)).ok).toBe(false);expect(http).not.toHaveBeenCalled();
});
it('actual proposal transport preserves the request reference and uses read-only lookup after uncertainty',async()=>{
 const {createPlatformPreparationClient}=await import('../../../desktop/src/lib/platformReview'),requestId='33333333-3333-4333-8333-333333333333',selection={operation:'publish',draftId:'draft',connectionId:'connection',expiresAt:'2099-01-01T00:00:00.000Z'},http=vi.fn(async(_url:RequestInfo|URL,_init?:RequestInit)=>{throw Error('lost save response')});vi.stubGlobal('fetch',http);const c=createPlatformPreparationClient(context());
 expect(await c.prepare(selection,requestId)).toMatchObject({ok:false,outcomeUnconfirmed:true});expect(http).toHaveBeenCalledTimes(1);expect(await c.lookup(requestId)).toMatchObject({ok:false,outcomeUnconfirmed:false});expect(http).toHaveBeenCalledTimes(2);const sent=http.mock.calls[1]?.[1]?.body;if(typeof sent!=='string')throw Error('synthetic_request_required');expect(JSON.parse(sent)).toEqual({operation:'lookup_preparation',requestId});
});
it('proposal receipts and lookup results stay metadata-only and match the exact request UUID',async()=>{
 const {createPlatformPreparationClient}=await import('../../../desktop/src/lib/platformReview'),requestId='44444444-4444-4444-8444-444444444444',selection={operation:'publish',draftId:'draft',connectionId:'connection',expiresAt:'2099-01-01T00:00:00.000Z'},data={requestId,actionId:saved().actionId,historical:false,authority:'proposal_reference_only'},http=vi.fn(async()=>Response.json({ok:true,data}));vi.stubGlobal('fetch',http);const c=createPlatformPreparationClient(context());
 expect((await c.prepare({...selection,sourceDigest:digest},requestId)).ok).toBe(false);expect(http).not.toHaveBeenCalled();expect(await c.prepare(selection,requestId)).toMatchObject({ok:true,data});
 http.mockResolvedValueOnce(Response.json({ok:true,data:{requestId,found:false,authority:'history_only'}}));expect(await c.lookup(requestId)).toMatchObject({ok:true,data:{found:false,authority:'history_only'}});expect(http).toHaveBeenCalledTimes(2);
 http.mockResolvedValueOnce(Response.json({ok:true,data:{...data,requestId:'55555555-5555-4555-8555-555555555555'}}));expect(await c.prepare(selection,requestId)).toMatchObject({ok:false,outcomeUnconfirmed:true});expect('execute' in c).toBe(false);expect('approve' in c).toBe(false);
});
it('history uses the actual fixed read-only transport and never retries a lost read',async()=>{
 const {createPlatformHistoryClient}=await import('../../../desktop/src/lib/platformReview');
 const page={entries:[],nextCursor:null,authority:'history_only',sourceValidation:'not_checked'},http=vi.fn(async()=>Response.json({ok:true,data:page}));vi.stubGlobal('fetch',http);
 expect((await createPlatformHistoryClient(context()).list(null)).ok).toBe(true);
 expect(http).toHaveBeenCalledExactlyOnceWith('https://example.test/api/desktop/platform-governance/history',expect.objectContaining({method:'POST',body:JSON.stringify({operation:'list_history',cursor:null}),credentials:'omit',redirect:'error'}));
 http.mockImplementationOnce(async()=>{throw Error('lost read')});expect(await createPlatformHistoryClient(context()).list(null)).toMatchObject({ok:false,outcomeUnconfirmed:false});expect(http).toHaveBeenCalledTimes(2);
 http.mockClear();expect((await releaseOperationPlanRequest(context(),'POST','/api/desktop/platform-governance/history',{operation:'list_history',cursor:null,claim:true},(_raw):_raw is never=>false)).ok).toBe(false);expect(http).not.toHaveBeenCalled();
});
