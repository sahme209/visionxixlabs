import { beforeEach, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
const io=vi.hoisted(()=>({context:vi.fn(),access:vi.fn(),connection:vi.fn(),automations:vi.fn(),executions:vi.fn(),load:vi.fn(),dags:vi.fn(),runs:vi.fn(),tasks:vi.fn()}));
vi.mock('@/lib/auth/currentContext',()=>({currentContext:io.context}));
vi.mock('@/lib/desktop/desktopCommercialAccess',()=>({readDesktopCommercialAccess:io.access}));
vi.mock('@/lib/integrations/airflow/connection',()=>({loadAirflowClient:io.load}));
vi.mock('@/lib/db',()=>({prisma:{tenantIntegrationConnection:{findUnique:io.connection},airflowAutomation:{findMany:io.automations},airflowAutomationExecution:{findMany:io.executions}}}));
import { GET } from '../route';
const req=(q='')=>new NextRequest('https://example.test/api/control/airflow'+q);
beforeEach(()=>{
 vi.resetAllMocks();io.context.mockResolvedValue({isAuthenticated:true,organizationId:'org-A',userId:'user-A',roles:['owner']});io.access.mockResolvedValue({allowed:true});
 io.connection.mockResolvedValue({status:'active',lastValidatedAt:new Date('2026-10-01'),scopesJson:{version:'3.1',dagCount:2,token:'never-expose'}});io.automations.mockResolvedValue([]);io.executions.mockResolvedValue([]);
 io.load.mockResolvedValue({client:{listDags:io.dags,listDagRuns:io.runs,listTaskInstances:io.tasks}});io.dags.mockResolvedValue([]);io.runs.mockResolvedValue([]);io.tasks.mockResolvedValue({tasks:[],offset:0,totalEntries:0});
});
it('requires browser sign-in before reading workspace data or credentials',async()=>{
 io.context.mockResolvedValue({isAuthenticated:false,roles:[]});expect((await GET(req())).status).toBe(401);expect(io.connection).not.toHaveBeenCalled();expect(io.load).not.toHaveBeenCalled();
});
it.each([{roles:[]},{roles:['unknown']},{roles:['platform_admin']}])('requires a recognized accepted workspace role $roles',async ({roles})=>{
 io.context.mockResolvedValue({isAuthenticated:true,organizationId:'org-A',userId:'user-A',roles});expect((await GET(req())).status).toBe(403);expect(io.load).not.toHaveBeenCalled();
});
it('does not load provider credentials when commercial access is denied',async()=>{
 io.access.mockResolvedValue({allowed:false});expect((await GET(req('?view=dags'))).status).toBe(403);expect(io.load).not.toHaveBeenCalled();
});
it('returns selected metadata without secrets or implicit provider requests',async()=>{
 const result=await GET(req('?organizationId=org-B'));expect(result.status).toBe(200);const body=await result.json();expect(body.data.connection.version).toBe('3.1');expect(JSON.stringify(body)).not.toContain('never-expose');expect(io.load).not.toHaveBeenCalled();
 expect(io.connection).toHaveBeenCalledWith(expect.objectContaining({where:{organizationId_provider:{organizationId:'org-A',provider:'airflow'}}}));
 expect(io.automations).toHaveBeenCalledWith(expect.objectContaining({where:{organizationId:'org-A'},take:50}));
});
it('loads the authenticated workspace DAGs on explicit request',async()=>{
 expect((await GET(req('?view=dags&organizationId=org-B'))).status).toBe(200);expect(io.load).toHaveBeenCalledWith('org-A');expect(io.dags).toHaveBeenCalledOnce();
});
it('keeps disconnected state honest and never loads credentials',async()=>{
 io.connection.mockResolvedValue(null);const result=await GET(req('?view=dags'));expect(result.status).toBe(409);expect(io.load).not.toHaveBeenCalled();
});
it('reads runs and paged task metadata through the existing client',async()=>{
 await GET(req('?view=runs&dag=daily'));expect(io.runs).toHaveBeenCalledWith('daily',50);
 await GET(req('?view=tasks&dag=daily&run=run-1&offset=100'));expect(io.tasks).toHaveBeenCalledWith('daily','run-1',100);
});
it.each(['?view=tasks&dag=daily','?view=runs','?view=tasks&dag=daily&run=x&offset=-1','?view=tasks&dag=daily&run=x&offset=1.5','?view=trigger'])('rejects invalid or mutating request %s',async q=>{
 expect((await GET(req(q))).status).toBe(400);expect(io.load).not.toHaveBeenCalled();
});
it('does not leak provider or database errors',async()=>{
 io.load.mockRejectedValue(Error('private-token-provider-payload'));const r=await GET(req('?view=dags'));expect(r.status).toBe(502);expect(await r.text()).not.toContain('private-token');
});
it('marks responses private and uncached',async()=>{
 const r=await GET(req());expect(r.headers.get('cache-control')).toContain('no-store');
});
