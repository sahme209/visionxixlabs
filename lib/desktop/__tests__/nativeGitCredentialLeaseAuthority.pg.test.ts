import {afterAll,beforeAll,describe,it,expect,vi} from 'vitest';
import {createRequire} from 'node:module';
import {randomUUID} from 'node:crypto';
import {realpathSync,statSync} from 'node:fs';
import {NextRequest} from 'next/server';
const pairing=vi.hoisted(()=>({current:vi.fn()}));
vi.mock('../resolveRequestDesktopSession',()=>({resolveRequestDesktopSession:pairing.current}));
import {createNativeGitCredentialLeaseAuthority} from '../nativeGitCredentialLeaseAuthority';
const socket=process.env.AXIOM_TICKET_GOVERNANCE_PG_SOCKET;
// Real caller transaction, persisted member/session/installation rows and clocks.
// Paired/commercial authentication is explicitly SIMULATED; no provider IO.
describe.skipIf(!socket)('native credential lease current authority on owned PostgreSQL',()=>{
 let db:any,other:any,network:ReturnType<typeof vi.spyOn>;
 beforeAll(async()=>{
  const generated=process.env.AXIOM_TICKET_GOVERNANCE_PG_CLIENT;
  if(!socket||!/^\/private\/tmp\/axiom-ticket-governance-pg-[^/]+\/socket$/.test(socket)||realpathSync(socket)!==socket||(statSync(socket).mode&0o077)!==0||!generated||!/^\/private\/tmp\/axiom-provider-approval-pg-evidence-[^/]+\/generated\/index\.js$/.test(generated))throw Error('owned_fixture_required');
  const Client=createRequire(import.meta.url)(generated).PrismaClient,url=`postgresql://recovery_fixture@localhost/neondb?host=${encodeURIComponent(socket)}&connection_limit=1`;
  db=new Client({datasources:{db:{url}}});other=new Client({datasources:{db:{url}}});const[r]=await db.$queryRawUnsafe("SELECT current_database()='neondb' AND current_user='recovery_fixture' AND current_setting('listen_addresses')='' AS private");if(r?.private!==true)throw Error('owned_fixture_required');
  network=vi.spyOn(globalThis,'fetch').mockRejectedValue(Error('provider IO forbidden'));
 });
 afterAll(async()=>{expect(network).not.toHaveBeenCalled();network?.mockRestore();await other?.$disconnect();await db?.$disconnect()});
 async function fixture(){
  const organizationId='lease-authority-'+randomUUID(),userId='operator',sessionId=organizationId+'-session',connectionId=organizationId+'-connection',at=new Date();
  await db.orgMembership.create({data:{organizationId,userId,role:'operator',acceptedAt:at}});await db.desktopSessionRecord.create({data:{id:sessionId,organizationId,userId,expiresAt:new Date(Date.now()+60000)}});
  await db.gitHubInstallation.create({data:{id:connectionId,organizationId,githubInstallationId:'123',accountLogin:'team',status:'active',installedAt:at,updatedAt:at}});
  const initial={id:sessionId,userId,organizationId,credentialKind:'desktop_session' as const,role:'operator' as const,capabilities:['github:write' as const]},scope={organizationId,actorUserId:userId,sessionId},binding={repositoryFullName:'team/repo',branch:'feature/reviewed',connectionId,githubInstallationId:'123',connectionRevision:at.toISOString()};
  pairing.current.mockReset();pairing.current.mockResolvedValue(initial);
  const authority=createNativeGitCredentialLeaseAuthority(new NextRequest('https://fixture.invalid/lease'),initial),run=()=>db.$transaction((tx:any)=>authority(tx,scope,binding));return{initial,scope,binding,run,authority};
 }
 it('accepts an actual current operator without issuing permissions or provider IO',async()=>{const f=await fixture();const final=await f.run();expect(typeof final).toBe('function');expect(()=>final()).not.toThrow()});
 it.each(['role','session','connection'])('rejects revoked persisted %s despite a simulated stale paired principal',async kind=>{const f=await fixture();if(kind==='role')await db.orgMembership.updateMany({where:{organizationId:f.scope.organizationId},data:{role:'read_only'}});if(kind==='session')await db.desktopSessionRecord.update({where:{id:f.scope.sessionId},data:{revokedAt:new Date()}});if(kind==='connection')await db.gitHubInstallation.update({where:{id:f.binding.connectionId},data:{revokedAt:new Date()}});await expect(f.run()).rejects.toThrow('native_git_lease_authority_unavailable')});
 it('rejects a new latest installation committed during the final paired-authority await',async()=>{const f=await fixture();let reads=0;pairing.current.mockImplementation(async()=>{if(++reads===2)await other.gitHubInstallation.create({data:{id:f.binding.connectionId+'-new',organizationId:f.scope.organizationId,githubInstallationId:'456',accountLogin:'team',status:'active',installedAt:new Date(Date.now()+1000),updatedAt:new Date()}});return f.initial});await expect(f.run()).rejects.toThrow('native_git_lease_authority_unavailable');expect(reads).toBe(2)});
 it('rejects lost current commercial authority after persisted source locks',async()=>{const f=await fixture();pairing.current.mockResolvedValueOnce(f.initial).mockResolvedValue(null);await expect(f.run()).rejects.toThrow('native_git_lease_authority_unavailable')});
 it('uses a fresh final clock after an installation lock wait crosses session expiry',async()=>{
  const f=await fixture();await db.desktopSessionRecord.update({where:{id:f.scope.sessionId},data:{expiresAt:new Date(Date.now()+1000)}});
  let locked!:()=>void,release!:()=>void;const ready=new Promise<void>(r=>{locked=r}),hold=new Promise<void>(r=>{release=r});
  const holder=other.$transaction(async(tx:any)=>{await tx.$queryRaw`SELECT "id" FROM "GitHubInstallation" WHERE "id"=${f.binding.connectionId} FOR UPDATE`;locked();await hold});await ready;
  let settled=false;const checking=f.run().then(()=>{settled=true;return null},(error:unknown)=>{settled=true;return error});
  try{await new Promise(r=>setTimeout(r,1100));expect(settled).toBe(false)}finally{release()}
  await holder;expect(await checking).toMatchObject({message:'native_git_lease_authority_unavailable'});
 });
 it('retains the original session expiry through a later database-clock await in the caller transaction',async()=>{
  const f=await fixture();await db.desktopSessionRecord.update({where:{id:f.scope.sessionId},data:{expiresAt:new Date(Date.now()+1000)}});let returned=false;
  await expect(db.$transaction(async(tx:any)=>{const final=await f.authority(tx,f.scope,f.binding);returned=true;await tx.$queryRaw`SELECT clock_timestamp() AS now FROM pg_sleep(1.1)`;final()})).rejects.toThrow('native_git_lease_authority_unavailable');expect(returned).toBe(true);
 });

});
