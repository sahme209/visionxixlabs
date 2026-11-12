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
function plan(){return compilePlatformPlan({format:1,scope:'platform',sourceDigest:d,expiresAt:new Date(Date.now()+60000).toISOString(),effects:[{id:'effect',kind:'settings.vercel',target:{projectId:'project',settingsDigest:d}}]})}
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

import {createDefaultPlatformExecution} from '../defaultExecution';
import {preparePlatformVercelDeployment} from '@/lib/deploy/platformDeployment';
import {generateSiteFilesFromPlan} from '@/lib/scaffoldGenerator';
import {deploySiteFromPlan} from '@/lib/deploy/provider';
async function deploymentFixture(){
 await identityFixtures();vi.stubEnv('DESKTOP_SESSION_SIGNING_KEY','synthetic-platform-key-'.repeat(3));vi.stubEnv('ADMIN_EMAILS','requester@example.test,reviewer@example.test');vi.stubEnv('VERCEL_TOKEN','synthetic-provider-token');vi.stubEnv('VERCEL_TEAM_ID','team_fixture');
 const request={headers:new Headers({authorization:'Bearer '+mintDesktopToken(actor.sessionId)})},requester=await createDefaultPlatformRequestService(request);
 const website={siteName:'fixture',fullPageHtml:'<h1>fixture</h1>'},prepared=preparePlatformVercelDeployment(generateSiteFilesFromPlan(website),{projectName:'fixture',teamId:'team_fixture'});
 const raw={format:1,scope:'platform',sourceDigest:d,expiresAt:new Date(Date.now()+60000).toISOString(),effects:[prepared.effect]},compiled=compilePlatformPlan(raw),id=await requester.propose(raw);
 const independent=await createDefaultPlatformRequestService({headers:new Headers({authorization:'Bearer '+mintDesktopToken(reviewer.sessionId)})});await independent.review(id,0,compiled.digest);
 return {website,prepared,id,binding:await createDefaultPlatformExecution(request,id,1)};
}
it.skipIf(!enabled)('joins default possessed requester, SQL review/claims and actual deployment helper with simulated HTTP',async()=>{
 try{
  const f=await deploymentFixture(),http=vi.fn(async()=>new Response(JSON.stringify({id:'dpl_fixture',readyState:'BUILDING'}),{status:200}));vi.stubGlobal('fetch',http);
  expect(await deploySiteFromPlan('vercel',f.website,{projectName:'fixture',platformExecution:f.binding})).toMatchObject({deploymentId:'dpl_fixture',state:'BUILDING'});
  expect(http).toHaveBeenCalledTimes(1);
  const rows=await db.$queryRawUnsafe<Array<{stateJson:{status:string;attemptCount:number}}>>('SELECT "stateJson" FROM "PlatformGovernanceAction" WHERE id=$1',f.id);expect(rows[0].stateJson).toMatchObject({status:'confirmed',attemptCount:1});
 }finally{vi.unstubAllGlobals();vi.unstubAllEnvs()}
});
it.skipIf(!enabled)('default deployment transport loss retains unknown parent/child and refuses replay',async()=>{
 try{
  const f=await deploymentFixture(),http=vi.fn(async()=>{throw Error('synthetic_lost_response')});vi.stubGlobal('fetch',http);
  for(let i=0;i<2;i++)await expect(deploySiteFromPlan('vercel',f.website,{projectName:'fixture',platformExecution:f.binding})).rejects.toThrow();expect(http).toHaveBeenCalledTimes(1);
  const rows=await db.$queryRawUnsafe<Array<{stateJson:{status:string;attemptCount:number}}>>('SELECT "stateJson" FROM "PlatformGovernanceAction" WHERE id=$1',f.id);expect(rows[0].stateJson).toMatchObject({status:'unknown',attemptCount:1});
 }finally{vi.unstubAllGlobals();vi.unstubAllEnvs()}
});

