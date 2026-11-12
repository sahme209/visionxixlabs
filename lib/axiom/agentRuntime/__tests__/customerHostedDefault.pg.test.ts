import {beforeAll,afterAll,beforeEach,afterEach,describe,it,expect,vi} from 'vitest';
import {randomUUID} from 'node:crypto';
import {realpathSync,statSync} from 'node:fs';
const m=vi.hoisted(()=>({limits:vi.fn(),send:vi.fn(),audit:vi.fn(),cloud:vi.fn(()=>{throw Error('cloud path forbidden')})}));
vi.mock('@/lib/ai/customerHostedLimitSupplier',()=>({readAcceptedCustomerHostedLimits:m.limits}));
vi.mock('@/lib/ai/customerHostedTransport',()=>({sendCustomerHostedCompletion:m.send}));
vi.mock('@/lib/audit/secureAudit',()=>({record:m.audit}));
vi.mock('@/lib/ai/AIProviderManager',()=>({getAIProviderManager:m.cloud}));
vi.mock('@/lib/billing/checkWorkspaceAICredits',()=>({checkWorkspaceAICredits:m.cloud}));
import {prisma} from '@/lib/db';
import {resolveGovernedAiCall} from '../governedAiCall';
import {runDecisionLoop} from '../decisionLoop';
const root=process.env.AXIOM_HOSTED_TOKEN_PG_ROOT;
describe.skipIf(!root)('actual default Agent offline composition; simulated model/evidence',()=>{
 beforeAll(async()=>{
  if(!root||!/^\/private\/tmp\/axiom-hosted-token-pg-[^/]+$/.test(root)||realpathSync(root)!==root||(statSync(root).mode&0o077)!==0)throw Error('owned_fixture_required');
  const [r]=await prisma.$queryRawUnsafe<Array<{owned:boolean}>>("SELECT current_database()='token_fixture' AND current_user='token_fixture' AND current_setting('listen_addresses')='' AS owned");if(!r?.owned)throw Error('owned_fixture_required');
 });
 afterAll(async()=>{await prisma.$disconnect()});
 beforeEach(()=>{const expiry=Date.now()+60000;vi.clearAllMocks();vi.stubEnv('AXIOM_OFFLINE_MODE','true');m.audit.mockResolvedValue(undefined);m.limits.mockImplementation(async()=>({reservedTokens:60,expiresAt:expiry,evidenceSha256:'b'.repeat(64)}));m.send.mockImplementation(async input=>{await input.beforeSend();return {data:{ok:true},raw:'{}',promptTokens:10,completionTokens:10,totalTokens:20}})});
 afterEach(()=>vi.unstubAllEnvs());
 async function fixture(kind='vllm'){
  const org='default-'+randomUUID(),actor='actor-'+randomUUID();
  await prisma.orgMembership.create({data:{organizationId:org,userId:actor,role:'operator',acceptedAt:new Date()}});
  await prisma.organizationAIProviderPolicy.create({data:{organizationId:org,enabled:true,allowedProviders:['customer_hosted'],modelSelections:{customer_hosted:'local'},fallbackOrder:[],updatedBy:actor}});
  const config={format:'axiom.customer-hosted/1',installationId:'install',revision:'r1',server:{kind,baseUrl:'https://models.private.test/v1',allowedHosts:['models.private.test']},models:[{id:'local',maxInputTokens:40,maxOutputTokens:20,maxInputBytes:8192}],budgets:[{organizationId:org,windowId:'w',startsAt:'2026-01-01T00:00:00.000Z',expiresAt:'2099-01-01T00:00:00.000Z',limitTokens:100}]};
  vi.stubEnv('AXIOM_LOCAL_MODEL_CONFIG',JSON.stringify(config));return {org,actor,config};
 }
 it.each(['vllm','ollama','lm_studio'])('runs the real default %s Agent/Prisma membership+ledger path',async kind=>{
  const f=await fixture(kind),resolved=await resolveGovernedAiCall(f.org,'customer_hosted',f.actor,'local');if(!resolved.ok)throw Error('fixture unavailable');
  expect(await resolved.extract('input','shape','request-1')).toMatchObject({data:{ok:true},usage:{totalTokens:20}});
  const rows=await prisma.durableAgentWorkflow.findMany({where:{organizationId:f.org,workflowKind:'customer_hosted_token_call_v1'}});expect(rows).toHaveLength(1);expect(rows[0].stateJson).toMatchObject({status:'settled',reportedTokens:20,reservedTokens:60});
  expect(m.send).toHaveBeenCalledTimes(1);expect(m.cloud).not.toHaveBeenCalled();expect(m.audit).toHaveBeenCalledWith(expect.objectContaining({detail:expect.objectContaining({provider:'customer_hosted',settlement:'customer_hosted_unpriced',outcome:'confirmed'})}));
 });
 it('refuses actual membership revocation after a durable claim without a model send',async()=>{
  const f=await fixture();let writes=0;const expiry=Date.now()+60000;
  m.limits.mockImplementation(async()=>{
   const rows=await prisma.durableAgentWorkflow.findMany({where:{organizationId:f.org,workflowKind:'customer_hosted_token_call_v1'}});
   if(rows.some(row=>(row.stateJson as {status?:string}).status==='dispatched'))await prisma.orgMembership.updateMany({where:{organizationId:f.org,userId:f.actor},data:{acceptedAt:null}});
   return {reservedTokens:60,expiresAt:expiry,evidenceSha256:'b'.repeat(64)};
  });
  m.send.mockImplementation(async input=>{await input.beforeSend();writes++;return {data:{},raw:'{}',promptTokens:1,completionTokens:1,totalTokens:2}});
  const resolved=await resolveGovernedAiCall(f.org,'customer_hosted',f.actor,'local');if(!resolved.ok)throw Error('fixture unavailable');
  await expect(resolved.extract('input','shape','request-1')).rejects.toMatchObject({name:'AgentStreamInterrupted'});expect(writes).toBe(0);
  const row=await prisma.durableAgentWorkflow.findFirstOrThrow({where:{organizationId:f.org}});expect(row.stateJson).toMatchObject({status:'unknown',reservedTokens:60,reportedTokens:null});expect(m.cloud).not.toHaveBeenCalled();
 });
 it('refuses a missing workspace cap before any reservation or cloud path',async()=>{
  const f=await fixture();f.config.budgets=[];vi.stubEnv('AXIOM_LOCAL_MODEL_CONFIG',JSON.stringify(f.config));
  expect(await resolveGovernedAiCall(f.org,'customer_hosted',f.actor,'local')).toMatchObject({ok:false});expect(await prisma.durableAgentWorkflow.count({where:{organizationId:f.org}})).toBe(0);expect(m.send).not.toHaveBeenCalled();expect(m.cloud).not.toHaveBeenCalled();
 });
 it('preserves unknown liability after a single simulated transport failure',async()=>{
  const f=await fixture();m.send.mockImplementation(async input=>{await input.beforeSend();throw Error('simulated response lost')});
  const resolved=await resolveGovernedAiCall(f.org,'customer_hosted',f.actor,'local');if(!resolved.ok)throw Error('fixture unavailable');
  await expect(resolved.extract('input','shape','request-1')).rejects.toMatchObject({name:'AgentStreamInterrupted'});
  const row=await prisma.durableAgentWorkflow.findFirstOrThrow({where:{organizationId:f.org}});expect(row.stateJson).toMatchObject({status:'unknown',reservedTokens:60});expect(m.send).toHaveBeenCalledTimes(1);expect(m.cloud).not.toHaveBeenCalled();
 });
 it('runs the actual Agent decision loop with real identity/policy/membership/ledger and a simulated response',async()=>{
  const f=await fixture();await prisma.workspaceAgentIdentity.create({data:{organizationId:f.org,enabled:true,allowedTools:[],updatedBy:f.actor}});
  f.config.models[0]={...f.config.models[0],maxInputTokens:4096,maxOutputTokens:512,maxInputBytes:131072};f.config.budgets[0].limitTokens=10000;vi.stubEnv('AXIOM_LOCAL_MODEL_CONFIG',JSON.stringify(f.config));
  const expiry=Date.now()+60000;m.limits.mockResolvedValue({reservedTokens:4608,expiresAt:expiry,evidenceSha256:'b'.repeat(64)});
  m.send.mockImplementation(async input=>{await input.beforeSend();return {data:{action:'respond',message:'Done'},raw:'{}',promptTokens:200,completionTokens:20,totalTokens:220}});
  const tools=vi.fn();const outcome=await runDecisionLoop({organizationId:f.org,userId:f.actor,preferredProvider:'customer_hosted',preferredModel:'local',correlationId:'decision-1',transcript:[{role:'user',content:'Say Done'}],executeReadOnlyTool:tools,isProdEnvironmentTarget:async()=>false});
  expect(outcome).toMatchObject({kind:'final',message:'Done'});expect(tools).not.toHaveBeenCalled();expect(m.send).toHaveBeenCalledTimes(1);expect(m.cloud).not.toHaveBeenCalled();
  const row=await prisma.durableAgentWorkflow.findFirstOrThrow({where:{organizationId:f.org}});expect(row.stateJson).toMatchObject({status:'settled',reservedTokens:4608,reportedTokens:220});
 });

});
