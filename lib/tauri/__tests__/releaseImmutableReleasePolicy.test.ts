import {it,expect,vi} from 'vitest';
import {createImmutableReleasePolicyReader,IMMUTABLE_RELEASE_POLICY} from '../releaseImmutableReleasePolicy';
const now=Date.parse('2026-10-28T22:00:00Z');
function fixture(){
 const plan:any={purpose:'release_deployment',organizationId:'org',releaseId:'release',releaseVersion:1,intakeDigest:'a'.repeat(64),planId:'release_plan_'+'b'.repeat(64),creatorUserId:'creator',requesterUserId:'requester',executorUserId:'executor',repositoryFullName:'owner/fixture',connectionId:'connection',connectionRevision:'2026-10-28T21:00:00.000Z',installationId:'123',workflowPath:'.github/workflows/deploy.yml',workflowBlobSha:'b'.repeat(40),sourceCommitSha:'a'.repeat(40),refKind:'tag',ref:'axiom-release-fixture',inputs:{},sourcePolicy:IMMUTABLE_RELEASE_POLICY,windowStart:'2026-10-28T21:59:00.000Z',expiresAt:'2026-10-28T22:05:00.000Z'};
 const tag:any={ref:'refs/tags/'+plan.ref,object:{type:'commit',sha:plan.sourceCommitSha}},release:any={id:123,tag_name:plan.ref,draft:false,immutable:true,published_at:'2026-10-28T21:59:00.000Z'};
 let releaseReads=0,changed=false,denied=false;
 const fetcher=vi.fn(async(url:string,init:RequestInit)=>{expect(init.method).toBe('GET');expect(init.redirect).toBe('error');if(denied)return Response.json({}, {status:403});if(url.endsWith('/fixture'))return Response.json({full_name:plan.repositoryFullName,archived:false,disabled:false});if(url.includes('/git/ref/tags/'))return Response.json(tag);if(url.includes('/releases/tags/')){releaseReads++;return Response.json(changed&&releaseReads>1?{...release,id:456}:release)}throw Error('unexpected provider endpoint')});
 const credential:any={organizationId:'org',connectionId:'connection',connectionRevision:plan.connectionRevision,repositoryFullName:plan.repositoryFullName,installationId:'123',token:'readonly-test',expiresAt:now+600000,permissions:{administration:'read',contents:'read',metadata:'read'}};
 const deps={isEnabled:()=>true,now:()=>now,assertCurrent:vi.fn(async()=>{}),readCredential:vi.fn(async()=>credential),fetch:fetcher as unknown as typeof fetch,onRefusal:vi.fn()};
 return{plan,tag,release,credential,deps,fetcher,change:()=>{changed=true},deny:()=>{denied=true},run:()=>createImmutableReleasePolicyReader(deps)(plan,new AbortController().signal)};
}
it('uses a separately named immutable release proof and exact tag without reading hidden bypass actors',async()=>{const f=fixture(),result=await f.run();expect(result?.proof.sourcePolicy).toBe(IMMUTABLE_RELEASE_POLICY);expect(result?.evidence).toMatchObject({releaseId:123,immutable:true,sourceCommitSha:f.plan.sourceCommitSha});expect(f.fetcher).toHaveBeenCalledTimes(5)});
it.each(['mutable','missing','draft','wrongTag','wrongSha','annotated','oldPolicy','wrongCredential','adminWrite','expired','denied','changed'])('refuses unproven immutable source: %s',async kind=>{const f=fixture();if(kind==='mutable')f.release.immutable=false;if(kind==='missing')delete f.release.immutable;if(kind==='draft')f.release.draft=true;if(kind==='wrongTag')f.release.tag_name='other';if(kind==='wrongSha')f.tag.object.sha='c'.repeat(40);if(kind==='annotated')f.tag.object.type='tag';if(kind==='oldPolicy')f.plan.sourcePolicy='github_protected_tag_v1';if(kind==='wrongCredential')f.credential.organizationId='other';if(kind==='adminWrite')f.credential.permissions.administration='write';if(kind==='expired')f.credential.expiresAt=now;if(kind==='denied')f.deny();if(kind==='changed')f.change();expect(await f.run()).toBeNull();if(kind==='mutable')expect(f.deps.onRefusal).toHaveBeenCalledWith('release_immutable_required')});
it('refuses authority loss before a provider request',async()=>{const f=fixture();f.deps.assertCurrent.mockRejectedValue(Error('revoked'));expect(await f.run()).toBeNull();expect(f.fetcher).not.toHaveBeenCalled()});
it('separates fresh read-only immutable-source observation from expired execution admission',async()=>{
 const f=fixture();f.plan.expiresAt=new Date(now-1).toISOString();
 expect(await f.run()).toBeNull();expect(f.fetcher).not.toHaveBeenCalled();
 const result=await createImmutableReleasePolicyReader({...f.deps,readPurpose:'observation'})(f.plan,new AbortController().signal);
 expect(result?.proof).toMatchObject({sourcePolicy:IMMUTABLE_RELEASE_POLICY});expect(Date.parse(result!.evidence.expiresAt)).toBeGreaterThan(now);
 for(const [,init] of f.fetcher.mock.calls)expect(init.method).toBe('GET');
 f.credential.permissions.administration='write';expect(await createImmutableReleasePolicyReader({...f.deps,readPurpose:'observation'})(f.plan,new AbortController().signal)).toBeNull();
});
it('issues the observation-only read lease after verification while preserving dispatch and network deadlines',async()=>{
 const f=fixture();let clock=now;const assertCurrent=vi.fn(async()=>{clock+=400});const deps={...f.deps,now:()=>clock,assertCurrent};
 const observed=await createImmutableReleasePolicyReader({...deps,readPurpose:'observation'})(f.plan,new AbortController().signal);expect(observed).not.toBeNull();const verified=Date.parse(observed!.evidence.observedAt);expect(verified).toBeGreaterThan(now);expect(Date.parse(observed!.evidence.expiresAt)).toBe(verified+12000);
 clock=now;const dispatched=await createImmutableReleasePolicyReader(deps)(f.plan,new AbortController().signal);expect(dispatched).not.toBeNull();expect(Date.parse(dispatched!.evidence.expiresAt)).toBe(now+12000);
 clock=now;const late={...deps,assertCurrent:async()=>{clock+=13000}};expect(await createImmutableReleasePolicyReader({...late,readPurpose:'observation'})(f.plan,new AbortController().signal)).toBeNull();
});
