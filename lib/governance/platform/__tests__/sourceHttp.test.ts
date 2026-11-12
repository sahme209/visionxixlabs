import {afterEach,it,expect,vi} from 'vitest';
import {createPlatformSourceHttp} from '../sourceHttp';
import {createPlatformSourceClient} from '../../../../desktop/src/lib/platformReview';
import {releaseOperationPlanRequest} from '../../../../desktop/src/lib/releaseOperationPlanTransport';
const page={kind:'drafts' as const,entries:[],nextCursor:null,authority:'selection_metadata_only' as const};
afterEach(()=>vi.unstubAllGlobals());
it('joins the real fixed read-only client/HTTP command without creating any plan',async()=>{
 const sources=vi.fn(async()=>page),handle=createPlatformSourceHttp(async()=>({sources})),http=vi.fn(async(input:RequestInfo|URL,init?:RequestInit)=>handle(new Request(String(input),init)));vi.stubGlobal('fetch',http);
 const config={apiBase:'https://fixture.example.test',sessionToken:'axm.desk.synthetic'},context={getConfig:()=>config,getRevision:()=>0,subscribe:()=>()=>{}};
 expect(await createPlatformSourceClient(context).list('drafts',null)).toEqual({ok:true,data:page});expect(sources).toHaveBeenCalledExactlyOnceWith('drafts',null);expect(http).toHaveBeenCalledExactlyOnceWith('https://fixture.example.test/api/desktop/platform-governance/sources',expect.objectContaining({method:'POST',credentials:'omit',redirect:'error'}));
 http.mockClear();expect((await releaseOperationPlanRequest(context,'POST','/api/desktop/platform-governance/sources',{operation:'list_sources',kind:'drafts',cursor:null,actor:'invented'},(_raw):_raw is never=>false)).ok).toBe(false);expect(http).not.toHaveBeenCalled();
});
it('rejects unauthenticated, mutation and unbounded commands, and never returns raw errors',async()=>{
 const sources=vi.fn(async()=>page),factory=vi.fn(async()=>({sources})),handle=createPlatformSourceHttp(factory),request=(body:unknown)=>new Request('https://fixture.test/sources',{method:'POST',body:JSON.stringify(body)});
 factory.mockRejectedValueOnce(Error('private auth detail'));const denied=await handle(request({operation:'list_sources',kind:'drafts',cursor:null}));expect(denied.status).toBe(401);expect(await denied.text()).not.toContain('private auth');
 for(const body of [{operation:'save',kind:'drafts',cursor:null},{operation:'list_sources',kind:'drafts',cursor:null,limit:1000}])expect((await handle(request(body))).status).toBe(400);expect(sources).not.toHaveBeenCalled();
 sources.mockRejectedValueOnce(Error('private database detail'));const unavailable=await handle(request({operation:'list_sources',kind:'drafts',cursor:null}));expect(unavailable.status).toBe(409);expect(await unavailable.text()).not.toContain('private database');
});
it('lost catalog reads stay read-only and explain the missing source metadata',async()=>{
 const config={apiBase:'https://fixture.example.test',sessionToken:'axm.desk.synthetic'},context={getConfig:()=>config,getRevision:()=>0,subscribe:()=>()=>{}};const http=vi.fn(async()=>{throw Error('lost')});vi.stubGlobal('fetch',http);
 expect(await createPlatformSourceClient(context).list('accounts',null)).toMatchObject({ok:false,outcomeUnconfirmed:false,error:'Source metadata could not be verified. No proposal or action was submitted.'});expect(http).toHaveBeenCalledTimes(1);
});
