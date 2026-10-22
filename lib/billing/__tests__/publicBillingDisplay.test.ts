import { beforeEach, describe, expect, it, vi } from 'vitest';
const mocks=vi.hoisted(()=>({billing:vi.fn(),summary:vi.fn(),recent:vi.fn(),redirect:vi.fn((url:string)=>{throw Error(`redirect:${url}`);})}));
vi.mock('@/lib/auth/currentContext',()=>({currentContext:async()=>({isAuthenticated:true,organizationId:'org'})}));
vi.mock('@/lib/billing/tenantBillingStore',()=>({readBillingPlan:mocks.billing}));
vi.mock('@/lib/db',()=>({prisma:{workspaceUsageSummary:{findUnique:mocks.summary},usageEvent:{findMany:mocks.recent}}}));
vi.mock('next/navigation',()=>({redirect:mocks.redirect}));
import Page from '@/app/dashboard/billing/usage/page';
describe('public subscription billing display',()=>{
 beforeEach(()=>{vi.clearAllMocks();mocks.summary.mockResolvedValue(null);mocks.recent.mockResolvedValue([]);});
 it.each([
  {tier:'growth',status:'active',publicPlanId:'pro',pricingPlanAvailable:true},
  {tier:'trial',status:'no_plan',publicPlanId:'pro',pricingPlanAvailable:false},
 ])('uses canonical contract-aware balances instead of calendar-month legacy summaries (%s)',async record=>{
  mocks.billing.mockResolvedValue(record);
  await expect(Page()).rejects.toThrow('redirect:/control/usage-billing');
  expect(mocks.summary).not.toHaveBeenCalled();expect(mocks.recent).not.toHaveBeenCalled();
 });
});
