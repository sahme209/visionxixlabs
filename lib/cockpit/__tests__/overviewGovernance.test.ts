/** @vitest-environment jsdom */
import { render, screen, cleanup } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
const io=vi.hoisted(()=>({count:vi.fn(),policy:vi.fn(),checks:vi.fn(),results:vi.fn(),envs:vi.fn(async()=>[] as unknown[]),keys:vi.fn(async()=>[] as unknown[])}));
vi.mock('@/lib/auth/currentContext',()=>({currentContext:async()=>({isAuthenticated:true,organizationId:'org-g',email:'p@example.test',userId:'u',roles:['owner']})}));
vi.mock('@/lib/db',()=>({prisma:{agentActionProposal:{count:io.count},orgMembership:{count:io.count},tenantIntegrationConnection:{count:io.count},environment:{count:io.count,findMany:io.envs},policyChangeRequest:{count:io.policy},deploymentCheck:{findMany:io.checks},deploymentCheckResult:{findMany:io.results},apiKey:{findMany:io.keys}}}));
vi.mock('@/lib/billing/tenantBillingStore',()=>({readBillingPlanWithAvailability:async()=>null}));
vi.mock('@/lib/billing/currentAIAllowance',()=>({readCurrentAIAllowance:async()=>({available:false})}));
vi.mock('@/lib/billing/isolatedApplication/scope',()=>({withIsolatedWorkspaceScope:(_c:unknown,_m:unknown,op:()=>unknown)=>op()}));
vi.mock('next/navigation',()=>({redirect:(url:string)=>{throw Error(url)}}));
import Overview from '@/app/control/page';
beforeEach(()=>{vi.clearAllMocks();io.count.mockResolvedValue(0);io.policy.mockResolvedValue(1);io.checks.mockResolvedValue([{key:'a'},{key:'b'}]);io.results.mockResolvedValue([{checkKey:'a',status:'failed'},{checkKey:'a',status:'passed'},{checkKey:'b',status:'passed'}]);});
afterEach(()=>cleanup());
it('surfaces pending policy changes and blocking checks that failed on their latest run',async()=>{
 render(await Overview());
 expect(screen.getByRole('link',{name:'1 policy change request awaits a second approver'}).getAttribute('href')).toBe('/control/governance#policy-as-code-heading');
 expect(screen.getByRole('link',{name:'1 failed on its latest reported run'}).getAttribute('href')).toBe('/control/checks');
 expect(io.policy).toHaveBeenCalledWith({where:{organizationId:'org-g',status:'pending'}});
});
it('hides the section when the governance reads fail',async()=>{
 io.policy.mockRejectedValue(Error('down'));
 render(await Overview());
 expect(screen.queryByRole('heading',{name:'Release governance'})).toBeNull();
});
it('lists environments frozen right now',async()=>{
 io.envs.mockResolvedValueOnce([{name:'Production',changeWindowRuleJson:{freezes:[{startUtc:'2000-01-01T00:00:00Z',endUtc:'2999-01-01T00:00:00Z',reason:'Holiday freeze'}]}},{name:'Dev',changeWindowRuleJson:null}]);
 render(await Overview());
 expect(screen.getByText(/Production is frozen: Holiday freeze, until/)).toBeTruthy();
 expect(screen.queryByText(/Dev is frozen/)).toBeNull();
});
it('links to agent firewall warnings',async()=>{
 io.keys.mockResolvedValueOnce([{name:'ci-all',scopes:['*'],expiresAt:null,revokedAt:null}]);
 render(await Overview());
 expect(screen.getByRole('link',{name:'1 agent firewall warning to review'}).getAttribute('href')).toBe('/control/agent-gateway#agent-firewall-heading');
});
