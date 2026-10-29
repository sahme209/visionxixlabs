import {beforeEach,afterEach,it,expect,vi} from 'vitest';
import {NextRequest} from 'next/server';
const m=vi.hoisted(()=>({session:vi.fn(),row:vi.fn(),read:vi.fn()}));
vi.mock('@/lib/desktop/resolveRequestDesktopSession',()=>({resolveRequestDesktopSession:m.session}));
vi.mock('@/lib/db',()=>({prisma:{tenantIntegrationConnection:{findUnique:m.row}}}));
vi.mock('@/lib/releaseops/readJiraCreateMetadata',()=>({readJiraCreateMetadata:m.read}));
import {GET} from '../route';
const principal={id:'session',userId:'consenter',organizationId:'tenant',credentialKind:'desktop_session',role:'owner',capabilities:['connections:manage']};
const revision='2026-10-24T18:20:00.000Z';
const base='https://axiom.test/api/desktop/integrations/jira/create-metadata';
const query=new URLSearchParams({connectionId:'selected',revision,projectIdOrKey:'KAN',issueTypeId:'10009'});
const request=(q=query.toString())=>new NextRequest(`${base}?${q}`);
beforeEach(()=>{vi.resetAllMocks();m.session.mockResolvedValue({...principal});m.row.mockResolvedValue({id:'selected',organizationId:'tenant',provider:'jira',status:'active',revokedAt:null,consentedByUserId:'consenter',externalAccountId:'12345678-1234-4234-8234-123456789abc',scopesJson:['read:jira-work'],updatedAt:new Date(revision)});m.read.mockResolvedValue({ok:true,connectionId:'selected',connectionRevision:revision,projectIdOrKey:'KAN',issueTypeId:'10009',metadata:{authority:'discovery_only',fields:[]}});vi.stubEnv('JIRA_CLIENT_ID','synthetic-client');vi.stubEnv('JIRA_CLIENT_SECRET','SYNTHETIC_PRIVATE');});
afterEach(()=>vi.unstubAllEnvs());
it('uses paired admin capability and server tenant; returns no-store discovery only',async()=>{const r=await GET(request());expect(r.status).toBe(200);expect(r.headers.get('cache-control')).toBe('no-store');expect(await r.text()).not.toContain('SYNTHETIC_PRIVATE');expect(m.session).toHaveBeenCalledWith(expect.anything(),expect.objectContaining({requiredCapability:'connections:manage',requireWorkspaceAdmin:true,allowApiKey:false}));expect(m.row).toHaveBeenCalledWith(expect.objectContaining({where:{organizationId_provider:{organizationId:'tenant',provider:'jira'}}}));expect(m.read.mock.calls[0][0]).toMatchObject({organizationId:'tenant',authorization:{connectionId:'selected',revision,actor:{userId:'consenter',canManageConnections:true}}});});
it.each([undefined,{...principal,credentialKind:'api_key'},{...principal,role:'operator'},{...principal,capabilities:['workspace:read']}])('rejects insufficient paired authority before DB/reader',async p=>{m.session.mockResolvedValue(p);expect((await GET(request())).status).toBe(401);expect(m.row).not.toHaveBeenCalled();expect(m.read).not.toHaveBeenCalled();});
it.each(['extra=x', 'connectionId=other', 'revision=bad', 'projectIdOrKey=x', 'issueTypeId=NaN','organizationId=foreign','actor=owner'])('rejects unknown/duplicate query %s',async extra=>{expect((await GET(request(query+'&'+extra))).status).toBe(400);expect(m.row).not.toHaveBeenCalled();});
it.each(['☃'.repeat(800),'x'.repeat(2200)])('bounds URL UTF8 bytes',async value=>{expect((await GET(request('connectionId='+value))).status).toBe(400);expect(m.row).not.toHaveBeenCalled();});
it.each([{status:'pending'},{status:'revoked'},{organizationId:'foreign'},{consentedByUserId:'other'},{id:'other'},{scopesJson:['offline_access']},{externalAccountId:null},{updatedAt:new Date(0)}])('refuses nonselected/nonactive/nonconsenting storage %j',async change=>{m.row.mockResolvedValue({...await m.row(),...change});expect((await GET(request())).status).toBe(409);expect(m.read).not.toHaveBeenCalled();});
it('fresh actor reader rejects session/tenant/user/role changes',async()=>{m.read.mockImplementation(async input=>{expect(await input.authorization.readCurrentActor()).toBeNull();return {ok:false};});m.session.mockResolvedValueOnce(principal).mockResolvedValue({...principal,userId:'other'});expect((await GET(request())).status).toBe(409);});
it('preserves unknown refresh without retry or metadata success',async()=>{m.read.mockResolvedValue({ok:false,error:'jira_refresh_persistence_outcome_unknown',retryAllowed:false});const r=await GET(request());expect(r.status).toBe(409);expect(await r.json()).toEqual({ok:false,error:'jira_refresh_persistence_outcome_unknown',retryAllowed:false});expect(m.read).toHaveBeenCalledTimes(1);});
it('refuses oversized serialized discovery instead of truncating',async()=>{m.read.mockResolvedValue({ok:true,metadata:{authority:'discovery_only',fields:[{name:'☃'.repeat(100000)}]}});expect((await GET(request())).status).toBe(502);});
it('sanitizes backend errors',async()=>{m.row.mockRejectedValue(Error('PRIVATE_CREDENTIAL'));const r=await GET(request());expect(r.status).toBe(503);expect(await r.text()).not.toContain('PRIVATE_CREDENTIAL');});
it('re-resolves the exact paired actor for every service authority read',async()=>{
 m.session.mockResolvedValueOnce(principal).mockResolvedValueOnce(principal).mockResolvedValueOnce(principal).mockResolvedValue({...principal,organizationId:'foreign'});
 m.read.mockImplementation(async input=>{expect(await input.authorization.readCurrentActor()).toEqual({organizationId:'tenant',userId:'consenter',canManageConnections:true});expect(await input.authorization.readCurrentActor()).toBeNull();return {ok:false,error:'jira_create_metadata_unavailable'};});
 expect((await GET(request())).status).toBe(409);expect(m.session).toHaveBeenCalledTimes(4);
});
it('does not require offline scope or platform configuration for an unexpired read',async()=>{
 vi.stubEnv('JIRA_CLIENT_ID','');vi.stubEnv('JIRA_CLIENT_SECRET','');expect((await GET(request())).status).toBe(200);
 expect(m.read.mock.calls[0][0].authorization.refresh).toMatchObject({clientId:'',clientSecret:''});
});
it.each(['', 'bad\u0000id', 'x'.repeat(513)])('rejects invalid explicit connection IDs before storage',async value=>{
 const q=new URLSearchParams(query);q.set('connectionId',value);expect((await GET(request(q.toString()))).status).toBe(400);expect(m.row).not.toHaveBeenCalled();
});

it('preserves native field discovery with an already approved write grant',async()=>{m.row.mockResolvedValue({...await m.row(),scopesJson:['offline_access','read:jira-work','write:jira-work']});expect((await GET(request())).status).toBe(200);expect(m.read).toHaveBeenCalledTimes(1)});
it.each([{scopes:['write:jira-work']},{scopes:['read:jira-work','write:jira-work','write:jira-work']},{scopes:['read:jira-work','manage:jira-project']}])('refuses missing read authority, duplicates or unrelated grants %j',async ({scopes})=>{m.row.mockResolvedValue({...await m.row(),scopesJson:scopes});expect((await GET(request())).status).toBe(409);expect(m.read).not.toHaveBeenCalled()});