import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {S3Client} from '@aws-sdk/client-s3';
import {STSClient} from '@aws-sdk/client-sts';
import {templateAccessEffect} from '@/lib/cloud/aws/platformTemplatePlan';
import {ensureTemplatePublished} from '@/lib/cloud/aws/templateHosting';
async function templateFixture(){
 await identityFixtures();vi.stubEnv('DESKTOP_SESSION_SIGNING_KEY','synthetic-platform-key-'.repeat(3));vi.stubEnv('ADMIN_EMAILS','requester@example.test,reviewer@example.test');vi.stubEnv('AWS_CONNECTOR_BROKER_ACCESS_KEY_ID','synthetic-key');vi.stubEnv('AWS_CONNECTOR_BROKER_SECRET_ACCESS_KEY','synthetic-secret');vi.stubEnv('AWS_SHARED_CREDENTIALS_FILE','/private/tmp/axiom-no-synthetic-aws-credentials');vi.stubEnv('AWS_CONFIG_FILE','/private/tmp/axiom-no-synthetic-aws-config');vi.stubEnv('AWS_PROFILE','axiom-synthetic');
 const bytes=readFileSync('public/aws/axiom-agent-quick-deploy.yaml'),accountId='123456789012',input={accountId,region:'us-east-2',objectVersion:'version-1',recipientDigest:'b'.repeat(64),ttlSeconds:3600};
 const effect=templateAccessEffect({...input,bytesDigest:createHash('sha256').update(bytes).digest('hex')}),raw={format:1,scope:'platform',sourceDigest:d,expiresAt:new Date(Date.now()+60000).toISOString(),effects:[effect]},compiled=compilePlatformPlan(raw);
 const request={headers:new Headers({authorization:'Bearer '+mintDesktopToken(actor.sessionId)})},requester=await createDefaultPlatformRequestService(request),id=await requester.propose(raw);
 const independent=await createDefaultPlatformRequestService({headers:new Headers({authorization:'Bearer '+mintDesktopToken(reviewer.sessionId)})});await independent.review(id,0,compiled.digest);
 vi.spyOn(STSClient.prototype,'send').mockResolvedValue({Account:accountId} as never);
 return {bytes,input,id,binding:await createDefaultPlatformExecution(request,id,1)};
}
it.skipIf(!enabled)('joins default SQL authority to exact template readback and actual synthetic signing',async()=>{
 try{
  const f=await templateFixture(),read=vi.spyOn(S3Client.prototype,'send').mockResolvedValue({VersionId:'version-1',ContentLength:f.bytes.length,Body:(async function*(){yield f.bytes})()} as never);
  expect(await ensureTemplatePublished({platformExecution:f.binding,access:f.input})).toMatchObject({available:true});
  expect(await ensureTemplatePublished({platformExecution:f.binding,access:f.input})).toMatchObject({available:false});expect(read).toHaveBeenCalledTimes(1);
  const rows=await db.$queryRawUnsafe<Array<{stateJson:{status:string;attemptCount:number}}>>('SELECT "stateJson" FROM "PlatformGovernanceAction" WHERE id=$1',f.id);expect(rows[0].stateJson).toMatchObject({status:'confirmed',attemptCount:1});
 }finally{vi.restoreAllMocks();vi.unstubAllEnvs()}
});
it.skipIf(!enabled)('revocation during template readback prevents URL release in the default composed path',async()=>{
 try{
  const f=await templateFixture();vi.spyOn(S3Client.prototype,'send').mockImplementation(async()=>{
   await db.$executeRawUnsafe('UPDATE "DesktopSessionRecord" SET "revokedAt"=clock_timestamp() WHERE id=$1',reviewer.sessionId);
   return {VersionId:'version-1',ContentLength:f.bytes.length,Body:(async function*(){yield f.bytes})()};
  });
  expect(await ensureTemplatePublished({platformExecution:f.binding,access:f.input})).toMatchObject({available:false});
  const rows=await db.$queryRawUnsafe<Array<{stateJson:{status:string;attemptCount:number}}>>('SELECT "stateJson" FROM "PlatformGovernanceAction" WHERE id=$1',f.id);expect(rows[0].stateJson).toMatchObject({status:'unknown',attemptCount:1});
 }finally{vi.restoreAllMocks();vi.unstubAllEnvs()}
});

