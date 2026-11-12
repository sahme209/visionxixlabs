import {afterAll,beforeAll,it,expect} from 'vitest';
import {createDatabaseClient} from '@/lib/database/createDatabaseClient';
import {createPlatformSqlRepository,type PlatformSqlDatabase} from '../sqlRepository';
import {createPlatformActionService,type PlatformRepository} from '../actionStore';
import {compilePlatformPlan} from '../kernel';
const enabled=!!process.env.AXIOM_PLATFORM_PG_ROOT;
let db:ReturnType<typeof createDatabaseClient>;
beforeAll(()=>{if(enabled)db=createDatabaseClient(process.env.DATABASE_URL)});
afterAll(async()=>{if(db)await db.$disconnect()});
const actor={userId:'requester',sessionId:'requester-session'},reviewer={userId:'reviewer',sessionId:'reviewer-session'},d='a'.repeat(64);
function service(repository?:PlatformRepository){return createPlatformActionService(repository??createPlatformSqlRepository(db as unknown as PlatformSqlDatabase),{assertCurrent:async()=>{}})}
function plan(){return compilePlatformPlan({format:1,scope:'platform',sourceDigest:d,expiresAt:new Date(Date.now()+60000).toISOString(),effects:[{id:'effect',kind:'growth.post.publish',target:{connectionId:'connection',connectionRevision:'revision',author:'author',draftId:'draft',renderedPayloadDigest:d}}]})}
async function ready(s:ReturnType<typeof service>){const p=plan(),id=await s.propose(p,actor);await s.review(id,0,p.digest,reviewer);return id}
it.skipIf(!enabled)('serializes actual duplicate SQL claims and records exactly one attempt',async()=>{
 const s=service(),id=await ready(s),results=await Promise.allSettled([s.claim(id,1,actor),s.claim(id,1,actor)]);
 expect(results.filter(r=>r.status==='fulfilled')).toHaveLength(1);
 const rows=await db.$queryRawUnsafe<Array<{stateJson:{attemptCount:number;status:string}}>>('SELECT "stateJson" FROM "PlatformGovernanceAction" WHERE id=$1',id);
 expect(rows[0].stateJson).toMatchObject({attemptCount:1,status:'claimed'});
 const counts=await db.$queryRawUnsafe<Array<{count:bigint}>>('SELECT count(*) AS count FROM "PlatformGovernanceEvent" WHERE "actionId"=$1',id);expect(Number(counts[0].count)).toBe(3);
});
it.skipIf(!enabled)('rolls back actual SQL claim if its durable event cannot be recorded',async()=>{
 const repo=createPlatformSqlRepository(db as unknown as PlatformSqlDatabase),s=service(repo),id=await ready(s);
 const broken=service({transaction:fn=>repo.transaction(tx=>fn({...tx,event:async()=>{throw Error('synthetic_event_outage')}}))});
 await expect(broken.claim(id,1,actor)).rejects.toThrow();
 const rows=await db.$queryRawUnsafe<Array<{stateJson:{status:string}}>>('SELECT "stateJson" FROM "PlatformGovernanceAction" WHERE id=$1',id);expect(rows[0].stateJson.status).toBe('approved');
});
it.skipIf(!enabled)('preserves unknown child and parent in real SQL without replay',async()=>{
 const s=service(),id=await ready(s);await s.claim(id,1,actor);const effect=await s.claimNextEffect(id,actor);await s.observeEffect(effect.proof,'unknown');
 await expect(s.claimNextEffect(id,actor)).rejects.toThrow();await expect(s.claim(id,3,actor)).rejects.toThrow();
 const rows=await db.$queryRawUnsafe<Array<{stateJson:{status:string;attemptCount:number}}>>('SELECT "stateJson" FROM "PlatformGovernanceAction" WHERE id=$1',id);expect(rows[0].stateJson).toMatchObject({status:'unknown',attemptCount:1});
 const children=await db.$queryRawUnsafe<Array<{status:string}>>('SELECT status FROM "PlatformGovernanceEffect" WHERE "actionId"=$1',id);expect(children).toEqual([{status:'unknown'}]);
});
