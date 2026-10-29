import {afterEach,expect,it,vi} from 'vitest';
import {DesktopClient} from '../../../desktop/src/lib/desktopClient';
const targets={requestId:'release',requestVersion:3,repositoryFullName:'team/service',targets:[{number:42,url:'https://github.com/team/service/pull/42'}]};
const plan={authority:'evidence_only',digest:'c'.repeat(64),plan:{kind:'merge_pull_request',organizationId:'org',requestId:'release',requestVersion:3,intakeDigest:'d'.repeat(64),connectionId:'install',connectionRevision:'2026-10-24T00:00:00Z',window:{startUtc:'2026-10-24T00:00:00Z',endUtc:'2026-10-24T01:00:00Z'},method:'squash',pullRequest:{repositoryFullName:'team/service',number:42,url:'https://github.com/team/service/pull/42',headRef:'release',headSha:'a'.repeat(40),baseRef:'main',baseSha:'b'.repeat(40)}}};
const client=()=>new DesktopClient({apiBase:'https://axiom.invalid',sessionToken:'axm.desk.fixture.signature'});
const respond=(data:unknown,status=200)=>{const fetcher=vi.fn().mockResolvedValue(new Response(JSON.stringify({ok:true,data}),{status}));vi.stubGlobal('fetch',fetcher);return fetcher};
afterEach(()=>{vi.unstubAllGlobals();vi.useRealTimers()});
it('reads only paired, request-version-bound target metadata',async()=>{
 const fetcher=respond(targets);expect(await client().releaseMergeTargets('release',3)).toEqual({ok:true,data:targets});
 expect(fetcher).toHaveBeenCalledWith('https://axiom.invalid/api/desktop/deployments/release/merge-targets?expectedVersion=3',expect.objectContaining({method:'GET',credentials:'omit'}));
});
it('reads an explicitly selected method and PR, with no write payload',async()=>{
 const fetcher=respond(plan);expect(await client().releaseMergePlan('release',3,42,'squash','team/service')).toEqual({ok:true,data:plan});
 expect(fetcher).toHaveBeenCalledWith('https://axiom.invalid/api/desktop/deployments/release/merge-plan?expectedVersion=3&pullRequestNumber=42&method=squash',expect.objectContaining({method:'GET'}));
 expect(fetcher.mock.calls[0][1]).not.toHaveProperty('body');
});
it.each([{...targets,requestVersion:4},{...targets,requestId:'other'},{...targets,targets:[...targets.targets,...targets.targets]},{...targets,targets:[{number:42,url:'https://other.test/42'}]}])('refuses wrong-context or malformed metadata %j',async value=>{respond(value);expect((await client().releaseMergeTargets('release',3)).ok).toBe(false)});
it.each([{...plan,authority:'approved'},{...plan,plan:{...plan.plan,requestVersion:4}},{...plan,plan:{...plan.plan,method:'merge'}},{...plan,plan:{...plan.plan,pullRequest:{...plan.plan.pullRequest,number:43}}},{...plan,plan:{...plan.plan,pullRequest:{...plan.plan.pullRequest,repositoryFullName:'other/service'}}}])('refuses any plan outside exact selected context %j',async value=>{respond(value);expect((await client().releaseMergePlan('release',3,42,'squash','team/service')).ok).toBe(false)});
it('refuses non-paired credentials and HTTP error bodies',async()=>{
 const fetcher=respond(targets);expect((await new DesktopClient({sessionToken:'vxlk_fixture'}).releaseMergeTargets('release',3)).ok).toBe(false);expect(fetcher).not.toHaveBeenCalled();
 respond(plan,503);expect((await client().releaseMergePlan('release',3,42,'squash','team/service')).ok).toBe(false);
});
