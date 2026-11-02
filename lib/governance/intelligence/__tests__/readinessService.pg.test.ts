vi.mock('@/lib/desktop/resolveRequestDesktopSession',()=>({resolveRequestDesktopSession:vi.fn()}));
import {resolveRequestDesktopSession} from '@/lib/desktop/resolveRequestDesktopSession';
import {createGovernanceReadinessService} from '../readinessService';
import {beforeAll,afterAll,describe,it,expect,vi} from 'vitest';
import {randomUUID} from 'node:crypto';
import {createRequire} from 'node:module';
import {realpathSync,statSync} from 'node:fs';
import {createNativeGitCredentialLeaseStore,readNativeGitCredentialLeaseBlockers} from '../nativeGitCredentialLeaseStore';
import {createGovernanceRevisionStore} from '../revisionStore';
import {compileBaseline,parseEvidenceSnapshot} from '../contracts';
import {sha256ContentHash} from '@/lib/tauri/contentHash';
const socket=process.env.AXIOM_TICKET_GOVERNANCE_PG_SOCKET;
/** Actual durable tables/locks/history; paired identity/provider authority are
 * explicit fixture simulations. No token is resolved or stored by this suite. */
describe.skipIf(!socket)('readiness metadata on owned socket PostgreSQL; simulated pairing/provider authority',()=>{
 let db:any,other:any;
 beforeAll(async()=>{const generated=process.env.AXIOM_TICKET_GOVERNANCE_PG_CLIENT;if(!socket||!/^\/private\/tmp\/axiom-ticket-governance-pg-[^/]+\/socket$/.test(socket)||realpathSync(socket)!==socket||(statSync(socket).mode&0o077)!==0||!generated||!/^\/private\/tmp\/axiom-provider-approval-pg-evidence-[^/]+\/generated\/index\.js$/.test(generated))throw Error('owned_fixture_required');const Client=createRequire(import.meta.url)(generated).PrismaClient;const options={transactionOptions:{timeout:15000},datasources:{db:{url:`postgresql://recovery_fixture@localhost/neondb?host=${encodeURIComponent(socket)}&connection_limit=1`}}};db=new Client(options);other=new Client(options);const[r]=await db.$queryRawUnsafe("SELECT current_database()='neondb' AND current_user='recovery_fixture' AND current_setting('listen_addresses')='' AS private");if(!r?.private)throw Error('owned_fixture_required')});afterAll(async()=>{await other?.$disconnect();await db?.$disconnect()});

 async function fixture(){const org='readiness-'+randomUUID(),scope={organizationId:org,actorUserId:'reader',sessionId:randomUUID()},cancel=new AbortController();
 await db.orgMembership.create({data:{organizationId:org,userId:'reader',role:'read_only',acceptedAt:new Date()}});await db.desktopSessionRecord.create({data:{id:scope.sessionId,organizationId:org,userId:'reader',expiresAt:new Date(Date.now()+60000)}});
 vi.mocked(resolveRequestDesktopSession).mockResolvedValue({id:scope.sessionId,userId:'reader',organizationId:org,credentialKind:'desktop_session'} as any);
 const read=(repo=db)=>createGovernanceReadinessService({signal:cancel.signal}as any,repo,scope).read();
 const store=createNativeGitCredentialLeaseStore(db,{signal:cancel.signal,assertCurrent:async()=>()=>{cancel.signal.throwIfAborted()}}),binding={repositoryFullName:'team/repo',branch:'main',connectionId:'fixture-provider',githubInstallationId:'123',connectionRevision:new Date().toISOString()};return{org,scope,read,store,binding,cancel};}
 it('reads actual immutable pending/live history without qualifying empty or populated metadata',async()=>{const f=await fixture();expect(await f.read()).toMatchObject({executionAuthorized:false,catalogQualification:'unavailable',metadata:{pendingCount:0}});const a=await f.store.reserve(f.scope,f.binding,randomUUID());await f.store.reserve(f.scope,f.binding,randomUUID());await f.store.finalize(f.scope,a.id,Date.now()+60000);expect(await f.read()).toEqual({status:'unavailable',executionAuthorized:false,catalogQualification:'unavailable',legacyQualification:'unavailable',metadata:{anyEnrollment:false,pendingCount:1,liveIssuedCount:1,expiredIssuedCount:0}});});
 it('waits for organization lock and observes committed lease metadata, not premature absence',async()=>{const f=await fixture();let entered!:()=>void,release!:()=>void;const held=new Promise<void>(r=>entered=r),gate=new Promise<void>(r=>release=r);const holding=other.$transaction(async(tx:any)=>{await tx.$queryRaw`SELECT 1 FROM pg_advisory_xact_lock(hashtext(${'governance_org_'+sha256ContentHash(f.org)}))`;entered();await gate;},{timeout:15000});await held;let completed=false;const reading=f.read().then((r:any)=>{completed=true;return r});await new Promise(r=>setTimeout(r,40));expect(completed).toBe(false);release();await holding;expect((await reading).metadata).toMatchObject({pendingCount:0});});
 it('withholds metadata after real session expiry during transaction result delivery',async()=>{const f=await fixture();await db.desktopSessionRecord.update({where:{id:f.scope.sessionId},data:{expiresAt:new Date(Date.now()+500)}});const proxy=new Proxy(db,{get(target,key){if(key==='$transaction')return async(fn:any,opts:any)=>{const result=await target.$transaction(fn,opts);await new Promise(r=>setTimeout(r,550));return result};return Reflect.get(target,key)}});expect(await f.read(proxy)).not.toHaveProperty('metadata');});
 it('withholds actual revoked reader membership and malformed lease history',async()=>{const f=await fixture();const a=await f.store.reserve(f.scope,f.binding,randomUUID());await db.durableAgentWorkflowEvent.deleteMany({where:{workflowRunId:a.id}});expect(await f.read()).not.toHaveProperty('metadata');const g=await fixture();await db.orgMembership.delete({where:{organizationId_userId:{organizationId:g.org,userId:'reader'}}});expect(await g.read()).not.toHaveProperty('metadata');});
});