import {randomUUID} from 'node:crypto';
import {encryptCredential} from '@/lib/security/credentialVault';
import {publishDraft,POST_DRAFT_SELECT,POST_CONNECTION_SELECT} from '@/lib/growth/linkedin/posting';
import {preparePlatformLinkedInPost,preparePlatformLinkedInSchedule} from '@/lib/growth/linkedin/platformPostingPlan';
import {schedulePlatformLinkedInDraft} from '@/lib/growth/linkedin/platformSchedule';
async function postFixture(schedule=false,scheduleDelay=30000,serverPrepared=false,claimExecution=true){
 await identityFixtures();vi.stubEnv('DESKTOP_SESSION_SIGNING_KEY','synthetic-platform-key-'.repeat(3));vi.stubEnv('ADMIN_EMAILS','requester@example.test,reviewer@example.test');vi.stubEnv('LINKEDIN_POSTING_ENABLED','true');vi.stubEnv('LINKEDIN_REST_VERSION','202605');vi.stubEnv('CREDENTIAL_ENCRYPTION_KEY','synthetic-credential-key-'.repeat(3));
 const connection=await defaultPrisma.linkedInAccountConnection.create({data:{ownerEmail:randomUUID()+'@example.test',linkedinUrn:'urn:li:person:fixture',accessToken:encryptCredential('synthetic-linkedin-token'),scopes:'w_member_social',expiresAt:new Date(Date.now()+60000),status:'connected'},select:POST_CONNECTION_SELECT});
 const draft=await defaultPrisma.linkedInPostDraft.create({data:{title:'Fixture',hook:'Hook',body:'Body',category:'governance',status:'approved'},select:POST_DRAFT_SELECT}),scheduledFor=new Date(Date.now()+scheduleDelay),effect=schedule?preparePlatformLinkedInSchedule(draft,connection,'202605',Date.now(),scheduledFor).effect:preparePlatformLinkedInPost(draft,connection,'202605',Date.now()).effect;
 const raw={format:1,scope:'platform',sourceDigest:d,expiresAt:new Date(Math.min(connection.expiresAt.getTime(),Date.now()+30000)).toISOString(),effects:[effect]},request={headers:new Headers({authorization:'Bearer '+mintDesktopToken(actor.sessionId)})},requester=await createDefaultPlatformRequestService(request),prepared=serverPrepared?await requester.prepareGrowth({operation:schedule?'schedule':'publish',draftId:draft.id,connectionId:connection.id,expiresAt:raw.expiresAt,...(schedule?{scheduledFor:scheduledFor.toISOString()}:{})}):null,id=prepared?.actionId??await requester.propose(raw),saved=await requester.inspect(id);
 const independent=await createDefaultPlatformRequestService({headers:new Headers({authorization:'Bearer '+mintDesktopToken(reviewer.sessionId)})});if(serverPrepared)expect((await independent.previewGrowth(id)).renderedPost).toBe(prepared?.preview?.renderedPost);await independent.review(id,0,saved.plan.digest);
 return {draft,connection,scheduledFor,effect,id,requester,request,prepared,binding:claimExecution?await createDefaultPlatformExecution(request,id,1):undefined};
}
it.skipIf(!enabled)('joins actual default post source, credential crypto, human review and SQL ledger with simulated HTTP',async()=>{
 try{
  const f=await postFixture(false,30000,true),http=vi.fn(async()=>new Response('',{status:201,headers:{'x-restli-id':'urn:li:share:123'}}));expect(f.prepared?.preview?.renderedPost).toContain('Hook');expect(f.prepared?.preview?.sourceDigest).not.toBe(d);vi.stubGlobal('fetch',http);
  expect(await publishDraft({draftId:f.draft.id,connectionId:f.connection.id,platformExecution:f.binding,triggeredBy:'untrusted-hint'})).toMatchObject({kind:'success',urn:'urn:li:share:123',recordingConfirmed:true});expect(http).toHaveBeenCalledTimes(1);
  const row=await defaultPrisma.linkedInPostDraft.findUnique({where:{id:f.draft.id}});expect(row).toMatchObject({status:'published',linkedinPostUrn:'urn:li:share:123'});
  const runs=await defaultPrisma.linkedInPostPublishRun.findMany({where:{draftId:f.draft.id}});expect(runs).toHaveLength(1);expect(runs[0].triggeredBy).toBe('user:requester');
 }finally{vi.unstubAllGlobals();vi.unstubAllEnvs()}
});
it.skipIf(!enabled)('final default source assertion refuses a draft changed after child claim',async()=>{
 try{
  const f=await postFixture(),claim=await f.requester.claimNextEffect(f.id);
  await defaultPrisma.linkedInPostDraft.update({where:{id:f.draft.id},data:{body:'changed after independent review'}});
  await expect(f.requester.beforeEffectSend(claim.proof,f.effect)).rejects.toThrow();await f.requester.observeEffect(claim.proof,'unknown');
  const rows=await db.$queryRawUnsafe<Array<{stateJson:{status:string}}>>('SELECT "stateJson" FROM "PlatformGovernanceAction" WHERE id=$1',f.id);expect(rows[0].stateJson.status).toBe('unknown');
 }finally{vi.unstubAllEnvs()}
});
it.skipIf(!enabled)('lost post response remains unknown in both ledgers and never redispatches the same binding',async()=>{
 try{
  const f=await postFixture(),http=vi.fn(async()=>{throw Error('synthetic_lost_response')});vi.stubGlobal('fetch',http);
  expect(await publishDraft({draftId:f.draft.id,connectionId:f.connection.id,platformExecution:f.binding,triggeredBy:'untrusted-hint'})).toMatchObject({kind:'outcome_unknown'});
  await publishDraft({draftId:f.draft.id,connectionId:f.connection.id,platformExecution:f.binding,triggeredBy:'untrusted-hint'});expect(http).toHaveBeenCalledTimes(1);
  const rows=await db.$queryRawUnsafe<Array<{stateJson:{status:string}}>>('SELECT "stateJson" FROM "PlatformGovernanceAction" WHERE id=$1',f.id);expect(rows[0].stateJson.status).toBe('unknown');
  const runs=await defaultPrisma.linkedInPostPublishRun.findMany({where:{draftId:f.draft.id}});expect(runs).toHaveLength(1);expect(runs[0].outcome).toBe('unknown');
 }finally{vi.unstubAllGlobals();vi.unstubAllEnvs()}
});

async function publicationPair(draftId:string){
 const s=createPlatformActionService(createPlatformSqlRepository(db as unknown as PlatformSqlDatabase),{assertCurrent:async()=>{},assertEffectCurrent:async()=>{}});
 const p=compilePlatformPlan({format:1,scope:'platform',sourceDigest:d,expiresAt:new Date(Date.now()+60000).toISOString(),effects:[{id:'post',kind:'growth.post.publish',target:{draftId,connectionId:'synthetic-connection',connectionRevision:'synthetic-revision',author:'urn:li:person:synthetic',renderedPayloadDigest:d}}]});
 const effects=[];for(let i=0;i<2;i++){const id=await s.propose(p,actor);await s.review(id,0,p.digest,reviewer);await s.claim(id,1,actor);effects.push(await s.claimNextEffect(id,actor))}return {s,effects};
}
it.skipIf(!enabled)('SQL uniqueness grants one native publication across concurrent approved actions',async()=>{
 const {s,effects}=await publicationPair('concurrent-native-draft');
 const results=await Promise.allSettled(effects.map(e=>s.beforeEffectSend(e.proof,e.effect,actor)));
 expect(results.filter(r=>r.status==='fulfilled')).toHaveLength(1);
 const rows=await db.$queryRawUnsafe<Array<{count:bigint}>>('SELECT count(*) AS count FROM "PlatformGovernanceEffect" WHERE "publicationKey" IS NOT NULL');expect(Number(rows[0].count)).toBeGreaterThanOrEqual(1);
 // The losing action cannot recover its consumed proof and send later.
 const lost=results.findIndex(r=>r.status==='rejected');await expect(s.beforeEffectSend(effects[lost].proof,effects[lost].effect,actor)).rejects.toThrow();
});
it.skipIf(!enabled)('SQL unknown publication permanently retains the native draft reservation',async()=>{
 const {s,effects}=await publicationPair('unknown-native-draft');
 await s.beforeEffectSend(effects[0].proof,effects[0].effect,actor);await s.observeEffect(effects[0].proof,'unknown');
 await expect(s.beforeEffectSend(effects[1].proof,effects[1].effect,actor)).rejects.toThrow();
 const rows=await db.$queryRawUnsafe<Array<{status:string}>>('SELECT status FROM "PlatformGovernanceEffect" WHERE "publicationKey"=$1',(await import('@/lib/tauri/contentHash')).sha256ContentHash({kind:'growth.post.publish',draftId:'unknown-native-draft'}));expect(rows).toEqual([{status:'unknown'}]);
});

