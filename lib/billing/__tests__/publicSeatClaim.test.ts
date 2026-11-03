import {beforeEach,afterEach,describe,expect,it,vi} from 'vitest';
const m=vi.hoisted(()=>({snapshot:vi.fn(),existing:vi.fn(),count:vi.fn(),create:vi.fn(),update:vi.fn()}));
vi.mock('../publicBillingEntitlements',()=>({readPublicEntitlementSnapshot:m.snapshot}));vi.mock('../publicCreditAuthority',()=>({publicDatabaseNow:async()=>new Date('2026-10-22T12:00:00Z')}));
import {claimOrganizationSeat} from '../organizationSeatClaim';
const input={organizationId:'org',userId:'member',role:'operator'};
const repo=()=>({$transaction:async(fn:(tx:unknown)=>Promise<unknown>)=>fn({$queryRawUnsafe:async()=>[],tenantBillingPlan:{findUnique:async()=>({tier:'public_pro_v1',status:'active',seatQuantity:3})},orgMembership:{findUnique:m.existing,count:m.count,create:m.create,update:m.update}})});
describe('public subscription membership seat claims',()=>{
 beforeEach(()=>{vi.resetAllMocks();vi.stubEnv('AXIOM_PUBLIC_BILLING_POLICY','axiom_public_anniversary_v1');vi.stubEnv('AXIOM_STRIPE_ACCOUNT_ID','acct_fixture');vi.stubEnv('AXIOM_STRIPE_MODE','test');m.snapshot.mockResolvedValue({usable:true,seatQuantity:3});m.existing.mockResolvedValue(null);m.count.mockResolvedValue(2);});afterEach(()=>vi.unstubAllEnvs());
 it('admits a third paid seat from the verified contract',async()=>{expect(await claimOrganizationSeat(repo() as never,input)).toMatchObject({ok:true,used:3,limit:3});expect(m.create).toHaveBeenCalledOnce();});
 it('counts a previously invited but unaccepted member as a new seat',async()=>{m.existing.mockResolvedValue({id:'pending',role:'read_only',acceptedAt:null});m.count.mockResolvedValue(3);expect(await claimOrganizationSeat(repo() as never,input)).toMatchObject({ok:false,error:'seat_limit_exhausted'});expect(m.update).not.toHaveBeenCalled();});
 it('accepts an invitation only when a paid seat remains',async()=>{m.existing.mockResolvedValue({id:'pending',role:'read_only',acceptedAt:null});expect(await claimOrganizationSeat(repo() as never,input)).toMatchObject({ok:true,used:3,limit:3});expect(m.update).toHaveBeenCalledOnce();expect(m.create).not.toHaveBeenCalled();});
 it('does not consume a second seat for an already accepted member',async()=>{m.existing.mockResolvedValue({id:'active',role:'read_only',acceptedAt:new Date()});m.count.mockResolvedValue(3);expect(await claimOrganizationSeat(repo() as never,input)).toMatchObject({ok:true,created:false,used:3,limit:3});});
 it('refuses new membership when coverage is unavailable',async()=>{m.snapshot.mockResolvedValue({usable:false,seatQuantity:0});expect(await claimOrganizationSeat(repo() as never,input)).toMatchObject({ok:false,error:'seat_entitlement_unavailable'});expect(m.create).not.toHaveBeenCalled();});
});
