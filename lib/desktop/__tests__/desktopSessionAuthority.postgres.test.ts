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
import {prismaDesktopSessionStore} from '../desktopSessionStore.prisma';
import {mintDesktopToken} from '../desktopToken';
import {id} from '@/lib/domain/ids';
import {enrollNewPublicWorkspace} from '@/lib/billing/publicFreeEnrollment';
const socket=process.env.AXIOM_OWNED_AGENT_PG_SOCKET;
describe.skipIf(!socket)('actual HMAC → durable paired session → current membership and billing authority',()=>{
 beforeAll(async()=>{
  if(!socket||!/^\/(?:private\/)?tmp\/axiom-agent-chain-[^/]+\/socket$/.test(socket)||realpathSync(socket)!==socket||(statSync(socket).mode&0o077)!==0||(process.getuid&&statSync(socket).uid!==process.getuid()))throw Error('owned_private_socket_required');
  f.client=createDatabaseClient(`postgresql://agent_fixture@localhost/axiom_agent_fixture?host=${encodeURIComponent(socket)}`);
  const [binding]=await f.client.$queryRawUnsafe<Array<{private:boolean}>>(`SELECT current_database()='axiom_agent_fixture' AND current_user='agent_fixture' AND current_setting('listen_addresses')='' AS private`);if(!binding?.private)throw Error('owned_fixture_binding_required');
  vi.stubEnv('DESKTOP_SESSION_SIGNING_KEY',randomBytes(32).toString('hex'));vi.stubEnv('AXIOM_PUBLIC_BILLING_POLICY','axiom_public_anniversary_v1');vi.stubEnv('AXIOM_STRIPE_ACCOUNT_ID','acct_fixture');vi.stubEnv('AXIOM_STRIPE_MODE','test');setDesktopSessionStore(prismaDesktopSessionStore);
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
});
