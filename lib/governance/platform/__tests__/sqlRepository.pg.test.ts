import type {OperationalEcsTransport} from '../operations/ecsExecution';
import {afterAll,beforeAll,it,expect} from 'vitest';
import {createDatabaseClient} from '@/lib/database/createDatabaseClient';
import {createPlatformSqlRepository,type PlatformSqlDatabase} from '../sqlRepository';
import {createPlatformActionService,type PlatformRepository} from '../actionStore';
import {compilePlatformPlan,readPlatformAction} from '../kernel';
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
import {mintDesktopToken,verifyDesktopToken} from '@/lib/desktop/desktopToken';
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
import {deploySite,deploySiteFromPlan} from '@/lib/deploy/provider';
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
import * as templateSource from '@/lib/cloud/aws/platformTemplateSource';
async function templateFixture(beforeReview?:(id:string)=>void){
 await identityFixtures();vi.stubEnv('DESKTOP_SESSION_SIGNING_KEY','synthetic-platform-key-'.repeat(3));vi.stubEnv('ADMIN_EMAILS','requester@example.test,reviewer@example.test');vi.stubEnv('AWS_CONNECTOR_BROKER_ACCESS_KEY_ID','synthetic-key');vi.stubEnv('AWS_CONNECTOR_BROKER_SECRET_ACCESS_KEY','synthetic-secret');vi.stubEnv('AWS_SHARED_CREDENTIALS_FILE','/private/tmp/axiom-no-synthetic-aws-credentials');vi.stubEnv('AWS_CONFIG_FILE','/private/tmp/axiom-no-synthetic-aws-config');vi.stubEnv('AWS_PROFILE','axiom-synthetic');
 const bytes=readFileSync('public/aws/axiom-agent-quick-deploy.yaml'),accountId='123456789012',input={accountId,region:'us-east-2',objectVersion:'version-1',recipientDigest:'b'.repeat(64),ttlSeconds:3600};
 const effect=templateAccessEffect({...input,bytesDigest:createHash('sha256').update(bytes).digest('hex')});
 const request={headers:new Headers({authorization:'Bearer '+mintDesktopToken(actor.sessionId)})},requester=await createDefaultPlatformRequestService(request);
 const handler=createPlatformReviewHttp(),prepareHandler=createPlatformTemplatePreparationHttp();
 vi.spyOn(globalThis,'fetch').mockImplementation(async(input,init)=>{const url=String(input);if(url==='https://fixture.example.test/api/desktop/platform-governance/review')return handler(new Request(url,init));if(url==='https://fixture.example.test/api/desktop/platform-governance/template')return prepareHandler(new Request(url,init));throw Error('unexpected_external_destination')});
 function context(sessionId:string){const config={apiBase:'https://fixture.example.test',sessionToken:mintDesktopToken(sessionId)};return {getConfig:()=>config,getRevision:()=>0,subscribe:()=>()=>{}}}
 const client=createPlatformTemplateClient(context(actor.sessionId)),reference=randomUUID(),selection={...input,operation:'access',expiresAt:new Date(Date.now()+60000).toISOString()},saved=await client.prepare(selection,reference);
 expect(saved.ok).toBe(true);if(!saved.ok)throw Error('template_preparation_unavailable');const id=saved.data.actionId,compiled=(await requester.inspect(id)).plan;
 expect(await client.lookup(reference)).toMatchObject({ok:true,data:{found:true,actionId:id}});expect(await client.prepare(selection,reference)).toMatchObject({ok:true,data:{actionId:id,historical:true}});
 const preview=await createPlatformTemplateClient(context(reviewer.sessionId)).preview(await requester.inspect(id));
 expect(preview.ok).toBe(true);if(!preview.ok||preview.data.kind!=='template.source')throw Error('template_preview_unavailable');expect(preview.data.yaml).toBe(bytes.toString('utf8'));expect(preview.data.bytesDigest).toBe(effect.target.bytesDigest);
 const previewEvents=await db.$queryRawUnsafe<Array<{kind:string}>>('SELECT kind FROM "PlatformGovernanceEvent" WHERE "actionId"=$1',id);expect(previewEvents).toEqual([{kind:'proposed'}]);
 beforeReview?.(id);
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

import {createPlatformDeploymentHttp} from '../deploymentHttp';
import {createPlatformSourceHttp} from '../sourceHttp';
import {createPlatformHistoryHttp} from '../historyHttp';
import {createPlatformPreparationHttp} from '../preparationHttp';
import {createPlatformReviewHttp} from '../reviewHttp';
import {createPlatformTemplatePreparationHttp} from '../templatePreparationHttp';
import {createPlatformTemplateClient,createPlatformDeploymentClient,createPlatformSourceClient,createPlatformHistoryClient,createPlatformPreparationClient,createPlatformReviewClient,createPlatformExecutionClient} from '../../../../desktop/src/lib/platformReview';
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
  const leadIds=Array.from({length:25},(_,i)=>'zzzz-catalog-lead-'+String(i).padStart(3,'0'));
  for(const id of leadIds)await db.$executeRawUnsafe('INSERT INTO "Lead" (id,"updatedAt","fullPayload") VALUES ($1,clock_timestamp(),$2::jsonb)',id,JSON.stringify({aiPackage:{companyName:'Lead company '.repeat(30)},email:'private-lead@example.test',privateToken:'never-in-catalog'}));
  const leads=new Set<string>();cursor=null;
  for(let i=0;i<10;i++){const page=await reader.sources('leads',cursor);expect(page.kind).toBe('leads');if(page.kind!=='leads')throw Error('wrong_catalog');for(const e of page.entries){expect(leads.has(e.id)).toBe(false);leads.add(e.id);if(leadIds.includes(e.id)){expect(e.label).toHaveLength(240);expect(e.labelTruncated).toBe(true);expect(e.hasSavedPackage).toBe(true)}}expect(JSON.stringify(page)).not.toMatch(/aiPackage|fullPayload|private-lead|never-in-catalog/);cursor=page.nextCursor;if(!cursor)break}expect(cursor).toBeNull();expect(leadIds.every(id=>leads.has(id))).toBe(true);
  const handle=createPlatformSourceHttp(),config={apiBase:'https://fixture.example.test',sessionToken:mintDesktopToken(actor.sessionId)};
  vi.stubGlobal('fetch',vi.fn(async(input:RequestInfo|URL,init?:RequestInit)=>{const url=String(input);if(url==='https://fixture.example.test/api/desktop/platform-governance/sources')return handle(new Request(url,init));return http()}));
  const client=createPlatformSourceClient({getConfig:()=>config,getRevision:()=>0,subscribe:()=>()=>{}});expect((await client.list('accounts',null)).ok).toBe(true);expect((await client.list('leads',null)).ok).toBe(true);
  expect(await counts()).toEqual(before);expect(http).not.toHaveBeenCalled();
  await db.$executeRawUnsafe('UPDATE "DesktopSessionRecord" SET "revokedAt"=clock_timestamp() WHERE id=$1',actor.sessionId);await expect(reader.sources('accounts',null)).rejects.toThrow();expect(await counts()).toEqual(before);
 }finally{vi.unstubAllEnvs();vi.unstubAllGlobals()}
});

import {preparePlatformLeadDeployment} from '@/lib/deploy/platformLeadSource';
it.skipIf(!enabled)('prepares exact real SQL lead source and refuses source changes at independent review',async()=>{
 await identityFixtures();vi.stubEnv('DESKTOP_SESSION_SIGNING_KEY','synthetic-platform-key-'.repeat(3));vi.stubEnv('ADMIN_EMAILS','requester@example.test,reviewer@example.test');vi.stubEnv('VERCEL_TEAM_ID','team_fixture');
 try{
  const leadId='lead-source-'+randomUUID(),pkg={companyName:'Fixture',tagline:'Exact existing source',aboutText:'About',services:['Service'],contactEmail:'fixture@example.test'};
  await db.$executeRawUnsafe('INSERT INTO "Lead" (id,"updatedAt","fullPayload") VALUES ($1,clock_timestamp(),$2::jsonb)',leadId,JSON.stringify({aiPackage:pkg,privateUnrelated:'must-not-enter-plan'}));
  const request={headers:new Headers({authorization:'Bearer '+mintDesktopToken(actor.sessionId)})},requester=await createDefaultPlatformRequestService(request),nonce=randomUUID(),selected={leadId,projectName:'source-reviewed-project',environment:'preview',expiresAt:new Date(Date.now()+20000).toISOString()};
  const handle=createPlatformDeploymentHttp(),config={apiBase:'https://fixture.example.test',sessionToken:mintDesktopToken(actor.sessionId)};
  vi.stubGlobal('fetch',vi.fn(async(input:RequestInfo|URL,init?:RequestInit)=>{const url=String(input);if(url!=='https://fixture.example.test/api/desktop/platform-governance/deployment')throw Error('unexpected_external_destination');return handle(new Request(url,init))}));
  const client=createPlatformDeploymentClient({getConfig:()=>config,getRevision:()=>0,subscribe:()=>()=>{}}),receipt=await client.prepare(selected,nonce);expect(receipt.ok).toBe(true);if(!receipt.ok)throw Error('prepared_deployment_failed');const saved=receipt.data,repeated=await requester.prepareDeployment(selected,nonce);expect(repeated).toMatchObject({actionId:saved.actionId,historical:true});
  const previewResponse=await client.preview(await requester.inspect(saved.actionId));expect(previewResponse.ok).toBe(true);if(!previewResponse.ok)throw Error('deployment_preview_failed');const preview=previewResponse.data;expect(preview.files.some(f=>f.content.includes('Exact existing source'))).toBe(true);expect(JSON.stringify(preview)).not.toContain('must-not-enter-plan');
  const inspected=await requester.inspect(saved.actionId);expect(inspected.plan.effects[0]).toMatchObject({kind:'deployment.vercel',target:{leadId,teamId:'team_fixture',projectName:'source-reviewed-project'}});
  await expect(requester.review(saved.actionId,0,inspected.plan.digest)).rejects.toThrow();
  const independent=await createDefaultPlatformRequestService({headers:new Headers({authorization:'Bearer '+mintDesktopToken(reviewer.sessionId)})});expect((await independent.previewDeployment(saved.actionId)).planDigest).toBe(preview.planDigest);
  await db.$executeRawUnsafe('UPDATE "Lead" SET "fullPayload"=jsonb_set("fullPayload",\'{aiPackage,tagline}\',\'"Changed after preview"\'::jsonb),"updatedAt"=clock_timestamp() WHERE id=$1',leadId);
  await expect(independent.review(saved.actionId,0,inspected.plan.digest)).rejects.toThrow();expect((await requester.inspect(saved.actionId)).status).toBe('proposed');
  expect(await client.lookup(nonce)).toMatchObject({ok:true,data:{found:true,actionId:saved.actionId}});
  expect(await requester.lookupDeploymentPreparation(nonce)).toMatchObject({found:true,actionId:saved.actionId});expect(await requester.lookupGrowthPreparation(nonce)).toMatchObject({found:false});
  expect(await requester.prepareDeployment(selected,nonce)).toMatchObject({actionId:saved.actionId,historical:true});await expect(requester.prepareDeployment({...selected,projectName:'substitute'},nonce)).rejects.toThrow();
 }finally{vi.unstubAllEnvs();vi.unstubAllGlobals()}
});
it.skipIf(!enabled)('joins SQL-derived lead review to one default provider effect with simulated HTTP',async()=>{
 await identityFixtures();vi.stubEnv('DESKTOP_SESSION_SIGNING_KEY','synthetic-platform-key-'.repeat(3));vi.stubEnv('ADMIN_EMAILS','requester@example.test,reviewer@example.test');vi.stubEnv('VERCEL_TEAM_ID','team_fixture');vi.stubEnv('VERCEL_TOKEN','synthetic-token');
 try{
  const leadId='lead-effect-'+randomUUID(),pkg={companyName:'Fixture',tagline:'Reviewed',aboutText:'About',services:['Service'],contactEmail:'fixture@example.test'};
  await db.$executeRawUnsafe('INSERT INTO "Lead" (id,"updatedAt","fullPayload") VALUES ($1,clock_timestamp(),$2::jsonb)',leadId,JSON.stringify({aiPackage:pkg}));
  const request={headers:new Headers({authorization:'Bearer '+mintDesktopToken(actor.sessionId)})},requester=await createDefaultPlatformRequestService(request),saved=await requester.prepareDeployment({leadId,projectName:'source-reviewed-project',environment:'preview',expiresAt:new Date(Date.now()+20000).toISOString()},randomUUID()),record=await requester.inspect(saved.actionId);
  const independent=await createDefaultPlatformRequestService({headers:new Headers({authorization:'Bearer '+mintDesktopToken(reviewer.sessionId)})});await independent.review(saved.actionId,0,record.plan.digest);
  const rows=await db.$queryRawUnsafe<Array<{id:string;updatedAt:Date;aiPackage:unknown}>>('SELECT id,"updatedAt","fullPayload"->\'aiPackage\' AS "aiPackage" FROM "Lead" WHERE id=$1',leadId),source=preparePlatformLeadDeployment(rows[0],{leadId,projectName:'source-reviewed-project',environment:'preview',expiresAt:record.plan.expiresAt},'team_fixture',Date.now());
  expect(source.plan.digest).toBe(record.plan.digest);const binding=await createDefaultPlatformExecution(request,saved.actionId,1),http=vi.fn(async()=>Response.json({id:'dpl_leadsource',readyState:'BUILDING'}));vi.stubGlobal('fetch',http);
  expect(await deploySite('vercel',source.package,{projectName:'source-reviewed-project',effectId:record.plan.effects[0].id,source:{leadId,leadRevision:rows[0].updatedAt.toISOString()},platformExecution:binding})).toMatchObject({deploymentId:'dpl_leadsource',state:'BUILDING'});expect(http).toHaveBeenCalledTimes(1);expect((await requester.inspect(saved.actionId)).status).toBe('confirmed');
  await expect(deploySite('vercel',source.package,{projectName:'source-reviewed-project',effectId:record.plan.effects[0].id,source:{leadId,leadRevision:rows[0].updatedAt.toISOString()},platformExecution:binding})).rejects.toThrow();expect(http).toHaveBeenCalledTimes(1);
 }finally{vi.unstubAllEnvs();vi.unstubAllGlobals()}
});
it.skipIf(!enabled)('changed lead after claim refuses the final default send and retains one unknown attempt',async()=>{
 await identityFixtures();vi.stubEnv('DESKTOP_SESSION_SIGNING_KEY','synthetic-platform-key-'.repeat(3));vi.stubEnv('ADMIN_EMAILS','requester@example.test,reviewer@example.test');vi.stubEnv('VERCEL_TEAM_ID','team_fixture');vi.stubEnv('VERCEL_TOKEN','synthetic-token');
 try{
  const leadId='lead-changed-'+randomUUID(),pkg={companyName:'Fixture',tagline:'Reviewed',aboutText:'About',services:['Service'],contactEmail:'fixture@example.test'},expiresAt=new Date(Date.now()+20000).toISOString();
  await db.$executeRawUnsafe('INSERT INTO "Lead" (id,"updatedAt","fullPayload") VALUES ($1,clock_timestamp(),$2::jsonb)',leadId,JSON.stringify({aiPackage:pkg}));
  const request={headers:new Headers({authorization:'Bearer '+mintDesktopToken(actor.sessionId)})},requester=await createDefaultPlatformRequestService(request),saved=await requester.prepareDeployment({leadId,projectName:'source-reviewed-project',environment:'preview',expiresAt},randomUUID()),record=await requester.inspect(saved.actionId),independent=await createDefaultPlatformRequestService({headers:new Headers({authorization:'Bearer '+mintDesktopToken(reviewer.sessionId)})});await independent.review(saved.actionId,0,record.plan.digest);
  const rows=await db.$queryRawUnsafe<Array<{id:string;updatedAt:Date;aiPackage:unknown}>>('SELECT id,"updatedAt","fullPayload"->\'aiPackage\' AS "aiPackage" FROM "Lead" WHERE id=$1',leadId),binding=await createDefaultPlatformExecution(request,saved.actionId,1),http=vi.fn(async()=>Response.json({id:'dpl_never_sent'}));vi.stubGlobal('fetch',http);
  await db.$executeRawUnsafe('UPDATE "Lead" SET "fullPayload"=jsonb_set("fullPayload",\'{aiPackage,tagline}\',\'"Changed after claim"\'::jsonb),"updatedAt"=clock_timestamp() WHERE id=$1',leadId);
  await expect(deploySite('vercel',pkg,{projectName:'source-reviewed-project',effectId:record.plan.effects[0].id,source:{leadId,leadRevision:rows[0].updatedAt.toISOString()},platformExecution:binding})).rejects.toThrow();expect(http).not.toHaveBeenCalled();expect(await requester.inspect(saved.actionId)).toMatchObject({status:'unknown',attemptCount:1});await expect(requester.claim(saved.actionId,3)).rejects.toThrow();
 }finally{vi.unstubAllEnvs();vi.unstubAllGlobals()}
});

