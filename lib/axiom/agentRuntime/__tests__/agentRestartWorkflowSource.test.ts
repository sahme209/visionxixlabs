import {beforeEach,afterEach,it,expect,vi} from 'vitest';
import {createHash} from 'node:crypto';
import {AWS_ECS_DEPLOY_WORKFLOW_FILENAME,AWS_ECS_DEPLOY_WORKFLOW_TEMPLATE} from '@/lib/releaseops/awsEcsDeployWorkflowTemplate';
import {observeAgentRestartWorkflowSource} from '../agentRestartWorkflowSource';
const input=()=>({repositoryFullName:'fixture/repository',sourceKind:'tag' as const,sourceRef:'v1.2.3',installationToken:'PRIVATE_FIXTURE_TOKEN',signal:new AbortController().signal});
const commit='a'.repeat(40),tagObject='b'.repeat(40),published='2026-10-01T00:00:00.000Z';
let calls:Array<{url:string;init:RequestInit}>,mode:string;
beforeEach(()=>{calls=[];mode='ok';vi.stubGlobal('fetch',vi.fn(async(url:string,init:RequestInit)=>{
 calls.push({url,init});expect(init.method).toBe('GET');expect(init.redirect).toBe('error');expect(init.credentials).toBe('omit');expect(url.startsWith('https://api.github.com/repos/fixture/repository')).toBe(true);
 if(mode==='redirect'){const response=Response.json({});Object.defineProperty(response,'redirected',{value:true});return response;}
 if(mode==='error')return Response.json({detail:'PRIVATE_FIXTURE_TOKEN secret error'},{status:403});
 if(mode==='link')return Response.json({},{headers:{link:'<https://foreign.test/next>; rel=next'}});
 if(url.endsWith('/repository'))return Response.json({id:123,full_name:mode==='foreign'?'other/repository':'fixture/repository',archived:mode==='archived',disabled:false});
 if(url.includes('/git/ref/tags/'))return Response.json({ref:'refs/tags/v1.2.3',object:{type:mode==='annotated'?'tag':'commit',sha:mode==='ref_changed'&&calls.filter(v=>v.url.includes('/git/ref/')).length>1?'c'.repeat(40):mode==='annotated'?tagObject:commit}});
 if(url.includes('/git/tags/'))return Response.json({sha:tagObject,object:{type:'commit',sha:commit}});
 if(url.includes('/releases/tags/'))return Response.json({id:mode==='release_changed'&&calls.filter(v=>v.url.includes('/releases/')).length>1?43:42,tag_name:'v1.2.3',draft:mode==='draft',immutable:mode!=='mutable',published_at:published});
 if(url.includes('/contents/.github/workflows/')){
  expect(url).toContain('?ref='+commit);const content=mode==='different_workflow'?AWS_ECS_DEPLOY_WORKFLOW_TEMPLATE+'\n# unreviewed':AWS_ECS_DEPLOY_WORKFLOW_TEMPLATE;
  const sha=createHash('sha1').update('blob '+Buffer.byteLength(content)+'\0').update(content).digest('hex');
  return Response.json({type:'file',path:'.github/workflows/'+AWS_ECS_DEPLOY_WORKFLOW_FILENAME,encoding:'base64',sha:mode==='wrong_blob'?'c'.repeat(40):sha,size:Buffer.byteLength(content),content:Buffer.from(content).toString('base64')});
 }
 throw Error('unexpected_fixture_read');
}));});
afterEach(()=>{vi.unstubAllGlobals();vi.useRealTimers();});
it.each(['ok','annotated'])('observes exact immutable %s source and current reviewed template without writes',async variant=>{mode=variant;const value=await observeAgentRestartWorkflowSource(input());expect(value?.source).toMatchObject({kind:'github_immutable_restart_source_v1',repositoryFullName:'fixture/repository',repositoryId:'123',tagName:'v1.2.3',ref:'refs/tags/v1.2.3',sourceCommitSha:commit,releaseId:'42',workflowFile:AWS_ECS_DEPLOY_WORKFLOW_FILENAME});expect(value!.expiresAt).toBeGreaterThan(value!.observedAt);expect(JSON.stringify(value)).not.toContain('PRIVATE_FIXTURE_TOKEN');expect(calls.length).toBe(variant==='annotated'?7:6);});
it.each(['foreign','archived','draft','mutable','ref_changed','release_changed','different_workflow','wrong_blob','redirect','error','link'])('refuses %s evidence without a mutable/source fallback',async refusal=>{mode=refusal;expect(await observeAgentRestartWorkflowSource(input())).toBeNull();expect(calls.every(v=>v.init.method==='GET')).toBe(true);});
it('refuses branch source and malformed tokens without provider traffic',async()=>{expect(await observeAgentRestartWorkflowSource({...input(),sourceKind:'branch'} as any)).toBeNull();expect(await observeAgentRestartWorkflowSource({...input(),installationToken:'bad token'})).toBeNull();expect(calls).toHaveLength(0);});
it('propagates cancellation without provider traffic',async()=>{const controller=new AbortController();controller.abort();expect(await observeAgentRestartWorkflowSource({...input(),signal:controller.signal})).toBeNull();expect(calls).toHaveLength(0);});
it('bounds a never-resolving read without a retry',async()=>{vi.useFakeTimers();vi.stubGlobal('fetch',vi.fn(()=>new Promise(()=>{})));const pending=observeAgentRestartWorkflowSource(input());await vi.advanceTimersByTimeAsync(8001);expect(await pending).toBeNull();expect(fetch).toHaveBeenCalledOnce();});
