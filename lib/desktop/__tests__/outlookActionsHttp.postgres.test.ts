import {beforeAll,afterAll,beforeEach,describe,it,expect,vi} from 'vitest';
import {NextRequest} from 'next/server';
import {createRequire} from 'node:module';
import {randomUUID} from 'node:crypto';
import {realpathSync,statSync} from 'node:fs';
// Actual HTTP/store/transport/transaction/history. Authentication, vault contents,
// positive issuer identity and every Graph reply are explicitly SIMULATED.
const io=vi.hoisted(()=>({db:null as any,locker:null as any,org:'',actor:'owner',sessionId:'',posts:0,graphReads:0,issuer:true,loseReservationAck:false,losePostAck:false,enrollAfterClaim:false,expireReviewerAfterClaim:false,disableAfterIntent:false,changeTaskAfterClaim:false,taskId:'',credentialExpiresAt:0}));
vi.mock('@/lib/db',()=>({get prisma(){return io.db}}));
vi.mock('@/lib/desktop/desktopCommercialAccess',()=>({readDesktopCommercialAccess:async()=>({allowed:true})}));
vi.mock('@/lib/api/rateLimiter',()=>({consumeToken:()=>({allowed:true})}));
vi.mock('@/lib/desktop/resolveRequestDesktopSession',()=>({resolveRequestDesktopSession:async(_r:any,options:any)=>{
 const sessionId=io.sessionId||io.org+'-'+io.actor;
 if(options.recordHeartbeat!==false)await io.db.$executeRaw`UPDATE "DesktopSessionRecord" SET "lastUsedAt"=clock_timestamp() WHERE "id"=${sessionId}`;
 return {id:sessionId,organizationId:io.org,userId:io.actor,credentialKind:'desktop_session',capabilities:io.actor==='owner'?['workspace:read','connections:manage','agent:approve']:['workspace:read','agent:approve']};
}}));
vi.mock('@/lib/security/credentialVault',()=>({decryptScopedCredential:()=>JSON.stringify({purpose:'outlook_actions_v1',accessToken:'SIMULATED_EXISTING_OUTLOOK_TOKEN',refreshToken:null,expiresAt:io.credentialExpiresAt,account:{id:'mailbox',displayName:'Synthetic mailbox',email:'owner@example.com'},scopes:['User.Read','Mail.ReadBasic','Calendars.Read','Mail.Send','Calendars.ReadWrite']})}));
vi.mock('@/lib/governance/intelligence/outlookOutboundIssuer',async original=>{const actual:any=await original();return{readOutlookOutboundIssuerDigest:()=>io.issuer?'d'.repeat(64):actual.readOutlookOutboundIssuerDigest()}});
import {outlookActionsHttp} from '../outlookActionsHttp';
import {sha256ContentHash as hash} from '@/lib/tauri/contentHash';
import {createConnectedActionStore} from '@/lib/integrations/connectedActionStore';
import {readBotActionTaskBinding} from '@/lib/axiom/bot/actionTaskBinding';
import {savedBotTaskContentHash} from '@/lib/axiom/bot/savedTaskSchema';
const socket=process.env.AXIOM_OUTLOOK_OUTBOUND_PG_SOCKET;
const post=(body:unknown)=>outlookActionsHttp(new NextRequest('https://owned.test/api/desktop/integrations/outlook/actions',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)}));
describe.skipIf(!socket)('fixed Outlook actions real owned PostgreSQL',()=>{
 beforeAll(async()=>{
  const generated=process.env.AXIOM_OUTLOOK_OUTBOUND_PG_CLIENT;
  if(!socket||!/^\/private\/tmp\/axiom-outlook-outbound-pg-[^/]+\/socket$/.test(socket)||realpathSync(socket)!==socket||(statSync(socket).mode&0o077)!==0||!generated||!/^\/private\/tmp\/axiom-outlook-outbound-pg-evidence-[^/]+\/generated\/index\.js$/.test(generated))throw Error('owned_fixture_required');
  const Client=createRequire(import.meta.url)(generated).PrismaClient;
  const actual=new Client({transactionOptions:{timeout:15000},datasources:{db:{url:`postgresql://recovery_fixture@localhost/neondb?host=${encodeURIComponent(socket)}`}}});
  io.locker=new Client({transactionOptions:{timeout:15000},datasources:{db:{url:`postgresql://recovery_fixture@localhost/neondb?host=${encodeURIComponent(socket)}`}}});
  const [r]=await actual.$queryRawUnsafe("SELECT current_database()='neondb' AND current_user='recovery_fixture' AND current_setting('listen_addresses')='' AS private");if(!r?.private)throw Error('private_fixture_required');
  io.db=new Proxy(actual,{get(db,key){if(key==='$transaction')return async(...args:any[])=>{
   const result=await db.$transaction(...args);
   if(result?.claimed===true){
    if(io.enrollAfterClaim){io.enrollAfterClaim=false;await db.durableAgentWorkflow.create({data:{id:'governance_active_'+hash(io.org),organizationId:io.org,workflowKind:'governance_baseline_active_v1',objective:'SIMULATED enrollment appearance; no activation',requestedByUserId:'owner',autonomyLevel:'observe',status:'paused_for_input',currentStep:'active',inputJson:{},stateJson:{},attemptCount:0,maxAttempts:1,version:0}})}
    if(io.expireReviewerAfterClaim){io.expireReviewerAfterClaim=false;await db.$executeRaw`UPDATE "DesktopSessionRecord" SET "expiresAt"=clock_timestamp()-interval '1 second' WHERE "id"=${io.org+'-reviewer'}`}
    if(io.changeTaskAfterClaim){io.changeTaskAfterClaim=false;await db.$executeRaw`UPDATE "BotTaskDraft" SET "version"=1 WHERE "id"=${io.taskId}`}
   }
   if(io.disableAfterIntent&&result?.status==='submission_intent')process.env.AXIOM_OUTLOOK_ACTIONS_ENABLED='false';
   if(io.loseReservationAck&&result?.status==='reserved'&&String(result.id).startsWith('governance_outbound_'))throw Error('SIMULATED lost acknowledgement after actual reservation commit');
   return result;
  };const value=db[key];return typeof value==='function'?value.bind(db):value}});
  await actual.$executeRawUnsafe('CREATE TABLE "DesktopSessionRecord" ("id" TEXT PRIMARY KEY,"organizationId" TEXT,"userId" TEXT,"expiresAt" TIMESTAMPTZ,"revokedAt" TIMESTAMPTZ,"lastUsedAt" TIMESTAMPTZ)');
  await actual.$executeRawUnsafe('CREATE TABLE "OrgMembership" ("organizationId" TEXT,"userId" TEXT,"acceptedAt" TIMESTAMPTZ,"role" TEXT,"providerScopes" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],PRIMARY KEY("organizationId","userId"))');
  await actual.$executeRawUnsafe('CREATE TABLE "BotTaskDraft" ("id" TEXT PRIMARY KEY,"organizationId" TEXT,"createdByUserId" TEXT,"status" TEXT,"version" INTEGER,"title" TEXT,"instruction" TEXT,"context" TEXT,"contentHash" TEXT)');
 });
 afterAll(async()=>{vi.unstubAllGlobals();vi.unstubAllEnvs();await io.locker?.$disconnect();await io.db?.$disconnect()});
 beforeEach(async()=>{
  vi.stubEnv('AXIOM_OUTLOOK_ACTIONS_ENABLED','true');vi.stubEnv('AXIOM_OUTLOOK_CONNECTIONS_ENABLED','true');
  Object.assign(io,{org:'outlook-'+randomUUID(),actor:'owner',sessionId:'',posts:0,graphReads:0,issuer:true,loseReservationAck:false,losePostAck:false,enrollAfterClaim:false,expireReviewerAfterClaim:false,disableAfterIntent:false,changeTaskAfterClaim:false,taskId:'',credentialExpiresAt:Date.now()+600000});
  for(const user of ['owner','reviewer']){
   await io.db.$executeRaw`INSERT INTO "DesktopSessionRecord" VALUES (${io.org+'-'+user},${io.org},${user},${new Date(Date.now()+600000)},NULL,NULL)`;
   await io.db.$executeRaw`INSERT INTO "OrgMembership" ("organizationId","userId","acceptedAt","role") VALUES (${io.org},${user},${new Date()},${user==='owner'?'owner':'security_reviewer'})`;
  }
  await io.db.tenantIntegrationConnection.create({data:{organizationId:io.org,provider:'outlook',status:'active',encryptedCredential:'SIMULATED_CIPHER',externalAccountId:'mailbox',scopesJson:['User.Read','Mail.ReadBasic','Calendars.Read','Mail.Send','Calendars.ReadWrite'],consentedByUserId:'owner',lastValidatedAt:new Date()}});
 });
 async function approved(kind:'outlook_mail_send'|'outlook_event_create',task=false){
  const content={kind,subject:'Exact reviewed subject',body:'Exact reviewed body',...(kind==='outlook_mail_send'?{to:['test@example.com']}:{startUtc:'2030-01-02T10:00:00Z',endUtc:'2030-01-02T11:00:00Z',attendees:['test@example.com']})};
  const draft=await post({action:'request',intentId:randomUUID(),...content});expect({status:draft.status,body:await draft.clone().json()}).toMatchObject({status:200});let saved=(await draft.json()).data.actions[0];
  if(task){
   // Seed a supported shared-contract task-bound action using explicitly
   // simulated request authority; this does not add a task field to Outlook HTTP.
   const taskId='bot_'+randomUUID().replaceAll('-','').repeat(2),text={title:'Exact Outlook task',instruction:'Review one synthetic action',context:''};io.taskId=taskId;
   await io.db.$executeRaw`INSERT INTO "BotTaskDraft" VALUES (${taskId},${io.org},'owner','draft',0,${text.title},${text.instruction},${text.context},${savedBotTaskContentHash(text)})`;
   const sourceTask=await io.db.$transaction((tx:any)=>readBotActionTaskBinding(tx,io.org,'owner',{taskId,expectedVersion:0}));
   const seeded={...saved.intent,intentId:randomUUID(),sourceTask};saved=await createConnectedActionStore(io.db,{assertCurrent:async()=>{},readCurrentIntent:async()=>seeded}).request({organizationId:io.org,actorUserId:'owner',sessionId:io.org+'-owner'},seeded);
  }
  io.actor='reviewer';const review=await post({action:'approve',id:saved.id,expectedVersion:0});expect({status:review.status,body:await review.clone().json()}).toMatchObject({status:200,body:{data:{actions:[{state:'approved'}]}}});io.actor='owner';
  vi.stubGlobal('fetch',vi.fn(async(url:string,init:RequestInit)=>{
   await io.locker.$transaction(async(tx:any)=>{const [lock]=await tx.$queryRaw`SELECT pg_try_advisory_xact_lock(hashtext(${'governance_org_'+hash(io.org)})) AS held`;expect(lock.held).toBe(true);await tx.$queryRaw`SELECT "id" FROM "DurableAgentWorkflow" WHERE "organizationId"=${io.org} FOR UPDATE NOWAIT`});
   if(init.method==='POST'){
    io.posts++;expect(url).toBe('https://graph.microsoft.com/v1.0'+(kind==='outlook_mail_send'?'/me/sendMail':'/me/events'));
    expect(await io.db.durableAgentWorkflow.count({where:{organizationId:io.org,workflowKind:'governance_outbound_v1',currentStep:'submission_intent'}})).toBe(1);
    const payload=JSON.parse(String(init.body));expect(kind==='outlook_mail_send'?payload.message.subject:payload.subject).toBe(content.subject);
    if(io.losePostAck)throw Error('SIMULATED lost Graph response');
    return kind==='outlook_mail_send'?new Response(null,{status:202}):Response.json({id:'event-1'},{status:201});
   }
   io.graphReads++;expect(await io.db.durableAgentWorkflow.count({where:{organizationId:io.org,workflowKind:'governance_outbound_v1'}})).toBe(1);
   if(url.endsWith('/me?$select=id'))return Response.json({id:'mailbox'});
   expect(kind).toBe('outlook_event_create');expect(url).toContain('/me/events/event-1?');return Response.json({id:'event-1',transactionId:saved.intent.intentId,subject:content.subject,body:{contentType:'text',content:content.body},start:{dateTime:'2030-01-02T10:00:00',timeZone:'UTC'},end:{dateTime:'2030-01-02T11:00:00',timeZone:'UTC'},attendees:[{type:'required',emailAddress:{address:'test@example.com'}}],webLink:'https://outlook.office.com/calendar/item/event-1'});
  }));
  return saved;
 }
 const execute=(saved:any)=>post({action:'execute',id:saved.id,expectedVersion:1});
 const slots=()=>io.db.durableAgentWorkflow.findMany({where:{organizationId:io.org,workflowKind:'governance_outbound_v1'}});
 describe.each(['outlook_mail_send','outlook_event_create'] as const)('%s',kind=>{
  it('actual HTTP review/claim records one intent before an unlocked fixed POST and does not claim quiescence',async()=>{
   const saved=await approved(kind),result=await execute(saved);expect({status:result.status,body:await result.clone().json()}).toMatchObject({status:200,body:{data:{actions:[{state:'confirmed',attemptCount:1}]}}});
   const [slot]=await slots();expect(slot).toMatchObject({currentStep:'submission_intent',version:1});expect(slot.inputJson.binding.profile).toBe(kind==='outlook_mail_send'?'outlook.mail_send.v1':'outlook.event_create.v1');expect(JSON.stringify(slot)).not.toContain('SIMULATED_EXISTING_OUTLOOK_TOKEN');
   await execute(saved);expect(io.posts).toBe(1);expect(await slots()).toHaveLength(1);
  });
  it('actual canonical unavailable leaves the exact approved attempt unchanged before any Graph access',async()=>{
   const saved=await approved(kind);io.issuer=false;expect((await execute(saved)).status).toBe(409);expect(await io.db.durableAgentWorkflow.findUnique({where:{id:saved.id}})).toMatchObject({currentStep:'approved',attemptCount:0,version:1});expect(await slots()).toHaveLength(0);expect(io.posts+io.graphReads).toBe(0);
  });
  it('lost Graph acknowledgement remains unknown and never resends or closes its intent',async()=>{
   const saved=await approved(kind);io.losePostAck=true;const result=await execute(saved);expect((await result.json()).data.actions[0]).toMatchObject({state:'unknown',attemptCount:1});expect((await slots())[0]).toMatchObject({currentStep:'submission_intent',version:1});await execute(saved);expect(io.posts).toBe(1);
  });
  it('lost reservation acknowledgement retains one committed blocker with no Graph access',async()=>{
   const saved=await approved(kind);io.loseReservationAck=true;const result=await execute(saved);expect((await result.json()).data.actions[0]).toMatchObject({state:'refused',attemptCount:1});expect((await slots())[0]).toMatchObject({currentStep:'reserved',version:0});await execute(saved);expect(await slots()).toHaveLength(1);expect(io.posts+io.graphReads).toBe(0);
  });
  it('enrollment after claim refuses before slot and Graph access',async()=>{
   const saved=await approved(kind);io.enrollAfterClaim=true;const result=await execute(saved);expect((await result.json()).data.actions[0]).toMatchObject({state:'refused',attemptCount:1});expect(await slots()).toHaveLength(0);expect(io.posts+io.graphReads).toBe(0);
  });
  it('existing current executor can re-pair without reviving the original requester session',async()=>{
   const saved=await approved(kind),next=io.org+'-owner-new';await io.db.$executeRaw`INSERT INTO "DesktopSessionRecord" VALUES (${next},${io.org},'owner',${new Date(Date.now()+600000)},NULL,NULL)`;await io.db.$executeRaw`UPDATE "DesktopSessionRecord" SET "revokedAt"=clock_timestamp() WHERE "id"=${io.org+'-owner'}`;io.sessionId=next;
   const result=await execute(saved);expect((await result.json()).data.actions[0]).toMatchObject({state:'confirmed',attemptCount:1});expect(io.posts).toBe(1);
  });
 });
 it('original independent reviewer expiry after claim preserves refusal with no outbound slot',async()=>{
  const saved=await approved('outlook_mail_send');io.expireReviewerAfterClaim=true;const result=await execute(saved);expect((await result.json()).data.actions[0]).toMatchObject({state:'refused',attemptCount:1});expect(await slots()).toHaveLength(0);expect(io.posts+io.graphReads).toBe(0);
 });
 it('action flag disabled after committed intent withholds the POST and retains intent history',async()=>{
  const saved=await approved('outlook_event_create');io.disableAfterIntent=true;const result=await execute(saved);expect((await result.json()).data.actions[0]).toMatchObject({state:'refused',attemptCount:1});expect((await slots())[0]).toMatchObject({currentStep:'submission_intent',version:1});expect(io.posts).toBe(0);
 });
 it('actual changed task version after claim refuses without resetting its reviewed source association',async()=>{
  const saved=await approved('outlook_mail_send',true);io.changeTaskAfterClaim=true;const result=await execute(saved);expect((await result.json()).data.actions[0]).toMatchObject({state:'refused',attemptCount:1,intent:{sourceTask:{taskId:io.taskId,taskVersion:0}}});expect(await slots()).toHaveLength(0);expect(io.posts+io.graphReads).toBe(0);
 });
});
