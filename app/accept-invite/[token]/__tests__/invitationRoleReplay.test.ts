/** SIMULATED database/auth/entitlement fixtures; actual signed token, acceptance
 * page and seat-claim implementation. Approved invitation-specific invariants. No messages/provider/production database. */
import {afterEach,beforeEach,expect,it,vi} from 'vitest';
const m=vi.hoisted(()=>({publicPolicy:false,snapshot:vi.fn(),repo:undefined as any}));
vi.mock('@/lib/db',()=>({prisma:new Proxy({}, {get:(_,key)=>m.repo[key]})}));
vi.mock('@/lib/auth/currentContext',()=>({currentContext:async()=>({isAuthenticated:true,userId:'invitee',sessionUserId:'invitee',email:'invitee@example.test',organizationId:'other-selected-org',roles:['read_only']})}));
vi.mock('@/lib/audit/secureAudit',()=>({record:async()=>{}}));
vi.mock('@/lib/billing/publicBillingConfig',()=>({publicBillingPolicyEnabled:()=>m.publicPolicy,configuredPublicBillingIdentity:()=>({accountId:'acct_SIMULATED',livemode:false})}));
vi.mock('@/lib/billing/publicBillingEntitlements',()=>({readPublicEntitlementSnapshot:m.snapshot}));
vi.mock('@/lib/billing/publicCreditAuthority',()=>({publicDatabaseNow:async()=>new Date()}));
import {renderToStaticMarkup} from 'react-dom/server';
import AcceptInvitePage from '../page';
import {claimOrganizationSeat,claimInvitedOrganizationSeat} from '@/lib/billing/organizationSeatClaim';
import {createInviteToken,validateInviteToken} from '@/lib/workforce/domains/inviteLinks';
function fixture(acceptedAt:Date|null,used=2){
 const member={id:'membership',acceptedAt,role:'read_only',invitedBy:'original-inviter',providerScopes:['aws']};
 const tx={ $queryRawUnsafe:async()=>[],tenantBillingPlan:{findUnique:vi.fn(async()=>null)},orgMembership:{findUnique:vi.fn(async()=>member),count:vi.fn(async()=>used+(acceptedAt===null&&member.acceptedAt!==null?1:0)),update:vi.fn(async({data}:any)=>Object.assign(member,data)),create:vi.fn(async()=>{throw Error('unexpected create')})}};
 m.repo={$transaction:async(fn:any)=>fn(tx),orgMembership:tx.orgMembership};return {tx,member};
}
beforeEach(()=>{vi.clearAllMocks();m.publicPolicy=false;m.snapshot.mockResolvedValue({usable:true,seatQuantity:2});vi.stubEnv('INVITE_LINK_SECRET','SIMULATED_local_test_key_not_a_credential');});
afterEach(()=>vi.unstubAllEnvs());
it('actual legacy acceptance must not restore admin role on accepted downgraded member',async()=>{
 const {tx,member}=fixture(new Date());
 const token=createInviteToken('invited-org','invitee@example.test','admin','former-admin');
 await AcceptInvitePage({params:Promise.resolve({token})});
 expect(member.role).toBe('read_only');expect(tx.orgMembership.update).not.toHaveBeenCalled();
});
it('actual public-billing acceptance must not restore admin role on accepted downgraded member',async()=>{
 m.publicPolicy=true;const {member}=fixture(new Date());
 await AcceptInvitePage({params:Promise.resolve({token:createInviteToken('invited-org','invitee@example.test','admin','former-admin')})});
 expect(member.role).toBe('read_only');
});
it('legacy pending membership is a new accepted seat and must refuse when full',async()=>{
 const {tx}=fixture(null,2);
 const result=await claimOrganizationSeat(m.repo,{organizationId:'invited-org',userId:'invitee',role:'operator',invitedBy:'former-admin'});
 expect(result).toMatchObject({ok:false,error:'seat_limit_exhausted'});expect(tx.orgMembership.update).not.toHaveBeenCalled();
});
it('CONTROL: existing SSO contract without invitedBy refreshes current mapped role',async()=>{
 const {member}=fixture(new Date());
 expect(await claimOrganizationSeat(m.repo,{organizationId:'sso-org',userId:'invitee',role:'operator'})).toMatchObject({ok:true,created:false});
 expect(member.role).toBe('operator');
});
it('OBSERVATION: signed invite validation has no inviter lookup or consumed-nonce state',()=>{
 const token=createInviteToken('invited-org','invitee@example.test','admin','former-admin');
 const first=validateInviteToken(token),second=validateInviteToken(token);
 expect(first.ok).toBe(true);expect(second).toEqual(first);expect(first.payload?.invitedByUserId).toBe('former-admin');
});

