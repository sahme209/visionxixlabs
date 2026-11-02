import {beforeEach,it,expect,vi} from 'vitest';
const guard=vi.hoisted(()=>vi.fn(()=>{throw Error('DB action must not compose GitHub credentials')}));
vi.mock('@/lib/desktop/currentGithubWriteAuthority',()=>({createCurrentGithubWriteGuard:guard}));
import {createAgentActionExecutionCoordinator} from '../agentActionExecutionCoordinator';
const scope={organizationId:'org',actorUserId:'requester',sessionId:'session'},principal={id:'session',userId:'requester',organizationId:'org',credentialKind:'desktop_session'};
const fixtures=[
 ['create_environment',{slug:'qa',name:'QA',tier:'qa'}],
 ['configure_deployment_target',{environmentId:'env',roleArn:'arn:aws:iam::123456789012:role/deployer',region:'us-east-1',ecsCluster:'cluster',ecsService:'service'}],
 ['connect_identity_provider',{protocol:'oidc',issuerOrEntityId:'https://idp.fixture.test',metadataDocument:'metadata',managedDomains:['fixture.test'],roleMapping:[{claimKey:'group',claimValue:'ops',role:'operator'}],requireMfaClaim:true}],
] as const;
let store:any,tx:any,source:any;
beforeEach(()=>{
 vi.clearAllMocks();
 tx={$queryRaw:vi.fn().mockImplementation(async(parts:TemplateStringsArray)=>String(parts).includes('"DeploymentTarget"')?[]:[{id:'env',organizationId:'org'}]),environment:{findUnique:vi.fn().mockResolvedValue(null),create:vi.fn().mockResolvedValue({id:'env',slug:'qa',name:'QA',tier:'qa'})},deploymentTarget:{upsert:vi.fn().mockResolvedValue({id:'target',organizationId:'org',environmentId:'env'})},tenantIdentityProvider:{findUnique:vi.fn().mockResolvedValue(null),create:vi.fn().mockResolvedValue({id:'idp',organizationId:'org',status:'pending'})}};
 store={inspectForExecution:vi.fn().mockImplementation(async()=>source),claim:vi.fn().mockResolvedValue({claimed:true,claim:{operationId:'operation'}}),applyDatabase:vi.fn().mockImplementation(async(_claim:any,apply:any)=>({state:'confirmed',receipt:await apply(tx,source)})),complete:vi.fn()};
});
const create=()=>createAgentActionExecutionCoordinator(new Request('https://fixture.test') as any,principal as any,{} as any,store,scope);
it.each(fixtures)('uses fixed transaction responder for saved %s with zero GitHub composition',async(toolName,args)=>{
 source={toolName,args:structuredClone(args),proposalDigest:'d'.repeat(64),reviewId:'review'};
 if(toolName==='configure_deployment_target')tx.environment.findUnique.mockResolvedValue({id:'env',organizationId:'org'});
 expect(await create().execute('operation')).toEqual({state:'confirmed',receipt:{code:'action_completed'}});expect(guard).not.toHaveBeenCalled();expect(store.applyDatabase).toHaveBeenCalledOnce();expect(store.complete).not.toHaveBeenCalled();
 if(toolName==='connect_identity_provider')expect(tx.tenantIdentityProvider.create.mock.calls[0][0].data.configuredByUserId).toBe('requester');
});
it('throws on responder failure so atomic store rolls back instead of confirming',async()=>{source={toolName:fixtures[0][0],args:fixtures[0][1],proposalDigest:'d'.repeat(64),reviewId:'review'};tx.environment.create.mockRejectedValue(Error('database rejected'));await expect(create().execute('operation')).rejects.toThrow('agent_execution_database_unavailable');expect(store.complete).not.toHaveBeenCalled();expect(store.applyDatabase).toHaveBeenCalledOnce();});
it('rejects changed transaction source before mutation',async()=>{source={toolName:fixtures[0][0],args:fixtures[0][1],proposalDigest:'d'.repeat(64),reviewId:'review'};store.applyDatabase.mockImplementation(async(_claim:any,apply:any)=>apply(tx,{...source,args:{...source.args,name:'changed'}}));await expect(create().execute('operation')).rejects.toThrow('agent_execution_source_changed');expect(tx.environment.create).not.toHaveBeenCalled();});
it('refuses a foreign target before fixed upsert',async()=>{source={toolName:fixtures[1][0],args:fixtures[1][1],proposalDigest:'d'.repeat(64),reviewId:'review'};tx.$queryRaw.mockResolvedValue([{id:'env',organizationId:'other'}]);await expect(create().execute('operation')).rejects.toThrow();expect(tx.deploymentTarget.upsert).not.toHaveBeenCalled();});
it('does not confirm an existing environment with changed reviewed configuration',async()=>{source={toolName:fixtures[0][0],args:fixtures[0][1],proposalDigest:'d'.repeat(64),reviewId:'review'};tx.environment.findUnique.mockResolvedValue({id:'env',slug:'qa',name:'different',tier:'prod'});await expect(create().execute('operation')).rejects.toThrow('agent_execution_source_changed');expect(tx.environment.create).not.toHaveBeenCalled();});

it('throws on conflicting foreign target returned by upsert so transaction can roll back',async()=>{source={toolName:fixtures[1][0],args:fixtures[1][1],proposalDigest:'d'.repeat(64),reviewId:'review'};tx.environment.findUnique.mockResolvedValue({id:'env',organizationId:'org'});tx.deploymentTarget.upsert.mockResolvedValue({id:'target',environmentId:'env',organizationId:'other'});await expect(create().execute('operation')).rejects.toThrow('agent_execution_target_unavailable');});