it.skipIf(!enabled)('default schedule execution joins real HMAC/source/SQL without publishing',async()=>{
 try{
  const f=await postFixture(true,30000,true),http=vi.fn();vi.stubGlobal('fetch',http);
  expect(await schedulePlatformLinkedInDraft({draftId:f.draft.id,connectionId:f.connection.id,scheduledFor:f.scheduledFor,platformExecution:f.binding})).toEqual({kind:'scheduled'});
  expect(http).not.toHaveBeenCalled();const row=await defaultPrisma.linkedInPostDraft.findUnique({where:{id:f.draft.id}});expect(row).toMatchObject({status:'scheduled',scheduledFor:f.scheduledFor,linkedinPostUrn:null});
  const rows=await db.$queryRawUnsafe<Array<{stateJson:{status:string}}>>('SELECT "stateJson" FROM "PlatformGovernanceAction" WHERE id=$1',f.id);expect(rows[0].stateJson.status).toBe('confirmed');
 }finally{vi.unstubAllGlobals();vi.unstubAllEnvs()}
});
it.skipIf(!enabled)('changed SQL draft invalidates the independently reviewed schedule',async()=>{
 try{
  const f=await postFixture(true);await defaultPrisma.linkedInPostDraft.update({where:{id:f.draft.id},data:{body:'changed schedule source'}});
  expect(await schedulePlatformLinkedInDraft({draftId:f.draft.id,connectionId:f.connection.id,scheduledFor:f.scheduledFor,platformExecution:f.binding})).toEqual({kind:'outcome_unknown'});
  const row=await defaultPrisma.linkedInPostDraft.findUnique({where:{id:f.draft.id}});expect(row).toMatchObject({status:'approved',scheduledFor:null});
 }finally{vi.unstubAllEnvs()}
});

it.skipIf(!enabled)('database mutation delay rolls back a schedule whose exact time expires',async()=>{
 try{
  const f=await postFixture(true,1000);
  await db.$executeRawUnsafe(`CREATE FUNCTION platform_fixture_delay_schedule() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.status='scheduled' THEN PERFORM pg_sleep(1.2); END IF; RETURN NEW; END $$`);
  await db.$executeRawUnsafe('CREATE TRIGGER platform_fixture_schedule_delay BEFORE UPDATE ON "LinkedInPostDraft" FOR EACH ROW EXECUTE FUNCTION platform_fixture_delay_schedule()');
  expect(await schedulePlatformLinkedInDraft({draftId:f.draft.id,connectionId:f.connection.id,scheduledFor:f.scheduledFor,platformExecution:f.binding})).toEqual({kind:'outcome_unknown'});
  const row=await defaultPrisma.linkedInPostDraft.findUnique({where:{id:f.draft.id}});expect(row).toMatchObject({status:'approved',scheduledFor:null});
  const rows=await db.$queryRawUnsafe<Array<{stateJson:{status:string}}>>('SELECT "stateJson" FROM "PlatformGovernanceAction" WHERE id=$1',f.id);expect(rows[0].stateJson.status).toBe('unknown');
 }finally{vi.unstubAllEnvs()}
});

