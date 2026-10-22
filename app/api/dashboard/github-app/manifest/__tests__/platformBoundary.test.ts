import {beforeEach,afterEach,expect,it,vi} from 'vitest';
import {NextRequest} from 'next/server';
const io=vi.hoisted(()=>({context:vi.fn(),upsert:vi.fn(),fetch:vi.fn(),start:vi.fn()}));
vi.mock('@/lib/auth/currentContext',()=>({currentContext:io.context}));
vi.mock('@/lib/integrations/trustedCallbackUrl',()=>({trustedAxiomUrl:(path:string)=>`https://visionxixlabs.com${path}`}));
vi.mock('@/lib/connectors/github/platformGithubAppCredential',()=>({upsertPlatformGithubAppCredential:io.upsert}));
vi.mock('@/lib/audit/secureAudit',()=>({record:vi.fn()}));
vi.mock('@/lib/audit/requiredAudit',()=>({recordRequiredAudit:vi.fn()}));
vi.mock('@/lib/db',()=>({prisma:{}}));
vi.mock('@/lib/integrations/tenantConnectionRepo',()=>({startTenantIntegrationAuthorization:io.start,consumeTenantIntegrationAuthorization:vi.fn()}));
beforeEach(()=>{vi.clearAllMocks();vi.stubEnv('ADMIN_EMAILS','platform@example.test');vi.stubGlobal('fetch',io.fetch);io.start.mockResolvedValue({state:'fixture-unguessable-state'});});
afterEach(()=>{vi.unstubAllGlobals();vi.unstubAllEnvs();});
it.each([['owner','manifest'],['admin','manifest'],['owner','callback'],['admin','callback']])('does not let a tenant %s use the platform App %s endpoint',async(role,endpoint)=>{
 io.context.mockResolvedValue({isAuthenticated:true,organizationId:'tenant-one',userId:'tenant-user',email:'tenant@example.test',roles:[role]});
 const {GET:manifest}=await import('../route');
 const {GET:callback}=await import('@/app/api/integrations/github/app-manifest-callback/route');
 const result=endpoint==='manifest'?await manifest(new NextRequest('https://visionxixlabs.com/api/dashboard/github-app/manifest')):await callback(new NextRequest('https://visionxixlabs.com/api/integrations/github/app-manifest-callback?code=untrusted-code'));
 expect(result.status).toBe(403);expect(await result.json()).toEqual({ok:false,error:'platform_admin_required'});
 expect(io.fetch).not.toHaveBeenCalled();expect(io.upsert).not.toHaveBeenCalled();
});
it('lets an explicitly configured platform administrator read the nonsecret manifest',async()=>{
 io.context.mockResolvedValue({isAuthenticated:true,organizationId:'tenant-one',userId:'operator-user',email:'platform@example.test',roles:['read_only']});
 const {GET}=await import('../route');const result=await GET(new NextRequest('https://visionxixlabs.com/api/dashboard/github-app/manifest'));
 expect(result.status).toBe(200);expect((await result.json()).data.createUrl).toBe('https://github.com/settings/apps/new');
 expect(io.fetch).not.toHaveBeenCalled();expect(io.upsert).not.toHaveBeenCalled();
});

it('requires same-origin initiation before creating any challenge',async()=>{
 const {POST}=await import('../route');const res=await POST(new NextRequest('https://visionxixlabs.com/api/dashboard/github-app/manifest',{method:'POST',headers:{origin:'https://other.invalid'}}));
 expect(res.status).toBe(403);expect(io.start).not.toHaveBeenCalled();
});
it('binds a platform-admin initiation to the actor and trusted callback and sends state to GitHub',async()=>{
 io.context.mockResolvedValue({isAuthenticated:true,organizationId:'tenant-one',userId:'operator-user',email:'platform@example.test',roles:['read_only']});
 const {POST}=await import('../route');const res=await POST(new NextRequest('https://visionxixlabs.com/api/dashboard/github-app/manifest',{method:'POST',headers:{origin:'https://visionxixlabs.com'}}));
 expect(res.status).toBe(200);const body=await res.json();
 expect(new URL(body.data.createUrl).searchParams.get('state')).toBe('fixture-unguessable-state');
 expect(io.start).toHaveBeenCalledWith(expect.anything(),{organizationId:'tenant-one',initiatedByUserId:'operator-user',provider:'github',redirectUri:'https://visionxixlabs.com/api/integrations/github/app-manifest-callback'});
 expect(res.headers.get('cache-control')).toBe('private, no-store');expect(io.fetch).not.toHaveBeenCalled();
});
it('keeps the read-only preview free of initiation writes',async()=>{
 io.context.mockResolvedValue({isAuthenticated:true,organizationId:'tenant-one',userId:'operator-user',email:'platform@example.test',roles:[]});
 const {GET}=await import('../route');expect((await GET(new NextRequest('https://visionxixlabs.com/api/dashboard/github-app/manifest'))).status).toBe(200);expect(io.start).not.toHaveBeenCalled();
});
it.each(['owner','admin'])('does not create a challenge for a non-platform %s',async(role)=>{
 io.context.mockResolvedValue({isAuthenticated:true,organizationId:'tenant-one',userId:'tenant-user',email:'tenant@example.test',roles:[role]});
 const {POST}=await import('../route');const res=await POST(new NextRequest('https://visionxixlabs.com/api/dashboard/github-app/manifest',{method:'POST',headers:{origin:'https://visionxixlabs.com'}}));
 expect(res.status).toBe(403);expect(io.start).not.toHaveBeenCalled();
});
it('fails closed when setup challenge persistence is unavailable',async()=>{
 io.context.mockResolvedValue({isAuthenticated:true,organizationId:'tenant-one',userId:'operator-user',email:'platform@example.test',roles:[]});io.start.mockRejectedValueOnce(new Error('storage unavailable'));
 const {POST}=await import('../route');const res=await POST(new NextRequest('https://visionxixlabs.com/api/dashboard/github-app/manifest',{method:'POST',headers:{origin:'https://visionxixlabs.com'}}));
 expect(res.status).toBe(503);expect((await res.json()).ok).toBe(false);expect(io.fetch).not.toHaveBeenCalled();
});
