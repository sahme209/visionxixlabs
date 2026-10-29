import {beforeEach,describe,it,expect,vi} from 'vitest';
import {createProtectedTagPolicyReader,PROTECTED_TAG_POLICY} from '../releaseProtectedTagPolicy';
import {sha256ContentHash} from '../contentHash';
const instant=Date.parse('2026-10-28T22:00:00Z'),sha='a'.repeat(40);
const plan={purpose:'release_deployment',organizationId:'org',releaseId:'release',releaseVersion:1,intakeDigest:'a'.repeat(64),planId:'release_plan_'+'b'.repeat(64),creatorUserId:'creator',requesterUserId:'requester',executorUserId:'executor',repositoryFullName:'owner/fixture',connectionId:'connection',connectionRevision:'2026-10-28T21:00:00.000Z',installationId:'123',workflowPath:'.github/workflows/deploy.yml',workflowBlobSha:'b'.repeat(40),sourceCommitSha:sha,refKind:'tag',ref:'axiom-release-fixture',inputs:{},sourcePolicy:PROTECTED_TAG_POLICY,windowStart:'2026-10-28T21:59:00.000Z',expiresAt:'2026-10-28T22:05:00.000Z'} as const;
const token=()=>({organizationId:'org',connectionId:'connection',connectionRevision:plan.connectionRevision,repositoryFullName:'owner/fixture',installationId:'123',token:'fixture-only-token',expiresAt:instant+600000,permissions:{contents:'read',administration:'read',metadata:'read'}});
const rule=(id:number,target:'tag'|'branch',types:string[])=>({id,name:'fixture protection',target,source_type:'Repository',source:'owner/fixture',enforcement:'active',bypass_actors:[],conditions:{ref_name:{include:[`refs/${target==='tag'?'tags':'heads'}/${plan.ref}`],exclude:[]}},rules:types.map(type=>({type}))});
let rules:any[], credential:any, branch:any, tag:any, alteredFinal:boolean, reads:number, mode:string;
function deps(){
 const fetcher=vi.fn(async(url:string,init:RequestInit)=>{
  expect(init.method).toBe('GET');expect(init.redirect).toBe('error');expect(init.credentials).toBe('omit');
  if(mode==='403')return Response.json({message:'not available'},{status:403});
  if(mode==='pagination')return Response.json([],{headers:{link:'next'}});
  if(url.endsWith('/fixture'))return Response.json({full_name:'owner/fixture',archived:false,disabled:false});
  if(url.includes('/git/ref/tags/')){reads++;return Response.json(alteredFinal&&reads>1?{...tag,object:{type:'commit',sha:'c'.repeat(40)}}:tag)}
  if(url.includes('/git/ref/heads/'))return branch?Response.json(branch):Response.json({}, {status:404});
  if(url.includes('/rulesets?'))return Response.json(rules.map(r=>({id:r.id})));
  return Response.json(rules.find(r=>url.endsWith('/'+r.id)));
 });
 return {isEnabled:()=>true,now:()=>instant,assertCurrent:vi.fn(async()=>{}),readCredential:vi.fn(async()=>credential),fetch:fetcher as unknown as typeof fetch};
}
beforeEach(()=>{credential=token();rules=[rule(1,'tag',['update','deletion']),rule(2,'branch',['creation'])];branch=null;tag={ref:'refs/tags/'+plan.ref,object:{type:'commit',sha}};alteredFinal=false;reads=0;mode='';});
const run=(d=deps(),p:any=plan)=>createProtectedTagPolicyReader(d)(p,new AbortController().signal);
describe('provider-enforced protected release tag policy',()=>{
 it('verifies exact protected tag and rejects same-name branch creation without granting writes',async()=>{
  const result=await run();expect(result?.proof).toEqual({kind:'verified_release_deployment_source_policy_v1',planDigest:sha256ContentHash(plan),sourcePolicy:PROTECTED_TAG_POLICY});expect(result?.evidence.rulesetIds).toEqual([1,2]);
 });
 it('has no active default or ambient fetch',async()=>expect(await createProtectedTagPolicyReader()(plan,new AbortController().signal)).toBeNull());
 it.each(['organizationId','connectionId','connectionRevision','repositoryFullName','installationId'])('rejects credential binding %s',async key=>{credential[key]='different';expect(await run()).toBeNull()});
 it('refuses dispatch/admin-write tokens',async()=>{credential.permissions.administration='write';const d=deps();expect(await run(d)).toBeNull();expect(d.fetch).not.toHaveBeenCalled()});
 it('refuses expired credentials',async()=>{credential.expiresAt=instant+100;expect(await run()).toBeNull()});
 it('refuses mutable branch dispatch',async()=>expect(await run(deps(),{...plan,refKind:'branch'})).toBeNull());
 it('does not reuse a different source policy',async()=>expect(await run(deps(),{...plan,sourcePolicy:'observed-sha'})).toBeNull());
 it('refuses a tag on another commit',async()=>{tag.object.sha='c'.repeat(40);expect(await run()).toBeNull()});
 it('does not silently dereference annotated tags',async()=>{tag.object.type='tag';expect(await run()).toBeNull()});
 it('refuses a same-name branch',async()=>{branch={ref:'refs/heads/'+plan.ref};expect(await run()).toBeNull()});
 it('refuses missing same-name branch creation restriction',async()=>{rules.pop();expect(await run()).toBeNull()});
 it('refuses missing tag deletion restriction',async()=>{rules[0].rules=[{type:'update'}];expect(await run()).toBeNull()});
 it('refuses any bypass actor',async()=>{rules[0].bypass_actors=[{actor_id:123,actor_type:'Integration',bypass_mode:'always'}];expect(await run()).toBeNull()});
 it('refuses unreadable bypass details',async()=>{delete rules[0].bypass_actors;expect(await run()).toBeNull()});
 it('refuses evaluate-only policy',async()=>{rules[0].enforcement='evaluate';expect(await run()).toBeNull()});
 it('refuses wildcard or excluded coverage',async()=>{rules[0].conditions.ref_name.include=['refs/tags/axiom-release-*'];expect(await run()).toBeNull()});
 it('refuses unknown rules instead of claiming coverage',async()=>{rules[0].rules.push({type:'unknown_rule'});expect(await run()).toBeNull()});
 it('refuses inherited policy without a supported reader',async()=>{rules[0].source_type='Organization';expect(await run()).toBeNull()});
 it.each(['403','pagination'])('refuses incomplete provider response %s',async value=>{mode=value;expect(await run()).toBeNull()});
 it('refuses a tag moved during verification',async()=>{alteredFinal=true;expect(await run()).toBeNull()});
 it('stops after authority revocation before subsequent provider reads',async()=>{const d=deps();let n=0;d.assertCurrent=vi.fn(async()=>{if(++n>2)throw Error('revoked')});expect(await run(d)).toBeNull();expect(d.fetch).toHaveBeenCalledTimes(1)});
 it('refuses pre-aborted observation',async()=>{const d=deps(),c=new AbortController();c.abort();expect(await createProtectedTagPolicyReader(d)(plan,c.signal)).toBeNull();expect(d.fetch).not.toHaveBeenCalled()});
});
