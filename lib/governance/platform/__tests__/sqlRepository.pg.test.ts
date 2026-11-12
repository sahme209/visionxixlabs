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

import {createCurrentPlatformAuthority} from '../currentAuthority';
async function identityFixtures(){
 for(const [userId,sessionId,email] of [['requester','requester-session','requester@example.test'],['reviewer','reviewer-session','reviewer@example.test']]){
  await db.$executeRawUnsafe('INSERT INTO "User" (id,email) VALUES ($1,$2) ON CONFLICT (id) DO UPDATE SET email=EXCLUDED.email',userId,email);
  await db.$executeRawUnsafe('INSERT INTO "DesktopSessionRecord" (id,"userId","organizationId","issuedAt","expiresAt","revokedAt") VALUES ($1,$2,\'actual-pairing-workspace\',clock_timestamp()-interval \'1 minute\',clock_timestamp()+interval \'1 hour\',NULL) ON CONFLICT (id) DO UPDATE SET "revokedAt"=NULL,"expiresAt"=EXCLUDED."expiresAt"',sessionId,userId);
  await db.$executeRawUnsafe('INSERT INTO "OrgMembership" ("userId","organizationId","acceptedAt") VALUES ($1,\'actual-pairing-workspace\',clock_timestamp()) ON CONFLICT ("userId","organizationId") DO UPDATE SET "acceptedAt"=EXCLUDED."acceptedAt"',userId);
 }
}
function currentService(){return createPlatformActionService(createPlatformSqlRepository(db as unknown as PlatformSqlDatabase),createCurrentPlatformAuthority(()=>['requester@example.test','reviewer@example.test']))}
it.skipIf(!enabled)('joins real current identities/sessions/membership through review, claim and effect observation',async()=>{
 await identityFixtures();const s=currentService(),id=await ready(s);await s.claim(id,1,actor);const effect=await s.claimNextEffect(id,actor);await s.beforeEffectSend(effect.proof,effect.effect,actor);await s.observeEffect(effect.proof,'confirmed');
 const rows=await db.$queryRawUnsafe<Array<{stateJson:{status:string}}>>('SELECT "stateJson" FROM "PlatformGovernanceAction" WHERE id=$1',id);expect(rows[0].stateJson.status).toBe('confirmed');
});
it.skipIf(!enabled)('revoked genuine reviewer cannot authorize a later SQL claim',async()=>{
 await identityFixtures();const s=currentService(),id=await ready(s);
 await db.$executeRawUnsafe('UPDATE "DesktopSessionRecord" SET "revokedAt"=clock_timestamp() WHERE id=$1',reviewer.sessionId);
 await expect(s.claim(id,1,actor)).rejects.toThrow();
 const rows=await db.$queryRawUnsafe<Array<{stateJson:{status:string;attemptCount:number}}>>('SELECT "stateJson" FROM "PlatformGovernanceAction" WHERE id=$1',id);expect(rows[0].stateJson).toMatchObject({status:'approved',attemptCount:0});
});

import {vi} from 'vitest';
import {prisma as defaultPrisma} from '@/lib/db';
import {mintDesktopToken} from '@/lib/desktop/desktopToken';
import {createDefaultPlatformRequestService} from '../requestService';
afterAll(async()=>{if(enabled)await defaultPrisma.$disconnect()});
it.skipIf(!enabled)('runs default request authentication, independent review and claim with actual signed synthetic tokens and SQL',async()=>{
 await identityFixtures();vi.stubEnv('DESKTOP_SESSION_SIGNING_KEY','synthetic-platform-key-'.repeat(3));vi.stubEnv('ADMIN_EMAILS','requester@example.test,reviewer@example.test');
 try{
  const requester=await createDefaultPlatformRequestService({headers:new Headers({authorization:'Bearer '+mintDesktopToken(actor.sessionId)})});
  const p=plan(),{digest:_,...input}=p,id=await requester.propose(input);
  await expect(requester.review(id,0,p.digest)).rejects.toThrow();
  const independent=await createDefaultPlatformRequestService({headers:new Headers({authorization:'Bearer '+mintDesktopToken(reviewer.sessionId)})});
  await independent.review(id,0,p.digest);await expect(independent.claim(id,1)).rejects.toThrow();await requester.claim(id,1);
  const effect=await requester.claimNextEffect(id);await requester.beforeEffectSend(effect.proof,effect.effect);await requester.observeEffect(effect.proof,'confirmed');
  const rows=await db.$queryRawUnsafe<Array<{stateJson:{status:string;attemptCount:number}}>>('SELECT "stateJson" FROM "PlatformGovernanceAction" WHERE id=$1',id);expect(rows[0].stateJson).toMatchObject({status:'confirmed',attemptCount:1});
 }finally{vi.unstubAllEnvs()}
});
it.skipIf(!enabled)('default possession refuses wrong signature and revoked reviewer after genuine review',async()=>{
 await identityFixtures();vi.stubEnv('DESKTOP_SESSION_SIGNING_KEY','synthetic-platform-key-'.repeat(3));vi.stubEnv('ADMIN_EMAILS','requester@example.test,reviewer@example.test');
 try{
  await expect(createDefaultPlatformRequestService({headers:new Headers({authorization:'Bearer axm.desk.requester-session.'+'0'.repeat(64)})})).rejects.toThrow();
  const requester=await createDefaultPlatformRequestService({headers:new Headers({authorization:'Bearer '+mintDesktopToken(actor.sessionId)})}),p=plan(),{digest:_,...input}=p,id=await requester.propose(input);
  const independent=await createDefaultPlatformRequestService({headers:new Headers({authorization:'Bearer '+mintDesktopToken(reviewer.sessionId)})});await independent.review(id,0,p.digest);
  await db.$executeRawUnsafe('UPDATE "DesktopSessionRecord" SET "revokedAt"=clock_timestamp() WHERE id=$1',reviewer.sessionId);
  await expect(requester.claim(id,1)).rejects.toThrow();
  const rows=await db.$queryRawUnsafe<Array<{stateJson:{status:string;attemptCount:number}}>>('SELECT "stateJson" FROM "PlatformGovernanceAction" WHERE id=$1',id);expect(rows[0].stateJson).toMatchObject({status:'approved',attemptCount:0});
 }finally{vi.unstubAllEnvs()}
});