it.skipIf(!enabled)('keeps changed-template review proposed with zero attempts or provider calls in actual SQL',async()=>{
 let id='';
 try{
  const sts=vi.spyOn(STSClient.prototype,'send'),s3=vi.spyOn(S3Client.prototype,'send');
  await expect(templateFixture(saved=>{id=saved;vi.spyOn(templateSource,'readPlatformTemplateBytes').mockResolvedValue(Buffer.from('changed synthetic source'))})).rejects.toThrow();
  expect(id).not.toBe('');expect(sts).not.toHaveBeenCalled();expect(s3).not.toHaveBeenCalled();
  const rows=await db.$queryRawUnsafe<Array<{stateJson:{status:string;version:number;attemptCount:number}}>>('SELECT "stateJson" FROM "PlatformGovernanceAction" WHERE id=$1',id);
  expect(rows[0].stateJson).toMatchObject({status:'proposed',version:0,attemptCount:0});
  const events=await db.$queryRawUnsafe<Array<{kind:string}>>('SELECT kind FROM "PlatformGovernanceEvent" WHERE "actionId"=$1',id);expect(events).toEqual([{kind:'proposed'}]);
 }finally{vi.restoreAllMocks();vi.unstubAllEnvs()}
});
it.skipIf(!enabled)('joins prepared canonical bucket target review with actual HMAC and SQL but no AWS calls',async()=>{
 try{
  await identityFixtures();vi.stubEnv('DESKTOP_SESSION_SIGNING_KEY','synthetic-platform-key-'.repeat(3));vi.stubEnv('ADMIN_EMAILS','requester@example.test,reviewer@example.test');
  const sts=vi.spyOn(STSClient.prototype,'send'),s3=vi.spyOn(S3Client.prototype,'send'),prepare=createPlatformTemplatePreparationHttp(),review=createPlatformReviewHttp();
  vi.stubGlobal('fetch',vi.fn(async(input:RequestInfo|URL,init?:RequestInit)=>{const url=String(input);if(url==='https://fixture.example.test/api/desktop/platform-governance/template')return prepare(new Request(url,init));if(url==='https://fixture.example.test/api/desktop/platform-governance/review')return review(new Request(url,init));throw Error('unexpected_external_destination')}));
  function context(sessionId:string){const config={apiBase:'https://fixture.example.test',sessionToken:mintDesktopToken(sessionId)};return {getConfig:()=>config,getRevision:()=>0,subscribe:()=>()=>{}}}
  const owner=context(actor.sessionId),other=context(reviewer.sessionId),saved=await createPlatformTemplateClient(owner).prepare({operation:'create_bucket',accountId:'123456789012',region:'us-east-2',expiresAt:new Date(Date.now()+60000).toISOString()},randomUUID());if(!saved.ok)throw Error('bucket_preparation_unavailable');
  const record=await createPlatformReviewClient(other).inspect(saved.data.actionId);if(!record.ok)throw Error('bucket_history_unavailable');
  const preview=await createPlatformTemplateClient(other).preview(record.data);expect(preview).toMatchObject({ok:true,data:{kind:'template.bucket',target:{accountId:'123456789012',region:'us-east-2',bucket:'axiom-cfn-templates-123456789012'},ownership:'not_observed'}});
  const approved=await createPlatformReviewClient(other).approve(record.data);expect(approved).toMatchObject({ok:true,data:{status:'approved',attemptCount:0,reviewerUserId:reviewer.userId}});expect(sts).not.toHaveBeenCalled();expect(s3).not.toHaveBeenCalled();
  const effects=await db.$queryRawUnsafe<Array<{count:bigint}>>('SELECT count(*) AS count FROM "PlatformGovernanceEffect" WHERE "actionId"=$1',saved.data.actionId);expect(Number(effects[0].count)).toBe(0);
 }finally{vi.restoreAllMocks();vi.unstubAllEnvs();vi.unstubAllGlobals()}
});

