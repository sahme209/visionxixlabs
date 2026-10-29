import {beforeEach,afterEach,describe,expect,it,vi} from 'vitest';
const m=vi.hoisted(()=>({find:vi.fn(),upsert:vi.fn(),enroll:vi.fn()}));
vi.mock('@/lib/db',()=>({prisma:{$transaction:async(fn:(tx:unknown)=>Promise<unknown>)=>fn({orgMembership:{findUnique:m.find,upsert:m.upsert}}),orgMembership:{upsert:m.upsert}}}));
vi.mock('../publicFreeEnrollment',()=>({enrollNewPublicWorkspace:m.enroll}));
import {ensurePersonalWorkspaceMembership} from '@/lib/auth/ensurePersonalWorkspaceMembership';
describe('new public Free enrollment at sign-in',()=>{
 beforeEach(()=>{vi.clearAllMocks();vi.stubEnv('AXIOM_PUBLIC_BILLING_POLICY','axiom_public_anniversary_v1');vi.stubEnv('AXIOM_STRIPE_ACCOUNT_ID','acct_fixture');vi.stubEnv('AXIOM_STRIPE_MODE','test');m.find.mockResolvedValue(null);m.upsert.mockResolvedValue({});});afterEach(()=>vi.unstubAllEnvs());
 it('enrolls only a newly created personal membership in the same transaction',async()=>{await ensurePersonalWorkspaceMembership({userId:'user',email:'fixture@example.invalid'});expect(m.enroll).toHaveBeenCalledOnce();expect(m.enroll.mock.calls[0][1]).toBe(m.upsert.mock.calls[0][0].create.organizationId);});
 it('does not migrate an existing workspace at sign-in',async()=>{m.find.mockResolvedValue({role:'owner',acceptedAt:new Date()});await ensurePersonalWorkspaceMembership({userId:'user',email:'fixture@example.invalid'});expect(m.enroll).not.toHaveBeenCalled();});
 it('propagates failed enrollment instead of claiming a free plan is configured',async()=>{m.enroll.mockRejectedValue(Error('missing storage'));await expect(ensurePersonalWorkspaceMembership({userId:'user',email:'fixture@example.invalid'})).rejects.toThrow('missing storage');});
});
