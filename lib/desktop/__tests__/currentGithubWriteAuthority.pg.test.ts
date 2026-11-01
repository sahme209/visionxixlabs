import {afterAll,beforeAll,describe,it,expect,vi} from 'vitest';
import {createRequire} from 'node:module';
import {randomUUID} from 'node:crypto';
import {realpathSync,statSync} from 'node:fs';
import {NextRequest} from 'next/server';
const auth=vi.hoisted(()=>({current:vi.fn()}));
vi.mock('@/lib/desktop/resolveRequestDesktopSession',()=>({resolveRequestDesktopSession:auth.current}));
import {createCurrentGithubWriteGuard} from '../currentGithubWriteAuthority';
const socket=process.env.AXIOM_EXECUTION_POLICY_PG_SOCKET;
describe.skipIf(!socket)('current desktop GitHub persisted authority snapshot',()=>{
 let db:any;
 beforeAll(async()=>{
  const generated=process.env.AXIOM_EXECUTION_POLICY_PG_CLIENT;
  if(!socket||!/^\/private\/tmp\/axiom-execution-policy-pg-[^/]+\/socket$/.test(socket)||realpathSync(socket)!==socket||(statSync(socket).mode&0o077)!==0||!generated||!generated.startsWith(socket.slice(0,-7)+'/generated/'))throw Error('owned_fixture_required');
  const Client=createRequire(import.meta.url)(generated).PrismaClient;
  db=new Client({datasources:{db:{url:`postgresql://policy_fixture@localhost/policy_fixture?host=${encodeURIComponent(socket)}`}}});
  const [r]=await db.$queryRawUnsafe("SELECT current_database()='policy_fixture' AND current_user='policy_fixture' AND current_setting('listen_addresses')='' AS private");if(!r?.private)throw Error('owned_fixture_required');
 });
 afterAll(async()=>db?.$disconnect());
 async function fixture(){
  const org='github-guard-'+randomUUID(),user='actor',sessionId=org+'-session',id=org+'-connection',now=new Date();
  await db.orgMembership.create({data:{organizationId:org,userId:user,role:'admin',acceptedAt:now}});
  await db.desktopSessionRecord.create({data:{id:sessionId,organizationId:org,userId:user,expiresAt:new Date(Date.now()+60000)}});
  const connection={id,organizationId:org,githubInstallationId:'123',accountLogin:'team',status:'active',installedAt:now,updatedAt:now};
  await db.gitHubInstallation.create({data:connection});
  const principal={id:sessionId,organizationId:org,userId:user,credentialKind:'desktop_session' as const,role:'admin' as const,capabilities:['github:write' as const]};
  auth.current.mockResolvedValue(principal);
  let change:(()=>Promise<void>)|undefined;
  const repo={$queryRaw:db.$queryRaw.bind(db),gitHubInstallation:db.gitHubInstallation,durableAgentWorkflow:{findMany:async(args:any)=>{const rows=await db.durableAgentWorkflow.findMany(args);if(change){const run=change;change=undefined;await run()}return rows}}};
  const guard=createCurrentGithubWriteGuard(new NextRequest('https://app.test/local'),principal,repo);
  await guard();
  return{guard,org,user,sessionId,id,connection,duringMetadata(run:()=>Promise<void>){change=run}};
 }
 it('accepts the exact current persisted session, membership, installation and absent enrollment',async()=>{const f=await fixture();await expect(f.guard()).resolves.toBeUndefined()});
 it.each(['connection_revoked','connection_replaced','membership_revoked','session_revoked','enrollment_added'])('refuses %s committed during the last enrollment read',async change=>{
  const f=await fixture();f.duringMetadata(async()=>{
   if(change==='connection_revoked')await db.gitHubInstallation.update({where:{id:f.id},data:{revokedAt:new Date()}});
   if(change==='connection_replaced')await db.gitHubInstallation.create({data:{...f.connection,id:f.id+'-new',githubInstallationId:'456',installedAt:new Date(Date.now()+1000)}});
   if(change==='membership_revoked')await db.orgMembership.update({where:{organizationId_userId:{organizationId:f.org,userId:f.user}},data:{role:'read_only'}});
   if(change==='session_revoked')await db.desktopSessionRecord.update({where:{id:f.sessionId},data:{revokedAt:new Date()}});
   if(change==='enrollment_added')await db.durableAgentWorkflow.create({data:{id:'governance_active_'+randomUUID(),organizationId:f.org,workflowKind:'conflicting_fixture_pointer',objective:'Fixture only',autonomyLevel:'observe',inputJson:{},stateJson:{},requestedByUserId:f.user}});
  });
  await expect(f.guard()).rejects.toThrow('github_write_authority_unavailable');
 });
});