import {createManualReleaseStore,type ManualReleaseRepository} from '../operations/manualReleaseStore';
import {createManualReleaseSqlRepository} from '../operations/manualReleaseSqlRepository';
import {assertCurrentPlatformPrincipal} from '../currentAuthority';
import {createManualReleaseSource} from '../operations/releasePreparation';
function manualFixture(repo?:ManualReleaseRepository){
 const evidenceId='platform_evidence_11111111-1111-4111-8111-111111111111',expiresAt=new Date(Date.now()+60000).toISOString();
 const manifest={format:1,scope:'platform',kind:'release.manual',expiresAt,source:{repository:'sahme209/visionxixlabs',branch:'main',commit:'b'.repeat(40)},target:{projectId:'prj_fixture',teamId:'team_fixture',environment:'production'},sourceHashes:{workflow:d,build:d,configuration:d,lock:d,schema:d},artifactEvidenceId:evidenceId,ciEvidence:[{name:'Typecheck + Vitest',receiptId:evidenceId,commit:'b'.repeat(40)}],compatibilityEvidenceId:evidenceId,recoveryEvidenceId:evidenceId,smokeProfileId:'production-smoke-v1'};
 const validity={observedAt:new Date().toISOString(),expiresAt};
 const source=createManualReleaseSource({readBundle:async()=>({format:1,evidenceId:evidenceId,...validity,currentMainCommit:manifest.source.commit,profile:{id:'synthetic-fixture-profile',revision:d,requiredChecks:['Typecheck + Vitest']},manifest,checks:[{name:'Typecheck + Vitest',receiptId:evidenceId,commit:manifest.source.commit,status:'completed',conclusion:'success'}],artifact:{receiptId:evidenceId,commit:manifest.source.commit,target:manifest.target,sourceHashes:manifest.sourceHashes,artifactSha256:d},compatibility:{receiptId:evidenceId,schemaSha256:d,databaseTargetDigest:d,...validity},recovery:{receiptId:evidenceId,schemaSha256:d,databaseTargetDigest:d,...validity}}),assertQualified:async()=>{}});
 const repository=repo??createManualReleaseSqlRepository(db as unknown as PlatformSqlDatabase);
 return {repository,source,selection:{manifestEvidenceId:evidenceId,expiresAt},store:createManualReleaseStore(repository,{assertCurrent:(tx,p)=>assertCurrentPlatformPrincipal(tx,p,()=>['requester@example.test','reviewer@example.test'])},source)};
}
import {createManualReleaseRequestComposition} from '../operations/manualReleaseRequest';
import {createDefaultManualReleaseRequestService} from '../operations/manualReleaseRequestService';
it.skipIf(!enabled)('stores separately reviewed manual notices once with actual current identity SQL and no executable action',async()=>{
 await identityFixtures();const f=manualFixture(),requestId='33333333-3333-4333-8333-333333333333';
 const saved=await Promise.all([f.store.prepare(f.selection,actor,requestId),f.store.prepare(f.selection,actor,requestId)]);expect(saved[0].recordId).toBe(saved[1].recordId);
 const id=saved[0].recordId,view=await f.store.inspect(id,reviewer);await expect(f.store.review(id,0,view.manifest.digest,actor)).rejects.toThrow();await f.store.review(id,0,view.manifest.digest,reviewer);
 vi.stubEnv('DESKTOP_SESSION_SIGNING_KEY','synthetic-platform-key-'.repeat(3));vi.stubEnv('ADMIN_EMAILS','requester@example.test,reviewer@example.test');
 let outcomes:PromiseSettledResult<unknown>[];
 try{
  const headers=new Headers({authorization:'Bearer '+mintDesktopToken(actor.sessionId)}),request={headers};
  const live=await createManualReleaseRequestComposition(request,{repo:f.repository,source:f.source,verifyDesktopToken,readAdminEmails:()=>['requester@example.test','reviewer@example.test'],resultSupplier:{readExact:async(manifest,deploymentId)=>({deploymentId,receiptId:'platform_evidence_11111111-1111-4111-8111-111111111111',...manifest.target,commit:manifest.source.commit,providerState:'BUILDING',observedAt:new Date().toISOString(),expiresAt:new Date(Date.now()+60000).toISOString()}),assertQualified:async()=>{},assertReadyEvidence:async()=>{throw Error('synthetic smoke unavailable')}}});
  const defaultReader=await createDefaultManualReleaseRequestService(request);expect(await defaultReader.inspect(id)).toMatchObject({status:'reviewed',ownerAuthorization:'external_not_verified'});
  await expect(defaultReader.prepare(f.selection,'55555555-5555-4555-8555-555555555555')).rejects.toThrow('manual_release_source_qualification_unavailable');
  outcomes=await Promise.allSettled([live.recordNotice(id,1),live.recordNotice(id,1)]);
  expect(await live.inspectResult(id,'dpl_fixture')).toMatchObject({state:'pending',providerExecution:false,executionAuthorized:false,ownerAuthorization:'external_not_verified'});
  await expect(defaultReader.inspectResult(id,'dpl_fixture')).rejects.toThrow();
 }finally{vi.unstubAllEnvs()}
expect(outcomes.filter(r=>r.status==='fulfilled')).toHaveLength(1);
 expect(await f.store.inspect(id,actor)).toMatchObject({status:'notice_recorded',attemptCount:1,version:3,providerExecution:false,ownerAuthorization:'external_not_verified'});
 const events=await db.$queryRawUnsafe<Array<{detailJson:unknown}>>('SELECT "detailJson" FROM "PlatformManualReleaseEvent" WHERE "recordId"=$1 ORDER BY sequence',id);expect(events).toHaveLength(4);expect(JSON.stringify(events)).not.toContain(actor.sessionId);
 expect(await db.$queryRawUnsafe('SELECT id FROM "PlatformGovernanceAction" WHERE id=$1',id)).toEqual([]);
});
it.skipIf(!enabled)('rolls manual review/event back atomically and refuses notice after actual reviewer revocation',async()=>{
 await identityFixtures();const f=manualFixture(),{recordId:id}=await f.store.prepare(f.selection,actor,'44444444-4444-4444-8444-444444444444'),view=await f.store.inspect(id,actor);
 const broken=manualFixture({transaction:fn=>f.repository.transaction(tx=>fn({...tx,event:async()=>{throw Error('synthetic_event_failure')}}))});await expect(broken.store.review(id,0,view.manifest.digest,reviewer)).rejects.toThrow();expect(await f.store.inspect(id,actor)).toMatchObject({status:'proposed',version:0});
 await f.store.review(id,0,view.manifest.digest,reviewer);await db.$executeRawUnsafe('UPDATE "DesktopSessionRecord" SET "revokedAt"=clock_timestamp() WHERE id=$1',reviewer.sessionId);await expect(f.store.recordNotice(id,1,actor)).rejects.toThrow();
 expect(await f.store.inspect(id,actor)).toMatchObject({status:'reviewed',attemptCount:0});await expect(f.store.inspect(id,reviewer)).rejects.toThrow();
});

