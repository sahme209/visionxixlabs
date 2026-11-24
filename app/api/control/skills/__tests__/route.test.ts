import { beforeEach, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
const io=vi.hoisted(()=>({context:vi.fn(),access:vi.fn(),createMany:vi.fn(),disable:vi.fn(),remove:vi.fn(),audit:vi.fn(),transaction:vi.fn()}));
vi.mock('@/lib/auth/currentContext',()=>({currentContext:io.context}));
vi.mock('@/lib/desktop/desktopCommercialAccess',()=>({readDesktopCommercialAccess:io.access}));
vi.mock('@/lib/db',()=>({prisma:{agentSkillInstallation:{updateMany:io.disable,deleteMany:io.remove},$transaction:io.transaction}}));
vi.mock('@/lib/audit/requiredAudit',()=>({recordRequiredAudit:io.audit}));
import { POST } from '../route';
const request=(body:unknown={skillId:'integration-audit',action:'install'},origin='https://fixture.test')=>new NextRequest('https://fixture.test/api/control/skills',{method:'POST',headers:{origin,'content-type':'application/json'},body:JSON.stringify(body)});
const transaction = {agentSkillInstallation: {createMany: io.createMany, updateMany: io.disable}};
beforeEach(()=>{vi.resetAllMocks();io.context.mockResolvedValue({isAuthenticated:true,organizationId:'org-A',userId:'user-A',roles:['owner']});io.access.mockResolvedValue({allowed:true});io.createMany.mockResolvedValue({count:1});io.disable.mockResolvedValue({count:1});io.remove.mockResolvedValue({count:1});io.audit.mockResolvedValue(undefined)});
beforeEach(() => { io.transaction.mockImplementation(callback => callback(transaction)); });
it('requires same-origin browser requests',async()=>{expect((await POST(request(undefined,'https://outside.test'))).status).toBe(403);expect(io.createMany).not.toHaveBeenCalled()});
it('requires sign-in',async()=>{io.context.mockResolvedValue({isAuthenticated:false,roles:[]});expect((await POST(request())).status).toBe(401);expect(io.createMany).not.toHaveBeenCalled()});
it.each(['operator','security_reviewer','finance_viewer','read_only','platform_admin'])('rejects non-admin role %s',async role=>{io.context.mockResolvedValue({isAuthenticated:true,organizationId:'org-A',userId:'user-A',roles:[role]});expect((await POST(request())).status).toBe(403);expect(io.createMany).not.toHaveBeenCalled()});
it('requires current commercial access',async()=>{io.access.mockResolvedValue({allowed:false});expect((await POST(request())).status).toBe(403);expect(io.createMany).not.toHaveBeenCalled()});
it.each([{skillId:'remote-unreviewed',action:'install'},{skillId:'integration-audit',action:'execute'}])('rejects unsupported requests %j',async body=>{expect((await POST(request(body))).status).toBe(400);expect(io.createMany).not.toHaveBeenCalled()});
it('uses the shared installation store for the authenticated workspace and audits unchanged tool authority',async()=>{
 const result=await POST(request({skillId:'integration-audit',action:'install',organizationId:'org-B'}));expect(result.status).toBe(200);
 expect(io.createMany).toHaveBeenCalledWith(expect.objectContaining({data:{organizationId:'org-A',skillId:'integration-audit',installedByUserId:'user-A',status:'enabled'},skipDuplicates:true}));
 expect(io.audit).toHaveBeenCalledWith(expect.objectContaining({action:'skill.install',detail:expect.objectContaining({authorityChanged:false})}), transaction);
 expect(result.headers.get('cache-control')).toContain('no-store');
});
it('disables the existing installation and refuses a missing installation',async()=>{
 expect((await POST(request({skillId:'integration-audit',action:'disable'}))).status).toBe(200);expect(io.disable).toHaveBeenCalledWith({where:{organizationId:'org-A',skillId:'integration-audit',status:'enabled'},data:{status:'disabled'}});
 io.disable.mockResolvedValue({count:0});expect((await POST(request({skillId:'integration-audit',action:'disable'}))).status).toBe(409);
});
it('does not report success or leak storage errors',async()=>{io.createMany.mockRejectedValue(Error('private-database-message'));const r=await POST(request());expect(r.status).toBe(503);expect(await r.text()).not.toContain('private-database')});

it('lets a skill disable proceed without confirmed auditing and refuses to report success',async()=>{
 io.audit.mockRejectedValueOnce(Error('private audit diagnostic'));
 const result=await POST(request({skillId:'integration-audit',action:'disable'}));expect(result.status).toBe(503);
 const body=await result.json();expect(body.error).toBe('skill_audit_unconfirmed');expect(body.data).toBeUndefined();
 expect(io.disable).toHaveBeenCalledOnce();expect(io.audit).toHaveBeenCalledOnce();
 expect(io.transaction).not.toHaveBeenCalled();
});

it('removes only the current workspace installation and reports not installed',async()=>{
 const result=await POST(request({skillId:'integration-audit',action:'remove',organizationId:'other'}));
 expect(result.status).toBe(200);expect(await result.json()).toEqual({ok:true,data:{skillId:'integration-audit',status:'not_installed'}});
 expect(io.remove).toHaveBeenCalledWith({where:{organizationId:'org-A',skillId:'integration-audit'}});
 io.remove.mockResolvedValue({count:0});expect((await POST(request({skillId:'integration-audit',action:'remove'}))).status).toBe(409);
});

it('refuses a stale enable without recreating the removed skill', async()=>{
 io.disable.mockResolvedValue({count:0});
 const result=await POST(request({skillId:'integration-audit',action:'enable'}));
 expect(result.status).toBe(409);
 expect(await result.json()).toEqual({ok:false,error:'skill_state_changed'});
 expect(io.disable).toHaveBeenCalledWith({where:{organizationId:'org-A',skillId:'integration-audit',status:'disabled'},data:{status:'enabled'}});
 expect(io.createMany).not.toHaveBeenCalled();
 expect(io.audit).not.toHaveBeenCalled();
});

it('does not overwrite an existing installation with Install', async()=>{
 io.createMany.mockResolvedValue({count:0});
 const result=await POST(request());
 expect(result.status).toBe(409);
 expect(await result.json()).toEqual({ok:false,error:'skill_state_changed'});
 expect(io.disable).not.toHaveBeenCalled();
 expect(io.audit).not.toHaveBeenCalled();
});
