import {beforeAll,afterAll,beforeEach,describe,it,expect,vi} from 'vitest';
import {NextRequest} from 'next/server';
import {createRequire} from 'node:module';import {randomUUID} from 'node:crypto';import {realpathSync,statSync} from 'node:fs';
const io=vi.hoisted(()=>({db:null as any,locker:null as any,scope:null as any,org:'',issuer:true,posts:0,postclaimCredentialReads:0,active:'',loseAck:false,loseReservationAck:false,enrollAfterClaim:false,demoteAfterClaim:false,heartbeatCalls:0,credentialDecrypts:0,expiresAt:0}));
vi.mock('@/lib/db',()=>({get prisma(){return io.db}}));
vi.mock('@/lib/api/rateLimiter',()=>({consumeToken:()=>({allowed:true})}));
vi.mock('@/lib/desktop/desktopCommercialAccess',()=>({readDesktopCommercialAccess:async()=>({allowed:true})}));
// Real current rows and heartbeat behavior, but request authentication is SIMULATED.
vi.mock('@/lib/desktop/resolveRequestDesktopSession',()=>({resolveRequestDesktopSession:async(_r:any,options:any)=>{
 const s=io.scope;if(options.recordHeartbeat!==false){io.heartbeatCalls++;await io.db.$executeRaw`UPDATE "DesktopSessionRecord" SET "lastUsedAt"=clock_timestamp() WHERE "id"=${s.sessionId}`}
 const sessions=await io.db.$queryRaw`SELECT "expiresAt","revokedAt" FROM "DesktopSessionRecord" WHERE "id"=${s.sessionId} AND "organizationId"=${s.organizationId} AND "userId"=${s.actorUserId}`;
 if(sessions.length!==1||sessions[0].revokedAt||sessions[0].expiresAt<=new Date())return null;
 const m=await io.db.orgMembership.findFirst({where:{organizationId:s.organizationId,userId:s.actorUserId}}),owner=['owner','admin'].includes(m?.role);
 return{id:s.sessionId,organizationId:s.organizationId,userId:s.actorUserId,credentialKind:'desktop_session',role:m?.role,capabilities:owner?['workspace:read','github:read','deploy:execute','agent:approve','connections:manage']:m?.role==='security_reviewer'?['workspace:read','github:read','agent:approve']:['workspace:read','github:read']};
}}));
vi.mock('@/lib/security/credentialVault',()=>({decryptScopedCredential:()=>{io.credentialDecrypts++;return JSON.stringify({cloudId:'11111111-1111-4111-8111-111111111111',accessToken:'SIMULATED_EXISTING_JIRA_TOKEN',expiresAt:io.expiresAt})}}));
vi.mock('@/lib/governance/intelligence/jiraOutboundIssuer',async original=>{const actual:any=await original();return{readJiraOutboundIssuerDigest:()=>io.issuer?'d'.repeat(64):actual.readJiraOutboundIssuerDigest()}});
import {handleJiraTicketLifecycle} from '../jiraTicketLifecycleHttp';
import {createJiraTicketLifecycleStore} from '@/lib/releaseops/jiraTicketLifecycleStore';
import {sha256ContentHash as hash} from '@/lib/tauri/contentHash';
import {collectJiraTerminalTransitions} from '@/lib/releaseops/jiraTicketTransport';
const socket=process.env.AXIOM_JIRA_LEGACY_PG_SOCKET;
/** Actual HTTP/store/fixed transport/transactions/history; positive canonical
 * identity, authentication, initial preview source and provider replies SIMULATED. */