import {generateKeyPair,exportJWK,SignJWT} from 'jose';
import {createOperationalWorkloadIdentity} from '../operations/workloadIdentity';
import {createOperationalDelegationStore,type OperationalCredentialIssuer} from '../operations/delegation';
import type {OperationalDelegationRepository} from '../operations/delegationContract';
import {compileOperationalManifest} from '../operations/kernel';
import {createOperationalTargetReservations} from '../operations/reservationStore';
let operationalKeys:ReturnType<typeof generateKeyPair>|undefined;
async function operationalFixture(options:{serviceName?:string;short?:boolean;operation?:'force'|'rollback';condition?:unknown;taskDefinitionArn?:string;currentTaskDefinitionArn?:string;issuer?:OperationalCredentialIssuer;transport?:OperationalEcsTransport}={}){
 await identityFixtures();vi.stubEnv('DESKTOP_SESSION_SIGNING_KEY','synthetic-platform-key-'.repeat(3));vi.stubEnv('ADMIN_EMAILS','requester@example.test,reviewer@example.test');
 const serviceName=options.serviceName??'fixture-'+randomUUID(),commit='b'.repeat(40),manifest=compileOperationalManifest({format:1,scope:'platform',kind:'deployment.ecs',operation:options.operation??'force',...(options.operation==='rollback'?{condition:options.condition}:{}),expiresAt:new Date(Date.now()+300000).toISOString(),target:{accountId:'123456789012',region:'us-east-2',clusterArn:'arn:aws:ecs:us-east-2:123456789012:cluster/fixture',serviceArn:'arn:aws:ecs:us-east-2:123456789012:service/'+(options.short?'':'fixture/')+serviceName,taskDefinitionArn:options.taskDefinitionArn??'arn:aws:ecs:us-east-2:123456789012:task-definition/service:2'},roleArn:'arn:aws:iam::123456789012:role/fixture',workload:{repository:'sahme209/visionxixlabs',ref:'refs/heads/main',commit,workflowCommit:commit,workflowPath:'.github/workflows/axiom-deploy-aws-ecs.yml',workflowSha256:d,runId:'12345',attempt:1},sourceEvidenceId:'platform_evidence_'+randomUUID()});if(manifest.kind!=='deployment.ecs')throw Error('fixture');
 const plan=compilePlatformPlan({format:1,scope:'platform',sourceDigest:manifest.digest,expiresAt:manifest.expiresAt,effects:[{id:'ecs',kind:'deployment.ecs',target:{accountId:manifest.target.accountId,region:manifest.target.region,cluster:manifest.target.clusterArn,service:manifest.target.serviceArn,taskDefinitionArn:manifest.target.taskDefinitionArn,operation:manifest.operation,configurationDigest:manifest.digest}}]});
 const repo=createPlatformSqlRepository(db as unknown as PlatformSqlDatabase),authority=createCurrentPlatformAuthority(()=>['requester@example.test','reviewer@example.test']);
 const {digest:ignoredManifestDigest,authority:ignoredAuthority,executionAuthorized:ignoredExecution,...selection}=manifest;
 const prepared=await createEcsPreparationStore(repo,authority,{assertCurrent:async()=>{}}).prepare(selection,randomUUID(),actor),id=prepared.actionId;
 const requester=await createDefaultPlatformRequestService({headers:new Headers({authorization:'Bearer '+mintDesktopToken(actor.sessionId)})});
 const reviewHttp=createOperationalHttp(request=>createOperationalDelegationRequestComposition(request,{repo,source:{readManifest:async(tx)=>tx.readEcsManifest(id),assertCurrent:async()=>{}},identity:createOperationalWorkloadIdentity({readProfile:async()=>{throw Error('unused')},assertProfileCurrent:async()=>{throw Error('unused')}}),preparationSource:{assertCurrent:async()=>{}},verifyDesktopToken,readAdminEmails:()=>['requester@example.test','reviewer@example.test']}));
 const reviewResponse=await reviewHttp(new Request('http://fixture.invalid/operations',{method:'POST',headers:{authorization:'Bearer '+mintDesktopToken(reviewer.sessionId)},body:JSON.stringify({operation:'review',actionId:id,expectedVersion:0,planDigest:plan.digest})}));expect(reviewResponse.status).toBe(200);
 operationalKeys??=generateKeyPair('RS256');const keys=await operationalKeys,key=await exportJWK(keys.publicKey),subject='repo:sahme209/visionxixlabs:ref:refs/heads/main';
 const profile={format:1,issuer:'https://token.actions.githubusercontent.com',audience:'axiom-synthetic-release',subject,repository:'sahme209/visionxixlabs',repositoryId:'123',repositoryOwnerId:'456',workflowPath:manifest.workload.workflowPath,workflowCommit:commit,workflowSha256:d,maximumLifetimeSeconds:300,keys:[{...key,alg:'RS256',use:'sig',kid:'fixture-key'}]};
 const profiles={readProfile:vi.fn(async()=>profile),assertProfileCurrent:vi.fn(async()=>{})},identity=createOperationalWorkloadIdentity(profiles),source={readManifest:async(tx:import('../operations/delegationContract').OperationalDelegationTransaction,parent:import('../contracts').PlatformAction)=>tx.readEcsManifest(id),assertCurrent:async()=>{}};
 let nativeOutcome:unknown=null;
 const nativeSource={assertPriorCredentialClosed:vi.fn(async()=>'platform_evidence_'+randomUUID()),readSnapshot:vi.fn(async()=>({receiptId:manifest.sourceEvidenceId,target:{...manifest.target,taskDefinitionArn:options.currentTaskDefinitionArn??'arn:aws:ecs:us-east-2:123456789012:task-definition/service:1'},deploymentId:'ecs-svc/1',observedAt:new Date().toISOString(),expiresAt:new Date(Date.now()+600000).toISOString(),profileDigest:d})),assertSnapshotCurrent:vi.fn(async()=>{}),readOutcome:vi.fn(async()=>nativeOutcome),assertOutcomeCurrent:vi.fn(async()=>{})};
 const targets=createOperationalTargetReservations(nativeSource),store=createOperationalDelegationStore(repo,authority,source,identity,targets,options.issuer,options.transport);
 function setNativeOutcome(kind:string,deploymentId:string|null='ecs-svc/2',generation=1){const receiptId='platform_evidence_'+randomUUID();nativeOutcome={receiptId,actionId:id,manifestDigest:manifest.digest,target:manifest.target,generation,kind,deploymentId,observedAt:new Date().toISOString(),profileDigest:d};return receiptId}
 const targetBinding={actionId:id,manifest};
 const observe=async(generation=1)=>repo.transaction(async tx=>{await tx.lock(id);return targets.observe(tx,targetBinding,generation)});

 async function token(jti:string){const at=Math.floor(Date.now()/1000);return new SignJWT({iss:profile.issuer,aud:profile.audience,sub:subject,jti,iat:at,nbf:at,exp:at+120,repository:profile.repository,repository_id:'123',repository_owner_id:'456',repository_owner:'sahme209',repository_visibility:'public',event_name:'workflow_dispatch',ref_type:'branch',runner_environment:'github-hosted',ref:'refs/heads/main',sha:commit,workflow_ref:profile.repository+'/'+profile.workflowPath+'@refs/heads/main',workflow_sha:commit,run_id:'12345',run_attempt:'1'}).setProtectedHeader({alg:'RS256',typ:'JWT',kid:'fixture-key',x5t:'synthetic-thumbprint'}).sign(keys.privateKey)}
 return {id,plan,manifest,requester,identity,source,profiles,repo,authority,store,token,targets,nativeSource,setNativeOutcome,observe};
}
it.skipIf(!enabled)('joins actual paired review, requester delegation, signed workload claim and durable credential liability without a provider send',async()=>{
 try{const f=await operationalFixture();await expect(f.requester.claim(f.id,1)).rejects.toThrow();await expect(f.store.delegate(f.id,1,f.plan.digest,reviewer)).rejects.toThrow();await f.store.delegate(f.id,1,f.plan.digest,actor);
  const jwt=await f.token('pg-credential-liability'),claims=await Promise.allSettled([f.store.claim(f.id,0,jwt),f.store.claim(f.id,0,jwt)]),success=claims.find(v=>v.status==='fulfilled');expect(success?.status).toBe('fulfilled');if(!success||success.status!=='fulfilled')throw Error('missing claim');
  const pending=await f.store.beginCredential(success.value.proof);await db.$executeRawUnsafe('UPDATE "DesktopSessionRecord" SET "revokedAt"=clock_timestamp() WHERE id=$1',reviewer.sessionId);await f.store.observeCredential(pending.proof,{status:'issued',leaseRef:'platform_credential_11111111-1111-4111-8111-111111111111',expiresAt:Date.now()+900000});
  expect(await f.store.inspect(f.id,actor)).toMatchObject({status:'claimed',version:3,attemptCount:1,executionPrincipal:{kind:'workload'},credential:{status:'issued'},providerExecution:false,executionAuthorized:false});
  const events=await db.$queryRawUnsafe<Array<{kind:string;detailJson:unknown}>>('SELECT kind,"detailJson" FROM "PlatformGovernanceEvent" WHERE "actionId"=$1 ORDER BY sequence',f.id);expect(events.map(e=>e.kind)).toEqual(['proposed','approved','workload.delegated','workload.claimed','credential.pending','credential.observed']);expect(JSON.stringify(events)).not.toContain(jwt);expect(JSON.stringify(events)).not.toContain(actor.sessionId);
  const replay=await db.$queryRawUnsafe<Array<{count:bigint}>>('SELECT count(*) AS count FROM "PlatformOperationalWorkloadUse" WHERE "actionId"=$1',f.id);expect(Number(replay[0].count)).toBe(1);
 }finally{vi.unstubAllEnvs()}
});
it.skipIf(!enabled)('refuses one signed workload token replayed against a second approved action in real SQL',async()=>{
 try{const a=await operationalFixture(),b=await operationalFixture();await a.store.delegate(a.id,1,a.plan.digest,actor);await b.store.delegate(b.id,1,b.plan.digest,actor);const token=await a.token('pg-cross-action-replay');await a.store.claim(a.id,0,token);await expect(b.store.claim(b.id,0,token)).rejects.toThrow();expect(await b.store.inspect(b.id,actor)).toMatchObject({status:'delegated',attemptCount:0});const rows=await db.$queryRawUnsafe<Array<{stateJson:{status:string}}>>('SELECT "stateJson" FROM "PlatformGovernanceAction" WHERE id=$1',b.id);expect(rows[0].stateJson.status).toBe('approved');
 }finally{vi.unstubAllEnvs()}
});
it.skipIf(!enabled)('rolls actual parent, delegation and replay reservation back on an event failure',async()=>{
 try{const f=await operationalFixture();await f.store.delegate(f.id,1,f.plan.digest,actor);const broken:OperationalDelegationRepository={transaction:fn=>f.repo.transaction(tx=>fn({...tx,event:async()=>{throw Error('synthetic event outage')}}))},s=createOperationalDelegationStore(broken,f.authority,f.source,f.identity,f.targets);await expect(s.claim(f.id,0,await f.token('pg-rolled-back-replay'))).rejects.toThrow();expect(await f.store.inspect(f.id,actor)).toMatchObject({status:'delegated',version:0,attemptCount:0});const rows=await db.$queryRawUnsafe<Array<{stateJson:{status:string}}>>('SELECT "stateJson" FROM "PlatformGovernanceAction" WHERE id=$1',f.id);expect(rows[0].stateJson.status).toBe('approved');expect(await db.$queryRawUnsafe('SELECT "replayKey" FROM "PlatformOperationalWorkloadUse" WHERE "actionId"=$1',f.id)).toEqual([]);
 }finally{vi.unstubAllEnvs()}
});
it.skipIf(!enabled)('preserves an actually committed workload claim when its acknowledgement is lost and never reclaims it',async()=>{
 try{const f=await operationalFixture();await f.store.delegate(f.id,1,f.plan.digest,actor);let lose=true;const uncertain:OperationalDelegationRepository={transaction:async fn=>{const value=await f.repo.transaction(fn);if(lose){lose=false;throw Error('synthetic lost commit ack')}return value}},s=createOperationalDelegationStore(uncertain,f.authority,f.source,f.identity,f.targets),jwt=await f.token('pg-lost-claim-ack');await expect(s.claim(f.id,0,jwt)).rejects.toThrow('operational_delegation_unconfirmed');expect(await f.store.inspect(f.id,actor)).toMatchObject({status:'claimed',attemptCount:1,credential:{status:'not_requested'}});await expect(f.store.claim(f.id,0,jwt)).rejects.toThrow();
 }finally{vi.unstubAllEnvs()}
});
it.skipIf(!enabled)('revoked actual reviewer blocks workload qualification before any credential stage while current reader history remains available',async()=>{
 try{const f=await operationalFixture();await f.store.delegate(f.id,1,f.plan.digest,actor);await db.$executeRawUnsafe('UPDATE "DesktopSessionRecord" SET "revokedAt"=clock_timestamp() WHERE id=$1',reviewer.sessionId);await expect(f.store.claim(f.id,0,await f.token('pg-revoked-reviewer'))).rejects.toThrow();expect(f.profiles.readProfile).not.toHaveBeenCalled();expect(await f.store.inspect(f.id,actor)).toMatchObject({status:'delegated',credential:{status:'not_requested'}});await expect(f.store.inspect(f.id,reviewer)).rejects.toThrow();
 }finally{vi.unstubAllEnvs()}
});
it.skipIf(!enabled)('serializes full/short ARN cloned targets across different actual approved workload actions before credential entry',async()=>{
 try{const serviceName='alias-'+randomUUID(),a=await operationalFixture({serviceName}),b=await operationalFixture({serviceName,short:true});await a.store.delegate(a.id,1,a.plan.digest,actor);await b.store.delegate(b.id,1,b.plan.digest,actor);const results=await Promise.allSettled([a.store.claim(a.id,0,await a.token('target-alias-a')),b.store.claim(b.id,0,await b.token('target-alias-b'))]);expect(results.filter(v=>v.status==='fulfilled')).toHaveLength(1);
 const rows=await db.$queryRawUnsafe<Array<{stateJson:{generation:number;phase:string;actionId:string}}>>('SELECT "stateJson" FROM "PlatformOperationalTarget" WHERE "actionId" IN ($1,$2)',a.id,b.id);expect(rows).toHaveLength(1);expect(rows[0].stateJson).toMatchObject({generation:1,phase:'reserved'});
 const loser=rows[0].stateJson.actionId===a.id?b:a;expect(await loser.store.inspect(loser.id,actor)).toMatchObject({status:'delegated',credential:{status:'not_requested'}});
 }finally{vi.unstubAllEnvs()}
});
it.skipIf(!enabled)('unknown native result with no operation identity blocks fresh approved actions without resetting generation or original history',async()=>{
 try{const serviceName='unknown-'+randomUUID(),a=await operationalFixture({serviceName});await a.store.delegate(a.id,1,a.plan.digest,actor);await a.store.claim(a.id,0,await a.token('target-unknown-a'));a.setNativeOutcome('unknown',null);expect(await a.observe()).toMatchObject({generation:1,phase:'unknown'});const b=await operationalFixture({serviceName});await b.store.delegate(b.id,1,b.plan.digest,actor);await expect(b.store.claim(b.id,0,await b.token('target-unknown-b'))).rejects.toThrow();expect(b.nativeSource.readSnapshot).not.toHaveBeenCalled();
 const rows=await db.$queryRawUnsafe<Array<{generation:number;stateJson:{phase:string}}>>('SELECT generation,"stateJson" FROM "PlatformOperationalTarget" WHERE "actionId"=$1',a.id);expect(rows[0]).toMatchObject({generation:1,stateJson:{phase:'unknown'}});const history=await db.$queryRawUnsafe('SELECT id FROM "PlatformOperationalTargetReceipt" WHERE "actionId"=$1',a.id);expect(history).toHaveLength(2);
 }finally{vi.unstubAllEnvs()}
});
it.skipIf(!enabled)('advances the actual target generation only after qualified synthetic acceptance/stability while retaining every receipt',async()=>{
 try{const serviceName='stable-'+randomUUID(),a=await operationalFixture({serviceName});await a.store.delegate(a.id,1,a.plan.digest,actor);await a.store.claim(a.id,0,await a.token('target-stable-a'));a.setNativeOutcome('accepted');await a.observe();a.setNativeOutcome('stable');await a.observe();const b=await operationalFixture({serviceName,short:true,currentTaskDefinitionArn:a.manifest.target.taskDefinitionArn});await b.store.delegate(b.id,1,b.plan.digest,actor);await b.store.claim(b.id,0,await b.token('target-stable-b'));const view=await b.store.inspect(b.id,actor);expect(view).toMatchObject({status:'claimed',targetReservation:{generation:2}});
 const targets=await db.$queryRawUnsafe<Array<{generation:number}>>('SELECT generation FROM "PlatformOperationalTarget" WHERE "actionId"=$1',b.id);expect(targets).toEqual([{generation:2}]);const receipts=await db.$queryRawUnsafe('SELECT id FROM "PlatformOperationalTargetReceipt" WHERE "actionId" IN ($1,$2)',a.id,b.id);expect(receipts).toHaveLength(4);
 }finally{vi.unstubAllEnvs()}
});
it.skipIf(!enabled)('admits a separately reviewed exact rollback only for the actual saved failure generation and prior task lineage',async()=>{
 try{const serviceName='rollback-'+randomUUID(),a=await operationalFixture({serviceName});await a.store.delegate(a.id,1,a.plan.digest,actor);await a.store.claim(a.id,0,await a.token('target-rollback-a'));a.setNativeOutcome('accepted');await a.observe();const failureReceiptId=a.setNativeOutcome('terminal_failure');await a.observe();const condition={kind:'verified_terminal_failure',failedActionId:a.id,failureReceiptId,priorDeploymentReceiptId:a.manifest.sourceEvidenceId,generation:1,failedTaskDefinitionArn:a.manifest.target.taskDefinitionArn},prior='arn:aws:ecs:us-east-2:123456789012:task-definition/service:1';
 const wrong=await operationalFixture({serviceName,operation:'rollback',condition:{...condition,generation:2},taskDefinitionArn:prior,currentTaskDefinitionArn:a.manifest.target.taskDefinitionArn});await wrong.store.delegate(wrong.id,1,wrong.plan.digest,actor);await expect(wrong.store.claim(wrong.id,0,await wrong.token('target-rollback-wrong'))).rejects.toThrow();
 const exact=await operationalFixture({serviceName,operation:'rollback',condition,taskDefinitionArn:prior,currentTaskDefinitionArn:a.manifest.target.taskDefinitionArn});await exact.store.delegate(exact.id,1,exact.plan.digest,actor);await exact.store.claim(exact.id,0,await exact.token('target-rollback-exact'));const rows=await db.$queryRawUnsafe<Array<{generation:number;stateJson:{target:{taskDefinitionArn:string}}}>>('SELECT generation,"stateJson" FROM "PlatformOperationalTarget" WHERE "actionId"=$1',exact.id);expect(rows[0]).toMatchObject({generation:2,stateJson:{target:{taskDefinitionArn:prior}}});
 }finally{vi.unstubAllEnvs()}
});
it.skipIf(!enabled)('rechecks the actual held reservation before credential staging and refuses revoked native qualification',async()=>{
 try{const f=await operationalFixture();await f.store.delegate(f.id,1,f.plan.digest,actor);const claimed=await f.store.claim(f.id,0,await f.token('target-before-credential'));f.nativeSource.assertSnapshotCurrent.mockRejectedValueOnce(Error('synthetic native qualification revoked'));const calls=f.profiles.readProfile.mock.calls.length;await expect(f.store.beginCredential(claimed.proof)).rejects.toThrow();expect(f.profiles.readProfile.mock.calls.length).toBe(calls);expect(await f.store.inspect(f.id,actor)).toMatchObject({version:1,credential:{status:'not_requested'}});
 }finally{vi.unstubAllEnvs()}
});
it.skipIf(!enabled)('keeps actual unknown credential liability blocking the next stable target generation',async()=>{
 try{const serviceName='lease-unknown-'+randomUUID(),a=await operationalFixture({serviceName});await a.store.delegate(a.id,1,a.plan.digest,actor);const claimed=await a.store.claim(a.id,0,await a.token('lease-unknown-a')),pending=await a.store.beginCredential(claimed.proof);await a.store.observeCredential(pending.proof,{status:'unknown'});a.setNativeOutcome('accepted');await a.observe();a.setNativeOutcome('stable');await a.observe();const b=await operationalFixture({serviceName,currentTaskDefinitionArn:a.manifest.target.taskDefinitionArn});await b.store.delegate(b.id,1,b.plan.digest,actor);await expect(b.store.claim(b.id,0,await b.token('lease-unknown-b'))).rejects.toThrow();expect(b.nativeSource.readSnapshot).not.toHaveBeenCalled();expect(b.nativeSource.assertPriorCredentialClosed).not.toHaveBeenCalled();const rows=await db.$queryRawUnsafe<Array<{generation:number}>>('SELECT generation FROM "PlatformOperationalTarget" WHERE "actionId"=$1',a.id);expect(rows).toEqual([{generation:1}]);
 }finally{vi.unstubAllEnvs()}
});
it.skipIf(!enabled)('requires qualified prior issued-credential closure and preserves its exact receipt in the new SQL generation',async()=>{
 try{const serviceName='lease-issued-'+randomUUID(),a=await operationalFixture({serviceName});await a.store.delegate(a.id,1,a.plan.digest,actor);const claimed=await a.store.claim(a.id,0,await a.token('lease-issued-a')),pending=await a.store.beginCredential(claimed.proof);await a.store.observeCredential(pending.proof,{status:'issued',leaseRef:'platform_credential_22222222-2222-4222-8222-222222222222',expiresAt:Date.now()+900000});a.setNativeOutcome('accepted');await a.observe();a.setNativeOutcome('stable');await a.observe();const b=await operationalFixture({serviceName,currentTaskDefinitionArn:a.manifest.target.taskDefinitionArn});await b.store.delegate(b.id,1,b.plan.digest,actor);b.nativeSource.assertPriorCredentialClosed.mockRejectedValueOnce(Error('synthetic closure unavailable'));await expect(b.store.claim(b.id,0,await b.token('lease-issued-b-refused'))).rejects.toThrow();
 const closureRef='platform_evidence_'+randomUUID();b.nativeSource.assertPriorCredentialClosed.mockResolvedValueOnce(closureRef);await b.store.claim(b.id,0,await b.token('lease-issued-b-closed'));const rows=await db.$queryRawUnsafe<Array<{generation:number;stateJson:{previousCredentialClosureReceiptId:string}}>>('SELECT generation,"stateJson" FROM "PlatformOperationalTarget" WHERE "actionId"=$1',b.id);expect(rows[0]).toMatchObject({generation:2,stateJson:{previousCredentialClosureReceiptId:closureRef}});const receipts=await db.$queryRawUnsafe<Array<{receiptJson:{previousCredentialClosureReceiptId:string}}>>('SELECT "receiptJson" FROM "PlatformOperationalTargetReceipt" WHERE "actionId"=$1',b.id);expect(receipts).toHaveLength(1);expect(receipts[0].receiptJson.previousCredentialClosureReceiptId).toBe(closureRef);
 }finally{vi.unstubAllEnvs()}
});

