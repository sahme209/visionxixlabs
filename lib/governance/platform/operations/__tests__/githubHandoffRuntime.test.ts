import {afterEach,expect,it,vi} from 'vitest';
import {mkdtemp,readFile,mkdir,writeFile,readdir} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createRequire} from 'node:module';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {prepareOperationalHandoffWorkflow} from '../handoffWorkflowArtifact';
import {createOperationalEcsResult} from '../ecsExecution';
const require=createRequire(import.meta.url);
const d='a'.repeat(64),config={environment:'fixture-reviewed',protectionRevision:d,audience:'fixture-audience',endpoint:'https://fixture.invalid/workload',preflightEndpoint:'https://fixture.invalid/preflight'};
const profile={format:2,purpose:'github_native_bootstrap_channel_v2',...config,repository:'sahme209/visionxixlabs',ref:'refs/heads/main',workflowPath:'.github/workflows/axiom-deploy-aws-ecs.yml',workflowSha256:d,nativeOrigin:'https://fixture.actions.githubusercontent.com',nativePath:'/token',nativeQueryKeys:[],expiresAt:Date.now()+600000};
afterEach(()=>{vi.unstubAllEnvs();vi.unstubAllGlobals()});
it('builds the actual fixed entrypoint with a closed dependency manifest; emitted bytes refuse overrides before native capture',async()=>{
 const {buildGithubHandoffRuntime}=require('../../../../../scripts/build-github-handoff-runtime.cjs');
 const directory=await mkdtemp(join(tmpdir(),'axiom-github-runtime-')),artifact=await buildGithubHandoffRuntime(profile,directory);
 const bytes=await readFile(artifact.path),hash=createHash('sha256').update(bytes).digest('hex');expect(hash).toBe(artifact.runtimeSha256);expect(bytes.length).toBeLessThan(1048576);
 expect(artifact.modules).toContain('lib/governance/platform/operations/githubJobEntry.ts');expect(artifact.modules.some((p:string)=>/prisma|privateStsIssuer|db\.ts|vault|session/i.test(p))).toBe(false);expect(artifact.modules.some((p:string)=>p.startsWith('node_modules/zod/'))).toBe(true);
 const runtime=await import(/* @vite-ignore */'data:text/javascript;base64,'+bytes.toString('base64'));
 const fetch=vi.fn(async()=>{throw Error('must not send')});vi.stubGlobal('fetch',fetch);
 await expect(runtime.default({actionId:'platform_action_11111111-1111-4111-8111-111111111111',delegationVersion:0},{...config,endpoint:'https://other.invalid/workload'})).rejects.toThrow('operational_job_unconfirmed');expect(fetch).not.toHaveBeenCalled();
 expect(artifact.authority).toBe('compiled_artifact_only');expect(artifact.installed).toBe(false);
 // Actual artifact compiler + generated Node step + same actual bundled bytes.
 // Provider/profile qualification is expressly simulated in this owned child.
 const prepared=await prepareOperationalHandoffWorkflow({read:async()=>({format:1,...config,sourceCommit:'a'.repeat(40),runtimeSha256:hash,javascript:bytes.toString('utf8')}),assertCurrent:async()=>{}},new AbortController().signal);
 const workflow=JSON.parse(prepared.files['.github/workflows/axiom-deploy-aws-ecs.yml']),run:string=workflow.jobs.handoff.steps[1].run;
 const cwd=await mkdtemp(join(tmpdir(),'axiom-generated-handoff-'));await mkdir(join(cwd,'.axiom/handoff'),{recursive:true});await writeFile(join(cwd,'.axiom/handoff/runner.mjs'),bytes);
 const actionId='platform_action_11111111-1111-4111-8111-111111111111',workload={environment:config.environment,protectionRevision:d,repository:profile.repository,ref:profile.ref,commit:'a'.repeat(40),workflowCommit:'a'.repeat(40),workflowPath:profile.workflowPath,workflowSha256:d,runId:'1',attempt:1};
 const metadata={actionId,manifestDigest:d,issuerProfileDigest:d,workload,observedAt:Date.now(),expiresAt:new Date(Date.now()+30000).toISOString(),executionAuthorized:false};
 const result=createOperationalEcsResult({format:1,purpose:'operational_ecs_update_result_v1',actionId,manifestDigest:d,nativeKey:d,generation:1,leaseRef:'platform_credential_11111111-1111-4111-8111-111111111111',kind:'accepted',deploymentId:'ecs-svc/2',requestId:'synthetic',observedAt:Date.now(),stable:false,rollbackAuthorized:false});
 const preloader=`let requests=0;globalThis.fetch=async(url,init)=>{requests++;if(url.startsWith(${JSON.stringify(profile.nativeOrigin)}))return Response.json({value:'synthetic.payload.signature'});if(url===${JSON.stringify(config.endpoint)})return Response.json({ok:true,data:${JSON.stringify(result)}});if(url===${JSON.stringify(config.preflightEndpoint)})return Response.json({ok:true,data:{...${JSON.stringify(metadata)},authority:JSON.parse(init.body).operation==='source-current'?'handoff_source_only':'handoff_preflight_only'}});throw Error('unexpected fixture URL')};process.on('beforeExit',()=>console.log('fixture-requests:'+requests));`;
 const environment:NodeJS.ProcessEnv={NODE_ENV:'test',HOME:cwd,AXIOM_ACTION_ID:actionId,ACTIONS_ID_TOKEN_REQUEST_URL:profile.nativeOrigin+'/token',ACTIONS_ID_TOKEN_REQUEST_TOKEN:'synthetic-request-bearer',GITHUB_REPOSITORY:profile.repository,GITHUB_REF:profile.ref,GITHUB_SHA:'a'.repeat(40),GITHUB_WORKFLOW_SHA:'a'.repeat(40),GITHUB_WORKFLOW_REF:profile.repository+'/'+profile.workflowPath+'@'+profile.ref,GITHUB_RUN_ID:'1',GITHUB_RUN_ATTEMPT:'1'};
 const invocation=()=>spawnSync(process.execPath,['--import','data:text/javascript;base64,'+Buffer.from(preloader).toString('base64'),'--input-type=module'],{input:run.split('\n').slice(1,-1).join('\n'),cwd,env:environment,timeout:10000,maxBuffer:65536,encoding:'utf8'});
 const child=invocation();expect(child.status,child.stderr).toBe(0);expect(child.stdout).toBe('fixture-requests:6\n');expect(child.stdout+child.stderr).not.toContain('synthetic.payload.signature');
 await writeFile(join(cwd,'.axiom/handoff/runner.mjs'),Buffer.concat([bytes,Buffer.from(' ')]));const changed=invocation();expect(changed.status).toBe(1);expect(changed.stdout).toBe('fixture-requests:0\n');
 const invalid=await mkdtemp(join(tmpdir(),'axiom-invalid-handoff-'));await expect(buildGithubHandoffRuntime({...profile,requestToken:'must-not-be-written'},invalid)).rejects.toThrow('handoff_profile_unavailable');expect(await readdir(invalid)).toEqual([]);
},30000);
