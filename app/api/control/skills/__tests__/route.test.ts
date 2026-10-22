import { beforeEach, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
const io=vi.hoisted(()=>({context:vi.fn(),access:vi.fn(),upsert:vi.fn(),disable:vi.fn(),audit:vi.fn()}));
vi.mock('@/lib/auth/currentContext',()=>({currentContext:io.context}));
vi.mock('@/lib/desktop/desktopCommercialAccess',()=>({readDesktopCommercialAccess:io.access}));
vi.mock('@/lib/db',()=>({prisma:{agentSkillInstallation:{upsert:io.upsert,updateMany:io.disable}}}));
vi.mock('@/lib/audit/requiredAudit',()=>({recordRequiredAudit:io.audit}));
import { POST } from '../route';
const request=(body:unknown={skillId:'integration-audit',action:'install'},origin='https://fixture.test')=>new NextRequest('https://fixture.test/api/control/skills',{method:'POST',headers:{origin,'content-type':'application/json'},body:JSON.stringify(body)});
beforeEach(()=>{vi.resetAllMocks();io.context.mockResolvedValue({isAuthenticated:true,organizationId:'org-A',userId:'user-A',roles:['owner']});io.access.mockResolvedValue({allowed:true});io.upsert.mockResolvedValue({});io.disable.mockResolvedValue({count:1});io.audit.mockResolvedValue(undefined)});
it('requires same-origin browser requests',async()=>{expect((await POST(request(undefined,'https://outside.test'))).status).toBe(403);expect(io.upsert).not.toHaveBeenCalled()});
it('requires sign-in',async()=>{io.context.mockResolvedValue({isAuthenticated:false,roles:[]});expect((await POST(request())).status).toBe(401);expect(io.upsert).not.toHaveBeenCalled()});
it.each(['operator','security_reviewer','finance_viewer','read_only','platform_admin'])('rejects non-admin role %s',async role=>{io.context.mockResolvedValue({isAuthenticated:true,organizationId:'org-A',userId:'user-A',roles:[role]});expect((await POST(request())).status).toBe(403);expect(io.upsert).not.toHaveBeenCalled()});
it('requires current commercial access',async()=>{io.access.mockResolvedValue({allowed:false});expect((await POST(request())).status).toBe(403);expect(io.upsert).not.toHaveBeenCalled()});
it.each([{skillId:'remote-unreviewed',action:'install'},{skillId:'integration-audit',action:'remove'},{skillId:'integration-audit',action:'execute'}])('rejects unsupported requests %j',async body=>{expect((await POST(request(body))).status).toBe(400);expect(io.upsert).not.toHaveBeenCalled()});
it('uses the shared installation store for the authenticated workspace and audits unchanged tool authority',async()=>{
 const result=await POST(request({skillId:'integration-audit',action:'install',organizationId:'org-B'}));expect(result.status).toBe(200);
 expect(io.upsert).toHaveBeenCalledWith(expect.objectContaining({where:{organizationId_skillId:{organizationId:'org-A',skillId:'integration-audit'}},create:expect.objectContaining({installedByUserId:'user-A'})}));
 expect(io.audit).toHaveBeenCalledWith(expect.objectContaining({action:'skill.install',detail:expect.objectContaining({authorityChanged:false})}));
 expect(result.headers.get('cache-control')).toContain('no-store');
});
it('disables the existing installation and refuses a missing installation',async()=>{
 expect((await POST(request({skillId:'integration-audit',action:'disable'}))).status).toBe(200);expect(io.disable).toHaveBeenCalledWith({where:{organizationId:'org-A',skillId:'integration-audit'},data:{status:'disabled'}});
 io.disable.mockResolvedValue({count:0});expect((await POST(request({skillId:'integration-audit',action:'disable'}))).status).toBe(409);
});
it('does not report success or leak storage errors',async()=>{io.upsert.mockRejectedValue(Error('private-database-message'));const r=await POST(request());expect(r.status).toBe(503);expect(await r.text()).not.toContain('private-database')});

it('discloses an unconfirmed required audit after a skill mutation without replaying it',async()=>{
 io.audit.mockRejectedValueOnce(Error('private audit diagnostic'));
 const result=await POST(request());expect(result.status).toBe(503);
 const body=await result.json();expect(body.error).toBe('skill_audit_unconfirmed');expect(body.data).toBeUndefined();
 expect(io.upsert).toHaveBeenCalledOnce();expect(io.audit).toHaveBeenCalledOnce();
});
