import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest';
const m=vi.hoisted(()=>({billing:vi.fn(),allowance:vi.fn(),members:vi.fn(),usage:vi.fn()}));
vi.mock('../tenantBillingStore',()=>({readBillingPlan:m.billing}));
vi.mock('../currentAIAllowance',()=>({readCurrentAIAllowance:m.allowance}));
vi.mock('@/lib/db',()=>({prisma:{orgMembership:{count:m.members},usageEvent:{aggregate:m.usage,count:async()=>0},addOnPurchase:{findMany:async()=>[]}}}));
import {planForStripeTier} from '../planRegistry';
import {checkWorkspaceAICredits} from '../checkWorkspaceAICredits';
import {enforceEntitlement} from '../enforceEntitlement';
function plan(){const base=planForStripeTier('growth');return {...base,displayName:'Pro',entitlements:{...base.entitlements,maxUsers:2,includedAICreditsCents:2000,overagePolicy:'hard_stop' as const}};}
describe('public entitlement enforcement',()=>{
 beforeEach(()=>{vi.resetAllMocks();vi.stubEnv('AXIOM_PUBLIC_BILLING_POLICY','axiom_public_anniversary_v1');m.billing.mockResolvedValue({tier:'growth',status:'active',publicPlanId:'pro',pricingPlan:plan(),pricingPlanAvailable:true});m.allowance.mockResolvedValue({available:true,poolCents:2000,usedCents:1950,heldCents:0,includedRemainingCents:50});m.members.mockResolvedValue(2);m.usage.mockResolvedValue({_sum:{billedCents:0}});});afterEach(()=>vi.unstubAllEnvs());
 it('uses the attributed remaining balance, not the legacy $200 Growth pool',async()=>{const r=await checkWorkspaceAICredits('org',100);expect(r.kind).toBe('block');expect(m.usage).not.toHaveBeenCalled();});
 it('refuses unavailable public credit evidence instead of falling back to a free balance',async()=>{m.allowance.mockResolvedValue({available:false});await expect(checkWorkspaceAICredits('org',1)).rejects.toThrow('ai_credit_meter_unavailable');});
 it('counts real accepted members against purchased seats',async()=>{const r=await enforceEntitlement({organizationId:'org',dimension:'users',attemptedDelta:1});expect(r).toMatchObject({kind:'block',limit:2});expect(m.members).toHaveBeenCalledWith({where:{organizationId:'org',acceptedAt:{not:null}}});});
 it('does not authorize extra members when counting fails',async()=>{m.members.mockRejectedValue(Error('database unavailable'));await expect(enforceEntitlement({organizationId:'org',dimension:'users'})).rejects.toThrow();});
 it('does not fall back to legacy allowances when paid coverage is unavailable',async()=>{m.billing.mockResolvedValue({tier:'growth',publicPlanId:'pro',pricingPlan:plan(),pricingPlanAvailable:false});await expect(checkWorkspaceAICredits('org',1)).rejects.toThrow();await expect(enforceEntitlement({organizationId:'org',dimension:'users'})).rejects.toThrow();});
});
