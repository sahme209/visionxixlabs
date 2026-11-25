import { createDatabaseClient } from "@/lib/database/createDatabaseClient";
import {afterAll,beforeAll,describe,expect,it,vi} from 'vitest';
import {PrismaClient} from '@/lib/prismaClient';
import {randomBytes,randomUUID} from 'node:crypto';
import {realpathSync,statSync} from 'node:fs';
import {NextRequest} from 'next/server';
const f=vi.hoisted(()=>({client:undefined as unknown as PrismaClient}));
vi.mock('@/lib/db',()=>({get prisma(){return f.client;}}));
import {resolveRequestDesktopSession} from '../resolveRequestDesktopSession';
import {createDesktopSession,revokeDesktopSession,setDesktopSessionStore} from '../desktopSession';
import {createPrivatePrismaDesktopSessionStore} from '../privateDesktopSessionStore.prisma';
import {mintDesktopToken} from '../desktopToken';
import {id} from '@/lib/domain/ids';
import {mintApiKey} from '@/lib/security/apiKeyCrypto';
import {enrollNewPublicWorkspace} from '@/lib/billing/publicFreeEnrollment';
import {GET as readReleases} from '@/app/api/desktop/deployments/route';
import {batchHistoryPageSchema} from '@/lib/desktop/batchHistoryContract';
import {GET as readClosure, POST as recordClosure} from '@/app/api/desktop/deployments/[id]/close/route';
const socket=process.env.AXIOM_OWNED_AGENT_PG_SOCKET;
describe.skipIf(!socket)('actual HMAC → durable paired session → current membership and billing authority',()=>{
 beforeAll(async()=>{
  if(!socket||!/^\/(?:private\/)?tmp\/axiom-agent-chain-[^/]+\/socket$/.test(socket)||realpathSync(socket)!==socket||(statSync(socket).mode&0o077)!==0||(process.getuid&&statSync(socket).uid!==process.getuid()))throw Error('owned_private_socket_required');
  f.client=createDatabaseClient(`postgresql://agent_fixture@localhost/axiom_agent_fixture?host=${encodeURIComponent(socket)}`);
  const [binding]=await f.client.$queryRawUnsafe<Array<{private:boolean}>>(`SELECT current_database()='axiom_agent_fixture' AND current_user='agent_fixture' AND current_setting('listen_addresses')='' AS private`);if(!binding?.private)throw Error('owned_fixture_binding_required');
  vi.stubEnv('DESKTOP_SESSION_SIGNING_KEY',randomBytes(32).toString('hex'));vi.stubEnv('AXIOM_PUBLIC_BILLING_POLICY','axiom_public_anniversary_v1');vi.stubEnv('AXIOM_STRIPE_ACCOUNT_ID','acct_fixture');vi.stubEnv('AXIOM_STRIPE_MODE','test');setDesktopSessionStore(createPrivatePrismaDesktopSessionStore(f.client));
  vi.stubGlobal('fetch',vi.fn(async()=>{throw Error('unexpected_external_fixture_request');}));
 });
 afterAll(async()=>{await f.client?.$disconnect();vi.unstubAllEnvs();vi.unstubAllGlobals();});
 async function fixture(){
  const organizationId='paired_org_'+randomUUID(),userId='paired_user_'+randomUUID();await f.client.user.create({data:{id:userId,email:randomUUID()+'@example.invalid'}});await f.client.orgMembership.create({data:{organizationId,userId,role:'owner',acceptedAt:new Date()}});expect(await f.client.$transaction(tx=>enrollNewPublicWorkspace(tx,organizationId,{accountId:'acct_fixture',livemode:false}))).toBe(true);
  const session=await createDesktopSession({organizationId:id.organization(organizationId),userId:id.user(userId),deviceFingerprint:'owned-fixture',deviceLabel:'Synthetic workstation',platform:'macos-arm'});return {organizationId,userId,session,token:mintDesktopToken(session.id)};
 }
 const resolve=(token:string,extra:Partial<Parameters<typeof resolveRequestDesktopSession>[1]>={})=>resolveRequestDesktopSession(new NextRequest('https://axiom.invalid/api/desktop/fixture',{headers:{authorization:'Bearer '+token}}),{requiredScope:'pipeline:read',route:'owned-fixture',allowApiKey:false,...extra});
 it('resolves a genuine signed fixture token through its durable session and active Free entitlement',async()=>{const c=await fixture();expect(await resolve(c.token)).toMatchObject({id:c.session.id,userId:c.userId,organizationId:c.organizationId,credentialKind:'desktop_session',role:'owner'});expect(await resolve(c.token)).toBeTruthy();expect(await f.client.desktopSessionRecord.count({where:{id:c.session.id}})).toBe(1);});
 it('rechecks reduced role capabilities without replacing the existing token',async()=>{const c=await fixture();expect(await resolve(c.token,{requiredCapability:'github:write'})).toBeTruthy();await f.client.orgMembership.update({where:{userId_organizationId:{userId:c.userId,organizationId:c.organizationId}},data:{role:'read_only'}});expect(await resolve(c.token,{requiredCapability:'github:write'})).toBeUndefined();expect(await resolve(c.token)).toMatchObject({role:'read_only',capabilities:['workspace:read','github:read']});});
 it('revokes workspace-admin authority after an owner becomes an operator',async()=>{const c=await fixture();expect(await resolve(c.token,{requireWorkspaceAdmin:true})).toBeTruthy();await f.client.orgMembership.update({where:{userId_organizationId:{userId:c.userId,organizationId:c.organizationId}},data:{role:'operator'}});expect(await resolve(c.token,{requireWorkspaceAdmin:true})).toBeUndefined();});
 it('does not recreate a removed shared-workspace membership',async()=>{const c=await fixture();await f.client.orgMembership.delete({where:{userId_organizationId:{userId:c.userId,organizationId:c.organizationId}}});expect(await resolve(c.token)).toBeUndefined();expect(await f.client.orgMembership.count({where:{userId:c.userId,organizationId:c.organizationId}})).toBe(0);});
 it('refuses an unaccepted shared-workspace membership',async()=>{const c=await fixture();await f.client.orgMembership.update({where:{userId_organizationId:{userId:c.userId,organizationId:c.organizationId}},data:{acceptedAt:null}});expect(await resolve(c.token)).toBeUndefined();});
 it('rejects the same signed token after durable session revocation',async()=>{const c=await fixture();expect(await resolve(c.token)).toBeTruthy();await revokeDesktopSession(c.session.id,'owned fixture revocation');expect(await resolve(c.token)).toBeUndefined();expect((await f.client.desktopSessionRecord.findUnique({where:{id:c.session.id}}))?.revokedAt).toBeTruthy();});
 it('rejects expired durable sessions',async()=>{const c=await fixture();await f.client.desktopSessionRecord.update({where:{id:c.session.id},data:{expiresAt:new Date(Date.now()-1000)}});expect(await resolve(c.token)).toBeUndefined();});
 it('rejects a decoder suffix before granting any session authority',async()=>{const c=await fixture();expect(await resolve(c.token+':discarded')).toBeUndefined();});
 it('rechecks current commercial account binding and recovers only after the matching evidence returns',async()=>{const c=await fixture();expect(await resolve(c.token)).toBeTruthy();try{vi.stubEnv('AXIOM_STRIPE_ACCOUNT_ID','acct_wrong_fixture');expect(await resolve(c.token)).toBeUndefined();}finally{vi.stubEnv('AXIOM_STRIPE_ACCOUNT_ID','acct_fixture');}expect(await resolve(c.token)).toBeTruthy();});
 it('does not substitute a reusable API key for a paired-session-only route',async()=>{expect(await resolve('vxlk_synthetic_not_a_real_key')).toBeUndefined();});

 const closureReference = 'local-change-42';
 const closureSummary = 'External validation was reported by the fixture operator.';

 async function closureFixture() {
  const owner = await fixture();
  const release = await f.client.tauriDeploymentRequest.create({data:{
   organizationId:owner.organizationId, requesterUserId:owner.userId,
   title:'Owned test release', correlationId:randomUUID(), status:'submitted',
   version:7, intakeJson:{displayTimeZone:'UTC'}, submittedAt:new Date(),
  }});
  const context = {params:Promise.resolve({id:release.id})};
  const url = 'https://axiom.invalid/api/desktop/deployments/'+release.id+'/close';
  const read = (token=owner.token, version=release.version) => readClosure(
   new NextRequest(url+'?expectedVersion='+version,{headers:{authorization:'Bearer '+token}}), context,
  );
  const record = () => recordClosure(new NextRequest(url,{
   method:'POST', headers:{authorization:'Bearer '+owner.token, 'content-type':'application/json'},
   body:JSON.stringify({expectedVersion:release.version, closureEvidenceId:closureReference, closureSummary}),
  }),context);
  return {owner, release, read, record};
 }

 it('reads the exact real audit receipt from a closed release without changing release or session state',async()=>{
  const {owner, release, read, record}=await closureFixture();
  expect((await read()).status).toBe(404);
  expect((await record()).status).toBe(200);
  const sessionWhere={id:owner.session.id};
  const lastSeenAt=new Date('2020-01-01T00:00:00.000Z');
  await f.client.desktopSessionRecord.update({where:sessionWhere,data:{lastSeenAt}});
  const exact=await read();
  expect(exact.status).toBe(200);
  expect(exact.headers.get('cache-control')).toBe('private, no-store');
  expect(await exact.json()).toEqual({ok:true,data:{id:release.id,version:release.version,
   reference:closureReference,summary:closureSummary}});
  expect((await read(owner.token,release.version-1)).status).toBe(404);
  expect(await f.client.tauriAuditEvent.count({where:{deploymentRequestId:release.id}})).toBe(1);
  expect(await f.client.desktopSessionRecord.findUniqueOrThrow({where:sessionWhere})).toMatchObject({lastSeenAt});
 });

 it('isolates the real closure receipt from a different paired workspace and a removed member',async()=>{
  const {owner, read, record}=await closureFixture();
  expect((await record()).status).toBe(200);
  const foreign=await fixture();
  expect((await read(foreign.token)).status).toBe(404);
  const {plaintext, ...storedKey}=mintApiKey('test');
  const apiKey=await f.client.apiKey.create({data:{...storedKey,
   organizationId:owner.organizationId, name:'Owned closure fixture key',
   scopes:['pipeline:trigger'], createdBy:owner.userId,
  }});
  expect((await read(plaintext)).status).toBe(401);
  expect(await f.client.apiKey.findUniqueOrThrow({where:{id:apiKey.id}})).toMatchObject({useCount:0,lastUsedAt:null});
  await f.client.orgMembership.delete({where:{userId_organizationId:{
   userId:owner.userId,organizationId:owner.organizationId,
  }}});
  expect((await read()).status).toBe(401);
 });
 it('pages stored batch history deterministically across tied closure times under paired authority',async()=>{
  const owner=await fixture(), foreign=await fixture();
  const closedAt=new Date('2026-11-01T18:00:00.000Z');
  const dependency={connectionId:'private-fixture-connection',connectionUpdatedAt:closedAt.toISOString(),runs:[
   {dagId:'retained-dag',dagRunId:'retained-run',logicalDate:closedAt.toISOString()},
  ]};
  const row={organizationId:owner.organizationId,requesterUserId:owner.userId,status:'closed',closedAt,
   intakeJson:{airflowDependency:dependency},title:'Archived release',version:7};
  const archiveIds=Array.from({length:22},(_,index)=>'archive-'+String(index).padStart(2,'0'));
  await f.client.tauriDeploymentRequest.createMany({data:[
   ...archiveIds.map(id=>({...row,id,correlationId:id})),
   {...row,id:'archive-foreign',correlationId:'foreign',organizationId:foreign.organizationId},
   {...row,id:'archive-invalid',correlationId:'malformed',intakeJson:{airflowDependency:{...dependency,runs:[]}}},
   {...row,id:'archive-submitted',correlationId:'submitted',status:'submitted',closedAt:null},
  ]});
  const base='https://axiom.invalid/api/desktop/deployments?batchHistory=1&excludeReleaseId=archive-21';
  const read=(url:string,token=owner.token)=>readReleases(new NextRequest(url,{headers:{authorization:'Bearer '+token}}));
  const first=await read(base);
  expect(first.status).toBe(200);
  expect(first.headers.get('cache-control')).toBe('private, no-store');
  const firstBody=await first.json();
  const one=batchHistoryPageSchema.parse(firstBody.data);
  expect(one.nextCursor).toBeTruthy();
  expect(one.releases.length).toBeLessThanOrEqual(20);
  expect(JSON.stringify(firstBody)).not.toContain('private-fixture-connection');
  expect(JSON.stringify(firstBody)).not.toContain('retained-run');
  const params = new URLSearchParams({beforeReleaseId:one.nextCursor!.id,beforeClosedAt:one.nextCursor!.closedAt});
  const second=await read(base+'&'+params);
  const two=batchHistoryPageSchema.parse((await second.json()).data);
  expect([...one.releases,...two.releases].map(release=>release.id)).toEqual(archiveIds.slice(0,-1).reverse());
  expect(two.nextCursor).toBeNull();
  expect((await read(base+'&beforeReleaseId=archive-00')).status).toBe(400);
  expect((await read(base+'&savedReleaseId=archive-00')).status).toBe(400);
  expect((await read(base+'&excludeReleaseId=archive-21')).status).toBe(400);
  expect((await read(base+'&excludeReleaseId='+encodeURIComponent('../archive-01'))).status).toBe(400);
  expect((await read(base,mintApiKey('test').plaintext)).status).toBe(401);
 });

});
