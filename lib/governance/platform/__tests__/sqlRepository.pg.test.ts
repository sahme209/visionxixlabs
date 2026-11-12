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
import {preparePlatformLinkedInPost} from '@/lib/growth/linkedin/platformPostingPlan';
async function postFixture(){
 await identityFixtures();vi.stubEnv('DESKTOP_SESSION_SIGNING_KEY','synthetic-platform-key-'.repeat(3));vi.stubEnv('ADMIN_EMAILS','requester@example.test,reviewer@example.test');vi.stubEnv('LINKEDIN_POSTING_ENABLED','true');vi.stubEnv('LINKEDIN_REST_VERSION','202605');vi.stubEnv('CREDENTIAL_ENCRYPTION_KEY','synthetic-credential-key-'.repeat(3));
 const connection=await defaultPrisma.linkedInAccountConnection.create({data:{ownerEmail:randomUUID()+'@example.test',linkedinUrn:'urn:li:person:fixture',accessToken:encryptCredential('synthetic-linkedin-token'),scopes:'w_member_social',expiresAt:new Date(Date.now()+60000),status:'connected'},select:POST_CONNECTION_SELECT});
 const draft=await defaultPrisma.linkedInPostDraft.create({data:{title:'Fixture',hook:'Hook',body:'Body',category:'governance',status:'approved'},select:POST_DRAFT_SELECT}),effect=preparePlatformLinkedInPost(draft,connection,'202605',Date.now()).effect;
 const raw={format:1,scope:'platform',sourceDigest:d,expiresAt:new Date(Date.now()+60000).toISOString(),effects:[effect]},compiled=compilePlatformPlan(raw),request={headers:new Headers({authorization:'Bearer '+mintDesktopToken(actor.sessionId)})},requester=await createDefaultPlatformRequestService(request),id=await requester.propose(raw);
 const independent=await createDefaultPlatformRequestService({headers:new Headers({authorization:'Bearer '+mintDesktopToken(reviewer.sessionId)})});await independent.review(id,0,compiled.digest);
 return {draft,connection,effect,id,requester,request,binding:await createDefaultPlatformExecution(request,id,1)};
}
it.skipIf(!enabled)('joins actual default post source, credential crypto, human review and SQL ledger with simulated HTTP',async()=>{
 try{
  const f=await postFixture(),http=vi.fn(async()=>new Response('',{status:201,headers:{'x-restli-id':'urn:li:share:123'}}));vi.stubGlobal('fetch',http);
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