import {readPlatformDeletionSource} from '@/lib/growth/linkedin/platformDeletionSource';
import {preparePlatformLinkedInDeletion} from '@/lib/growth/linkedin/platformDeletionPlan';
import {deletePlatformLinkedInPost} from '@/lib/growth/linkedin/platformDeletion';
async function deletionFixture(){
 const f=await postFixture();vi.stubGlobal('fetch',vi.fn(async()=>new Response(null,{status:201,headers:{'x-restli-id':'urn:li:share:'+f.draft.id.replace(/[^a-zA-Z0-9_-]/g,'')}})));
 expect(await publishDraft({draftId:f.draft.id,connectionId:f.connection.id,platformExecution:f.binding,triggeredBy:'fixture'})).toMatchObject({kind:'success'});
 const source=await defaultPrisma.$transaction(tx=>readPlatformDeletionSource(tx,f.draft.id,f.connection.id)),effect=preparePlatformLinkedInDeletion(source,'202605',Date.now()).effect;
 async function approved(serverPrepared=false,claimExecution=true){
  const raw={format:1,scope:'platform',sourceDigest:d,expiresAt:new Date(Math.min(f.connection.expiresAt.getTime(),Date.now()+20000)).toISOString(),effects:[effect]},requester=await createDefaultPlatformRequestService(f.request);
  const prepared=serverPrepared?await requester.prepareGrowth({operation:'delete',draftId:f.draft.id,connectionId:f.connection.id,expiresAt:raw.expiresAt}):null,id=prepared?.actionId??await requester.propose(raw),saved=await requester.inspect(id);
  const independent=await createDefaultPlatformRequestService({headers:new Headers({authorization:'Bearer '+mintDesktopToken(reviewer.sessionId)})});
  if(serverPrepared)expect(await independent.previewGrowth(id)).toMatchObject({actionId:id,planDigest:saved.plan.digest,authority:'review_preview_only'});
  await independent.review(id,0,saved.plan.digest);return {id,binding:claimExecution?await createDefaultPlatformExecution(f.request,id,1):undefined};
 }

 return {...f,effect,approved};
}
it.skipIf(!enabled)('default delete requires actual confirmed publication lineage and preserves original history',async()=>{
 try{const f=await deletionFixture(),a=await f.approved(true),http=vi.fn(async()=>new Response(null,{status:204}));vi.stubGlobal('fetch',http);
  expect(await deletePlatformLinkedInPost({draftId:f.draft.id,connectionId:f.connection.id,platformExecution:a.binding})).toEqual({kind:'deleted'});expect(http).toHaveBeenCalledTimes(1);
  const row=await defaultPrisma.linkedInPostDraft.findUnique({where:{id:f.draft.id}});expect(row).toMatchObject({status:'published',linkedinPostUrn:f.effect.target.postUrn});
  const original=await db.$queryRawUnsafe<Array<{stateJson:{status:string}}>>('SELECT "stateJson" FROM "PlatformGovernanceAction" WHERE id=$1',f.id);expect(original[0].stateJson.status).toBe('confirmed');
 }finally{vi.unstubAllGlobals();vi.unstubAllEnvs()}
});
it.skipIf(!enabled)('unknown deletion blocks a second independently reviewed action for the same native post',async()=>{
 try{const f=await deletionFixture(),one=await f.approved(),two=await f.approved(),http=vi.fn(async()=>{throw Error('synthetic_lost_delete_response')});vi.stubGlobal('fetch',http);
  for(const action of [one,two])expect(await deletePlatformLinkedInPost({draftId:f.draft.id,connectionId:f.connection.id,platformExecution:action.binding})).toEqual({kind:'outcome_unknown'});
  expect(http).toHaveBeenCalledTimes(1);
  const row=await defaultPrisma.linkedInPostDraft.findUnique({where:{id:f.draft.id}});expect(row).toMatchObject({status:'published',linkedinPostUrn:f.effect.target.postUrn});
 }finally{vi.unstubAllGlobals();vi.unstubAllEnvs()}
});
it.skipIf(!enabled)('current requester reads consumed SQL history after former reviewer revocation without renewed authority',async()=>{
 try{
  const f=await postFixture();const claim=await f.requester.claimNextEffect(f.id);await f.requester.observeEffect(claim.proof,'unknown');
  await db.$executeRawUnsafe('UPDATE "DesktopSessionRecord" SET "revokedAt"=clock_timestamp() WHERE id=$1',reviewer.sessionId);
  const result=await f.requester.inspect(f.id);expect(result).toMatchObject({status:'unknown',attemptCount:1,authority:'history_only',sourceValidation:'not_checked',requesterUserId:'requester',reviewerUserId:'reviewer',effects:[{id:f.effect.id,status:'unknown'}]});
  expect(JSON.stringify(result)).not.toContain('requester-session');expect(JSON.stringify(result)).not.toContain('reviewer-session');
  const rows=await db.$queryRawUnsafe<Array<{stateJson:{status:string;attemptCount:number}}>>('SELECT "stateJson" FROM "PlatformGovernanceAction" WHERE id=$1',f.id);expect(rows[0].stateJson).toMatchObject({status:'unknown',attemptCount:1});
 }finally{vi.unstubAllEnvs()}
});
it.skipIf(!enabled)('changed SQL source after reviewer preview refuses the exact approval without replacing history',async()=>{
 try{
  const f=await postFixture(),prepared=await f.requester.prepareGrowth({operation:'publish',draftId:f.draft.id,connectionId:f.connection.id,expiresAt:new Date(Date.now()+20000).toISOString()}),independent=await createDefaultPlatformRequestService({headers:new Headers({authorization:'Bearer '+mintDesktopToken(reviewer.sessionId)})});
  const preview=await independent.previewGrowth(prepared.actionId);expect(preview.renderedPost).toContain('Hook');
  await defaultPrisma.linkedInPostDraft.update({where:{id:f.draft.id},data:{body:'changed after exact reviewer preview'}});
  await expect(independent.review(prepared.actionId,0,preview.planDigest)).rejects.toThrow();await expect(independent.previewGrowth(prepared.actionId)).rejects.toThrow();
  expect(await f.requester.inspect(prepared.actionId)).toMatchObject({status:'proposed',version:0,attemptCount:0,reviewerUserId:null});
 }finally{vi.unstubAllEnvs()}
});

