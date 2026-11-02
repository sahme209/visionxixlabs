import {afterAll,beforeAll,describe,it,expect,vi} from 'vitest';
import {NextRequest} from 'next/server';
import {createRequire} from 'node:module';
import {randomUUID} from 'node:crypto';
import {realpathSync,statSync} from 'node:fs';
import {sha256ContentHash} from '@/lib/tauri/contentHash';
const m=vi.hoisted(()=>({db:null as any,principal:null as any,mint:vi.fn(),audit:vi.fn(),branch:vi.fn(),onAuth:null as null|((options:any)=>Promise<void>),loseFinalizeAck:false,delayFinalSnapshot:false,delayedSnapshots:0}));
vi.mock('@/lib/db',()=>({prisma:new Proxy({},{get(_target,key){
 if(key==='$queryRaw')return async(...args:any[])=>{const rows=await m.db.$queryRaw(...args);if(m.delayFinalSnapshot&&String(args[0]?.join?.(' ')??'').includes('AS \"sessionLive\"')){m.delayFinalSnapshot=false;m.delayedSnapshots++;expect(rows).toHaveLength(1);expect(rows[0].sessionLive).toBe(true);const expiry=rows[0].expiresAt??rows[0].sessionExpiresAt;expect(expiry).toBeInstanceOf(Date);expect(expiry.getTime()).toBeGreaterThan(Date.now());await new Promise(resolve=>setTimeout(resolve,1100));expect(Date.now()).toBeGreaterThanOrEqual(expiry.getTime())}return rows};
 if(key==='$transaction')return async(...args:any[])=>{const result=await m.db.$transaction(...args);if(m.loseFinalizeAck&&result?.status==='issued'){m.loseFinalizeAck=false;throw Error('simulated lost committed finalization response')}return result};
 const value=m.db[key];return typeof value==='function'?value.bind(m.db):value;
}})}));
vi.mock('../resolveRequestDesktopSession',()=>({resolveRequestDesktopSession:async(_request:unknown,options:unknown)=>{if(m.onAuth)await m.onAuth(options);return m.principal}}));
vi.mock('@/lib/connectors/github/githubAppAuth',()=>({resolveGithubInstallationToken:m.mint}));
vi.mock('@/lib/connectors/github/githubWriteClient',()=>({getRepositoryDefaultBranch:m.branch}));
vi.mock('@/lib/audit/secureAudit',()=>({record:m.audit}));
import {POST} from '@/app/api/desktop/github/clone-token/route';
const socket=process.env.AXIOM_NATIVE_GIT_COMPOSITION_SOCKET;
/** Actual Next route, guard, lease store/authority, tenant resolver, clocks,
 * transactions and history. Paired/commercial auth, lower provider issuer,
 * default-branch GET and audit are simulations; no live token or approval. */
