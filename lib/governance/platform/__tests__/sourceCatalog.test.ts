import {it,expect,vi} from 'vitest';
import {projectPlatformSources,platformSourceCommand} from '../sourceCatalog';
import {createPlatformActionService,type PlatformRepository} from '../actionStore';
const row=(i:number)=>({id:String(i).padStart(3,'0'),label:'Draft '+i,labelTruncated:false,status:'drafted',updatedAt:new Date('2026-11-12T00:00:00Z')});
it('projects only bounded source metadata with stable ID pagination and no source authority',()=>{
 const page=projectPlatformSources('drafts',Array.from({length:21},(_,i)=>row(21-i)),null);expect(page.entries).toHaveLength(20);expect(page.nextCursor).toBe('002');expect(page.authority).toBe('selection_metadata_only');expect(projectPlatformSources('drafts',[row(1)],page.nextCursor).nextCursor).toBeNull();
 for(const raw of [[{...row(1),accessToken:'secret'}],[row(1),row(1)],[row(1),row(2)]])expect(()=>projectPlatformSources('drafts',raw,null)).toThrow();
 expect(platformSourceCommand.safeParse({operation:'list_sources',kind:'drafts',cursor:null,actor:'caller'}).success).toBe(false);
});
it('requires current reader authority around source lookup and never writes or accepts caller identity',async()=>{
 const read=vi.fn(async()=>[row(1)]),write=vi.fn(),authority=vi.fn(async()=>{});
 const repo={transaction:async(fn:(tx:unknown)=>Promise<unknown>)=>fn({lock:async()=>{},readSourcePage:read,insert:write})} as unknown as PlatformRepository;
 const service=createPlatformActionService(repo,{assertCurrent:authority});expect((await service.sources('drafts',null,{userId:'admin',sessionId:'paired'})).entries).toHaveLength(1);expect(authority).toHaveBeenCalledTimes(2);expect(write).not.toHaveBeenCalled();
 authority.mockResolvedValueOnce(undefined).mockRejectedValueOnce(Error('revoked'));await expect(service.sources('drafts',null,{userId:'admin',sessionId:'paired'})).rejects.toThrow();expect(write).not.toHaveBeenCalled();
});
it('lead selection exposes metadata only, not email, package contents or proof of eligibility',()=>{
 const rows=[{id:'lead',label:'Company',labelTruncated:false,status:'package_ready',updatedAt:new Date('2026-11-12T00:00:00Z'),hasSavedPackage:true}];
 const page=projectPlatformSources('leads',rows,null);expect(page).toMatchObject({kind:'leads',authority:'selection_metadata_only',entries:[{id:'lead',hasSavedPackage:true}]});
 for(const extra of [{email:'private@example.test'},{fullPayload:{private:'secret'}},{aiPackage:{body:'content'}}])expect(()=>projectPlatformSources('leads',[{...rows[0],...extra}],null)).toThrow();
});