import {createPlatformExecutionHttp} from '../executionHttp';
function executionRequest(actionId:string,planDigest:string,sessionId=actor.sessionId){return new Request('https://fixture.example.test/platform/execute',{method:'POST',headers:{authorization:'Bearer '+mintDesktopToken(sessionId),'content-type':'application/json'},body:JSON.stringify({operation:'execute',actionId,expectedVersion:1,planDigest})})}
it.skipIf(!enabled)('default execution HTTP enforces original requester session then confirms exactly one publication',async()=>{
 try{const f=await postFixture(false,30000,true,false),saved=await f.requester.inspect(f.id),handle=createPlatformExecutionHttp(),http=vi.fn(async()=>new Response(null,{status:201,headers:{'x-restli-id':'urn:li:share:http-fixture'}}));vi.stubGlobal('fetch',http);
  expect((await handle(executionRequest(f.id,saved.plan.digest,reviewer.sessionId))).status).toBe(409);
  await db.$executeRawUnsafe('INSERT INTO "DesktopSessionRecord" (id,"userId","organizationId","issuedAt","expiresAt","revokedAt") VALUES ($1,$2,\'actual-pairing-workspace\',clock_timestamp()-interval \'1 minute\',clock_timestamp()+interval \'1 hour\',NULL)','requester-other-session',actor.userId);
  expect((await handle(executionRequest(f.id,saved.plan.digest,'requester-other-session'))).status).toBe(409);expect(http).not.toHaveBeenCalled();
  const response=await handle(executionRequest(f.id,saved.plan.digest));expect(response.status).toBe(200);expect(await response.json()).toMatchObject({ok:true,data:{actionId:f.id,status:'confirmed',attemptCount:1}});
  expect((await handle(executionRequest(f.id,saved.plan.digest))).status).toBe(409);expect(http).toHaveBeenCalledTimes(1);
 }finally{vi.unstubAllGlobals();vi.unstubAllEnvs()}
});
it.skipIf(!enabled)('default execution HTTP preserves a lost provider result and never replays it',async()=>{
 try{const f=await postFixture(false,30000,true,false),saved=await f.requester.inspect(f.id),handle=createPlatformExecutionHttp(),http=vi.fn(async()=>{throw Error('synthetic_lost_http_result')});vi.stubGlobal('fetch',http);
  for(let attempt=0;attempt<2;attempt++)expect((await handle(executionRequest(f.id,saved.plan.digest))).status).toBe(409);expect(http).toHaveBeenCalledTimes(1);expect(await f.requester.inspect(f.id)).toMatchObject({status:'unknown',attemptCount:1});
 }finally{vi.unstubAllGlobals();vi.unstubAllEnvs()}
});
it.skipIf(!enabled)('default execution HTTP applies the exact independently reviewed schedule without provider transport',async()=>{
 try{const f=await postFixture(true,30000,true,false),saved=await f.requester.inspect(f.id),http=vi.fn();vi.stubGlobal('fetch',http);
  expect((await createPlatformExecutionHttp()(executionRequest(f.id,saved.plan.digest))).status).toBe(200);expect(http).not.toHaveBeenCalled();expect(await defaultPrisma.linkedInPostDraft.findUnique({where:{id:f.draft.id}})).toMatchObject({status:'scheduled',scheduledFor:f.scheduledFor});
 }finally{vi.unstubAllGlobals();vi.unstubAllEnvs()}
});
it.skipIf(!enabled)('default execution HTTP deletes only the reviewed recorded publication and preserves its identity',async()=>{
 try{const f=await deletionFixture(),a=await f.approved(true,false),saved=await f.requester.inspect(a.id),http=vi.fn(async()=>new Response(null,{status:204}));vi.stubGlobal('fetch',http);
  expect((await createPlatformExecutionHttp()(executionRequest(a.id,saved.plan.digest))).status).toBe(200);expect(http).toHaveBeenCalledTimes(1);expect(await defaultPrisma.linkedInPostDraft.findUnique({where:{id:f.draft.id}})).toMatchObject({status:'published',linkedinPostUrn:f.effect.target.postUrn});
 }finally{vi.unstubAllGlobals();vi.unstubAllEnvs()}
});
it.skipIf(!enabled)('concurrent actual preparation references create one proposal/event and a read-only recoverable reference',async()=>{
 try{
  const f=await postFixture(false,30000,false,false),requestId=randomUUID(),selection={operation:'publish',draftId:f.draft.id,connectionId:f.connection.id,expiresAt:new Date(Date.now()+20000).toISOString()},results=await Promise.all([f.requester.prepareGrowth(selection,requestId),f.requester.prepareGrowth(selection,requestId)]);
  expect(results[0].actionId).toBe(results[1].actionId);expect(results.map(r=>r.historical).sort()).toEqual([false,true]);
  const counts=await db.$queryRawUnsafe<Array<{count:bigint}>>('SELECT count(*) AS count FROM "PlatformGovernanceEvent" WHERE "actionId"=$1',results[0].actionId);expect(Number(counts[0].count)).toBe(1);
  expect(await f.requester.lookupGrowthPreparation(requestId)).toEqual({found:true,actionId:results[0].actionId,authority:'history_only'});
  const independent=await createDefaultPlatformRequestService({headers:new Headers({authorization:'Bearer '+mintDesktopToken(reviewer.sessionId)})});expect(await independent.lookupGrowthPreparation(requestId)).toEqual({found:false,authority:'history_only'});
 }finally{vi.unstubAllEnvs()}
});
it.skipIf(!enabled)('preparation replay cannot renew a consumed unknown or substitute changed source/deadline',async()=>{
 try{
  const f=await postFixture(false,30000,false,false),requestId=randomUUID(),selection={operation:'publish',draftId:f.draft.id,connectionId:f.connection.id,expiresAt:new Date(Date.now()+20000).toISOString()},prepared=await f.requester.prepareGrowth(selection,requestId),saved=await f.requester.inspect(prepared.actionId),independent=await createDefaultPlatformRequestService({headers:new Headers({authorization:'Bearer '+mintDesktopToken(reviewer.sessionId)})});
  await independent.review(prepared.actionId,0,saved.plan.digest);await f.requester.claim(prepared.actionId,1);const child=await f.requester.claimNextEffect(prepared.actionId);await f.requester.observeEffect(child.proof,'unknown');const original=await f.requester.inspect(prepared.actionId);
  await defaultPrisma.linkedInPostDraft.update({where:{id:f.draft.id},data:{body:'changed after unknown original'}});
  const recovered=await f.requester.prepareGrowth(selection,requestId);expect(recovered).toMatchObject({actionId:prepared.actionId,historical:true,authority:'proposal_reference_only'});expect(recovered.preview).toBeUndefined();expect(await f.requester.inspect(prepared.actionId)).toEqual(original);
  await expect(f.requester.prepareGrowth({...selection,expiresAt:new Date(Date.now()+10000).toISOString()},requestId)).rejects.toThrow();
 }finally{vi.unstubAllEnvs()}
});