import {createSettingsArtifactStore} from '../operations/settingsArtifactStore';
import {compileOperationalSettingsPlan,openSettingsArtifact,deriveSettingsArtifactBinding} from '../operations/settingsArtifact';
it.skipIf(!enabled)('stores one exact private settings envelope in actual SQL and excludes duplicate/reviewed replacements',async()=>{
 await identityFixtures();const repo=createPlatformSqlRepository(db as unknown as PlatformSqlDatabase),authority=createCurrentPlatformAuthority(()=>['requester@example.test','reviewer@example.test']);
 const manifest=compileOperationalManifest({format:1,scope:'platform',kind:'settings.vercel',artifactProfileId:'synthetic-profile',expiresAt:new Date(Date.now()+60000).toISOString(),target:{projectId:'synthetic-project',teamId:'synthetic-team'},settings:[{name:'SYNTHETIC',environment:'production',type:'encrypted',sensitivity:'secret',artifactId:'platform_artifact_'+randomUUID(),current:{kind:'absent',receiptId:'platform_evidence_'+randomUUID()}}]});
 const p=compileOperationalSettingsPlan(manifest),s=createPlatformActionService(repo,authority),id=await s.propose(p,actor),key=new Uint8Array(32).fill(7),source={readManifest:async()=>manifest,assertCurrent:async()=>{},readKey:vi.fn(async()=>key)},store=createSettingsArtifactStore(repo,authority,source);
 const results=await Promise.allSettled([store.save(id,0,actor,'synthetic A'),store.save(id,0,actor,'synthetic B')]);expect(results.filter(r=>r.status==='fulfilled')).toHaveLength(1);expect(source.readKey).toHaveBeenCalledTimes(1);
 const rows=await db.$queryRawUnsafe<Array<{bindingJson:unknown;envelope:string}>>('SELECT "bindingJson",envelope FROM "PlatformSettingsArtifact" WHERE "actionId"=$1',id);expect(rows).toHaveLength(1);expect(['synthetic A','synthetic B']).toContain(openSettingsArtifact(key,rows[0].bindingJson,rows[0].envelope));
 await expect(store.review(id,0,p.digest,actor)).rejects.toThrow();await store.review(id,0,p.digest,reviewer);await expect(store.save(id,0,actor,'replacement')).rejects.toThrow();expect(source.readKey).toHaveBeenCalledTimes(1);
});
it.skipIf(!enabled)('rolls back the actual private envelope when current authority is lost after insert',async()=>{
 await identityFixtures();const repo=createPlatformSqlRepository(db as unknown as PlatformSqlDatabase),authority=createCurrentPlatformAuthority(()=>['requester@example.test','reviewer@example.test']);
 const manifest=compileOperationalManifest({format:1,scope:'platform',kind:'settings.vercel',artifactProfileId:'synthetic-profile',expiresAt:new Date(Date.now()+60000).toISOString(),target:{projectId:'synthetic-project',teamId:'synthetic-team'},settings:[{name:'SYNTHETIC',environment:'production',type:'encrypted',sensitivity:'secret',artifactId:'platform_artifact_'+randomUUID(),current:{kind:'absent',receiptId:'platform_evidence_'+randomUUID()}}]});
 const p=compileOperationalSettingsPlan(manifest),s=createPlatformActionService(repo,authority),id=await s.propose(p,actor);let revoked=false;
 const store=createSettingsArtifactStore({transaction:fn=>repo.transaction(tx=>fn({...tx,insertSettingsArtifact:async(key,row)=>{await tx.insertSettingsArtifact(key,row);revoked=true}}))},{assertCurrent:async(tx,principal)=>{if(revoked)throw Error('synthetic revoked');await authority.assertCurrent(tx,principal)}},{readManifest:async()=>manifest,assertCurrent:async()=>{},readKey:async()=>new Uint8Array(32).fill(9)});
 await expect(store.save(id,0,actor,'synthetic')).rejects.toThrow('settings_artifact_unavailable');const rows=await db.$queryRawUnsafe('SELECT id FROM "PlatformSettingsArtifact" WHERE "actionId"=$1',id);expect(rows).toEqual([]);expect((await s.inspect(id,actor)).status).toBe('proposed');
});

import {createSettingsArtifactRequestComposition} from '../operations/settingsArtifactRequest';
it.skipIf(!enabled)('binds private settings save and genuine independent review to actual HMAC sessions and SQL',async()=>{
 await identityFixtures();vi.stubEnv('DESKTOP_SESSION_SIGNING_KEY','synthetic-platform-settings-key-'.repeat(3));
 try{
 const repo=createPlatformSqlRepository(db as unknown as PlatformSqlDatabase),readAdminEmails=()=>['requester@example.test','reviewer@example.test'];
 const manifest=compileOperationalManifest({format:1,scope:'platform',kind:'settings.vercel',artifactProfileId:'synthetic-profile',expiresAt:new Date(Date.now()+60000).toISOString(),target:{projectId:'synthetic-project',teamId:'synthetic-team'},settings:[{name:'SYNTHETIC',environment:'production',type:'encrypted',sensitivity:'secret',artifactId:'platform_artifact_'+randomUUID(),current:{kind:'absent',receiptId:'platform_evidence_'+randomUUID()}}]});
 const p=compileOperationalSettingsPlan(manifest),id=await createPlatformActionService(repo,createCurrentPlatformAuthority(readAdminEmails)).propose(p,actor),source={readManifest:async()=>manifest,assertCurrent:async()=>{},readKey:vi.fn(async()=>new Uint8Array(32).fill(11))},ports={repo,source,verifyDesktopToken,readAdminEmails};
 const headers=new Headers({authorization:'Bearer '+mintDesktopToken(actor.sessionId)}),requester=await createSettingsArtifactRequestComposition({headers},ports);await requester.save(id,0,'synthetic');expect(await requester.preview(id)).toMatchObject({reviewReady:true,executionAuthorized:false,settings:[{artifactStatus:'saved'}]});await expect(requester.review(id,0,p.digest)).rejects.toThrow();
 const independent=await createSettingsArtifactRequestComposition({headers:new Headers({authorization:'Bearer '+mintDesktopToken(reviewer.sessionId)})},ports);await independent.review(id,0,p.digest);expect(source.readKey).toHaveBeenCalledTimes(1);await expect(independent.claim(id,1,p.digest)).rejects.toThrow();expect(await requester.claim(id,1,p.digest)).toMatchObject({status:'claimed',attemptCount:1,executionAuthorized:false});await expect(requester.claim(id,1,p.digest)).rejects.toThrow();
 headers.delete('authorization');await expect(requester.save(id,0,'replacement')).rejects.toThrow();const state=await db.$queryRawUnsafe<Array<{stateJson:{status:string;reviewer:{userId:string}}}>>('SELECT "stateJson" FROM "PlatformGovernanceAction" WHERE id=$1',id);expect(state[0].stateJson).toMatchObject({status:'claimed',reviewer:{userId:reviewer.userId}});
 }finally{vi.unstubAllEnvs()}
});
it.skipIf(!enabled)('permanently excludes a cloned settings action from the same native target after an unknown child',async()=>{
 await identityFixtures();const repo=createPlatformSqlRepository(db as unknown as PlatformSqlDatabase),authority=createCurrentPlatformAuthority(()=>['requester@example.test','reviewer@example.test']),name='KEY_'+randomUUID().replaceAll('-','').toUpperCase();
 async function prepare(){
 const manifest=compileOperationalManifest({format:1,scope:'platform',kind:'settings.vercel',artifactProfileId:'synthetic-profile',expiresAt:new Date(Date.now()+60000).toISOString(),target:{projectId:'synthetic-project',teamId:'synthetic-team'},settings:[{name,environment:'production',type:'encrypted',sensitivity:'secret',artifactId:'platform_artifact_'+randomUUID(),current:{kind:'absent',receiptId:'platform_evidence_'+randomUUID()}}]});
 const p=compileOperationalSettingsPlan(manifest),service=createPlatformActionService(repo,authority),id=await service.propose(p,actor),store=createSettingsArtifactStore(repo,authority,{readManifest:async()=>manifest,assertCurrent:async()=>{},readKey:async()=>new Uint8Array(32).fill(17)});await store.save(id,0,actor,'synthetic');await store.review(id,0,p.digest,reviewer);await service.claim(id,1,actor);const child=await service.claimNextEffect(id,actor);const binding=deriveSettingsArtifactBinding(id,readPlatformAction(await repo.transaction(async tx=>{await tx.lock(id);return tx.read(id)})),manifest,0,actor);return {id,service,child,binding};
 }
 const a=await prepare(),reserve=(f:Awaited<ReturnType<typeof prepare>>)=>repo.transaction(async tx=>{await tx.lock(f.id);return tx.reserveSettingsCreation(f.binding)});const key=await reserve(a);await a.service.observeEffect(a.child.proof,'unknown');const b=await prepare();await expect(reserve(b)).rejects.toThrow();await expect(reserve(a)).rejects.toThrow();const rows=await db.$queryRawUnsafe<Array<{publicationKey:string;status:string}>>('SELECT "publicationKey",status FROM "PlatformGovernanceEffect" WHERE "actionId"=$1',a.id);expect(rows).toEqual([{publicationKey:key,status:'unknown'}]);
});

