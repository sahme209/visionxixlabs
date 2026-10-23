import {beforeEach,expect,it,vi} from 'vitest';
const m=vi.hoisted(()=>({reserve:vi.fn(),claim:vi.fn(),write:vi.fn(),transaction:vi.fn(),extract:vi.fn(),policy:vi.fn(),catalog:vi.fn(),identity:vi.fn(),credit:vi.fn(),stream:vi.fn()}));
vi.mock('@/lib/db',()=>({prisma:{$transaction:m.transaction}}));
vi.mock('@/lib/billing/aiCreditReservation',()=>({reserveAICredits:m.reserve,claimLegacyAICreditDispatch:m.claim}));
vi.mock('@/lib/billing/recordAIUsageEvent',()=>({recordAIUsageEvent:m.write,recordReservedAIUsageEventV2:vi.fn()}));
vi.mock('@/lib/billing/checkWorkspaceAICredits',()=>({checkWorkspaceAICredits:m.credit}));
vi.mock('@/lib/ai/workspaceProviderPolicy',async original=>({...await original<typeof import('@/lib/ai/workspaceProviderPolicy')>(),loadWorkspaceAIProviderPolicyWithState:m.policy}));
vi.mock('@/lib/ai/gatewayModelCatalog',async original=>({...await original<typeof import('@/lib/ai/gatewayModelCatalog')>(),loadGatewayModelCatalog:m.catalog}));
vi.mock('../agentIdentityPolicy',()=>({readWorkspaceAgentIdentity:m.identity}));
vi.mock('@/lib/ai/providers/VercelGatewayProvider',async original=>({...await original<typeof import('@/lib/ai/providers/VercelGatewayProvider')>(),VercelGatewayProvider:class{
 name='vercel_gateway';defaultModel='fixture/model';isConfigured(){return true;}generateStructuredTextOnce=m.extract;streamTextOnce=m.stream;
}}));
import {runDecisionLoop} from '../decisionLoop';
const envelope=(text:string,id='synthetic-generation')=>({provider:'vercel_gateway',model:'fixture/model',gatewayGenerationId:id,latencyMs:1,text,usage:{promptTokens:2,completionTokens:3,totalTokens:5}});
beforeEach(()=>{
 vi.resetAllMocks();
 m.credit.mockResolvedValue({kind:'allow'});m.catalog.mockResolvedValue([{id:'fixture/model'}]);
 m.policy.mockResolvedValue({storageState:'ready',policy:{enabled:true,allowedProviders:['vercel_gateway'],modelSelections:{vercel_gateway:'fixture/model'},fallbackOrder:['vercel_gateway']}});
 m.identity.mockResolvedValue({enabled:true,allowedTools:['list_environments']});
 m.reserve.mockImplementation(async(_repo,input)=>({ok:true,reused:false,reservation:{id:'hold-'+input.correlationId}}));m.claim.mockResolvedValue(true);
 m.transaction.mockImplementation(async fn=>fn({$queryRawUnsafe:vi.fn(async(_sql,id,organizationId)=>[{id,organizationId,status:'dispatch_unknown',usageEventId:null}]),usageEvent:{findUnique:vi.fn(async()=>null),create:vi.fn()},aIUsageReservation:{updateMany:vi.fn(async()=>({count:1}))}}));
 m.write.mockImplementation(async input=>({recorded:true,usageEventId:'usage-'+input.externalUsageId,pendingSettlement:true}));
 m.stream.mockImplementation(async function*(){const response=await m.extract();yield {done:false,text:response.text};yield {done:true,text:'',response:{...response,finishReason:'stop'}};});
 m.extract.mockResolvedValue(envelope(JSON.stringify({action:'respond',message:'Synthetic accounted answer'})));
});
function run(streaming=false){const tool=vi.fn();return {tool,promise:runDecisionLoop({organizationId:'org',userId:'member',correlationId:'journey',transcript:[{role:'user',content:'Explain the fixture'}],preferredProvider:'vercel_gateway',preferredModel:'fixture/model',...(streaming?{streaming:{abortSignal:new AbortController().signal,onDraft:vi.fn()}}:{}),executeReadOnlyTool:tool,isProdEnvironmentTarget:async()=>false})};}
it.each([false,true].flatMap(streaming=>['claim','dispatch','usage','writer'].map(kind=>({streaming,kind}))))('actual decision/admission/manager chain never repairs $kind uncertainty (streaming=$streaming)',async ({streaming,kind})=>{
 if(kind==='claim')m.claim.mockRejectedValue(new Error('synthetic uncertain claim'));
 if(kind==='dispatch')m.extract.mockRejectedValue(new Error('synthetic uncertain provider outcome'));
 if(kind==='usage')m.extract.mockResolvedValue({...envelope('{}'),usage:undefined});
 if(kind==='writer')m.write.mockResolvedValue({recorded:false});
 const {tool,promise}=run(streaming);await expect(promise).rejects.toMatchObject({name:'AgentStreamInterrupted'});
 expect(m.reserve).toHaveBeenCalledOnce();expect(m.claim).toHaveBeenCalledOnce();expect(m.extract).toHaveBeenCalledTimes(kind==='claim'?0:1);expect(tool).not.toHaveBeenCalled();
 expect(m.reserve.mock.calls[0][1].correlationId).toBe('journey:0');
});
it.each([false,true])('actual chain admits a distinct repair only after the malformed envelope is durably accounted (streaming=%s)',async streaming=>{
 m.extract.mockResolvedValueOnce(envelope('not JSON','synthetic-malformed')).mockResolvedValueOnce(envelope(JSON.stringify({action:'respond',message:'Synthetic repaired answer'}),'synthetic-repaired'));
 const {tool,promise}=run(streaming);await expect(promise).resolves.toMatchObject({kind:'final',message:'Synthetic repaired answer',usage:{decisionSteps:2,inputTokens:4,outputTokens:6,totalTokens:10}});
 expect(m.reserve).toHaveBeenCalledTimes(2);expect(m.claim).toHaveBeenCalledTimes(2);expect(m.extract).toHaveBeenCalledTimes(2);expect(m.write).toHaveBeenCalledTimes(2);expect(tool).not.toHaveBeenCalled();
 expect(m.reserve.mock.calls.map(([,input])=>input.correlationId)).toEqual(['journey:0','journey:0:repair']);
 expect(m.reserve.mock.calls[0][1].idempotencyKey).not.toBe(m.reserve.mock.calls[1][1].idempotencyKey);
 expect(m.write.mock.invocationCallOrder[0]).toBeLessThan(m.reserve.mock.invocationCallOrder[1]);
});
it.each([false,true])('includes both accounted malformed attempts in a refused decision receipt (streaming=%s)',async streaming=>{
 m.extract.mockResolvedValueOnce(envelope('PRIVATE malformed response','synthetic-malformed-1')).mockResolvedValueOnce(envelope('PRIVATE second response','synthetic-malformed-2'));
 const {tool,promise}=run(streaming);const result=await promise;
 expect(result).toEqual({kind:'error',error:'decision_malformed',usage:{decisionSteps:2,inputTokens:4,outputTokens:6,totalTokens:10}});
 expect(JSON.stringify(result)).not.toContain('PRIVATE');expect(m.extract).toHaveBeenCalledTimes(2);expect(tool).not.toHaveBeenCalled();
});
it.each([false,true])('keeps a missing provider total unknown across repair (streaming=%s)',async streaming=>{
 m.extract.mockResolvedValueOnce({...envelope('not JSON','synthetic-malformed'),usage:{promptTokens:2,completionTokens:3}});
 const {promise}=run(streaming);await expect(promise).resolves.toMatchObject({kind:'final',usage:{decisionSteps:2,inputTokens:4,outputTokens:6,totalTokens:null}});
});
