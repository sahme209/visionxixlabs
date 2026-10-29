import {beforeEach,describe,it,expect,vi} from 'vitest';
import {createHash} from 'node:crypto';
import {createReleaseDeploymentGithubReaders} from '../releaseDeploymentGithubReaders';
const now=Date.parse('2026-10-28T22:00:00Z'),sha='a'.repeat(40);
const yaml='name: Synthetic acceptance\non:\n  workflow_dispatch:\n    inputs:\n      marker:\n        type: string\n        required: true\njobs:\n  test:\n    runs-on: ubuntu-latest\n    steps:\n      - run: echo synthetic\n';
const blob=createHash('sha1').update(`blob ${Buffer.byteLength(yaml)}\0${yaml}`).digest('hex');
const plan={purpose:'release_deployment',organizationId:'org',releaseId:'release',releaseVersion:1,intakeDigest:'a'.repeat(64),planId:'release_plan_'+'b'.repeat(64),creatorUserId:'creator',requesterUserId:'requester',executorUserId:'executor',repositoryFullName:'owner/fixture',connectionId:'connection',connectionRevision:'2026-10-28T21:00:00.000Z',installationId:'123',workflowPath:'.github/workflows/deploy.yml',workflowBlobSha:blob,sourceCommitSha:sha,refKind:'tag',ref:'axiom-release-fixture',inputs:{marker:'synthetic'},sourcePolicy:'github_protected_tag_v1',windowStart:'2026-10-28T21:59:00.000Z',expiresAt:'2026-10-28T22:05:00.000Z'} as const;
let file:any,run:any,workflow:any,credential:any,mode:string;
beforeEach(()=>{
 file={type:'file',path:plan.workflowPath,sha:blob,encoding:'base64',content:Buffer.from(yaml).toString('base64')};
 run={id:42,run_attempt:1,workflow_id:7,event:'workflow_dispatch',path:plan.workflowPath,head_sha:sha,head_branch:plan.ref,repository:{full_name:plan.repositoryFullName},head_repository:{full_name:plan.repositoryFullName}};workflow={id:7,path:plan.workflowPath};mode='';
 credential={organizationId:'org',connectionId:'connection',connectionRevision:plan.connectionRevision,repositoryFullName:plan.repositoryFullName,installationId:'123',token:'fixture-only',expiresAt:now+600000,permissions:{contents:'read',actions:'read',metadata:'read'}};
});
function deps(){return{isEnabled:()=>true,now:()=>now,assertCurrent:vi.fn(async()=>{}),readCredential:vi.fn(async()=>credential),fetch:vi.fn(async(url:string,init:RequestInit)=>{
 expect(init.method).toBe('GET');expect(init.redirect).toBe('error');expect(init.credentials).toBe('omit');
 if(mode==='403')return Response.json({}, {status:403});
 if(mode==='pagination')return Response.json({}, {headers:{link:'next'}});
 if(url.includes('/contents/')){expect(url.endsWith('?ref='+sha)).toBe(true);return Response.json(file)}
 if(url.includes('/actions/runs/')){expect(url.endsWith('/actions/runs/42/attempts/1')).toBe(true);return Response.json(run)}
 return Response.json(workflow);
 }) as unknown as typeof fetch}}