import {createSettingsExecutor} from '../operations/settingsExecution';
async function settingsExecutionFixture(){
 await identityFixtures();const repo=createPlatformSqlRepository(db as unknown as PlatformSqlDatabase),authority=createCurrentPlatformAuthority(()=>['requester@example.test','reviewer@example.test']);
 const manifest=compileOperationalManifest({format:1,scope:'platform',kind:'settings.vercel',artifactProfileId:'synthetic-profile',expiresAt:new Date(Date.now()+60000).toISOString(),target:{projectId:'synthetic-project',teamId:'synthetic-team'},settings:[0,1].map(i=>({name:'VALUE_'+i+'_'+randomUUID().replaceAll('-','').toUpperCase(),environment:'production',type:'encrypted',sensitivity:'secret',artifactId:'platform_artifact_'+randomUUID(),current:{kind:'absent',receiptId:'platform_evidence_'+randomUUID()}}))});
 const p=compileOperationalSettingsPlan(manifest),{digest:_d,authority:_a,executionAuthorized:_e,...selection}=manifest,prepared=await createSettingsPreparationStore(repo,authority,{assertCurrent:async()=>{}}).prepare(selection,randomUUID(),actor),id=prepared.actionId,source={readManifest:(tx:import('../operations/settingsArtifactStore').SettingsArtifactTransaction,key:string)=>tx.readSettingsManifest(key),assertCurrent:async()=>{},assertWriteProfile:vi.fn(async()=>{}),readKey:vi.fn(async()=>new Uint8Array(32).fill(21))},store=createSettingsArtifactStore(repo,authority,source);await store.save(id,0,actor,'synthetic first');await store.save(id,1,actor,'synthetic second');await store.review(id,0,p.digest,reviewer);await store.claim(id,1,p.digest,actor);source.readKey.mockClear();return {repo,authority,source,id};
}
it.skipIf(!enabled)('joins actual SQL child reservation and private decrypt to one simulated create per reviewed setting',async()=>{
 const f=await settingsExecutionFixture(),send=vi.fn(async(_url:string,init:RequestInit)=>{const payload=JSON.parse(init.body as string);expect(payload.value).toMatch(/^synthetic (first|second)$/);return new Response(JSON.stringify({created:{id:'synthetic-id',key:payload.key,type:payload.type,target:payload.target},failed:[]}),{status:201})}),transport=createSettingsVercelTransport({fetch:send,assertQualified:async()=>{},readCredential:async()=>'SYNTHETIC_TOKEN'}),executor=createSettingsExecutor(f.repo,f.authority,f.source,transport);
 expect(await executor.executeNext(f.id,actor,0)).toMatchObject({status:'provider_confirmed',effectIndex:0,deploymentPerformed:false});await expect(executor.executeNext(f.id,actor,0)).rejects.toThrow();expect(send).toHaveBeenCalledTimes(1);expect(await executor.executeNext(f.id,actor,1)).toMatchObject({status:'provider_confirmed',effectIndex:1});await expect(executor.executeNext(f.id,actor,0)).rejects.toThrow();expect(send).toHaveBeenCalledTimes(2);expect(f.source.readKey).toHaveBeenCalledTimes(2);const rows=await db.$queryRawUnsafe<Array<{status:string;publicationKey:string}>>('SELECT status,"publicationKey" FROM "PlatformGovernanceEffect" WHERE "actionId"=$1',f.id);expect(rows).toHaveLength(2);expect(rows.every(r=>r.status==='confirmed'&&r.publicationKey.length===64)).toBe(true);const receipts=await db.$queryRawUnsafe<Array<{detailJson:{settingsResult?:{settingId:string;outcome:string}}}>>('SELECT "detailJson" FROM "PlatformGovernanceEvent" WHERE "actionId"=$1 AND kind=\'effect.observed\' ORDER BY sequence',f.id);expect(receipts).toHaveLength(2);expect(receipts.every(r=>r.detailJson.settingsResult?.settingId==='synthetic-id'&&r.detailJson.settingsResult.outcome==='confirmed')).toBe(true);await db.$executeRawUnsafe('UPDATE "DesktopSessionRecord" SET "revokedAt"=clock_timestamp() WHERE id=$1',reviewer.sessionId);f.source.assertCurrent=async()=>{throw Error('old source unavailable')};const history=await createSettingsArtifactStore(f.repo,f.authority,f.source).inspect(f.id,actor);expect(history).toMatchObject({status:'confirmed',authority:'history_only',sourceValidation:'not_checked',executionAuthorized:false});expect(history.results).toHaveLength(2);expect(f.source.readKey).toHaveBeenCalledTimes(2);
});
it.skipIf(!enabled)('retains actual native reservation after uncertain create and stops every later child without another key read',async()=>{
 const f=await settingsExecutionFixture(),send=vi.fn(async(_binding:unknown,_value:string,before:()=>Promise<void>)=>{await before();return {outcome:'unknown'}}),executor=createSettingsExecutor(f.repo,f.authority,f.source,{send});await expect(executor.executeNext(f.id,actor,0)).rejects.toThrow();await expect(executor.executeNext(f.id,actor,0)).rejects.toThrow();expect(send).toHaveBeenCalledTimes(1);expect(f.source.readKey).toHaveBeenCalledTimes(1);const rows=await db.$queryRawUnsafe<Array<{status:string;publicationKey:string}>>('SELECT status,"publicationKey" FROM "PlatformGovernanceEffect" WHERE "actionId"=$1',f.id);expect(rows).toHaveLength(1);expect(rows[0]).toMatchObject({status:'unknown'});expect(rows[0].publicationKey).toHaveLength(64);
});
it.skipIf(!enabled)('refuses unqualified settings execution before custody, reservation or simulated transport',async()=>{
 const f=await settingsExecutionFixture();f.source.assertWriteProfile.mockRejectedValue(Error('synthetic unqualified'));const send=vi.fn(),executor=createSettingsExecutor(f.repo,f.authority,f.source,{send});await expect(executor.executeNext(f.id,actor,0)).rejects.toThrow();expect(send).not.toHaveBeenCalled();expect(f.source.readKey).not.toHaveBeenCalled();const rows=await db.$queryRawUnsafe('SELECT status FROM "PlatformGovernanceEffect" WHERE "actionId"=$1',f.id);expect(rows).toEqual([]);
});
it.skipIf(!enabled)('refuses a revoked write profile at the final settings send and retains native uncertainty',async()=>{
 const f=await settingsExecutionFixture();let physicalSends=0;const send=vi.fn(async(_binding:unknown,_value:string,before:()=>Promise<void>)=>{f.source.assertWriteProfile.mockRejectedValue(Error('synthetic revoked'));await before();physicalSends++;return {outcome:'confirmed',settingId:'must-not-exist'}}),executor=createSettingsExecutor(f.repo,f.authority,f.source,{send});await expect(executor.executeNext(f.id,actor,0)).rejects.toThrow();expect(physicalSends).toBe(0);const rows=await db.$queryRawUnsafe<Array<{status:string;publicationKey:string}>>('SELECT status,"publicationKey" FROM "PlatformGovernanceEffect" WHERE "actionId"=$1',f.id);expect(rows).toHaveLength(1);expect(rows[0].status).toBe('unknown');expect(rows[0].publicationKey).toHaveLength(64);
});

import {createSettingsVercelTransport} from '../operations/settingsVercelTransport';

import {createSettingsPreparationStore} from '../operations/settingsPreparation';

it.skipIf(!enabled)('recovers one immutable settings preparation reference without renewing or revalidating old source',async()=>{
 await identityFixtures();const repo=createPlatformSqlRepository(db as unknown as PlatformSqlDatabase),authority=createCurrentPlatformAuthority(()=>['requester@example.test','reviewer@example.test']),source={assertCurrent:vi.fn(async()=>{})},store=createSettingsPreparationStore(repo,authority,source),requestId=randomUUID();
 const selection={format:1,scope:'platform',kind:'settings.vercel',artifactProfileId:'synthetic-profile',expiresAt:new Date(Date.now()+60000).toISOString(),target:{projectId:'synthetic-project',teamId:'synthetic-team'},settings:[{name:'PREPARED',environment:'production',type:'encrypted',sensitivity:'secret',artifactId:'platform_artifact_'+randomUUID(),current:{kind:'absent',receiptId:'platform_evidence_'+randomUUID()}}]};
 const [a,b]=await Promise.all([store.prepare(selection,requestId,actor),store.prepare(selection,requestId,actor)]);expect(a.actionId).toBe(b.actionId);expect([a.historical,b.historical].sort()).toEqual([false,true]);source.assertCurrent.mockRejectedValue(Error('old source unavailable'));expect(await store.lookup(requestId,actor)).toMatchObject({found:true,actionId:a.actionId});expect(await store.prepare(selection,requestId,actor)).toMatchObject({historical:true});await expect(store.prepare({...selection,target:{...selection.target,projectId:'changed'}},requestId,actor)).rejects.toThrow();const rows=await db.$queryRawUnsafe('SELECT id FROM "PlatformGovernanceEvent" WHERE "actionId"=$1 AND kind=\'proposed\'',a.actionId);expect(rows).toHaveLength(1);
});

import {createSettingsHttp} from '../operations/settingsHttp';
it.skipIf(!enabled)('joins exact-child HTTP commands to real HMAC/SQL without advancing a repeated command',async()=>{
 const f=await settingsExecutionFixture();vi.stubEnv('DESKTOP_SESSION_SIGNING_KEY','synthetic-settings-http-key-'.repeat(3));try{
 const transport=createSettingsVercelTransport({fetch:async(_url,init)=>{const body=JSON.parse(init.body as string);return new Response(JSON.stringify({created:{id:'http-synthetic-id',key:body.key,type:body.type,target:body.target},failed:[]}),{status:201})},assertQualified:async()=>{},readCredential:async()=>'SYNTHETIC_TOKEN'});
 const http=createSettingsHttp(req=>createSettingsArtifactRequestComposition(req,{repo:f.repo,source:f.source,verifyDesktopToken,readAdminEmails:()=>['requester@example.test','reviewer@example.test'],execution:{assertWriteProfile:f.source.assertWriteProfile,transport}}));
 const parent=readPlatformAction(await f.repo.transaction(async tx=>{await tx.lock(f.id);return tx.read(f.id)})),command={operation:'execute',actionId:f.id,expectedVersion:parent.version,planDigest:parent.plan.digest,effectIndex:0};
 const request=(who:typeof actor,body:unknown)=>new Request('http://fixture.invalid/settings',{method:'POST',headers:{authorization:'Bearer '+mintDesktopToken(who.sessionId),'content-type':'application/json'},body:JSON.stringify(body)});
 const first=await http(request(actor,command));expect(first.status).toBe(200);expect(await first.json()).toMatchObject({ok:true,data:{effectIndex:0,settingId:'http-synthetic-id'}});expect((await http(request(actor,command))).status).toBe(409);expect((await http(request(reviewer,{...command,effectIndex:1}))).status).toBe(409);expect(f.source.readKey).toHaveBeenCalledTimes(1);
 const history=await http(request(actor,{operation:'inspect',actionId:f.id}));expect(history.status).toBe(200);expect(await history.json()).toMatchObject({ok:true,data:{status:'claimed',results:[{effectIndex:0,settingId:'http-synthetic-id'}]}});
 }finally{vi.unstubAllEnvs()}
});