it.each([false,true])('accepted invitation preserves owner role, exact timestamp and fields (public=%s)',async(publicPolicy)=>{
 m.publicPolicy=publicPolicy;const {tx,member}=fixture(new Date('2026-10-01T00:00:00Z'));member.role='owner';const original=structuredClone(member);
 const result=await claimInvitedOrganizationSeat(m.repo,{organizationId:'invited-org',userId:'invitee',role:'read_only',invitedBy:'new-inviter'});
 expect(result).toMatchObject({ok:true,alreadyMember:true,role:'owner',used:2});expect(member).toEqual(original);expect(tx.orgMembership.update).not.toHaveBeenCalled();expect(tx.orgMembership.create).not.toHaveBeenCalled();
});
it.each([false,true])('pending invitation below capacity accepts exactly one seat, then replay is read only (public=%s)',async(publicPolicy)=>{
 m.publicPolicy=publicPolicy;const {tx,member}=fixture(null,1);const input={organizationId:'invited-org',userId:'invitee',role:'operator',invitedBy:'inviter'};
 expect(await claimInvitedOrganizationSeat(m.repo,input)).toMatchObject({ok:true,alreadyMember:false,created:false,used:2,limit:2,role:'operator'});
 const acceptedAt=member.acceptedAt;expect(acceptedAt).toBeInstanceOf(Date);
 expect(await claimInvitedOrganizationSeat(m.repo,{...input,role:'admin'})).toMatchObject({ok:true,alreadyMember:true,role:'operator',used:2});
 expect(tx.orgMembership.update).toHaveBeenCalledOnce();expect(member.acceptedAt).toBe(acceptedAt);expect(tx.orgMembership.create).not.toHaveBeenCalled();
});
it('actual page displays persisted role and already-member state, retaining signed target tenant',async()=>{
 const {tx}=fixture(new Date());const token=createInviteToken('invited-org','invitee@example.test','admin','former-admin');
 const html=renderToStaticMarkup(await AcceptInvitePage({params:Promise.resolve({token})}));
 expect(html).toContain('already a workspace member');expect(html).toContain('Read-Only');expect(html).not.toContain('role refreshed');expect(html).not.toContain('>admin<');
 expect(tx.orgMembership.findUnique).toHaveBeenCalledWith({where:{userId_organizationId:{userId:'invitee',organizationId:'invited-org'}}});
});
it.each([undefined,new Date('invalid')])('unknown existing acceptance metadata refuses without update',async(acceptedAt)=>{
 const {tx,member}=fixture(null);(member as any).acceptedAt=acceptedAt;
 expect(await claimInvitedOrganizationSeat(m.repo,{organizationId:'invited-org',userId:'invitee',role:'admin',invitedBy:'inviter'})).toMatchObject({ok:false,error:'seat_entitlement_unavailable'});expect(tx.orgMembership.update).not.toHaveBeenCalled();
});
it('invitation entry cannot grant owner or unknown roles',async()=>{
 const {tx}=fixture(null,1);
 for(const role of ['owner','unknown'])expect(await claimInvitedOrganizationSeat(m.repo,{organizationId:'invited-org',userId:'invitee',role,invitedBy:'inviter'})).toMatchObject({ok:false});
 expect(tx.orgMembership.update).not.toHaveBeenCalled();expect(tx.orgMembership.create).not.toHaveBeenCalled();
});
