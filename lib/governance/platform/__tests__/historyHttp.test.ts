import {it,expect,vi} from 'vitest';
import {createPlatformHistoryHttp} from '../historyHttp';
const page={entries:[],nextCursor:null,authority:'history_only' as const,sourceValidation:'not_checked' as const};
const request=(body:unknown)=>new Request('https://axiom.example.test/history',{method:'POST',body:JSON.stringify(body)});
it('uses current authenticated service and accepts read-only pagination only',async()=>{
 const history=vi.fn(async()=>page),factory=vi.fn(async()=>({history})),handle=createPlatformHistoryHttp(factory);
 const response=await handle(request({operation:'list_history',cursor:null}));
 expect(response.status).toBe(200);expect(response.headers.get('cache-control')).toContain('no-store');expect(await response.json()).toEqual({ok:true,data:page});expect(history).toHaveBeenCalledExactlyOnceWith(null);
 for(const body of [{operation:'execute',cursor:null},{operation:'list_history',cursor:null,actor:'other'},{operation:'list_history',cursor:null,limit:1000}])expect((await handle(request(body))).status).toBe(400);
 expect(history).toHaveBeenCalledTimes(1);
 factory.mockRejectedValueOnce(Error('private-secret'));const denied=await handle(request({operation:'list_history',cursor:null}));expect(denied.status).toBe(401);expect(await denied.text()).not.toContain('private-secret');
});
it('refuses malformed or unavailable history without claiming success or retrying',async()=>{
 const history=vi.fn(async()=>page),handle=createPlatformHistoryHttp(async()=>({history}));
 history.mockRejectedValueOnce(Error('private database detail'));let response=await handle(request({operation:'list_history',cursor:null}));expect(response.status).toBe(409);expect(await response.text()).not.toContain('private database');expect(history).toHaveBeenCalledTimes(1);
 history.mockResolvedValueOnce({...page,authority:'execute'} as unknown as typeof page);response=await handle(request({operation:'list_history',cursor:null}));expect(response.status).toBe(409);
});