import {createPlatformSourceHttp} from '../sourceHttp';
import {createPlatformHistoryHttp} from '../historyHttp';
import {createPlatformPreparationHttp} from '../preparationHttp';
import {createPlatformReviewHttp} from '../reviewHttp';
import {createPlatformSourceClient,createPlatformHistoryClient,createPlatformPreparationClient,createPlatformReviewClient,createPlatformExecutionClient} from '../../../../desktop/src/lib/platformReview';
it.skipIf(!enabled)('joins real desktop transport, prepared HTTP, HMAC, source review, requester execution and SQL history',async()=>{
 try{
  const f=await postFixture(false,30000,false,false),prepare=createPlatformPreparationHttp(),review=createPlatformReviewHttp(),execute=createPlatformExecutionHttp(),history=createPlatformHistoryHttp();let providerCalls=0;
  vi.stubGlobal('fetch',vi.fn(async(input:RequestInfo|URL,init?:RequestInit)=>{
   const url=typeof input==='string'?input:input instanceof URL?input.href:input.url;
   if(url==='https://fixture.example.test/api/desktop/platform-governance/history')return history(new Request(url,init));
   if(url==='https://fixture.example.test/api/desktop/platform-governance/prepare')return prepare(new Request(url,init));
   if(url==='https://fixture.example.test/api/desktop/platform-governance/review')return review(new Request(url,init));
   if(url==='https://fixture.example.test/api/desktop/platform-governance/execute')return execute(new Request(url,init));
   if(url==='https://api.linkedin.com/rest/posts'&&init?.method==='POST'){providerCalls++;return new Response(null,{status:201,headers:{'x-restli-id':'urn:li:share:composed-fixture'}})}
   throw Error('unexpected_simulated_destination');
  }));
  function context(sessionId:string){const config={apiBase:'https://fixture.example.test',sessionToken:mintDesktopToken(sessionId)};return {getConfig:()=>config,getRevision:()=>0,subscribe:()=>()=>{}}}
  const owner=context(actor.sessionId),other=context(reviewer.sessionId),proposal=createPlatformPreparationClient(owner),ownerReview=createPlatformReviewClient(owner),independent=createPlatformReviewClient(other),requester=createPlatformExecutionClient(owner),nonce=randomUUID();
  const receipt=await proposal.prepare({operation:'publish',draftId:f.draft.id,connectionId:f.connection.id,expiresAt:new Date(Date.now()+20000).toISOString()},nonce);expect(receipt.ok).toBe(true);if(!receipt.ok)throw Error('synthetic_preparation_failed');
  const saved=await ownerReview.inspect(receipt.data.actionId);if(!saved.ok)throw Error('synthetic_read_failed');expect(saved.data.status).toBe('proposed');expect((await ownerReview.approve(saved.data)).ok).toBe(false);
  expect((await independent.preview(saved.data)).ok).toBe(true);const approved=await independent.approve(saved.data);if(!approved.ok)throw Error('synthetic_independent_review_failed');expect(providerCalls).toBe(0);
  const result=await requester.execute(approved.data);expect(result.ok).toBe(true);if(!result.ok)throw Error('synthetic_execution_failed');expect(result.data).toMatchObject({status:'confirmed',attemptCount:1,requesterUserId:'requester',reviewerUserId:'reviewer'});
  expect((await requester.execute(approved.data)).ok).toBe(false);expect(providerCalls).toBe(1);
  const page=await createPlatformHistoryClient(owner).list(null);expect(page.ok).toBe(true);if(!page.ok)throw Error('synthetic_directory_failed');expect(page.data.entries.some(e=>e.actionId===receipt.data.actionId&&e.status==='confirmed')).toBe(true);expect(JSON.stringify(page.data)).not.toContain(actor.sessionId);expect(providerCalls).toBe(1);
  const lookup=await proposal.lookup(nonce);expect(lookup).toMatchObject({ok:true,data:{found:true,actionId:receipt.data.actionId,authority:'history_only'}});expect(await f.requester.inspect(receipt.data.actionId)).toMatchObject({status:'confirmed',attemptCount:1});
 }finally{vi.unstubAllGlobals();vi.unstubAllEnvs()}
});

