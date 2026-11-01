import {beforeEach, expect, it, vi} from 'vitest';
import {NextRequest} from 'next/server';
const m=vi.hoisted(()=>({session:vi.fn(),find:vi.fn(),installation:vi.fn(),snapshot:vi.fn(),token:vi.fn(),write:vi.fn(),audit:vi.fn()}));
vi.mock('@/lib/db',()=>({prisma:{$queryRaw:m.snapshot,durableAgentWorkflow:{findMany:m.find},gitHubInstallation:{findFirst:m.installation}}}));
vi.mock('@/lib/desktop/resolveRequestDesktopSession',()=>({resolveRequestDesktopSession:m.session}));
vi.mock('@/lib/connectors/github/resolveTenantScopedToken',()=>({resolveTenantScopedToken:m.token,parseRepositoryFullName:()=>({owner:'test',repo:'repo'})}));
vi.mock('@/lib/audit/secureAudit',()=>({record:m.audit}));
vi.mock('@/lib/connectors/github/githubWriteClient',()=>({createBranch:m.write,commitFile:m.write,createPullRequest:m.write,getRepositoryDefaultBranch:async()=>({ok:true,data:'main'})}));
import {POST as branch} from '../branch/route';
import {POST as commit} from '../commit/route';
import {POST as pullRequest} from '../pull-request/route';
const routes=[branch,commit,pullRequest];
const installation={id:'installation',githubInstallationId:'123',updatedAt:new Date('2026-11-01T00:00:00Z'),revokedAt:null,suspendedAt:null};
const active=[{organizationId:'org',id:'governance_active_org',workflowKind:'governance_baseline_active_v1'}];
const request=(signal?:AbortSignal)=>new NextRequest('https://example.test/api/desktop/github/test',{method:'POST',signal,body:JSON.stringify({repositoryFullName:'test/repo',baseBranch:'main',newBranchName:'test',branch:'test',path:'test.txt',content:'test',message:'test',title:'test',head:'test',base:'main'})});
beforeEach(()=>{vi.resetAllMocks();m.snapshot.mockResolvedValue([{sessionId:'session',userId:'user',organizationId:'org',sessionLive:true,role:'admin',acceptedAt:new Date(),connectionId:'installation',githubInstallationId:'123',connectionRevision:new Date('2026-11-01T00:00:00Z'),connectionRevokedAt:null,connectionSuspendedAt:null,connectionStatus:'active',enrolled:false}]);m.installation.mockResolvedValue(installation);m.session.mockResolvedValue({id:'session',organizationId:'org',userId:'user',credentialKind:'desktop_session',capabilities:['workspace:read','github:write']});m.find.mockResolvedValue([]);m.token.mockResolvedValue({ok:true,token:'test-only'});m.write.mockImplementation(async input=>{try{await input.beforeWrite();return {ok:true,data:{}}}catch{return {ok:false,error:'github_write_authority_unavailable'}}});});
it.each(routes)('refuses enrolled legacy execution before resolving credentials',async route=>{m.find.mockResolvedValue(active);const response=await route(request());expect(response.status).toBe(409);expect(m.token).not.toHaveBeenCalled();expect(m.write).not.toHaveBeenCalled()});
it.each(routes)('refuses unavailable enrollment instead of treating it as disabled',async route=>{m.find.mockRejectedValue(Error('private DB detail'));const response=await route(request());expect(response.status).toBe(409);expect(await response.text()).not.toContain('private');expect(m.write).not.toHaveBeenCalled()});
it.each(routes)('retains legacy path only after positive absence and checks again at transport',async route=>{const response=await route(request());expect(response.status).toBe(200);expect(m.find).toHaveBeenCalled();expect(m.write).toHaveBeenCalledOnce();expect(m.find.mock.calls[0][0].where.organizationId).toBe('org')});
it.each(routes)('rejects enrollment introduced after preflight at the final write boundary',async route=>{m.write.mockImplementationOnce(async input=>{m.find.mockResolvedValue(active);try{await input.beforeWrite();return{ok:true,data:{}}}catch{return{ok:false,error:'github_write_authority_unavailable'}}});const response=await route(request());expect(response.status).toBe(502);expect(await response.json()).toMatchObject({error:'github_write_authority_unavailable'});expect(m.audit).not.toHaveBeenCalled()});
it.each(routes)('never reads enrollment for an unauthenticated request',async route=>{m.session.mockResolvedValue(null);expect((await route(request())).status).toBe(401);expect(m.find).not.toHaveBeenCalled();expect(m.token).not.toHaveBeenCalled()});

