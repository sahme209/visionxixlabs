import {afterEach,beforeEach,expect,it,vi} from 'vitest';
const io=vi.hoisted(()=>({installation:vi.fn(),token:vi.fn()}));
vi.mock('@/lib/db',()=>({prisma:{gitHubInstallation:{findFirst:io.installation}}}));
vi.mock('../resolveTenantScopedToken',()=>({resolveTenantScopedToken:io.token,parseRepositoryFullName:(s:string)=>/^[A-Za-z0-9][A-Za-z0-9_.-]{0,99}\/[A-Za-z0-9][A-Za-z0-9_.-]{0,99}$/.test(s)?{owner:s.split('/')[0],repo:s.split('/')[1]}:null}));
import {readBotPullRequestEvidence} from '../readBotPullRequestEvidence';
const revision=new Date('2026-10-24T00:00:00Z');
const installation={id:'install-1',githubInstallationId:'19',updatedAt:revision,revokedAt:null,suspendedAt:null};
const payload={number:42,state:'open',draft:false,merged:false,html_url:'https://github.com/team/service/pull/42',head:{ref:'release/demo',sha:'a'.repeat(40),repo:{full_name:'team/service'}},base:{ref:'main',sha:'b'.repeat(40),repo:{full_name:'team/service'}}};
const binding={releaseId:'release-1',releaseVersion:1,releaseDigest:'c'.repeat(64),repositoryFullName:'team/service',pullRequestNumber:42,connectionId:'install-1',connectionRevision:revision.toISOString()};
const input=()=>({organizationId:'org-1',binding,signal:new AbortController().signal});
let fetcher:ReturnType<typeof vi.fn>;
beforeEach(()=>{vi.clearAllMocks();io.installation.mockResolvedValue(installation);io.token.mockResolvedValue({ok:true,token:'private-fixture-token'});fetcher=vi.fn(async()=>new Response(JSON.stringify(payload)));vi.stubGlobal('fetch',fetcher)});
afterEach(()=>vi.unstubAllGlobals());
it('performs one bounded tenant-pinned GET with pull-request read-only authority and a final connection fence',async()=>{
 const result=await readBotPullRequestEvidence(input());expect(result.ok).toBe(true);if(!result.ok)return;
 expect(result).toMatchObject({connectionId:installation.id,connectionRevision:revision.toISOString()});expect(result.observation).toMatchObject({repositoryFullName:'team/service',number:42,headSha:payload.head.sha,baseSha:payload.base.sha});
 expect(io.token).toHaveBeenCalledWith('org-1',{owner:'team',repo:'service'},expect.objectContaining({id:'install-1',permissionProfile:'pull_requests_read',signal:expect.any(AbortSignal)}));
 expect(fetcher).toHaveBeenCalledTimes(1);expect(fetcher).toHaveBeenCalledWith('https://api.github.com/repos/team/service/pulls/42',expect.objectContaining({method:'GET',redirect:'error',cache:'no-store',credentials:'omit'}));
 expect(io.installation).toHaveBeenCalledTimes(2);expect(result).not.toHaveProperty('token');
});
it.each([{repositoryFullName:'../service'},{repositoryFullName:'team/service/extra'},{pullRequestNumber:0},{pullRequestNumber:1.2}])('refuses invalid identities before any token/provider access %j',async patch=>{expect((await readBotPullRequestEvidence({...input(),binding:{...binding,...patch}})).ok).toBe(false);expect(io.token).not.toHaveBeenCalled();expect(fetcher).not.toHaveBeenCalled()});
it('does not fetch without the tenant installation or narrowed token',async()=>{
 io.installation.mockResolvedValue(null);expect((await readBotPullRequestEvidence(input())).ok).toBe(false);expect(io.token).not.toHaveBeenCalled();
 io.installation.mockResolvedValue(installation);io.token.mockResolvedValue({ok:false});expect((await readBotPullRequestEvidence(input())).ok).toBe(false);expect(fetcher).not.toHaveBeenCalled();
});
it.each([{number:43},{html_url:'https://other.test/42'},{merged:true},{head:{...payload.head,sha:'bad'}},{base:{...payload.base,repo:{full_name:'other/service'}}}])('refuses mismatched/ineligible provider evidence %j',async patch=>{fetcher.mockResolvedValue(new Response(JSON.stringify({...payload,...patch})));expect((await readBotPullRequestEvidence(input())).ok).toBe(false)});
it.each([null,{...installation,id:'replacement'},{...installation,updatedAt:new Date('2026-10-24T00:00:01Z')},{...installation,revokedAt:revision}])('refuses revoked/replaced connection after the read',async changed=>{io.installation.mockResolvedValueOnce(installation).mockResolvedValueOnce(changed);expect((await readBotPullRequestEvidence(input())).ok).toBe(false)});
it('bounds provider bodies and sanitizes diagnostic errors',async()=>{
 fetcher.mockResolvedValueOnce(new Response('x'.repeat(262145)));expect(await readBotPullRequestEvidence(input())).toEqual({ok:false,error:'bot_pull_request_read_unavailable'});
 fetcher.mockRejectedValueOnce(new Error('private-fixture-token'));expect(await readBotPullRequestEvidence(input())).toEqual({ok:false,error:'bot_pull_request_read_unavailable'});
});
it('stops an aborted response body and never returns a late observation',async()=>{
 const controller=new AbortController();fetcher.mockImplementationOnce(async()=>new Response(new ReadableStream({start(){controller.abort()}})));
 expect((await readBotPullRequestEvidence({...input(),signal:controller.signal})).ok).toBe(false);
});

it.each([{draft:true},{state:'closed'},{state:'closed',merged:true},{head:{...payload.head,repo:{full_name:'fork/service'}}}])('records non-merge-ready states as evidence only %j',async patch=>{fetcher.mockResolvedValue(new Response(JSON.stringify({...payload,...patch})));expect((await readBotPullRequestEvidence(input())).ok).toBe(true)});
it.each([{connectionId:'replacement'},{connectionRevision:'2026-10-24T00:00:01.000Z'}])('refuses stale server connection binding before provider access',async patch=>{expect((await readBotPullRequestEvidence({...input(),binding:{...binding,...patch}})).ok).toBe(false);expect(fetcher).not.toHaveBeenCalled()});