it.skipIf(!enabled)('paginates actual historical SQL records without restoring the old session claim',async()=>{
 const s=service(),old=await ready(s),created=[] as string[];
 for(let i=0;i<24;i++)created.push(await s.propose(plan(),actor));
 const newer={userId:actor.userId,sessionId:'new-session'};
 const found=new Set<string>();let cursor:import('../historyContract').PlatformHistoryCursor|null=null;
 for(let i=0;i<10;i++){
  const page=await s.history(cursor,newer);
  expect(JSON.stringify(page)).not.toContain('requester-session');
  for(const entry of page.entries){expect(found.has(entry.actionId)).toBe(false);found.add(entry.actionId)}
  cursor=page.nextCursor;if(!cursor)break;
 }
 expect(cursor).toBeNull();expect(found.has(old)).toBe(true);expect(created.every(id=>found.has(id))).toBe(true);
 expect((await s.inspect(old,newer)).status).toBe('approved');
 await expect(s.claim(old,1,newer)).rejects.toThrow();
 expect((await s.inspect(old,newer)).attemptCount).toBe(0);
});

it.skipIf(!enabled)('discovers real metadata pages without credential/body exposure or a new platform action',async()=>{
 await identityFixtures();vi.stubEnv('DESKTOP_SESSION_SIGNING_KEY','synthetic-platform-key-'.repeat(3));vi.stubEnv('ADMIN_EMAILS','requester@example.test,reviewer@example.test');
 const http=vi.fn(async()=>{throw Error('no_external_source_reads')});vi.stubGlobal('fetch',http);
 try{
  const ids=Array.from({length:25},(_,i)=>'zzzz-catalog-'+String(i).padStart(3,'0'));
  for(const id of ids)await db.$executeRawUnsafe('INSERT INTO "LinkedInPostDraft" (id,title,hook,body,category,"updatedAt") VALUES ($1,$2,$3,$4,$5,clock_timestamp())',id,'Metadata label '.repeat(30),'private hook not catalog','private body not catalog','governance');
  const account=await defaultPrisma.linkedInAccountConnection.create({data:{ownerEmail:randomUUID()+'@example.test',linkedinUrn:'urn:li:person:catalog-fixture',organizationUrn:'urn:li:organization:catalog-fixture',accessToken:'synthetic-not-used',scopes:'w_organization_social',expiresAt:new Date(Date.now()+60000),status:'connected'}});
  const request={headers:new Headers({authorization:'Bearer '+mintDesktopToken(actor.sessionId)})},reader=await createDefaultPlatformRequestService(request);
  const counts=()=>db.$queryRawUnsafe('SELECT (SELECT count(*) FROM "PlatformGovernanceAction")::text AS actions,(SELECT count(*) FROM "PlatformGovernanceEvent")::text AS events');const before=await counts();
  const seen=new Set<string>();let cursor:string|null=null;
  for(let i=0;i<10;i++){
   const page=await reader.sources('drafts',cursor);expect(page.kind).toBe('drafts');
   for(const entry of page.entries){expect(seen.has(entry.id)).toBe(false);seen.add(entry.id);if(ids.includes(entry.id)){expect(entry.label).toHaveLength(240);expect(entry.labelTruncated).toBe(true)}}
   expect(JSON.stringify(page)).not.toMatch(/private hook not catalog|private body not catalog/);cursor=page.nextCursor;if(!cursor)break;
  }
  expect(cursor).toBeNull();expect(ids.every(id=>seen.has(id))).toBe(true);
  let accountFound=false;cursor=null;
  for(let i=0;i<10;i++){const page=await reader.sources('accounts',cursor);expect(page.kind).toBe('accounts');if(page.kind!=='accounts')throw Error('wrong_catalog');const selected=page.entries.find(e=>e.id===account.id);if(selected){expect(selected.author).toBe('urn:li:organization:catalog-fixture');accountFound=true}expect(JSON.stringify(page)).not.toMatch(/accessToken|ownerEmail|synthetic-not-used|refreshToken/);cursor=page.nextCursor;if(!cursor)break}
  expect(accountFound).toBe(true);
  const handle=createPlatformSourceHttp(),config={apiBase:'https://fixture.example.test',sessionToken:mintDesktopToken(actor.sessionId)};
  vi.stubGlobal('fetch',vi.fn(async(input:RequestInfo|URL,init?:RequestInit)=>{const url=String(input);if(url==='https://fixture.example.test/api/desktop/platform-governance/sources')return handle(new Request(url,init));return http()}));
  const client=createPlatformSourceClient({getConfig:()=>config,getRevision:()=>0,subscribe:()=>()=>{}});expect((await client.list('accounts',null)).ok).toBe(true);
  expect(await counts()).toEqual(before);expect(http).not.toHaveBeenCalled();
  await db.$executeRawUnsafe('UPDATE "DesktopSessionRecord" SET "revokedAt"=clock_timestamp() WHERE id=$1',actor.sessionId);await expect(reader.sources('accounts',null)).rejects.toThrow();expect(await counts()).toEqual(before);
 }finally{vi.unstubAllEnvs();vi.unstubAllGlobals()}
});
