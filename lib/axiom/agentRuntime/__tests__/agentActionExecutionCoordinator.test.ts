import {beforeEach,afterEach,describe,it,expect,vi} from 'vitest';
const mocks=vi.hoisted(()=>({guard:vi.fn(),resolve:vi.fn()}));
vi.mock('@/lib/desktop/currentGithubWriteAuthority',()=>({createCurrentGithubWriteGuard:mocks.guard}));
import {createAgentActionExecutionCoordinator} from '../agentActionExecutionCoordinator';
const scope={organizationId:'org',actorUserId:'requester',sessionId:'session'};
const principal={id:'session',userId:'requester',organizationId:'org',credentialKind:'desktop_session'};
const args={repositoryFullName:'owner/repo',baseBranch:'main',newBranchName:'work',_review:{kind:'github_branch',baseBranch:'main',newBranchName:'work',baseSha:'a'.repeat(40)}};
const saved=()=>({toolName:'create_github_branch',args:structuredClone(args),proposalDigest:'d'.repeat(64),reviewId:'review'});
let store:any,guard:any,writes:number;
beforeEach(()=>{
 vi.clearAllMocks();writes=0;
 guard=Object.assign(vi.fn().mockResolvedValue(undefined),{resolveToken:mocks.resolve,connectionBinding:vi.fn(()=>({id:'connection',githubInstallationId:'123',updatedAt:new Date('2026-11-01')}))});mocks.guard.mockReturnValue(guard);mocks.resolve.mockResolvedValue({ok:true,token:'private-token'});
 const claim=Object.freeze({operationId:'operation'});
 store={inspectForExecution:vi.fn().mockImplementation(async()=>saved()),claim:vi.fn().mockResolvedValue({claimed:true,claim}),beforeDispatch:vi.fn().mockImplementation(async()=>saved()),beforeGithubDispatch:vi.fn().mockImplementation(async()=>saved()),complete:vi.fn().mockImplementation(async(_proof:any,state:string,receipt:any)=>({state,receipt})),get:vi.fn()};
 vi.stubGlobal('fetch',vi.fn(async(_url:string,init:any)=>{if(init.method!=='GET'){writes++;return Response.json({ref:'refs/heads/work',object:{sha:'a'.repeat(40)}})}return Response.json({object:{sha:'a'.repeat(40)}})}));
});
afterEach(()=>vi.unstubAllGlobals());
const create=()=>createAgentActionExecutionCoordinator(new Request('https://fixture.test') as any,principal as any,{} as any,store,scope);
describe('unmounted fixed requester GitHub execution core (simulated authority/provider)',()=>{
 it('uses only stored arguments, pins before claim, checks again at transport, returns closed receipt',async()=>{
  const result=await create().execute('operation');expect(result).toEqual({state:'confirmed',receipt:{code:'action_completed'}});expect(writes).toBe(1);
  expect(guard.mock.invocationCallOrder[0]).toBeLessThan(store.claim.mock.invocationCallOrder[0]);expect(mocks.resolve.mock.calls[0][0]).toEqual({owner:'owner',repo:'repo'});expect(store.beforeDispatch).toHaveBeenCalled();expect(JSON.stringify(result)).not.toContain('private-token');
 });
 it.each(['unsupported_closed_tool'])('refuses unfinished %s before claim or credentials',async toolName=>{store.inspectForExecution.mockResolvedValue({...saved(),toolName});await expect(create().execute('operation')).rejects.toThrow('agent_execution_tool_unavailable');expect(store.claim).not.toHaveBeenCalled();expect(mocks.resolve).not.toHaveBeenCalled();});
 it('rejects substituted principal before touching store',async()=>{expect(()=>createAgentActionExecutionCoordinator(new Request('https://fixture.test') as any,{...principal,userId:'reviewer'} as any,{} as any,store,scope)).toThrow();expect(store.inspectForExecution).not.toHaveBeenCalled();});
 it('does not resolve credentials on replay',async()=>{store.claim.mockResolvedValue({claimed:false,operation:{state:'unknown'}});expect(await create().execute('operation')).toEqual({state:'unknown'});expect(mocks.resolve).not.toHaveBeenCalled();expect(writes).toBe(0);});
 it('refuses changed review after credential await before any write',async()=>{store.beforeDispatch.mockResolvedValue({...saved(),proposalDigest:'e'.repeat(64)});expect(await create().execute('operation')).toEqual({state:'refused',receipt:{code:'pre_dispatch_refused'}});expect(writes).toBe(0);});
 it('refuses current transport authority loss with zero provider writes',async()=>{guard.mockImplementation(async()=>{if(store.beforeDispatch.mock.calls.length)throw Error('revoked')});expect(await create().execute('operation')).toEqual({state:'refused',receipt:{code:'pre_dispatch_refused'}});expect(writes).toBe(0);});
 it('keeps lost provider response consumed and unknown without raw error',async()=>{vi.stubGlobal('fetch',vi.fn(async(_url:string,init:any)=>{if(init.method!=='GET'){writes++;throw Error('private-token provider detail')}return Response.json({object:{sha:'a'.repeat(40)}})}));expect(await create().execute('operation')).toEqual({state:'unknown',receipt:{code:'provider_outcome_unknown'}});expect(writes).toBe(1);expect(store.complete).toHaveBeenCalledTimes(1);});
 it('does not retry after outcome storage fails',async()=>{store.complete.mockRejectedValue(Error('database unavailable'));await expect(create().execute('operation')).rejects.toThrow('database unavailable');expect(writes).toBe(1);expect(store.complete).toHaveBeenCalledTimes(1);});
 it('classifies malformed successful provider evidence as unknown',async()=>{vi.stubGlobal('fetch',vi.fn(async(_url:string,init:any)=>{if(init.method!=='GET'){writes++;return Response.json({ref:'refs/heads/other',object:{sha:'bad'}})}return Response.json({object:{sha:'a'.repeat(40)}})}));expect(await create().execute('operation')).toEqual({state:'unknown',receipt:{code:'provider_outcome_unknown'}});expect(writes).toBe(1);});
 it('refuses unsafe saved file paths before claim',async()=>{store.inspectForExecution.mockResolvedValue({...saved(),toolName:'commit_github_file',args:{repositoryFullName:'owner/repo',branch:'work',path:'.env',content:'unsafe',message:'change',_review:{kind:'github_file',baseSha:null,baseContent:''}}});await expect(create().execute('operation')).rejects.toThrow();expect(store.claim).not.toHaveBeenCalled();expect(writes).toBe(0);});
 it('uses exact saved file review and repeats default-branch protection at actual PUT',async()=>{
  const file={...saved(),toolName:'commit_github_file',args:{repositoryFullName:'owner/repo',branch:'work',path:'app.txt',content:'new',message:'change',_review:{kind:'github_file',baseSha:'a'.repeat(40),baseContent:'old'}}};store.inspectForExecution.mockResolvedValue(file);store.beforeDispatch.mockResolvedValue(file);store.beforeGithubDispatch.mockResolvedValue(file);
  let repoReads=0;vi.stubGlobal('fetch',vi.fn(async(url:string,init:any)=>{if(init.method!=='GET'){writes++;return Response.json({content:{sha:'b'.repeat(40),html_url:'https://github.com/owner/repo'}})}if(url.endsWith('/repos/owner/repo')){repoReads++;return Response.json({default_branch:repoReads===1?'main':'work'})}return Response.json({sha:'a'.repeat(40)})}));
  expect(await create().execute('operation')).toEqual({state:'refused',receipt:{code:'pre_dispatch_refused'}});expect(repoReads).toBe(2);expect(writes).toBe(0);
 });
 it('successful multi-file object write followed by authority loss remains unknown',async()=>{
  const files=[{path:'a.txt',content:'a'},{path:'b.txt',content:'b'}],file={...saved(),toolName:'commit_github_files',args:{repositoryFullName:'owner/repo',branch:'work',message:'change',files,_review:{kind:'github_files',files:files.map(f=>({path:f.path,baseSha:'a'.repeat(40),baseContent:'old'}))}}};store.inspectForExecution.mockResolvedValue(file);store.beforeDispatch.mockResolvedValue(file);store.beforeGithubDispatch.mockResolvedValue(file);
  guard.mockImplementation(async()=>{if(writes)throw Error('revoked')});vi.stubGlobal('fetch',vi.fn(async(url:string,init:any)=>{if(init.method!=='GET'){writes++;return Response.json({sha:'b'.repeat(40)})}if(url.endsWith('/repos/owner/repo'))return Response.json({default_branch:'main'});if(url.includes('/git/ref/'))return Response.json({object:{type:'commit',sha:'c'.repeat(40)}});if(url.includes('/git/commits/'))return Response.json({tree:{sha:'d'.repeat(40)}});return Response.json({type:'file',encoding:'base64',sha:'a'.repeat(40),content:Buffer.from('old').toString('base64'),path:'a.txt',html_url:'https://github.com/owner/repo'})}));
  expect(await create().execute('operation')).toEqual({state:'unknown',receipt:{code:'provider_outcome_unknown'}});expect(writes).toBe(1);
 });

 it('rechecks reviewer and source after the last asynchronous GitHub guard',async()=>{
  let revoked=false;guard.mockImplementation(async()=>{if(store.beforeDispatch.mock.calls.length)revoked=true});store.beforeGithubDispatch.mockImplementation(async()=>{if(revoked)throw Error('reviewer revoked');return saved()});
  expect(await create().execute('operation')).toEqual({state:'refused',receipt:{code:'pre_dispatch_refused'}});expect(store.beforeGithubDispatch).toHaveBeenCalledOnce();expect(writes).toBe(0);expect(store.complete).toHaveBeenCalledOnce();
 });
 it('uses the captured connection in the final store check with no later guard await',async()=>{
  let final=false;store.beforeGithubDispatch.mockImplementation(async(_scope:any,_claim:any,binding:any)=>{expect(binding).toEqual(guard.connectionBinding());final=true;return saved()});guard.mockImplementation(async()=>{if(final)throw Error('authority awaited after final check')});
  expect(await create().execute('operation')).toEqual({state:'confirmed',receipt:{code:'action_completed'}});expect(writes).toBe(1);
 });

});