it.skipIf(!enabled)('joins one actual durable pending lease to private synthetic credential issuance without storing key material',async()=>{
 const issuer={assertQualified:vi.fn(async()=>{}),issue:vi.fn(async(_manifest:unknown,beforeIssue:()=>Promise<void>)=>{await beforeIssue();return {leaseRef:'platform_credential_'+randomUUID(),accessKeyId:'SYNTHETIC_ACCESS',secretAccessKey:'SYNTHETIC_SECRET',sessionToken:'SYNTHETIC_TOKEN',expiresAt:Date.now()+900000}})};try{const f=await operationalFixture({issuer});await f.store.delegate(f.id,1,f.plan.digest,actor);const claimed=await f.store.claim(f.id,0,await f.token('issued-private-handle')),pending=await f.store.beginCredential(claimed.proof),issued=await f.store.issueCredential(pending.proof);expect(issued.history).toMatchObject({credential:{status:'issued'}});expect(issued.credentialHandle).toBeTruthy();expect(JSON.stringify(issued)).not.toContain('SYNTHETIC_SECRET');await expect(f.store.issueCredential(pending.proof)).rejects.toThrow();expect(issuer.issue).toHaveBeenCalledOnce();const rows=await db.$queryRawUnsafe('SELECT "stateJson" FROM "PlatformOperationalDelegation" WHERE "actionId"=$1',f.id);expect(JSON.stringify(rows)).not.toMatch(/SYNTHETIC_(ACCESS|SECRET|TOKEN)/);
 }finally{vi.unstubAllEnvs()}
});
it.skipIf(!enabled)('records a private issuer loss as actual unknown credential liability and blocks a second mint',async()=>{
 const issuer={assertQualified:vi.fn(async()=>{}),issue:vi.fn(async()=>{throw Error('PRIVATE issuer loss')})};try{const f=await operationalFixture({issuer});await f.store.delegate(f.id,1,f.plan.digest,actor);const claimed=await f.store.claim(f.id,0,await f.token('unknown-private-issuer')),pending=await f.store.beginCredential(claimed.proof),issued=await f.store.issueCredential(pending.proof);expect(issued).toMatchObject({credentialHandle:null,history:{credential:{status:'unknown'}}});await expect(f.store.issueCredential(pending.proof)).rejects.toThrow();expect(issuer.issue).toHaveBeenCalledOnce();
 }finally{vi.unstubAllEnvs()}
});

function syntheticOperationalIssuer(){return {assertQualified:vi.fn(async()=>{}),issue:vi.fn(async(_manifest:unknown,beforeIssue:()=>Promise<void>)=>{await beforeIssue();return {leaseRef:'platform_credential_'+randomUUID(),accessKeyId:'SYNTHETIC_ACCESS',secretAccessKey:'SYNTHETIC_SECRET',sessionToken:'SYNTHETIC_TOKEN',expiresAt:Date.now()+900000}})}}
it.skipIf(!enabled)('consumes one private issued handle for an exact SQL ECS child and records acceptance without declaring stability',async()=>{
 const issuer=syntheticOperationalIssuer(),transport:OperationalEcsTransport={assertQualified:async()=>{},send:vi.fn(async(manifest,credentials,before)=>{expect(credentials.secretAccessKey).toBe('SYNTHETIC_SECRET');await before();return {$metadata:{httpStatusCode:200,requestId:'synthetic-request'},service:{clusterArn:manifest.target.clusterArn,serviceArn:manifest.target.serviceArn,taskDefinition:manifest.target.taskDefinitionArn,status:'ACTIVE',deploymentController:{type:'ECS'},deployments:[{id:'ecs-svc/2',status:'PRIMARY',taskDefinition:manifest.target.taskDefinitionArn}]}}})};try{const f=await operationalFixture({issuer,transport});await f.store.delegate(f.id,1,f.plan.digest,actor);const claimed=await f.store.claim(f.id,0,await f.token('private-ecs-send')),pending=await f.store.beginCredential(claimed.proof),issued=await f.store.issueCredential(pending.proof);if(!issued.credentialHandle)throw Error('fixture');await expect(f.store.executeCredential({})).rejects.toThrow();expect(await f.store.executeCredential(issued.credentialHandle)).toMatchObject({kind:'accepted',deploymentId:'ecs-svc/2',stable:false,rollbackAuthorized:false});await expect(f.store.executeCredential(issued.credentialHandle)).rejects.toThrow();expect(transport.send).toHaveBeenCalledTimes(1);const parents=await db.$queryRawUnsafe<Array<{stateJson:{status:string}}>>('SELECT "stateJson" FROM "PlatformGovernanceAction" WHERE id=$1',f.id);expect(parents[0].stateJson.status).toBe('claimed');const events=await db.$queryRawUnsafe<Array<{detailJson:{operationalResult:{kind:string}}}>>('SELECT "detailJson" FROM "PlatformGovernanceEvent" WHERE "actionId"=$1 AND kind=\'effect.observed\'',f.id);expect(events[0].detailJson.operationalResult.kind).toBe('accepted');expect(JSON.stringify(events)).not.toMatch(/SYNTHETIC_(ACCESS|SECRET|TOKEN)/);
 }finally{vi.unstubAllEnvs()}
});
it.skipIf(!enabled)('records an uncertain ECS child without rollback, reusing credentials or releasing the native target',async()=>{
 const issuer=syntheticOperationalIssuer(),transport:OperationalEcsTransport={assertQualified:async()=>{},send:vi.fn(async(_manifest,_credentials,before)=>{await before();throw Error('synthetic timeout or waiter error')})};try{const f=await operationalFixture({issuer,transport});await f.store.delegate(f.id,1,f.plan.digest,actor);const claimed=await f.store.claim(f.id,0,await f.token('private-ecs-unknown')),pending=await f.store.beginCredential(claimed.proof),issued=await f.store.issueCredential(pending.proof);if(!issued.credentialHandle)throw Error('fixture');expect(await f.store.executeCredential(issued.credentialHandle)).toMatchObject({kind:'unknown',deploymentId:null,rollbackAuthorized:false});await expect(f.store.executeCredential(issued.credentialHandle)).rejects.toThrow();expect(transport.send).toHaveBeenCalledTimes(1);const rows=await db.$queryRawUnsafe<Array<{stateJson:{status:string}}>>('SELECT "stateJson" FROM "PlatformGovernanceAction" WHERE id=$1',f.id);expect(rows[0].stateJson.status).toBe('unknown');const targets=await db.$queryRawUnsafe<Array<{stateJson:{phase:string}}>>('SELECT "stateJson" FROM "PlatformOperationalTarget" WHERE "actionId"=$1',f.id);expect(targets[0].stateJson.phase).toBe('reserved');
 }finally{vi.unstubAllEnvs()}
});
it.skipIf(!enabled)('refuses a revoked native ECS profile at final send while preserving issued and unknown liabilities',async()=>{
 const issuer=syntheticOperationalIssuer();let block:()=>void=()=>{},physicalSends=0;const transport:OperationalEcsTransport={assertQualified:async()=>{},send:vi.fn(async(_manifest,_credentials,before)=>{block();await before();physicalSends++;return {}})};try{const f=await operationalFixture({issuer,transport});block=()=>{f.nativeSource.assertSnapshotCurrent.mockRejectedValue(Error('synthetic revoked native profile'))};await f.store.delegate(f.id,1,f.plan.digest,actor);const claimed=await f.store.claim(f.id,0,await f.token('private-ecs-revoked')),pending=await f.store.beginCredential(claimed.proof),issued=await f.store.issueCredential(pending.proof);if(!issued.credentialHandle)throw Error('fixture');expect(await f.store.executeCredential(issued.credentialHandle)).toMatchObject({kind:'unknown',rollbackAuthorized:false});expect(physicalSends).toBe(0);expect(await f.store.inspect(f.id,actor)).toMatchObject({credential:{status:'issued'}});
 }finally{vi.unstubAllEnvs()}
});

import {NodeHttpHandler} from '@smithy/node-http-handler';
import {IncomingMessage} from 'node:http';
import {Socket} from 'node:net';
import {createOperationalEcsSdkTransport,createOperationalEcsSdkReader} from '../operations/ecsSdkTransport';
it.skipIf(!enabled)('joins actual SQL/private issuance/current final gates to the installed ECS SDK with native network intercepted',async()=>{
 const native=vi.spyOn(NodeHttpHandler.prototype,'handle').mockImplementation(async request=>{const input=JSON.parse(String(request.body));expect(request.hostname).toBe('ecs.us-east-2.amazonaws.com');expect(input.forceNewDeployment).toBe(true);expect(input.taskDefinition).toMatch(/:2$/);const body=new IncomingMessage(new Socket());body.push(Buffer.from(JSON.stringify({service:{clusterArn:input.cluster,serviceArn:input.service,taskDefinition:input.taskDefinition,status:'ACTIVE',deploymentController:{type:'ECS'},deployments:[{id:'ecs-svc/2',status:'PRIMARY',taskDefinition:input.taskDefinition}]}})));body.push(null);return {response:{statusCode:200,headers:{'x-amzn-requestid':'synthetic-sdk-request','content-type':'application/x-amz-json-1.1'},body}}});
 try{const f=await operationalFixture({issuer:syntheticOperationalIssuer(),transport:createOperationalEcsSdkTransport(async()=>{})});await f.store.delegate(f.id,1,f.plan.digest,actor);const claimed=await f.store.claim(f.id,0,await f.token('actual-sdk-synthetic-native')),pending=await f.store.beginCredential(claimed.proof),issued=await f.store.issueCredential(pending.proof);if(!issued.credentialHandle)throw Error('fixture');expect(await f.store.executeCredential(issued.credentialHandle)).toMatchObject({kind:'accepted',deploymentId:'ecs-svc/2',requestId:'synthetic-sdk-request',stable:false});expect(native).toHaveBeenCalledOnce();
 }finally{native.mockRestore();vi.unstubAllEnvs()}
});

import {createOperationalEcsOutcomeSource} from '../operations/ecsOutcomeSource';
it.skipIf(!enabled)('joins original SQL acceptance to qualified exact-operation readback without following another deployment',async()=>{
 const issuer=syntheticOperationalIssuer(),transport:OperationalEcsTransport={assertQualified:async()=>{},send:async(manifest,_credentials,before)=>{await before();return {$metadata:{httpStatusCode:200,requestId:'synthetic-update'},service:{clusterArn:manifest.target.clusterArn,serviceArn:manifest.target.serviceArn,taskDefinition:manifest.target.taskDefinitionArn,status:'ACTIVE',deploymentController:{type:'ECS'},deployments:[{id:'ecs-svc/2',status:'PRIMARY',taskDefinition:manifest.target.taskDefinitionArn}]}}}};
 try{const f=await operationalFixture({issuer,transport}),profile={profileDigest:d,expiresAt:Date.now()+600000};let returnedId='ecs-svc/3';const describe=vi.fn(async()=>({evidence:Object.freeze({synthetic:true}),response:{$metadata:{httpStatusCode:200,requestId:'synthetic-observation'},failures:[],services:[{clusterArn:f.manifest.target.clusterArn,serviceArn:f.manifest.target.serviceArn,taskDefinition:f.manifest.target.taskDefinitionArn,status:'ACTIVE',deploymentController:{type:'ECS'},desiredCount:1,runningCount:1,pendingCount:0,deployments:[{id:returnedId,status:'PRIMARY',taskDefinition:f.manifest.target.taskDefinitionArn,rolloutState:'COMPLETED'}]}]}}));
 const source=createOperationalEcsOutcomeSource({readProfile:async()=>profile,describe,assertQualified:async()=>{}}),targets=createOperationalTargetReservations({...f.nativeSource,...source}),observe=()=>f.repo.transaction(async tx=>{await tx.lock(f.id);return targets.observe(tx,{actionId:f.id,manifest:f.manifest},1)});
 await f.store.delegate(f.id,1,f.plan.digest,actor);const claimed=await f.store.claim(f.id,0,await f.token('original-operation-observation')),pending=await f.store.beginCredential(claimed.proof),issued=await f.store.issueCredential(pending.proof);await expect(observe()).rejects.toThrow();expect(describe).not.toHaveBeenCalled();if(!issued.credentialHandle)throw Error('fixture');await f.store.executeCredential(issued.credentialHandle);expect(await observe()).toMatchObject({phase:'accepted',deploymentId:'ecs-svc/2'});expect(describe).not.toHaveBeenCalled();expect(await observe()).toMatchObject({phase:'unknown',deploymentId:'ecs-svc/2'});returnedId='ecs-svc/2';expect(await observe()).toMatchObject({phase:'stable',deploymentId:'ecs-svc/2'});expect(describe).toHaveBeenCalledTimes(2);const receipts=await db.$queryRawUnsafe('SELECT id FROM "PlatformOperationalTargetReceipt" WHERE "actionId"=$1',f.id);expect(receipts).toHaveLength(4);const parents=await db.$queryRawUnsafe<Array<{stateJson:{status:string}}>>('SELECT "stateJson" FROM "PlatformGovernanceAction" WHERE id=$1',f.id);expect(parents[0].stateJson.status).toBe('claimed');
 }finally{vi.unstubAllEnvs()}
});

