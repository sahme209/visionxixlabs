import {beforeEach,expect,it,vi} from 'vitest';
import {NextRequest} from 'next/server';
const io=vi.hoisted(()=>({session:vi.fn(),row:vi.fn(),pull:vi.fn()}));
vi.mock('@/lib/db',()=>({prisma:{tauriDeploymentRequest:{findFirst:io.row}}}));
vi.mock('@/lib/desktop/resolveRequestDesktopSession',()=>({resolveRequestDesktopSession:io.session}));
vi.mock('@/lib/connectors/github/readReleasePullRequest',()=>({readReleasePullRequest:io.pull}));
import {GET} from '../route';
import {hasDesktopCapability,type DesktopCapability} from '@/lib/desktop/desktopAuthorization';
import {completeReleaseIntake} from '@/lib/tauri/__tests__/fixtures/completeReleaseIntake';
const intake={...completeReleaseIntake(),repositoryUrls:['https://github.com/team/service'],productionPrUrls:['https://github.com/team/service/pull/42']};
const row={id:intake.id,organizationId:intake.tenantId,version:3,status:'submitted',intakeJson:intake};
const observation={connectionId:'install',connectionRevision:'2026-10-24T00:00:00Z',repositoryFullName:'team/service',number:42,headRepositoryFullName:'team/service',headRef:intake.sourceBranch,headSha:'a'.repeat(40),baseRef:intake.targetBranch,baseSha:'b'.repeat(40),state:'open',draft:false,merged:false};
const session={organizationId:intake.tenantId,userId:'reader'};
const request=(query='expectedVersion=3&pullRequestNumber=42&method=squash')=>new NextRequest('https://axiom.invalid/api/desktop/deployments/'+row.id+'/merge-plan?'+query);
const call=(req=request())=>GET(req,{params:Promise.resolve({id:row.id})});
beforeEach(()=>{vi.clearAllMocks();io.session.mockResolvedValue(session);io.row.mockResolvedValue(row);io.pull.mockResolvedValue({ok:true,observation})});
it('returns a server-bound immutable review plan without merge or approval authority',async()=>{
 const response=await call();const body=await response.json();expect(response.status).toBe(200);expect(response.headers.get('cache-control')).toBe('no-store');
 expect(body.data.authority).toBe('evidence_only');expect(body.data.plan.pullRequest.headSha).toBe(observation.headSha);expect(body.data.plan.method).toBe('squash');expect(body.data.digest).toMatch(/^[a-f0-9]{64}$/);
 expect(io.session).toHaveBeenCalledWith(expect.anything(),expect.objectContaining({requiredScope:'pipeline:read',requiredCapability:'github:read',allowApiKey:false}));
 expect(io.pull).toHaveBeenCalledWith(expect.objectContaining({organizationId:intake.tenantId,repositoryFullName:'team/service',pullRequestNumber:42,signal:expect.any(AbortSignal)}));
 expect(io.row).toHaveBeenCalledWith(expect.objectContaining({where:{organizationId:intake.tenantId,id:row.id}}));
 expect(JSON.stringify(body)).not.toMatch(/approved|token/);
});
it('requires paired read capability before storage or GitHub',async()=>{io.session.mockResolvedValue(null);expect((await call()).status).toBe(401);expect(io.row).not.toHaveBeenCalled();expect(io.pull).not.toHaveBeenCalled()});
it.each(['expectedVersion=3&pullRequestNumber=42&method=auto','expectedVersion=3&expectedVersion=3&pullRequestNumber=42&method=squash','expectedVersion=3&pullRequestNumber=42&method=squash&approved=true','expectedVersion=-1&pullRequestNumber=42&method=squash'])('refuses invalid/duplicate/grant query %s',async query=>{expect((await call(request(query))).status).toBe(400);expect(io.row).not.toHaveBeenCalled();expect(io.pull).not.toHaveBeenCalled()});
it.each([null,{...row,organizationId:'other'},{...row,status:'draft'},{...row,version:4},{...row,intakeJson:{...intake,noPrRequired:true}}])('refuses missing, wrong-tenant, stale or incomplete release before provider access',async changed=>{io.row.mockResolvedValue(changed);expect((await call()).status).toBe(409);expect(io.pull).not.toHaveBeenCalled()});
it('does not read a PR absent from the stored release',async()=>{expect((await call(request('expectedVersion=3&pullRequestNumber=43&method=squash'))).status).toBe(409);expect(io.pull).not.toHaveBeenCalled()});
it('refuses a changed stored release or revoked paired actor after evidence reads',async()=>{
 io.row.mockResolvedValueOnce(row).mockResolvedValueOnce({...row,version:4});expect((await call()).status).toBe(409);
 io.row.mockResolvedValue(row);io.session.mockResolvedValueOnce(session).mockResolvedValueOnce(null);expect((await call()).status).toBe(401);
});
it('sanitizes provider and database diagnostics',async()=>{
 io.pull.mockRejectedValueOnce(new Error('private-secret'));const response=await call();expect(response.status).toBe(502);expect(JSON.stringify(await response.json())).not.toContain('private-secret');
});

it('does not expose private GitHub evidence to a finance-only workspace reader',async()=>{io.session.mockImplementation(async(_request,policy)=>hasDesktopCapability('finance_viewer',policy.requiredCapability as DesktopCapability)?session:null);expect((await call()).status).toBe(401);expect(io.row).not.toHaveBeenCalled();expect(io.pull).not.toHaveBeenCalled()});
it('rechecks GitHub-specific access after a role changes during the provider read',async()=>{let role:'operator'|'finance_viewer'='operator';io.session.mockImplementation(async(_request,policy)=>hasDesktopCapability(role,policy.requiredCapability as DesktopCapability)?session:null);io.pull.mockImplementation(async()=>{role='finance_viewer';return{ok:true,observation}});const response=await call();expect(response.status).toBe(401);expect(JSON.stringify(await response.json())).not.toContain(observation.headSha)});