it('refuses branch execution without captured trusted source before claim',async()=>{const source=saved();delete (source.args as any)._review;store.inspectForExecution.mockResolvedValue(source);await expect(create().execute('operation')).rejects.toThrow('agent_execution_review_unavailable');expect(store.claim).not.toHaveBeenCalled();expect(writes).toBe(0)});
it('consumes a stale base refusal without sending a branch write',async()=>{vi.stubGlobal('fetch',vi.fn(async()=>Response.json({object:{sha:'b'.repeat(40)}})));expect(await create().execute('operation')).toEqual({state:'refused',receipt:{code:'pre_dispatch_refused'}});expect(store.complete).toHaveBeenCalledOnce();expect(writes).toBe(0)});
it('does not confirm a different commit returned for the reviewed branch',async()=>{vi.stubGlobal('fetch',vi.fn(async(_url:string,init:any)=>{if(init.method!=='GET'){writes++;return Response.json({ref:'refs/heads/work',object:{sha:'b'.repeat(40)}})}return Response.json({object:{sha:'a'.repeat(40)}})}));expect(await create().execute('operation')).toEqual({state:'unknown',receipt:{code:'provider_outcome_unknown'}});expect(writes).toBe(1)});


function usePullRequestSource(){
 const source={...saved(),toolName:'open_github_pull_request',args:{repositoryFullName:'owner/repo',head:'reviewed',base:'main',title:'Reviewed change',_review:{kind:'github_pull_request',head:'reviewed',base:'main',headSha:'a'.repeat(40),baseSha:'b'.repeat(40)}}};
 store.inspectForExecution.mockResolvedValue(source);store.beforeDispatch.mockResolvedValue(source);store.beforeGithubDispatch.mockResolvedValue(source);return source;
}
function pullRequestProvider(changed?:'head'|'response'){
 vi.stubGlobal('fetch',vi.fn(async(url:string,init:any)=>{
  if(init.method==='GET')return Response.json({object:{type:'commit',sha:((url.endsWith('/reviewed')?(changed==='head'?'c':'a'):'b')).repeat(40)}});
  writes++;return Response.json({number:42,html_url:'https://github.com/owner/repo/pull/42',head:{ref:'reviewed',sha:(changed==='response'?'c':'a').repeat(40),repo:{full_name:'owner/repo'}},base:{ref:'main',sha:'b'.repeat(40),repo:{full_name:'owner/repo'}}});
 }));
}
it('requires captured pull-request commits before claiming the operation',async()=>{const source=usePullRequestSource();delete (source.args as any)._review;await expect(create().execute('operation')).rejects.toThrow('agent_execution_review_unavailable');expect(store.claim).not.toHaveBeenCalled();expect(writes).toBe(0)});
it('refuses changed pull-request head with no provider POST',async()=>{usePullRequestSource();pullRequestProvider('head');expect(await create().execute('operation')).toEqual({state:'refused',receipt:{code:'pre_dispatch_refused'}});expect(writes).toBe(0)});
it('confirms one pull request only after checking both returned reviewed commits',async()=>{usePullRequestSource();pullRequestProvider();expect(await create().execute('operation')).toEqual({state:'confirmed',receipt:{code:'action_completed',references:[{kind:'github_pull_request',id:'42'}]}});expect(writes).toBe(1);expect(store.beforeGithubDispatch).toHaveBeenCalledOnce()});
it('keeps a created pull request with changed response source consumed unknown',async()=>{usePullRequestSource();pullRequestProvider('response');expect(await create().execute('operation')).toEqual({state:'unknown',receipt:{code:'provider_outcome_unknown'}});expect(writes).toBe(1);expect(store.complete).toHaveBeenCalledOnce()});
