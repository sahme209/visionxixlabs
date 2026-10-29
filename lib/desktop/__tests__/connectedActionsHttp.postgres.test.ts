import {beforeAll,afterAll,beforeEach,describe,it,expect,vi} from 'vitest';
import {NextRequest} from 'next/server';
import {createRequire} from 'node:module';
import {randomUUID} from 'node:crypto';
import {realpathSync,statSync} from 'node:fs';
const io=vi.hoisted(()=>({db:null as any,org:'',actor:'owner',mutations:0}));
vi.mock('@/lib/db',()=>({get prisma(){return io.db}}));
vi.mock('@/lib/desktop/desktopCommercialAccess',()=>({readDesktopCommercialAccess:async()=>({allowed:true})}));
// The production resolver touches the session on a separate pooled connection.
// Real PostgreSQL row locks must not be hidden by a no-op principal mock.
vi.mock('@/lib/desktop/resolveRequestDesktopSession',()=>({resolveRequestDesktopSession:async()=>{await io.db.$executeRaw`UPDATE "DesktopSessionRecord" SET "lastUsedAt"=clock_timestamp() WHERE "id"=${io.org+'-'+io.actor}`;const rows=await io.db.$queryRaw`SELECT "role" FROM "OrgMembership" WHERE "organizationId"=${io.org} AND "userId"=${io.actor}`;const role=rows[0]?.role;return{id:io.org+'-'+io.actor,organizationId:io.org,userId:io.actor,credentialKind:'desktop_session',capabilities:role==='owner'?['workspace:read','connections:manage','agent:approve']:role==='security_reviewer'?['workspace:read','agent:approve']:['workspace:read']}}}));
vi.mock('@/lib/security/credentialVault',()=>({decryptScopedCredential:()=>JSON.stringify({accessToken:'synthetic-only-token',expiresAt:Date.now()+600000})}));
import {createConnectedActionsHttp} from '../connectedActionsHttp';
import {resolveRequestDesktopSession} from '../resolveRequestDesktopSession';
const handleConnectedActions=(r:NextRequest,p:string)=>createConnectedActionsHttp({repo:io.db,readPrincipal:r=>resolveRequestDesktopSession(r),readConnection:(organizationId,provider)=>io.db.tenantIntegrationConnection.findUnique({where:{organizationId_provider:{organizationId,provider}}}),commercialAllowed:async()=>true,decrypt:()=>JSON.stringify({accessToken:'synthetic-only-token',expiresAt:Date.now()+600000}),fetch:(...args)=>fetch(...args),enabled:()=>true})(r,p);
const socket=process.env.AXIOM_SLACK_APPROVAL_PG_SOCKET;
const team='11111111-1111-4111-8111-111111111111',viewer='22222222-2222-4222-8222-222222222222';
const post=(body:unknown)=>handleConnectedActions(new NextRequest('https://owned.test/api/desktop/integrations/linear/actions',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)}),'linear');
const read=(query:string)=>handleConnectedActions(new NextRequest('https://owned.test/api/desktop/integrations/linear/actions'+query),'linear');
describe.skipIf(!socket)('Connected actions full service real owned PostgreSQL',()=>{
 beforeAll(async()=>{if(!socket||!/^\/private\/tmp\/axiom-slack-approval-pg-[^/]+\/socket$/.test(socket)||realpathSync(socket)!==socket||(statSync(socket).mode&0o077)!==0)throw Error('owned_socket_required');const generated=process.env.AXIOM_SLACK_APPROVAL_PG_CLIENT;if(!generated||!/^\/private\/tmp\/axiom-slack-approval-pg-evidence-[^/]+\/generated\/index\.js$/.test(generated))throw Error('owned_client_required');const Client=createRequire(import.meta.url)(generated).PrismaClient;io.db=new Client({datasources:{db:{url:`postgresql://recovery_fixture@localhost/neondb?host=${encodeURIComponent(socket)}`}}});await io.db.$executeRawUnsafe('CREATE TABLE "DesktopSessionRecord" ("id" text PRIMARY KEY,"organizationId" text,"userId" text,"expiresAt" timestamptz,"revokedAt" timestamptz,"lastUsedAt" timestamptz)');await io.db.$executeRawUnsafe('CREATE TABLE "OrgMembership" ("organizationId" text,"userId" text,"acceptedAt" timestamptz,"role" text,PRIMARY KEY("organizationId","userId"))')});
 afterAll(async()=>{for(const key of ['AXIOM_CONNECTED_APP_ACTIONS_ENABLED','AXIOM_LINEAR_ISSUE_ACTIONS_ENABLED'])delete process.env[key];vi.unstubAllGlobals();await io.db?.$disconnect()});
 beforeEach(async()=>{process.env.AXIOM_CONNECTED_APP_ACTIONS_ENABLED='true';process.env.AXIOM_LINEAR_ISSUE_ACTIONS_ENABLED='true';io.org='org-'+randomUUID();io.actor='owner';io.mutations=0;for(const user of ['owner','reviewer']){await io.db.$executeRaw`INSERT INTO "DesktopSessionRecord" VALUES (${io.org+'-'+user},${io.org},${user},${new Date(Date.now()+600000)},NULL,NULL)`;await io.db.$executeRaw`INSERT INTO "OrgMembership" VALUES (${io.org},${user},${new Date()},${user==='owner'?'owner':'security_reviewer'})`}await io.db.tenantIntegrationConnection.create({data:{organizationId:io.org,provider:'linear',status:'active',encryptedCredential:'synthetic-cipher',externalAccountId:viewer,scopesJson:['read','write'],consentedByUserId:'owner',lastValidatedAt:new Date()}});vi.stubGlobal('fetch',vi.fn(async(url:string,init:RequestInit)=>{expect(url).toBe('https://api.linear.app/graphql');const body=JSON.parse(String(init.body));if(/\bmutation\b/.test(body.query)){io.mutations++;throw Error('no_provider_mutation_authorized')}if(body.query.includes('AxiomActionTargets'))return Response.json({data:{viewer:{id:viewer},organization:{id:team,name:'Synthetic Axiom'},teams:{nodes:[{id:team,name:'Engineering',key:'AX'}],pageInfo:{hasNextPage:false}}}});return Response.json({data:{team:{id:team,states:{nodes:[]},issues:{nodes:[],pageInfo:{hasNextPage:false}}}}})}))});
 async function draft(){const intentId=randomUUID(),r=await post({action:'request',kind:'linear_issue_create',intentId,teamId:team,title:'Synthetic acceptance'});expect({status:r.status,body:await r.clone().json()}).toMatchObject({status:200,body:{ok:true}});return{...(await r.json()).data.actions[0],intentId}}
 it('saves and recovers an exact draft without self-blocking the session touch',async()=>{const d=await draft();expect(d.state).toBe('requested');const r=await read('?intentId='+d.intentId);expect(r.status).toBe(200);expect((await r.json()).data.actions[0].id).toBe(d.id);expect(await io.db.durableAgentWorkflow.count({where:{organizationId:io.org}})).toBe(1);expect(io.mutations).toBe(0)},15000);
 it('requires a distinct current reviewer and retains history after cancellation',async()=>{const d=await draft();expect((await post({action:'approve',id:d.id,expectedVersion:0})).status).not.toBe(200);io.actor='reviewer';const a=await post({action:'approve',id:d.id,expectedVersion:0});expect(a.status).toBe(200);expect((await a.json()).data.actions[0].state).toBe('approved');io.actor='owner';const c=await post({action:'cancel',id:d.id,expectedVersion:1});expect(c.status).toBe(200);expect((await c.json()).data.actions[0].state).toBe('cancelled');expect(io.mutations).toBe(0)},15000);
 it('refuses revoked session authority inside the transaction without saving a draft',async()=>{await io.db.$executeRaw`UPDATE "DesktopSessionRecord" SET "revokedAt"=clock_timestamp() WHERE "id"=${io.org+'-owner'}`;const r=await post({action:'request',kind:'linear_issue_create',intentId:randomUUID(),teamId:team,title:'Must refuse'});expect(r.status).toBe(401);expect(await io.db.durableAgentWorkflow.count({where:{organizationId:io.org}})).toBe(0);expect(io.mutations).toBe(0)});
 async function teamsSetup(failSend=false,licenseDenied=false){
  const channel='19:acceptance@thread.tacv2';
  await io.db.tenantIntegrationConnection.create({data:{organizationId:io.org,provider:'teams',status:'active',encryptedCredential:'synthetic-cipher',externalAccountId:team,scopesJson:['User.Read','Team.ReadBasic.All','Channel.ReadBasic.All','ChannelMessage.Send'],consentedByUserId:'owner',lastValidatedAt:new Date()}});
  vi.stubGlobal('fetch',vi.fn(async(url:string,init:RequestInit)=>{
   if(url==='https://graph.microsoft.com/v1.0/me/joinedTeams?$select=id,displayName,isArchived')return licenseDenied?Response.json({error:{code:'Forbidden',message:'Failed to get license information for the user. Ensure user has a valid Office365 license assigned to them.'}},{status:403}):Response.json({value:[{id:team,displayName:'Synthetic team',isArchived:false}]});
   if(url===`https://graph.microsoft.com/v1.0/teams/${team}/channels?$select=id,displayName,membershipType`)return Response.json({value:[{id:channel,displayName:'Releases',membershipType:'standard'},{id:'19:private@thread.tacv2',displayName:'Private',membershipType:'private'}]});
   expect(url).toBe(`https://graph.microsoft.com/v1.0/teams/${team}/channels/${encodeURIComponent(channel)}/messages`);expect(init.method).toBe('POST');io.mutations++;
   expect(JSON.parse(String(init.body))).toEqual({body:{contentType:'text',content:'Synthetic governed notification'}});
   if(failSend)throw Error('synthetic lost acknowledgement');
   return Response.json({id:'1234567890123',channelIdentity:{teamId:team,channelId:channel}},{status:201});
  }));
  const send=(body:unknown)=>handleConnectedActions(new NextRequest('https://owned.test/api/desktop/integrations/teams/actions',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)}),'teams');
  const draft=()=>send({action:'request',kind:'teams_channel_message',intentId:randomUUID(),teamId:team,channelId:channel,text:'Synthetic governed notification'});
  return{send,draft,channel};
 }
 it('Teams mock journey discovers targets, requires distinct review, sends once and saves the exact receipt',async()=>{
  const t=await teamsSetup(),d=await t.draft();expect(d.status).toBe(200);const a=(await d.json()).data.actions[0];
  expect((await t.send({action:'approve',id:a.id,expectedVersion:0})).status).not.toBe(200);
  io.actor='reviewer';expect((await t.send({action:'approve',id:a.id,expectedVersion:0})).status).toBe(200);
  io.actor='owner';const r=await t.send({action:'execute',id:a.id,expectedVersion:1});expect(r.status).toBe(200);expect((await r.json()).data.actions[0]).toMatchObject({state:'confirmed',attemptCount:1,receipt:{provider:'teams',teamId:team,channelId:t.channel,messageId:'1234567890123'}});
  expect((await t.send({action:'execute',id:a.id,expectedVersion:1})).status).toBe(200);expect(io.mutations).toBe(1);
 });
 it('Teams mock lost acknowledgement is durable unknown and is never resent',async()=>{
  const t=await teamsSetup(true),d=(await (await t.draft()).json()).data.actions[0];io.actor='reviewer';expect((await t.send({action:'approve',id:d.id,expectedVersion:0})).status).toBe(200);io.actor='owner';
  const r=await t.send({action:'execute',id:d.id,expectedVersion:1});expect(r.status).toBe(200);expect((await r.json()).data.actions[0]).toMatchObject({state:'unknown',attemptCount:1});
  await t.send({action:'execute',id:d.id,expectedVersion:1});expect(io.mutations).toBe(1);
 });
 it('Teams refuses private channel action plans before any mocked send',async()=>{
  const t=await teamsSetup();const r=await t.send({action:'request',kind:'teams_channel_message',intentId:randomUUID(),teamId:team,channelId:'19:private@thread.tacv2',text:'Must refuse'});expect(r.status).toBe(409);expect(await io.db.durableAgentWorkflow.count({where:{organizationId:io.org}})).toBe(0);
  expect(io.mutations).toBe(0);
 });

});
