import {afterAll,beforeAll,describe,expect,it,vi} from 'vitest';
import {createRequire} from 'node:module';
import {realpathSync,statSync} from 'node:fs';
import {randomUUID} from 'node:crypto';
import {claimInvitedOrganizationSeat,claimOrganizationSeat,type OrganizationSeatClaimRepo} from '../organizationSeatClaim';
// Actual helper + isolated PostgreSQL Serializable transactions. No browser,
// invite issuance, billing provider, authenticated actor or grants are simulated
// as production authority: this suite qualifies seat bookkeeping only.
const socket=process.env.AXIOM_INVITATION_SEAT_PG_SOCKET;
describe.skipIf(!socket)('owned PostgreSQL invitation final-seat admission',()=>{
 let db:any;
 beforeAll(async()=>{
  const generated=process.env.AXIOM_INVITATION_SEAT_PG_CLIENT;
  if(!socket||!/^\/private\/tmp\/axiom-invitation-seat-pg-[^/]+\/socket$/.test(socket)||realpathSync(socket)!==socket||(statSync(socket).mode&0o077)!==0||!generated||generated!==socket.slice(0,-7)+'/generated/index.js')throw Error('owned_fixture_required');
  vi.stubEnv('AXIOM_PUBLIC_BILLING_POLICY','');
  const Client=createRequire(import.meta.url)(generated).PrismaClient;db=new Client();await db.$connect();
 });
 afterAll(async()=>{await db?.$disconnect();vi.unstubAllEnvs()});
 it.each(['invitation','mixed SSO/invitation'])('only one pending member can take final free seat (%s)',async(kind)=>{
  const org='seat-'+randomUUID(),acceptedAt=new Date('2026-10-01T00:00:00Z');
  await db.orgMembership.createMany({data:[{organizationId:org,userId:'owner',role:'owner',acceptedAt},{organizationId:org,userId:'a',role:'read_only',acceptedAt:null,invitedBy:'original'},{organizationId:org,userId:'b',role:'read_only',acceptedAt:null,invitedBy:'original'}]});
  let readers=0,release!:()=>void;const bothRead=new Promise<void>(resolve=>release=resolve);
  const repo:OrganizationSeatClaimRepo={$transaction:(fn,options)=>db.$transaction(async(tx:any)=>fn({tenantBillingPlan:tx.tenantBillingPlan,orgMembership:{findUnique:(args:any)=>tx.orgMembership.findUnique(args),create:(args:any)=>tx.orgMembership.create(args),update:(args:any)=>tx.orgMembership.update(args),count:async(args:any)=>{const count=await tx.orgMembership.count(args);if(++readers===2)release();await bothRead;return count}}}),{...options,timeout:10000})};
  const a={organizationId:org,userId:'a',role:'operator',invitedBy:'signed-inviter'},b={...a,userId:'b'};
  const results=await Promise.all([claimInvitedOrganizationSeat(repo,a),kind==='invitation'?claimInvitedOrganizationSeat(repo,b):claimOrganizationSeat(repo,b)]);
  expect(results.filter(r=>r.ok)).toHaveLength(1);expect(results.filter(r=>!r.ok)).toHaveLength(1);
  expect(await db.orgMembership.count({where:{organizationId:org,acceptedAt:{not:null}}})).toBe(2);
  const pending=await db.orgMembership.findFirst({where:{organizationId:org,acceptedAt:null}});expect(pending).not.toBeNull();
  expect(await claimInvitedOrganizationSeat(db,{...a,userId:pending.userId})).toMatchObject({ok:false,error:'seat_limit_exhausted'});
  const winner=await db.orgMembership.findFirst({where:{organizationId:org,userId:{not:'owner'},acceptedAt:{not:null}}});
  expect(await claimInvitedOrganizationSeat(db,{...a,userId:winner.userId,role:'admin'})).toMatchObject({ok:true,alreadyMember:true,role:'operator',used:2});
  expect(await db.orgMembership.findUnique({where:{id:winner.id}})).toEqual(winner);
  expect(await db.orgMembership.findFirst({where:{organizationId:org,userId:'owner'}})).toMatchObject({role:'owner',acceptedAt});
 });
});