describe.skipIf(!socket)('legacy Jira fixed outbound owned PostgreSQL',()=>{
 beforeAll(async()=>{
  const generated=process.env.AXIOM_JIRA_LEGACY_PG_CLIENT;
  if(!socket||!/^\/private\/tmp\/axiom-jira-legacy-pg-[^/]+\/socket$/.test(socket)||realpathSync(socket)!==socket||(statSync(socket).mode&0o077)!==0||!generated||!/^\/private\/tmp\/axiom-jira-legacy-pg-evidence-[^/]+\/generated\/index\.js$/.test(generated))throw Error('owned_fixture_required');
  const Client=createRequire(import.meta.url)(generated).PrismaClient;
  const actual=new Client({transactionOptions:{timeout:15000},datasources:{db:{url:`postgresql://recovery_fixture@localhost/neondb?host=${encodeURIComponent(socket)}`}}});
  io.locker=new Client({datasources:{db:{url:`postgresql://recovery_fixture@localhost/neondb?host=${encodeURIComponent(socket)}`}}});
  const [r]=await actual.$queryRawUnsafe("SELECT current_database()='neondb' AND current_user='recovery_fixture' AND current_setting('listen_addresses')='' AS private");if(!r?.private)throw Error('private_fixture_required');
  io.db=new Proxy(actual,{get(db,key){
   if(key==='$transaction')return async(...args:any[])=>{const result=await db.$transaction(...args);
    if(result?.claimed===true){if(io.enrollAfterClaim){io.enrollAfterClaim=false;await db.durableAgentWorkflow.create({data:{id:'governance_active_'+hash(io.org),organizationId:io.org,workflowKind:'governance_baseline_active_v1',objective:'SIMULATED enrollment appearance only',requestedByUserId:'owner',autonomyLevel:'observe',status:'paused_for_input',currentStep:'active',inputJson:{},stateJson:{},attemptCount:0,maxAttempts:1,version:0}})}if(io.demoteAfterClaim){io.demoteAfterClaim=false;await db.orgMembership.updateMany({where:{organizationId:io.org,userId:'reviewer'},data:{role:'read_only'}})}}
    if(io.loseReservationAck&&result?.status==='reserved')throw Error('SIMULATED lost acknowledgement after real reservation commit');return result;
   };
   if(key==='tenantIntegrationConnection')return new Proxy(db.tenantIntegrationConnection,{get(delegate,k){if(k==='findUnique')return async(...args:any[])=>{const row=await delegate.findUnique(...args);if(io.active){const state=await db.durableAgentWorkflow.findUnique({where:{id:io.active}});if(state?.currentStep==='dispatching'){expect(await db.durableAgentWorkflow.count({where:{organizationId:io.org,workflowKind:'governance_outbound_v1',currentStep:'reserved'}})).toBe(1);io.postclaimCredentialReads++}}return row};const v=delegate[k];return typeof v==='function'?v.bind(delegate):v}});
   const v=db[key];return typeof v==='function'?v.bind(db):v;
  }});
  await actual.$executeRawUnsafe('CREATE TABLE "DesktopSessionRecord" ("id" TEXT PRIMARY KEY,"organizationId" TEXT,"userId" TEXT,"expiresAt" TIMESTAMPTZ,"revokedAt" TIMESTAMPTZ,"lastUsedAt" TIMESTAMPTZ)');
 });
 afterAll(async()=>{vi.unstubAllGlobals();vi.unstubAllEnvs();await io.locker?.$disconnect();await io.db?.$disconnect()});
 beforeEach(async()=>{
  vi.stubEnv('AXIOM_JIRA_TICKET_LIFECYCLE_ENABLED','true');vi.stubEnv('AXIOM_JIRA_TICKET_WRITES_ENABLED','true');
  Object.assign(io,{org:'legacy-'+randomUUID(),issuer:true,posts:0,postclaimCredentialReads:0,active:'',loseAck:false,loseReservationAck:false,enrollAfterClaim:false,demoteAfterClaim:false,heartbeatCalls:0,credentialDecrypts:0,expiresAt:Date.now()+600000});
  for(const user of ['owner','reviewer']){await io.db.orgMembership.create({data:{organizationId:io.org,userId:user,role:user==='owner'?'owner':'security_reviewer',acceptedAt:new Date()}});await io.db.$executeRaw`INSERT INTO "DesktopSessionRecord" VALUES (${io.org+'-'+user},${io.org},${user},${new Date(Date.now()+600000)},NULL,NULL)`}
 });
 async function approved(kind:'publish'|'close'){
  const owner={organizationId:io.org,actorUserId:'owner',sessionId:io.org+'-owner'},reviewer={...owner,actorUserId:'reviewer',sessionId:io.org+'-reviewer'};io.scope=owner;
  const intake={kind:'resolution_draft',id:'release',tenantId:io.org};const release=await io.db.tauriDeploymentRequest.create({data:{id:'release-'+io.org,organizationId:io.org,requesterUserId:'owner',status:'draft',version:2,intakeJson:intake}});
  const revision=new Date(Date.now()-1000),siteId='11111111-1111-4111-8111-111111111111',connectionId='jira-'+io.org;
  await io.db.tenantIntegrationConnection.create({data:{id:connectionId,organizationId:io.org,provider:'jira',status:'active',encryptedCredential:'SIMULATED',externalAccountId:siteId,scopesJson:['read:jira-work','write:jira-work'],consentedByUserId:'owner',updatedAt:revision}});
  const payload={fields:{project:{id:'1'},issuetype:{id:'2'},summary:'Exact reviewed publish'}};
  const base:any={organizationId:io.org,releaseId:release.id,releaseVersion:2,connectionId,connectionRevision:revision.toISOString(),siteId,expiresAt:new Date(Date.now()+600000).toISOString(),sourceDigest:hash({requestVersion:2,intake}),payload,payloadDigest:hash(payload),kind:'publish'};
  const seed=createJiraTicketLifecycleStore(io.db,{transportMode:'provider',assertCurrent:async()=>{},readCurrentAction:async(_tx,_s,c)=>c,readWriteReadiness:async()=>true});
  const published=await seed.prepare(owner,{candidate:base,executorUserId:'owner',clientRequestId:randomUUID()});
  let candidate=base,record=published;
  const transitions={transitions:[{id:'31',name:'Finish',hasScreen:false,to:{id:'3',name:'Done',statusCategory:{key:'done'}}}]};
  if(kind==='close'){
   // Synthetic original provider receipt seeds the legacy close prerequisite;
   // it is never represented as real provider or customer acceptance.
   await seed.approve(reviewer,{actionId:published.id,expectedVersion:0,clientRequestId:randomUUID()});await seed.claim(owner,published.id);await seed.finish(owner,published.id,{status:'confirmed',issue:{id:'4',key:'KAN-4'}});
   const closePayload={transition:{id:'31'}};candidate={...base,kind:'close',publishActionId:published.id,issue:{id:'4',key:'KAN-4'},transition:{id:'31',targetStatusId:'3',targetCategory:'done',discoveryDigest:collectJiraTerminalTransitions(transitions).discoveryDigest},payload:closePayload,payloadDigest:hash(closePayload)};record=await seed.prepare(owner,{candidate,executorUserId:'owner',clientRequestId:randomUUID()});
  }
  const send=(mode:true|'dispatch',version=1)=>handleJiraTicketLifecycle(new NextRequest('https://owned.test/api/desktop/deployments/'+release.id+'/jira-actions',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({expectedVersion:version,clientRequestId:randomUUID()})}),release.id,record.id,mode);
  io.scope=reviewer;const review=await send(true,0);expect({status:review.status,body:await review.clone().json()}).toMatchObject({status:201});io.scope=owner;io.active=record.id;
  vi.stubGlobal('fetch',vi.fn(async(url:string,init:RequestInit)=>{
   await io.locker.$transaction(async(tx:any)=>{const [lock]=await tx.$queryRaw`SELECT pg_try_advisory_xact_lock(hashtext(${'governance_org_'+hash(io.org)})) AS held`;expect(lock.held).toBe(true);await tx.$queryRaw`SELECT "id" FROM "DurableAgentWorkflow" WHERE "organizationId"=${io.org} FOR UPDATE NOWAIT`});
   expect(url.startsWith('https://api.atlassian.com/ex/jira/'+siteId+'/rest/api/3/issue')).toBe(true);
   if(init.method==='POST'){io.posts++;expect(url.endsWith(kind==='publish'?'/issue':'/issue/4/transitions')).toBe(true);expect(JSON.parse(String(init.body))).toEqual(candidate.payload);expect(await io.db.durableAgentWorkflow.count({where:{organizationId:io.org,workflowKind:'governance_outbound_v1',currentStep:'submission_intent'}})).toBe(1);if(io.loseAck)throw Error('SIMULATED lost provider acknowledgement');return kind==='publish'?Response.json({id:'5',key:'KAN-5'},{status:201}):new Response(null,{status:204})}
   return Response.json(url.includes('/transitions')?transitions:{id:'4',key:'KAN-4',fields:{status:{id:'3',statusCategory:{key:'done'}}}});
  }));
  return{owner,reviewer,record,candidate,execute:()=>send('dispatch'),saved:()=>io.db.durableAgentWorkflow.findUnique({where:{id:record.id}}),slots:()=>io.db.durableAgentWorkflow.findMany({where:{organizationId:io.org,workflowKind:'governance_outbound_v1'}})};
 }
 describe.each(['publish','close'] as const)('%s',kind=>{
  it('actual legacy HTTP preserves actor-ID review then records one unlocked fixed write intent',async()=>{const f=await approved(kind),r=await f.execute();expect({status:r.status,body:await r.clone().json()}).toMatchObject({status:201,body:{data:{actions:[{status:'confirmed',attemptCount:1}]}}});const [slot]=await f.slots();expect(slot).toMatchObject({currentStep:'submission_intent',version:1});expect(slot.inputJson.binding.profile).toBe(kind==='publish'?'jira.issue_create.v1':'jira.legacy_transition.v1');expect(JSON.stringify(slot)).not.toContain('SIMULATED_EXISTING_JIRA_TOKEN');expect(io.posts).toBe(1);expect(io.postclaimCredentialReads).toBe(1);expect(io.heartbeatCalls).toBe(0);await f.execute();expect(io.posts).toBe(1)});
  it('actual canonical unavailable preserves approval and does not resolve preclaim credential',async()=>{const f=await approved(kind);io.issuer=false;expect((await f.execute()).status).toBe(409);expect(await f.saved()).toMatchObject({currentStep:'approved',attemptCount:0});expect(await f.slots()).toHaveLength(0);expect(io.posts).toBe(0);expect(io.postclaimCredentialReads).toBe(0);expect(io.credentialDecrypts).toBe(0)});
  it('lost provider acknowledgement remains unknown with no second write',async()=>{const f=await approved(kind);io.loseAck=true;const r=await f.execute();expect((await r.json()).data.actions[0]).toMatchObject({status:'unknown',attemptCount:1});expect((await f.slots())[0]).toMatchObject({currentStep:'submission_intent'});await f.execute();expect(io.posts).toBe(1)});
  it('lost reservation acknowledgement preserves committed blocker without transport credential',async()=>{const f=await approved(kind);io.loseReservationAck=true;const r=await f.execute();expect((await r.json()).data.actions[0]).toMatchObject({status:'refused',attemptCount:1});expect((await f.slots())[0]).toMatchObject({currentStep:'reserved'});expect(io.posts).toBe(0);expect(io.postclaimCredentialReads).toBe(0)});
  it('enrollment after claim refuses before slot or transport credential',async()=>{const f=await approved(kind);io.enrollAfterClaim=true;const r=await f.execute();expect((await r.json()).data.actions[0]).toMatchObject({status:'refused',attemptCount:1});expect(await f.slots()).toHaveLength(0);expect(io.posts).toBe(0)});
 });
 it('current approver demotion withholds write and preserves unknown when refusal recording loses authority',async()=>{const f=await approved('publish');io.demoteAfterClaim=true;const r=await f.execute();expect((await r.json()).data.actions[0]).toMatchObject({status:'unknown',attemptCount:1,providerWritePerformed:null});expect(await f.slots()).toHaveLength(0);expect(io.posts).toBe(0)});
 it('retains actual user-ID review semantics without treating a historical reviewer session as recorded authority',async()=>{const f=await approved('publish');const before=await f.saved();expect(before.stateJson.approval).not.toHaveProperty('approverSessionId');await io.db.$executeRaw`UPDATE "DesktopSessionRecord" SET "revokedAt"=clock_timestamp() WHERE "id"=${f.reviewer.sessionId}`;const r=await f.execute();expect((await r.json()).data.actions[0]).toMatchObject({status:'confirmed',attemptCount:1});expect(io.posts).toBe(1)});
});