it.skipIf(!enabled)('joins installed DescribeServices readback to the saved SQL operation with the native network intercepted',async()=>{
 const issuer=syntheticOperationalIssuer(),transport:OperationalEcsTransport={assertQualified:async()=>{},send:async(manifest,_credential,before)=>{await before();return {$metadata:{httpStatusCode:200,requestId:'synthetic-update'},service:{clusterArn:manifest.target.clusterArn,serviceArn:manifest.target.serviceArn,taskDefinition:manifest.target.taskDefinitionArn,status:'ACTIVE',deploymentController:{type:'ECS'},deployments:[{id:'ecs-svc/2',status:'PRIMARY',taskDefinition:manifest.target.taskDefinitionArn}]}}}};let restore:()=>void=()=>{};
 try{const f=await operationalFixture({issuer,transport});await f.store.delegate(f.id,1,f.plan.digest,actor);const claimed=await f.store.claim(f.id,0,await f.token('sdk-read-original-operation')),pending=await f.store.beginCredential(claimed.proof),issued=await f.store.issueCredential(pending.proof);if(!issued.credentialHandle)throw Error('fixture');await f.store.executeCredential(issued.credentialHandle);
 const native=vi.spyOn(NodeHttpHandler.prototype,'handle').mockImplementation(async request=>{expect(request.headers['x-amz-target']).toBe('AmazonEC2ContainerServiceV20141113.DescribeServices');expect(JSON.parse(String(request.body))).toEqual({cluster:f.manifest.target.clusterArn,services:[f.manifest.target.serviceArn]});const body=new IncomingMessage(new Socket());body.push(Buffer.from(JSON.stringify({failures:[],services:[{clusterArn:f.manifest.target.clusterArn,serviceArn:f.manifest.target.serviceArn,taskDefinition:f.manifest.target.taskDefinitionArn,status:'ACTIVE',deploymentController:{type:'ECS'},desiredCount:1,runningCount:1,pendingCount:0,deployments:[{id:'ecs-svc/2',status:'PRIMARY',taskDefinition:f.manifest.target.taskDefinitionArn,rolloutState:'COMPLETED'}]}]})));body.push(null);return {response:{statusCode:200,headers:{'x-amzn-requestid':'synthetic-read','content-type':'application/x-amz-json-1.1'},body}}});restore=()=>native.mockRestore();const reader=createOperationalEcsSdkReader(),profile={profileDigest:d,expiresAt:Date.now()+600000},source=createOperationalEcsOutcomeSource({readProfile:async()=>profile,assertQualified:async()=>{},describe:async(record,signal)=>({response:await reader.describe(record.target,{accessKeyId:'SYNTHETIC_READ_ACCESS',secretAccessKey:'SYNTHETIC_READ_SECRET',sessionToken:'SYNTHETIC_READ_TOKEN',expiresAt:Date.now()+60000},async()=>{},signal),evidence:Object.freeze({synthetic:true})})}),targets=createOperationalTargetReservations({...f.nativeSource,...source}),readerHeaders=new Headers({authorization:'Bearer '+mintDesktopToken(actor.sessionId)}),readerHttp=createOperationalHttp(request=>createOperationalDelegationRequestComposition(request,{repo:f.repo,source:f.source,identity:f.identity,targets,verifyDesktopToken,readAdminEmails:()=>['requester@example.test','reviewer@example.test']})),observe=async()=>{const response=await readerHttp(new Request('http://fixture.invalid/operations',{method:'POST',headers:readerHeaders,body:JSON.stringify({operation:'observe',actionId:f.id})}));const body=await response.json();if(response.status!==200)throw Error(body.error);return body.data};expect(await observe()).toMatchObject({phase:'accepted',executionAuthorized:false});expect(native).not.toHaveBeenCalled();await db.$executeRawUnsafe('UPDATE "DesktopSessionRecord" SET "revokedAt"=clock_timestamp() WHERE id=$1',reviewer.sessionId);expect(await observe()).toMatchObject({phase:'stable',deploymentId:'ecs-svc/2',executionAuthorized:false});expect(native).toHaveBeenCalledOnce();const history=await readerHttp(new Request('http://fixture.invalid/operations',{method:'POST',headers:readerHeaders,body:JSON.stringify({operation:'inspect',actionId:f.id})}));expect(history.status).toBe(200);expect(await history.json()).toMatchObject({ok:true,data:{parentStatus:'claimed',effectStatus:'confirmed',result:{kind:'accepted',deploymentId:'ecs-svc/2',stable:false},executionAuthorized:false,sourceValidation:'not_checked'}});expect(native).toHaveBeenCalledOnce();readerHeaders.delete('authorization');await expect(observe()).rejects.toThrow();expect(native).toHaveBeenCalledOnce();
 }finally{restore();vi.unstubAllEnvs()}
});

import {createOperationalDelegationRequestComposition} from '../operations/operationalRequest';

import {createOperationalHttp} from '../operations/operationalHttp';

import {createEcsPreparationStore} from '../operations/ecsPreparation';

it.skipIf(!enabled)('atomically prepares one ECS action for concurrent original references and rejects changed run selection',async()=>{
 try{const f=await operationalFixture(),requestId=randomUUID(),source={assertCurrent:vi.fn(async()=>{})},http=createOperationalHttp(request=>createOperationalDelegationRequestComposition(request,{repo:f.repo,source:f.source,identity:f.identity,preparationSource:source,verifyDesktopToken,readAdminEmails:()=>['requester@example.test','reviewer@example.test']})),invoke=async(body:unknown)=>{const response=await http(new Request('http://fixture.invalid/operations',{method:'POST',headers:{authorization:'Bearer '+mintDesktopToken(actor.sessionId)},body:JSON.stringify(body)}));const result=await response.json();if(response.status!==200)throw Error(result.error);return result.data},store={prepare:(selection:unknown,requestId:string,_actor:typeof actor)=>invoke({operation:'prepare',selection,requestId}),lookup:(requestId:string,_actor:typeof actor)=>invoke({operation:'lookup',requestId})},{digest:ignoredDigest,authority:ignoredAuthority,executionAuthorized:ignoredExecution,...selection}=f.manifest;
 const [a,b]=await Promise.all([store.prepare(selection,requestId,actor),store.prepare(selection,requestId,actor)]);expect(a.actionId).toBe(b.actionId);expect([a.historical,b.historical].sort()).toEqual([false,true]);const events=await db.$queryRawUnsafe<Array<{detailJson:unknown}>>('SELECT "detailJson" FROM "PlatformGovernanceEvent" WHERE "actionId"=$1',a.actionId);expect(events).toHaveLength(1);expect(JSON.stringify(events)).not.toContain(actor.sessionId);
 source.assertCurrent.mockClear();source.assertCurrent.mockRejectedValue(Error('source unavailable'));expect(await store.lookup(requestId,actor)).toMatchObject({found:true,actionId:a.actionId});expect(await store.prepare(selection,requestId,actor)).toMatchObject({historical:true});expect(source.assertCurrent).not.toHaveBeenCalled();await expect(store.prepare({...selection,workload:{...selection.workload,attempt:2}},requestId,actor)).rejects.toThrow();const parent=await f.repo.transaction(async tx=>{await tx.lock(a.actionId);return tx.read(a.actionId)});expect(parent).toMatchObject({status:'proposed',attemptCount:0,version:0});
 }finally{vi.unstubAllEnvs()}
});

it.skipIf(!enabled)('rolls an independent ECS review back in SQL when source qualification changes after the approval event',async()=>{
 try{const f=await operationalFixture(),source={assertCurrent:vi.fn(async()=>{})},store=createEcsPreparationStore(f.repo,f.authority,source),{digest:ignoredDigest,authority:ignoredAuthority,executionAuthorized:ignoredExecution,...selection}=f.manifest,saved=await store.prepare(selection,randomUUID(),actor),http=createOperationalHttp(request=>createOperationalDelegationRequestComposition(request,{repo:f.repo,source:f.source,identity:f.identity,preparationSource:source,verifyDesktopToken,readAdminEmails:()=>['requester@example.test','reviewer@example.test']}));
 const invoke=(reader:typeof actor,operation:'preview'|'review')=>http(new Request('http://fixture.invalid/operations',{method:'POST',headers:{authorization:'Bearer '+mintDesktopToken(reader.sessionId)},body:JSON.stringify({operation,actionId:saved.actionId,...(operation==='review'?{expectedVersion:0,planDigest:f.plan.digest}:{})})}));
 expect((await invoke(actor,'review')).status).toBe(409);const config={apiBase:'https://fixture.invalid',sessionToken:mintDesktopToken(reviewer.sessionId)};vi.stubGlobal('fetch',async(url:string,options?:RequestInit)=>http(new Request(url,options)));const client=createOperationalReviewClient({getConfig:()=>config,getRevision:()=>0,subscribe:()=>()=>{}}),preview=await client.preview(saved.actionId);expect(preview.ok).toBe(true);if(!preview.ok)throw Error('preview unavailable');source.assertCurrent.mockClear();source.assertCurrent.mockResolvedValueOnce().mockRejectedValueOnce(Error('source changed'));expect(await client.review(preview.data)).toMatchObject({ok:false,outcomeUnconfirmed:true});const parent=await f.repo.transaction(async tx=>{await tx.lock(saved.actionId);return tx.read(saved.actionId)});expect(parent).toMatchObject({status:'proposed',version:0,attemptCount:0});const events=await db.$queryRawUnsafe('SELECT kind FROM "PlatformGovernanceEvent" WHERE "actionId"=$1',saved.actionId);expect(events).toEqual([{kind:'proposed'}]);
 }finally{vi.unstubAllGlobals();vi.unstubAllEnvs()}
});

import {createOperationalReviewClient} from '../../../../desktop/src/lib/operationalReview';

it.skipIf(!enabled)('joins durable pending/current SQL authorization to installed STS exchange without native network',async()=>{
 let jwt='';const issuer=createOperationalStsIssuer({assertQualified:async()=>{},readWebIdentityToken:async()=>jwt,assertTokenCurrent:async(_manifest,token)=>{if(token!==jwt)throw Error('changed')}}),native=vi.spyOn(NodeHttpHandler.prototype,'handle').mockImplementation(async request=>{expect(request.hostname).toBe('sts.us-east-2.amazonaws.com');const fields=new URLSearchParams(String(request.body));expect(fields.get('WebIdentityToken')).toBe(jwt);const session=fields.get('RoleSessionName'),body=new IncomingMessage(new Socket());body.push(Buffer.from(`<AssumeRoleWithWebIdentityResponse xmlns="https://sts.amazonaws.com/doc/2011-06-15/"><AssumeRoleWithWebIdentityResult><AssumedRoleUser><Arn>arn:aws:sts::123456789012:assumed-role/fixture/${session}</Arn><AssumedRoleId>SYNTHETIC:${session}</AssumedRoleId></AssumedRoleUser><Credentials><AccessKeyId>SYNTHETIC_ACCESS</AccessKeyId><SecretAccessKey>SYNTHETIC_SECRET</SecretAccessKey><SessionToken>SYNTHETIC_SESSION</SessionToken><Expiration>${new Date(Date.now()+600000).toISOString()}</Expiration></Credentials></AssumeRoleWithWebIdentityResult></AssumeRoleWithWebIdentityResponse>`));body.push(null);return {response:{statusCode:200,headers:{'content-type':'text/xml','x-amzn-requestid':'synthetic-sts'},body}}});
 try{const f=await operationalFixture({issuer});jwt=await f.token('actual-sts-synthetic-token');await f.store.delegate(f.id,1,f.plan.digest,actor);const claim=await f.store.claim(f.id,0,jwt),pending=await f.store.beginCredential(claim.proof),issued=await f.store.issueCredential(pending.proof);expect(issued.credentialHandle).toBeTruthy();expect(issued.history).toMatchObject({credential:{status:'issued'}});expect(native).toHaveBeenCalledOnce();const rows=await db.$queryRawUnsafe('SELECT "stateJson" FROM "PlatformOperationalDelegation" WHERE "actionId"=$1',f.id);expect(JSON.stringify(rows)).not.toMatch(/SYNTHETIC_(ACCESS|SECRET|SESSION)/);expect(JSON.stringify(rows)).not.toContain(jwt);
 }finally{native.mockRestore();vi.unstubAllEnvs()}
});
import {createOperationalStsIssuer} from '../operations/stsIssuer';
