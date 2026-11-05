/** @vitest-environment jsdom */
import {afterEach,beforeEach,expect,it,vi} from 'vitest';
import {cleanup,render,screen} from '@testing-library/react';
import {createElement,type ReactNode} from 'react';
const io=vi.hoisted(()=>({cloud:vi.fn(),connections:vi.fn(),context:vi.fn(),admin:vi.fn(),link:vi.fn(),jira:vi.fn((_props:{scopeKey:string;canManage:boolean})=>null)}));
vi.mock('@/lib/auth/currentContext',()=>({currentContext:io.context}));
vi.mock('next/link',()=>({default:(props:{href:string;children:ReactNode;prefetch?:boolean})=>{io.link(props);return createElement('a',{href:props.href},props.children);}}));
vi.mock('@/lib/auth/platformAdmin',()=>({isAdminOrOwner:io.admin}));
vi.mock('@/components/auth/JiraSetupCard',()=>({JiraSetupCard:io.jira}));
vi.mock('@/lib/integrations/collaborationOAuthReadiness',()=>({isCollaborationOAuthConfigured:()=>false}));
vi.mock('@/components/cockpit/ProviderLogo',()=>({ProviderLogo:()=>null}));
vi.mock('@/components/auth/IntegrationConnectionAction',()=>({IntegrationConnectionAction:()=>null}));
vi.mock('@/lib/db',()=>({prisma:{gitHubInstallation:{findFirst:async()=>null},tenantIntegrationConnection:{findMany:io.connections},connectorSetupSession:{findMany:io.cloud}}}));
import Integrations from '../page';
beforeEach(()=>{vi.clearAllMocks();io.context.mockResolvedValue({isAuthenticated:true,organizationId:"org-current",userId:"user-current",email:"reader@example.test",roles:["read_only"]});io.admin.mockReturnValue(false);io.cloud.mockResolvedValue([]);io.connections.mockResolvedValue([]);});
afterEach(cleanup);
it('binds Jira setup to the server-rendered workspace/user without broadening viewer controls',async()=>{
 const view=render(await Integrations());
 expect(io.jira.mock.calls[0][0]).toEqual({scopeKey:JSON.stringify(['org-current','user-current']),canManage:false});
 io.context.mockResolvedValue({isAuthenticated:true,organizationId:'org-other',userId:'user-other',email:'owner@example.test',roles:['owner']});io.admin.mockReturnValue(true);
 view.rerender(await Integrations());
 expect(io.jira.mock.calls.at(-1)?.[0]).toEqual({scopeKey:JSON.stringify(['org-other','user-other']),canManage:true});
});

it('discovers existing Outlook and ServiceNow settings without inventing connection health',async()=>{
 io.context.mockResolvedValue({isAuthenticated:true,organizationId:'org-current',userId:'user-current',email:'owner@example.test',roles:['owner']});io.admin.mockReturnValue(true);
 render(await Integrations());
 expect(screen.getByRole('link',{name:'Open Outlook settings'}).getAttribute('href')).toBe('/account/integrations/outlook');
 expect(screen.getByRole('link',{name:'Open ServiceNow settings'}).getAttribute('href')).toBe('/account/integrations/servicenow');
 for(const name of ['Outlook','ServiceNow']){
  const row=screen.getByRole('heading',{name,exact:true}).closest('article')!;
  expect(row.textContent).toMatch(name==='Outlook'?/current connection status is not shown here/i:/status is checked in settings/i);
  expect(row.textContent).not.toMatch(/\bconnected\b|\bactive\b|\bvalidated\b/i);
 }
 for(const href of ['/account/integrations/outlook','/account/integrations/servicenow'])expect(io.link.mock.calls.find(([props])=>props.href===href)?.[0].prefetch).toBe(false);
 expect(io.connections).toHaveBeenCalledTimes(1);
 expect(io.connections.mock.calls[0][0].where.provider.in).toEqual(['slack','teams','linear','airflow']);
});

it('keeps new setup controls unavailable to a read-only viewer while showing provider purpose',async()=>{
 render(await Integrations());
 expect(screen.getByRole('heading',{name:'Outlook',exact:true})).toBeTruthy();
 expect(screen.getByRole('heading',{name:'ServiceNow',exact:true})).toBeTruthy();
 expect(screen.queryByRole('link',{name:'Open Outlook settings'})).toBeNull();
 expect(screen.queryByRole('link',{name:'Open ServiceNow settings'})).toBeNull();
 expect(screen.getByText('Read-only access')).toBeTruthy();
 expect(io.jira.mock.calls[0][0].canManage).toBe(false);
});

it('keeps admin settings navigation independent of unavailable aggregate records without showing cached health',async()=>{
 io.context.mockResolvedValue({isAuthenticated:true,organizationId:'org-current',userId:'user-current',email:'admin@example.test',roles:['admin']});io.admin.mockReturnValue(true);io.connections.mockRejectedValue(new Error('synthetic aggregate unavailable'));
 render(await Integrations());
 expect(screen.getByRole('alert').textContent).toContain('Connection records are temporarily unavailable');
 expect(screen.getByRole('link',{name:'Open Outlook settings'}).getAttribute('href')).toBe('/account/integrations/outlook');
 expect(screen.getByRole('link',{name:'Open ServiceNow settings'}).getAttribute('href')).toBe('/account/integrations/servicenow');
 for(const name of ['Outlook','ServiceNow'])expect(screen.getByRole('heading',{name,exact:true}).closest('article')!.textContent).not.toMatch(/\bconnected\b|\bactive\b|\bvalidated\b/i);
 expect(io.jira.mock.calls[0][0].canManage).toBe(false);
});

it('does not expose setup links or query records without current membership',async()=>{
 io.context.mockResolvedValue({isAuthenticated:true,organizationId:'org-current',userId:'user-current',email:'reader@example.test',roles:[]});
 render(await Integrations());
 expect(screen.getByRole('alert').textContent).toContain('current workspace membership');
 expect(screen.queryByRole('heading',{name:'Outlook',exact:true})).toBeNull();
 expect(screen.queryByRole('link',{name:'Open ServiceNow settings'})).toBeNull();
 expect(io.connections).not.toHaveBeenCalled();expect(io.cloud).not.toHaveBeenCalled();
});
