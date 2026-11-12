import {it,expect} from 'vitest';
import {compileOperationalManifest,matchesOperationalRollbackFailure} from '../kernel';
import {operationalManifestSchema} from '../contracts';
const d='a'.repeat(64),commit='b'.repeat(40),ref='platform_evidence_11111111-1111-4111-8111-111111111111',artifact='platform_artifact_22222222-2222-4222-8222-222222222222';
const common={format:1,scope:'platform',expiresAt:'2099-01-01T00:00:00Z'};
const source={repository:'sahme209/visionxixlabs',branch:'main',commit};
const target={projectId:'prj_fixture',teamId:'team_fixture',environment:'production'};
const manual=()=>({...common,kind:'release.manual',source,target,sourceHashes:{workflow:d,build:d,configuration:d,lock:d,schema:d},artifactEvidenceId:ref,ciEvidence:[{name:'Typecheck + Vitest',receiptId:ref,commit}],compatibilityEvidenceId:ref,recoveryEvidenceId:ref,smokeProfileId:'production-smoke-v1'});
const ecsTarget={accountId:'123456789012',region:'us-east-2',clusterArn:'arn:aws:ecs:us-east-2:123456789012:cluster/main',serviceArn:'arn:aws:ecs:us-east-2:123456789012:service/main/api',taskDefinitionArn:'arn:aws:ecs:us-east-2:123456789012:task-definition/api:12'};
const workload={repository:'sahme209/visionxixlabs',ref:'refs/heads/main',commit,workflowCommit:commit,workflowPath:'.github/workflows/axiom-deploy-aws-ecs.yml',workflowSha256:d,runId:'40808599225',attempt:1};
const ecs=()=>({...common,kind:'deployment.ecs',operation:'force',target:ecsTarget,roleArn:'arn:aws:iam::123456789012:role/axiom-deploy',workload,sourceEvidenceId:ref});
it('compiles immutable metadata without turning an admin notice or CI references into owner/provider authority',()=>{
 const result=compileOperationalManifest(manual());expect(result).toMatchObject({kind:'release.manual',authority:'metadata_only',executionAuthorized:false,ownerAuthorization:'external_not_verified'});expect(result.digest).toMatch(/^[a-f0-9]{64}$/);expect(Object.isFrozen(result)).toBe(true);expect(Object.isFrozen(result.target)).toBe(true);
 for(const input of [{...manual(),ownerVerified:true},{...manual(),source:{...source,branch:'feature'}},{...manual(),ciEvidence:[{name:'Typecheck + Vitest',receiptId:ref,commit:'c'.repeat(40)}]},{...manual(),ciEvidence:[{name:'Typecheck + Vitest',receiptId:ref,commit,green:true}]}])expect(()=>compileOperationalManifest(input)).toThrow();
});
it('binds exact ECS account/region/cluster/task/workflow/run and refuses caller proof or retargeting',()=>{
 expect(compileOperationalManifest(ecs())).toMatchObject({kind:'deployment.ecs',operation:'force',executionAuthorized:false});
 expect(compileOperationalManifest({...ecs(),target:{...ecsTarget,serviceArn:'arn:aws:ecs:us-east-2:123456789012:service/api'}})).toMatchObject({kind:'deployment.ecs',executionAuthorized:false});
 for(const input of [{...ecs(),proof:true},{...ecs(),target:{...ecsTarget,accountId:'999999999999'}},{...ecs(),target:{...ecsTarget,region:'us-east-1'}},{...ecs(),target:{...ecsTarget,serviceArn:'arn:aws:ecs:us-east-2:123456789012:service/other/api'}},{...ecs(),workload:{...workload,runId:'first-matching-run'}},{...ecs(),workload:{...workload,attempt:0}},{...ecs(),workload:{...workload,workflowCommit:'c'.repeat(40)}}])expect(()=>compileOperationalManifest(input)).toThrow();
});
it('settings manifest hashes nonsecret references only and refuses duplicate targets or secret-bearing fields',()=>{
 const entry={name:'AWS_CONNECTOR_BROKER_SECRET_ACCESS_KEY',environment:'production',type:'encrypted',sensitivity:'secret',artifactId:artifact,current:{kind:'present',id:'env_fixture',updatedAt:123,receiptId:ref}};
 const manifest={...common,kind:'settings.vercel',target:{projectId:'prj_fixture',teamId:'team_fixture'},settings:[entry]};expect(compileOperationalManifest(manifest)).toMatchObject({kind:'settings.vercel',executionAuthorized:false});
 for(const input of [{...manifest,settings:[entry,entry]},{...manifest,settings:[{...entry,environment:'all'}]},{...manifest,settings:[{...entry,value:'never included'}]},{...manifest,settings:[{...entry,secretHash:d}]},{...manifest,settings:[{...entry,ciphertext:'never included'}]},{...manifest,settings:[{...entry,type:'plain'}]}])expect(()=>compileOperationalManifest(input)).toThrow();
});
it('a rollback condition matches only exact failure receipt lineage; timeout/unknown is never enough',()=>{
 const actionId='platform_action_33333333-3333-4333-8333-333333333333',condition={kind:'verified_terminal_failure',failedActionId:actionId,failureReceiptId:ref,priorDeploymentReceiptId:ref,generation:3,failedTaskDefinitionArn:ecsTarget.taskDefinitionArn};
 const plan=compileOperationalManifest({...ecs(),operation:'rollback',target:{...ecsTarget,taskDefinitionArn:'arn:aws:ecs:us-east-2:123456789012:task-definition/api:11'},condition});
 const observed={kind:'provider_terminal_failure',actionId,receiptId:ref,generation:3,accountId:ecsTarget.accountId,region:ecsTarget.region,clusterArn:ecsTarget.clusterArn,serviceArn:ecsTarget.serviceArn,failedTaskDefinitionArn:ecsTarget.taskDefinitionArn};
 expect(matchesOperationalRollbackFailure(plan,observed)).toBe(true);
 for(const input of [{...observed,kind:'waiter_error'},{...observed,kind:'unknown'},{...observed,generation:2},{...observed,actionId:'platform_action_44444444-4444-4444-8444-444444444444'},{...observed,serviceArn:'arn:aws:ecs:us-east-2:123456789012:service/main/other'}])expect(matchesOperationalRollbackFailure(plan,input)).toBe(false);
 expect(plan.executionAuthorized).toBe(false);
});

it('returns a closed validation failure for malformed ARN/run data instead of throwing from refinements',()=>{
 for(const input of [{...ecs(),target:{...ecsTarget,clusterArn:'invalid'}},{...ecs(),target:{...ecsTarget,serviceArn:'invalid'}},{...ecs(),target:{...ecsTarget,taskDefinitionArn:'invalid'}},{...ecs(),roleArn:'invalid'},{...ecs(),workload:{...workload,runId:'invalid'}}]){
  let result:ReturnType<typeof operationalManifestSchema.safeParse>|undefined;expect(()=>{result=operationalManifestSchema.safeParse(input)}).not.toThrow();expect(result?.success).toBe(false);
 }
});
