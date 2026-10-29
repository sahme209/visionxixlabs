/** @vitest-environment jsdom */
import {afterEach,beforeEach,expect,it,vi} from 'vitest';
import {cleanup,render,screen} from '@testing-library/react';
const io=vi.hoisted(()=>({cloud:vi.fn(),connections:vi.fn(),context:vi.fn(),admin:vi.fn(),jira:vi.fn((_props:{scopeKey:string;canManage:boolean})=>null)}));
vi.mock('@/lib/auth/currentContext',()=>({currentContext:io.context}));
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
