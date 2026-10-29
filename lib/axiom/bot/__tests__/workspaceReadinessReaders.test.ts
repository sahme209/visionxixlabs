import {it,expect,vi} from 'vitest';
const m=vi.hoisted(()=>({membership:vi.fn(async()=>({role:'owner',acceptedAt:new Date()})),billing:vi.fn(async()=>({available:true,plan:{tier:'pro',status:'active'}}))}));
vi.mock('@/lib/db',()=>({prisma:{orgMembership:{findUnique:m.membership}}}));
vi.mock('@/lib/billing/tenantBillingStore',()=>({readBillingPlanWithAvailability:m.billing}));
import {workspaceReadinessReaders} from '../workspaceReadinessReaders';
it('uses recorded availability-aware billing policy rather than a default access grant',async()=>{const signal=new AbortController().signal;expect((await workspaceReadinessReaders().readAccess({organizationId:'org',userId:'user'},signal)).canRead).toBe(true);expect(m.billing).toHaveBeenCalledWith('org');m.billing.mockResolvedValueOnce({available:false,plan:{tier:'pro',status:'active'}});await expect(workspaceReadinessReaders().readAccess({organizationId:'org',userId:'user'},signal)).rejects.toThrow()});