it.each(routes)('rechecks paired authority after token resolution before transport writes',async route=>{m.token.mockImplementation(async()=>{m.session.mockResolvedValue(null);return{ok:true,token:'test-only'}});expect((await route(request())).status).toBe(409);expect(m.audit).not.toHaveBeenCalled()});
it.each(routes)('refuses a different principal even if the new account has write capability',async route=>{m.token.mockImplementation(async()=>{m.session.mockResolvedValue({id:'session',organizationId:'org',userId:'other',credentialKind:'desktop_session',capabilities:['github:write']});return{ok:true,token:'test-only'}});expect((await route(request())).status).toBe(409);expect(m.audit).not.toHaveBeenCalled()});
it.each(routes)('rechecks authority after awaiting enrollment metadata rather than using a stale role',async route=>{m.find.mockImplementation(async()=>{m.session.mockResolvedValue(null);return[]});expect((await route(request())).status).toBe(409);expect(m.token).not.toHaveBeenCalled();expect(m.write).not.toHaveBeenCalled()});
it.each(routes)('requires the same live session, organization, paired kind and current write capability',async route=>{for(const patch of[{id:'other-session'},{organizationId:'other-org'},{credentialKind:'api_key'},{capabilities:['workspace:read']}]){m.session.mockResolvedValue({id:'session',organizationId:'org',userId:'user',credentialKind:'desktop_session',capabilities:['github:write']});m.token.mockImplementation(async()=>{m.session.mockResolvedValue({id:'session',organizationId:'org',userId:'user',credentialKind:'desktop_session',capabilities:['github:write'],...patch});return{ok:true,token:'test-only'}});expect((await route(request())).status).toBe(409)}expect(m.audit).not.toHaveBeenCalled()});
it.each(routes)('uses current paired membership checks without writing a heartbeat on revalidation',async route=>{expect((await route(request())).status).toBe(200);expect(m.session).toHaveBeenCalled();for(const call of m.session.mock.calls.slice(1))expect(call[1]).toMatchObject({requiredCapability:'github:write',allowApiKey:false,requireWorkspaceMembership:true,recordHeartbeat:false})});

it.each(routes)('binds token issuance to the captured current installation revision',async route=>{
 expect((await route(request())).status).toBe(200);
 expect(m.token).toHaveBeenCalledWith('org',{owner:'test',repo:'repo'},expect.objectContaining({id:'installation',githubInstallationId:'123',updatedAt:installation.updatedAt,signal:expect.any(AbortSignal)}),expect.objectContaining({gitHubInstallation:expect.any(Object)}));
});
it.each(routes)('refuses a connection revoked during token minting before transport entry',async route=>{
 m.token.mockImplementationOnce(async()=>{m.installation.mockResolvedValue({...installation,revokedAt:new Date()});return{ok:true,token:'test-only'}});
 expect((await route(request())).status).toBe(409);expect(m.write).not.toHaveBeenCalled();expect(m.audit).not.toHaveBeenCalled();
});
it.each(routes)('rechecks captured installation immediately before a transport write',async route=>{
 m.write.mockImplementationOnce(async input=>{m.installation.mockResolvedValue({...installation,id:'replacement'});try{await input.beforeWrite();return{ok:true,data:{}}}catch{return{ok:false,error:'github_write_authority_unavailable'}}});
 expect((await route(request())).status).toBe(502);expect(m.audit).not.toHaveBeenCalled();
});

it.each(routes)('does not mint credentials if enrollment appears during the installation lookup',async route=>{
 m.installation.mockImplementationOnce(async()=>{m.find.mockResolvedValue(active);return installation});
 expect((await route(request())).status).toBe(409);expect(m.token).not.toHaveBeenCalled();expect(m.write).not.toHaveBeenCalled();
});

it.each(routes)('refuses missing, changed, revoked or suspended installation at final transport',async route=>{
 for(const changed of [null,{...installation,githubInstallationId:'456'},{...installation,updatedAt:new Date('2026-11-01T00:00:01Z')},{...installation,revokedAt:new Date()},{...installation,suspendedAt:new Date()}]){
  m.installation.mockResolvedValue(installation);
  m.write.mockImplementationOnce(async input=>{m.installation.mockResolvedValue(changed);try{await input.beforeWrite();return{ok:true,data:{}}}catch{return{ok:false,error:'github_write_authority_unavailable'}}});
  expect((await route(request())).status).toBe(502);
 }
 expect(m.audit).not.toHaveBeenCalled();
});
it.each(routes)('refuses caller cancellation during token resolution before any transport entry',async route=>{
 const controller=new AbortController();m.token.mockImplementationOnce(async()=>{controller.abort();return{ok:true,token:'test-only'}});
 expect((await route(request(controller.signal))).status).toBe(409);expect(m.write).not.toHaveBeenCalled();expect(m.audit).not.toHaveBeenCalled();
});

it.each(routes)('refuses installation revocation during final enrollment await using one current database snapshot',async route=>{
 m.write.mockImplementationOnce(async input=>{
  let revoked=false;m.find.mockImplementationOnce(async()=>{revoked=true;return[]});
  const original=(await m.snapshot())[0];m.snapshot.mockImplementationOnce(async()=>[{...original,connectionRevokedAt:revoked?new Date():null}]);
  try{await input.beforeWrite();return{ok:true,data:{}}}catch{return{ok:false,error:'github_write_authority_unavailable'}}
 });
 expect((await route(request())).status).toBe(502);expect(m.audit).not.toHaveBeenCalled();
});