describe.skipIf(!socket)('native Git issuance composed on owned PostgreSQL',()=>{
 let db:any,other:any,network:ReturnType<typeof vi.spyOn>;
 beforeAll(async()=>{
  const generated=process.env.AXIOM_NATIVE_GIT_COMPOSITION_CLIENT;
  if(!socket||!/^\/private\/tmp\/axiom-native-git-lease-pg-[^/]+\/socket$/.test(socket)||realpathSync(socket)!==socket||(statSync(socket).mode&0o077)!==0||!generated||generated!==socket.slice(0,-7)+'/generated/index.js'||realpathSync(generated)!==generated)throw Error('owned_fixture_required');
  const Client=createRequire(import.meta.url)(generated).PrismaClient,url=`postgresql://native_git_fixture@localhost/native_git_fixture?host=${encodeURIComponent(socket)}&connection_limit=1`;
  db=new Client({datasources:{db:{url}}});other=new Client({datasources:{db:{url}}});m.db=db;
  const [row]=await db.$queryRawUnsafe("SELECT current_database()='native_git_fixture' AND current_user='native_git_fixture' AND current_setting('listen_addresses')='' AS private");if(row?.private!==true)throw Error('owned_fixture_required');
  network=vi.spyOn(globalThis,'fetch').mockRejectedValue(Error('live provider IO forbidden'));
 });
 afterAll(async()=>{expect(network).not.toHaveBeenCalled();network?.mockRestore();await other?.$disconnect();await db?.$disconnect()});
 async function fixture(sessionLifetime=120000){
  vi.clearAllMocks();m.onAuth=null;m.loseFinalizeAck=false;m.delayFinalSnapshot=false;m.delayedSnapshots=0;
  const organizationId='git-composition-'+randomUUID(),userId='operator',sessionId=organizationId+'-session',connectionId=organizationId+'-connection',at=new Date(),expiresAt=Date.now()+60000;
  await db.orgMembership.create({data:{organizationId,userId,role:'operator',acceptedAt:at}});
  await db.desktopSessionRecord.create({data:{id:sessionId,organizationId,userId,expiresAt:new Date(Date.now()+sessionLifetime)}});
  await db.gitHubInstallation.create({data:{id:connectionId,organizationId,githubInstallationId:'123',accountLogin:'team',status:'active',installedAt:at,updatedAt:at}});
  m.principal={id:sessionId,userId,organizationId,credentialKind:'desktop_session',role:'operator',capabilities:['github:write']};
  m.audit.mockResolvedValue(undefined);m.branch.mockResolvedValue({ok:true,data:'main'});
  const rows=()=>other.durableAgentWorkflow.findMany({where:{organizationId,workflowKind:'native_git_credential_lease_v1'},orderBy:{createdAt:'asc'}});
  m.mint.mockImplementation(async(input:any)=>{
   expect(input.installationId).toBe(123);expect(input.repositories).toEqual(['repo']);expect(input.signal).toBeInstanceOf(AbortSignal);
   const leases=await rows();expect(leases).toHaveLength(input.permissionProfile==='contents_read'?0:1);
   if(leases.length){expect(leases[0]).toMatchObject({currentStep:'pending',version:0});
    // Reservation is visible/committed before provider issuance; neither row nor
    // activation-org locks remain held across this simulated provider await.
    await other.$transaction(async(tx:any)=>{
     const [lock]=await tx.$queryRaw`SELECT pg_try_advisory_xact_lock(hashtext(${'governance_org_'+sha256ContentHash(organizationId)})) AS available`;expect(lock.available).toBe(true);
     await tx.$queryRaw`SELECT "id" FROM "DurableAgentWorkflow" WHERE "id"=${leases[0].id} FOR UPDATE NOWAIT`;
    });
   }
   return{ok:true,token:'SIMULATED_PRIVATE_GIT_TOKEN',installationId:123,expiresAt};
  });
  const run=(purpose:'push'|'clone'|'pull'='push')=>POST(new NextRequest('https://fixture.invalid/api/desktop/github/clone-token',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({repositoryFullName:'team/repo',purpose,...(purpose==='push'?{branch:'feature/reviewed'}:{})})}));
  return{organizationId,userId,sessionId,connectionId,expiresAt,rows,run};
 }
 it('commits real known expiry before a response and keeps all stored/audit metadata token-free',async()=>{
  const f=await fixture();m.audit.mockImplementation(async()=>{expect((await f.rows())[0]).toMatchObject({currentStep:'issued',stateJson:{providerExpiresAt:f.expiresAt}})});const response=await f.run();expect(response.status).toBe(200);expect(await response.json()).toEqual({ok:true,data:{cloneUrl:'https://x-access-token:SIMULATED_PRIVATE_GIT_TOKEN@github.com/team/repo.git'}});expect(response.headers.get('cache-control')).toBe('private, no-store');
  const rows=await f.rows();expect(rows).toHaveLength(1);expect(rows[0]).toMatchObject({version:1,currentStep:'issued',stateJson:{status:'issued',providerExpiresAt:f.expiresAt}});expect(rows[0].inputJson.binding.repositoryFullName).toBe('team/repo');
  const events=await other.durableAgentWorkflowEvent.findMany({where:{workflowRunId:rows[0].id},orderBy:{sequence:'asc'}});expect(events).toHaveLength(2);expect(JSON.stringify({rows,events,audit:m.audit.mock.calls})).not.toContain('SIMULATED_PRIVATE_GIT_TOKEN');expect(m.mint).toHaveBeenCalledOnce();expect(m.mint.mock.calls[0][0]).not.toHaveProperty('permissionProfile');
 });
 it('rejects an actual reservation after persisted role loss and never calls the provider',async()=>{
  const f=await fixture();let changed=false;m.onAuth=async options=>{if(!changed&&options.route==='native Git credential lease authority'){changed=true;await other.orgMembership.updateMany({where:{organizationId:f.organizationId},data:{role:'read_only'}})}};
  const response=await f.run();expect(response.status).toBe(409);expect(changed).toBe(true);expect(await f.rows()).toHaveLength(0);expect(m.mint).not.toHaveBeenCalled();
 });
 it('keeps an unknown issuance pending without automatic retry or secret output',async()=>{
  const f=await fixture();m.mint.mockRejectedValue(Error('SIMULATED_PRIVATE_GIT_TOKEN lost issuance reply'));
  const response=await f.run();expect(response.status).toBe(409);expect(JSON.stringify(await response.json())).not.toContain('SIMULATED_PRIVATE_GIT_TOKEN');expect(m.mint).toHaveBeenCalledOnce();const rows=await f.rows();expect(rows).toHaveLength(1);expect(rows[0]).toMatchObject({currentStep:'pending',version:0});expect(await other.durableAgentWorkflowEvent.count({where:{workflowRunId:rows[0].id}})).toBe(1);
 });
 it('retains actual issued metadata after finalization acknowledgement loss without reminting',async()=>{
  const f=await fixture();m.loseFinalizeAck=true;const response=await f.run();expect(response.status).toBe(409);expect(JSON.stringify(await response.json())).not.toContain('SIMULATED_PRIVATE_GIT_TOKEN');
  const rows=await f.rows();expect(rows).toHaveLength(1);expect(rows[0]).toMatchObject({currentStep:'issued',version:1,stateJson:{providerExpiresAt:f.expiresAt}});expect(m.mint).toHaveBeenCalledOnce();expect(m.audit).not.toHaveBeenCalled();expect(await other.durableAgentWorkflowEvent.count({where:{workflowRunId:rows[0].id}})).toBe(2);expect(m.mint).toHaveBeenCalledOnce();
 });
 it.each(['session','installation'])('withholds the response after actual %s revocation during audit while retaining the issued lease',async kind=>{
  const f=await fixture();m.audit.mockImplementation(async()=>{if(kind==='session')await other.desktopSessionRecord.update({where:{id:f.sessionId},data:{revokedAt:new Date()}});else await other.gitHubInstallation.update({where:{id:f.connectionId},data:{revokedAt:new Date()}})});
  const response=await f.run();expect(response.status).toBe(409);expect(JSON.stringify(await response.json())).not.toContain('SIMULATED_PRIVATE_GIT_TOKEN');expect((await f.rows())[0]).toMatchObject({currentStep:'issued',version:1});expect(m.mint).toHaveBeenCalledOnce();
 });
 it.each(['clone','push'] as const)('withholds %s credentials when the final live SQL snapshot returns after real session expiry',async purpose=>{
  const f=await fixture(1000);m.audit.mockImplementation(async()=>{m.delayFinalSnapshot=true});
  const response=await f.run(purpose);expect(m.delayedSnapshots).toBe(1);expect(response.status).toBe(409);expect(JSON.stringify(await response.json())).not.toContain('SIMULATED_PRIVATE_GIT_TOKEN');expect(m.mint).toHaveBeenCalledOnce();
  const rows=await f.rows();if(purpose==='push'){expect(rows).toHaveLength(1);expect(rows[0]).toMatchObject({currentStep:'issued',version:1,stateJson:{providerExpiresAt:f.expiresAt}})}else expect(rows).toHaveLength(0);
 });
 it.each(['clone','pull'] as const)('uses actual pinned contents_read resolver for %s without creating a write lease',async purpose=>{
  const f=await fixture(),response=await f.run(purpose);expect(response.status).toBe(200);expect(m.mint).toHaveBeenCalledOnce();expect(m.mint.mock.calls[0][0]).toMatchObject({permissionProfile:'contents_read',repositories:['repo']});expect(await f.rows()).toHaveLength(0);expect(m.branch).not.toHaveBeenCalled();
 });
});
