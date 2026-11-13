import {it,expect} from 'vitest';
import {projectPlatformHistory} from '../historyProjection';
import {createPlatformAction,compilePlatformPlan} from '../kernel';
const at=Date.parse('2026-11-12T00:00:00Z'),d='a'.repeat(64);
const state=createPlatformAction(compilePlatformPlan({format:1,scope:'platform',sourceDigest:d,expiresAt:'2026-11-13T00:00:00Z',effects:[{id:'one',kind:'settings.vercel',target:{projectId:'project',settingsDigest:d}}]}),{userId:'requester',sessionId:'private-session'},at);
const row=(i:number)=>({id:`platform_action_11111111-1111-4111-8111-${String(i).padStart(12,'0')}`,createdAt:new Date(at+i),stateJson:state,planDigest:state.plan.digest,version:0});
it('returns 20 bounded historical entries and a cursor, without session or state',()=>{
 const page=projectPlatformHistory(Array.from({length:21},(_,i)=>row(21-i)),null);
 expect(page.entries).toHaveLength(20);expect(page.nextCursor?.actionId).toBe(row(2).id);
 expect(JSON.stringify(page)).not.toMatch(/private-session|stateJson|executionAuthorized/);
 expect(projectPlatformHistory([row(1)],page.nextCursor).nextCursor).toBeNull();
});
it('refuses corruption, duplicate ordering, oversized pages and cursor replay',()=>{
 for(const rows of [[{...row(1),version:1}],[{...row(1),planDigest:'b'.repeat(64)}],[row(1),row(1)],[row(1),row(2)],Array.from({length:22},(_,i)=>row(30-i))])expect(()=>projectPlatformHistory(rows,null)).toThrow();
 expect(()=>projectPlatformHistory([row(1)],{createdAt:row(1).createdAt.toISOString(),actionId:row(1).id})).toThrow();
});

it('requires current reader both before and after the history read, without writing',async()=>{
 const {createPlatformActionService}=await import('../actionStore');
 const {vi}=await import('vitest');
 const read=vi.fn(async()=>[row(1)]),lock=vi.fn(),write=vi.fn();
 const tx={readActionPage:read,lock,insert:write};
 const repo={transaction:async(fn:(tx:unknown)=>Promise<unknown>)=>fn(tx)} as unknown as import('../actionStore').PlatformRepository;
 const current=vi.fn(async()=>{}),service=createPlatformActionService(repo,{assertCurrent:current});
 expect((await service.history(null,{userId:'admin',sessionId:'new-session'})).entries).toHaveLength(1);
 expect(current).toHaveBeenCalledTimes(2);expect(write).not.toHaveBeenCalled();
 current.mockRejectedValueOnce(Error('revoked'));read.mockClear();
 await expect(service.history(null,{userId:'admin',sessionId:'new-session'})).rejects.toThrow();expect(read).not.toHaveBeenCalled();
 current.mockResolvedValueOnce(undefined).mockRejectedValueOnce(Error('revoked-after-read'));
 await expect(service.history(null,{userId:'admin',sessionId:'new-session'})).rejects.toThrow();expect(write).not.toHaveBeenCalled();
});
it('rejects inconsistent history pages before desktop presentation',async()=>{
 const {platformHistoryPage}=await import('../historyContract'),page=projectPlatformHistory([row(2),row(1)],null);
 for(const bad of [{...page,entries:[{...page.entries[0],status:'confirmed'}]},{...page,entries:[page.entries[0],page.entries[0]]},{...page,nextCursor:{createdAt:page.entries[0].createdAt,actionId:page.entries[0].actionId}}])expect(platformHistoryPage.safeParse(bad).success).toBe(false);
});
it('compares cursor instants rather than ISO fractional spelling',()=>{
 const value=row(1),cursor={createdAt:'2026-11-12T00:00:00.001000Z',actionId:row(2).id};
 expect(projectPlatformHistory([value],cursor).entries).toHaveLength(1);
});
