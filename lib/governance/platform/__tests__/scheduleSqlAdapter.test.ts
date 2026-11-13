import {expect,it,vi} from 'vitest';
import {createPlatformSqlRepository,type PlatformSql,type PlatformSqlDatabase} from '../sqlRepository';
import {compilePlatformPlan,createPlatformAction,approvePlatformAction,claimPlatformAction} from '../kernel';
const at=Date.parse('2026-11-12T00:00:00Z'),d='a'.repeat(64),id='platform_action_11111111-1111-4111-8111-111111111111',actor={userId:'requester',sessionId:'requester-session'},reviewer={userId:'reviewer',sessionId:'reviewer-session'};
function fixture(){
 const plan=compilePlatformPlan({format:1,scope:'platform',sourceDigest:d,expiresAt:new Date(at+30000).toISOString(),effects:[{id:'schedule',kind:'growth.schedule.change',target:{draftId:'draft',connectionId:'connection',connectionRevision:d,author:'urn:li:person:author',renderedPayloadDigest:d,scheduledFor:new Date(at+90000).toISOString()}}]}),effect=plan.effects[0];if(effect.kind!=='growth.schedule.change')throw Error('fixture');
 const state=claimPlatformAction(approvePlatformAction(createPlatformAction(plan,actor,at),{...reviewer,planDigest:plan.digest},at),actor,at);
 const query=vi.fn(async(sql:string)=>{if(sql.includes('pg_advisory_xact_lock'))return [{locked:1}];if(sql.includes('"stateJson"'))return [{stateJson:state,planDigest:plan.digest,version:state.version}];if(sql.includes('SELECT status FROM'))return [{status:'claimed'}];throw Error('unexpected query')});
 const execute=vi.fn(async()=>1),sql:PlatformSql={$queryRawUnsafe:query as PlatformSql['$queryRawUnsafe'],$executeRawUnsafe:execute},db:PlatformSqlDatabase={$transaction:async fn=>fn(sql)};
 return {repo:createPlatformSqlRepository(db),execute,query,effect,state};
}
it('binds its one parameterized update to the locked claimed action/effect and exact draft revision',async()=>{
 const f=fixture(),revision=new Date(at-1000);await f.repo.transaction(async tx=>{await tx.lock(id);await tx.applyGrowthSchedule!(id,0,f.effect,revision)});
 expect(f.execute).toHaveBeenCalledTimes(1);const [sql,...args]=f.execute.mock.calls[0] as unknown as [string,...unknown[]];expect(sql).toBe('UPDATE "LinkedInPostDraft" SET status=$1,"scheduledFor"=$2,"updatedAt"=clock_timestamp() WHERE id=$3 AND "updatedAt"=$4 AND status IN ($5,$6)');expect(args).toEqual(['scheduled',new Date(at+90000),'draft',revision,'approved','scheduled']);
});
it('rejects wrong parent/effect/child/revision and non-singleton update results without retry',async()=>{
 for(const cause of ['unlocked','foreign','effect','child','revision','zero','many'] as const){const f=fixture();if(cause==='child')f.query.mockImplementation(async sql=>sql.includes('pg_advisory_xact_lock')?[{locked:1}]:sql.includes('"stateJson"')?[{stateJson:f.state,planDigest:f.state.plan.digest,version:f.state.version}]:[{status:'confirmed'}]);if(cause==='zero')f.execute.mockResolvedValue(0);if(cause==='many')f.execute.mockResolvedValue(2);
 await expect(f.repo.transaction(async tx=>{if(cause!=='unlocked')await tx.lock(id);await tx.applyGrowthSchedule!(cause==='foreign'?'platform_action_22222222-2222-4222-8222-222222222222':id,0,cause==='effect'?{...f.effect,target:{...f.effect.target,draftId:'other'}}:f.effect,cause==='revision'?new Date(NaN):new Date(at-1000))})).rejects.toThrow();expect(f.execute).toHaveBeenCalledTimes(cause==='zero'||cause==='many'?1:0);
 }
});
