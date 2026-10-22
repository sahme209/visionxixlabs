/** @vitest-environment jsdom */
import { render, screen, cleanup } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
const io=vi.hoisted(()=>({billing:vi.fn(),allowance:vi.fn(),context:vi.fn(),count:vi.fn()}));
vi.mock('@/lib/auth/currentContext',()=>({currentContext:io.context}));
vi.mock('@/lib/db',()=>({prisma:{user:{findUnique:async()=>({name:'Member'})},agentActionProposal:{count:io.count},orgMembership:{count:io.count},tenantIntegrationConnection:{count:io.count},environment:{count:io.count}}}));
vi.mock('@/lib/billing/tenantBillingStore',()=>({readBillingPlanWithAvailability:io.billing}));
vi.mock('@/lib/billing/currentAIAllowance',()=>({readCurrentAIAllowance:io.allowance}));
vi.mock('@/lib/billing/isolatedApplication/scope',()=>({withIsolatedWorkspaceScope:(_ctx:unknown,_mode:unknown,operation:()=>unknown)=>operation()}));
vi.mock('next/navigation',()=>({redirect:(url:string)=>{throw Error(url)}}));
vi.mock('@/components/auth/DesktopSessionsPanel',()=>({DesktopSessionsPanel:()=>null}));
import Overview from '@/app/control/page';
import Settings from '@/app/control/settings/page';
beforeEach(()=>{
 vi.clearAllMocks();io.context.mockResolvedValue({isAuthenticated:true,organizationId:'org-current',email:'person@example.test',userId:'user-current',roles:['owner']});io.count.mockResolvedValue(0);
 io.billing.mockResolvedValue({available:true,plan:{tier:'growth',status:'active',publicPlanId:'pro',pricingPlanAvailable:true}});
 io.allowance.mockResolvedValue({available:true,includedRemainingCents:1234,poolCents:2000,usedCents:500,heldCents:266,addOnCents:0});
});
afterEach(()=>cleanup());
it('connects overview to authoritative account readers and internal product journeys',async()=>{
 render(await Overview());
 expect(io.billing).toHaveBeenCalledWith('org-current');
 expect(io.allowance.mock.calls[0][1]).toBe('org-current');
 expect(screen.getByRole('heading',{name:'Current plan'})).toBeTruthy();
 expect(screen.getByText('Pro')).toBeTruthy();expect(screen.getByText('$12.34')).toBeTruthy();
 expect(screen.getByRole('link',{name:'Review plans'}).getAttribute('href')).toBe('/control/plans');
 expect(screen.getByRole('link',{name:'View usage & billing'}).getAttribute('href')).toBe('/control/usage-billing');
 expect(screen.getByRole('link',{name:'Manage desktop sessions'}).getAttribute('href')).toBe('/control/settings?section=sessions');
 expect(screen.getByRole('link',{name:'Connect services'}).getAttribute('href')).toBe('/control/integrations');
});
it('does not turn failed billing or allowance reads into free access or a zero balance',async()=>{
 io.billing.mockRejectedValue(Error('storage unavailable'));io.allowance.mockRejectedValue(Error('storage unavailable'));
 render(await Overview());
 expect(screen.getAllByText('Unavailable').length).toBeGreaterThanOrEqual(2);
 expect(screen.queryByText('Free')).toBeNull();expect(screen.queryByText('$0.00')).toBeNull();
 expect(screen.queryByText('Access active')).toBeNull();
});
it('does not describe a canceled paid contract as active desktop access',async()=>{
 io.billing.mockResolvedValue({available:true,plan:{tier:'growth',status:'canceled',publicPlanId:'pro',pricingPlanAvailable:false}});
 render(await Overview());
 expect(screen.getByText('Billing verification required')).toBeTruthy();
 expect(screen.queryByText('Access active')).toBeNull();
});

it('opens the real sessions tab from the overview deep link',async()=>{
 render(await Settings({searchParams:Promise.resolve({section:'sessions'})}));
 expect(screen.getByRole('tab',{name:'Sessions'}).getAttribute('aria-selected')).toBe('true');
 expect(screen.getByRole('tab',{name:'Profile'}).getAttribute('aria-selected')).toBe('false');
});
it('retains a validated sessions destination through sign-in',async()=>{
 io.context.mockResolvedValue({isAuthenticated:false,roles:[]});
 await expect(Settings({searchParams:Promise.resolve({section:'sessions'})})).rejects.toThrow('/auth/signin?callbackUrl=%2Fcontrol%2Fsettings%3Fsection%3Dsessions');
});
it('ignores unrecognized settings destinations',async()=>{
 render(await Settings({searchParams:Promise.resolve({section:'//outside.test'})}));
 expect(screen.getByRole('tab',{name:'Profile'}).getAttribute('aria-selected')).toBe('true');
});
it('does not query account information without a verified membership',async()=>{
 io.context.mockResolvedValue({isAuthenticated:true,organizationId:'org-current',roles:[]});
 render(await Overview());
 expect(io.billing).not.toHaveBeenCalled();expect(io.allowance).not.toHaveBeenCalled();
 expect(screen.getByRole('alert')).toBeTruthy();
});
it('requires sign-in before reading workspace account data',async()=>{
 io.context.mockResolvedValue({isAuthenticated:false,roles:[]});
 await expect(Overview()).rejects.toThrow('/auth/signin?callbackUrl=/control');
 expect(io.billing).not.toHaveBeenCalled();expect(io.allowance).not.toHaveBeenCalled();
});