describe('exact deployment workflow and first-attempt readers',()=>{
 it('reads immutable commit content and reuses validated workflow input contract',async()=>{const result=await createReleaseDeploymentGithubReaders(deps()).readWorkflowContract(plan,new AbortController().signal);expect(result).toMatchObject({workflowBlobSha:blob,sourceCommitSha:sha,dispatchSupported:true})});
 it('verifies only exact returned run and workflow identity',async()=>{expect(await createReleaseDeploymentGithubReaders(deps()).verifyRunReceipt(plan,'42',new AbortController().signal)).toEqual({repositoryFullName:plan.repositoryFullName,workflowPath:plan.workflowPath,headSha:sha,ref:plan.ref,runId:'42',runAttempt:1})});
 it('does not enable ambient default readers',async()=>expect(await createReleaseDeploymentGithubReaders().readWorkflowContract(plan,new AbortController().signal)).toBeNull());
 it.each(['path','sha','encoding','type'])('refuses mismatched file %s',async key=>{file[key]='wrong';expect(await createReleaseDeploymentGithubReaders(deps()).readWorkflowContract(plan,new AbortController().signal)).toBeNull()});
 it('refuses changed bytes under a claimed SHA',async()=>{file.content=Buffer.from(yaml+'# altered').toString('base64');expect(await createReleaseDeploymentGithubReaders(deps()).readWorkflowContract(plan,new AbortController().signal)).toBeNull()});
 it('refuses malformed base64',async()=>{file.content='not base64!';expect(await createReleaseDeploymentGithubReaders(deps()).readWorkflowContract(plan,new AbortController().signal)).toBeNull()});
 it('refuses unknown submitted input',async()=>expect(await createReleaseDeploymentGithubReaders(deps()).readWorkflowContract({...plan,inputs:{unknown:'x'}},new AbortController().signal)).toBeNull());
 it('refuses a missing required input',async()=>expect(await createReleaseDeploymentGithubReaders(deps()).readWorkflowContract({...plan,inputs:{}},new AbortController().signal)).toBeNull());
 it.each(['head_sha','head_branch','path','event'])('refuses unrelated run %s',async key=>{run[key]='wrong';expect(await createReleaseDeploymentGithubReaders(deps()).verifyRunReceipt(plan,'42',new AbortController().signal)).toBeNull()});
 it('refuses a rerun',async()=>{run.run_attempt=2;expect(await createReleaseDeploymentGithubReaders(deps()).verifyRunReceipt(plan,'42',new AbortController().signal)).toBeNull()});
 it('refuses another repository or fork',async()=>{run.head_repository.full_name='other/fork';expect(await createReleaseDeploymentGithubReaders(deps()).verifyRunReceipt(plan,'42',new AbortController().signal)).toBeNull()});
 it('refuses another workflow identity',async()=>{workflow.id=8;expect(await createReleaseDeploymentGithubReaders(deps()).verifyRunReceipt(plan,'42',new AbortController().signal)).toBeNull()});
 it.each(['403','pagination'])('refuses incomplete read %s',async value=>{mode=value;expect(await createReleaseDeploymentGithubReaders(deps()).readWorkflowContract(plan,new AbortController().signal)).toBeNull()});
 it('refuses wrong tenant and write credentials before fetch',async()=>{credential.organizationId='other';const d=deps();expect(await createReleaseDeploymentGithubReaders(d).readWorkflowContract(plan,new AbortController().signal)).toBeNull();expect(d.fetch).not.toHaveBeenCalled()});
 it('refuses a copied URL as run ID',async()=>{const d=deps();expect(await createReleaseDeploymentGithubReaders(d).verifyRunReceipt(plan,'https://github.com/owner/fixture/actions/runs/42',new AbortController().signal)).toBeNull();expect(d.fetch).not.toHaveBeenCalled()});
 it('revocation during read refuses the result',async()=>{const d=deps();let n=0;d.assertCurrent=vi.fn(async()=>{if(++n>2)throw Error('revoked')});expect(await createReleaseDeploymentGithubReaders(d).readWorkflowContract(plan,new AbortController().signal)).toBeNull()});
});

it('reads only the exact protected lightweight tag when proposing a deployment',async()=>{const d=deps();d.fetch=vi.fn(async()=>Response.json({ref:'refs/tags/'+plan.ref,object:{type:'commit',sha}})) as unknown as typeof fetch;expect(await createReleaseDeploymentGithubReaders(d).readSourceTag(plan,new AbortController().signal)).toBe(sha);});
it('refuses annotated tags for deployment proposals',async()=>{const d=deps();d.fetch=vi.fn(async()=>Response.json({ref:'refs/tags/'+plan.ref,object:{type:'tag',sha}})) as unknown as typeof fetch;expect(await createReleaseDeploymentGithubReaders(d).readSourceTag(plan,new AbortController().signal)).toBeNull();});
