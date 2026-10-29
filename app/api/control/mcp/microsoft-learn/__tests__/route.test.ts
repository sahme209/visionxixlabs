import {beforeEach,expect,it,vi} from 'vitest';
import {NextRequest} from 'next/server';
const io=vi.hoisted(()=>({context:vi.fn(),access:vi.fn(),check:vi.fn(),search:vi.fn(),audit:vi.fn()}));
vi.mock('@/lib/auth/currentContext',()=>({currentContext:io.context}));
vi.mock('@/lib/desktop/desktopCommercialAccess',()=>({readDesktopCommercialAccess:io.access}));
vi.mock('@/lib/db',()=>({prisma:{}}));
vi.mock('@/lib/audit/requiredAudit',()=>({recordRequiredAudit:io.audit}));
vi.mock('@/lib/integrations/mcp/microsoftLearn',()=>({checkMicrosoftLearn:io.check,searchInstalledMicrosoftLearn:io.search}));
import {POST} from '../route';
import {clearRateLimits} from '@/lib/api/rateLimiter';
const request=(body:unknown={action:'search',query:'Azure identity'},origin='https://fixture.test')=>new NextRequest('https://fixture.test/api/control/mcp/microsoft-learn',{method:'POST',headers:{origin,'content-type':'application/json'},body:JSON.stringify(body)});
beforeEach(()=>{vi.resetAllMocks();clearRateLimits();io.context.mockResolvedValue({isAuthenticated:true,userId:'user-A',organizationId:'org-A',roles:['read_only']});io.access.mockResolvedValue({allowed:true});io.search.mockResolvedValue({ok:true,data:{results:[]}});io.check.mockResolvedValue({ok:true,data:{searchAvailable:true}});});
it.each(['origin','auth','membership','access'])('denies %s before contacting Microsoft',async boundary=>{
 if(boundary==='auth')io.context.mockResolvedValue({isAuthenticated:false});if(boundary==='membership')io.context.mockResolvedValue({isAuthenticated:true,userId:'u',organizationId:'o',roles:[]});if(boundary==='access')io.access.mockResolvedValue({allowed:false});
 expect((await POST(request(undefined,boundary==='origin'?'https://outside.test':'https://fixture.test'))).status).toBe(boundary==='auth'?401:403);expect(io.search).not.toHaveBeenCalled();expect(io.check).not.toHaveBeenCalled();
});
it('uses the authenticated workspace and never accepts a user-provided endpoint',async()=>{
 expect((await POST(request({action:'search',query:'Azure identity',organizationId:'org-B'}))).status).toBe(400);
 const result=await POST(request());expect(result.status).toBe(200);expect(io.search).toHaveBeenCalledWith(expect.anything(),'org-A','Azure identity');expect(result.headers.get('cache-control')).toContain('no-store');
 expect((await POST(request({action:'check',endpoint:'http://localhost/private'}))).status).toBe(400);
});
it('requires a current installation and withholds private errors',async()=>{io.search.mockResolvedValue({ok:false,error:'mcp_not_enabled'});expect((await POST(request())).status).toBe(409);io.search.mockRejectedValue(Error('private diagnostic'));const r=await POST(request());expect(r.status).toBe(503);expect(await r.text()).not.toContain('private diagnostic');});
it('checks the real server capability without pretending to install or grant access',async()=>{const r=await POST(request({action:'check'}));expect(r.status).toBe(200);expect(await r.json()).toEqual({ok:true,data:{searchAvailable:true}});expect(io.search).not.toHaveBeenCalled();});
it('bounds request bodies before JSON parsing',async()=>{expect((await POST(request({action:'search',query:'x'.repeat(3000)}))).status).toBe(400);expect(io.search).not.toHaveBeenCalled();});
it('does not release results when required audit persistence fails',async()=>{io.audit.mockRejectedValue(Error('private audit error'));const r=await POST(request());expect(r.status).toBe(503);expect(await r.json()).toEqual({ok:false,error:'documentation_audit_unconfirmed'});});
it('rate-limits repeated requests before another provider call',async()=>{for(let i=0;i<10;i++)expect((await POST(request({action:'check'}))).status).toBe(200);expect((await POST(request({action:'check'}))).status).toBe(429);expect(io.check).toHaveBeenCalledTimes(10);});
