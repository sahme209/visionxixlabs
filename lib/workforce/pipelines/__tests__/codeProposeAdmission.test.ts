import {beforeEach,expect,it,vi} from "vitest";
const m=vi.hoisted(()=>({admit:vi.fn(),generate:vi.fn(),admitted:vi.fn(),load:vi.fn(),record:vi.fn(),policy:undefined as unknown,usage:vi.fn()}));
vi.mock("@/lib/billing/checkWorkspaceAICredits",()=>({checkWorkspaceAICredits:async()=>({kind:'allow'})}));
vi.mock("@/lib/billing/governedExtractAdmission",()=>({admitAIText:m.admit}));
vi.mock("@/lib/billing/recordAIUsageEvent",()=>({recordAIUsageEvent:m.record}));
vi.mock("@/lib/audit/secureAudit",()=>({record:vi.fn()}));
vi.mock("@/lib/ai/AIProviderManager",()=>({getAIProviderManager:()=>({isServiceProviderAvailable:()=>true,status:()=>[{provider:'vercel_gateway',configured:true}],generateText:m.generate,generateTextWithAdmission:m.admitted})}));
vi.mock("@/lib/ai/workspaceProviderPolicy",()=>({loadWorkspaceAIProviderPolicyWithState:m.load,resolveWorkspaceAIProviderPolicy:({stored}:{stored:unknown})=>stored}));
vi.mock("@/lib/db",()=>({prisma:{pipelineStageRun:{findFirst:async()=>null,aggregate:async()=>({_sum:{costCents:0}})},usageEvent:{findUnique:m.usage}}}));
vi.mock("../budgetConfigStore",()=>({loadBudgetConfig:async()=>({})}));
import {codeProposeRealExecutor} from "../codeProposeRealExecutor";
const patch='--- a/file.txt\n+++ b/file.txt\n@@ -1 +1 @@\n-old\n+new\n';
const reply=(text=patch,generation='synthetic_generation')=>({text,provider:'vercel_gateway',model:'anthropic/claude-sonnet-5',gatewayGenerationId:generation,usage:{promptTokens:10,completionTokens:5,totalTokens:15},finishReason:'stop'});
const context={organizationId:'owned_org',runId:'owned_run',stageRunId:'owned_stage',pipelineId:'owned_pipeline',stageId:'owned_propose',stageKind:'code_propose' as const,correlationId:'owned_correlation',triggeredBy:'owned_user',runMetadata:{instruction:'prepare a proposal',repoRef:'owned/repo'}};
beforeEach(()=>{vi.resetAllMocks();m.policy={enabled:true,allowedProviders:['vercel_gateway'],modelSelections:{vercel_gateway:'anthropic/claude-sonnet-5'},fallbackOrder:['vercel_gateway']};m.load.mockImplementation(async()=>({storageState:'ready',policy:m.policy}));m.admit.mockResolvedValue({ok:true,admission:{synthetic:true}});m.generate.mockResolvedValue(reply());m.admitted.mockResolvedValue(reply());m.record.mockResolvedValue({recorded:true,usageEventId:'owned_usage',pendingSettlement:true});m.usage.mockResolvedValue({id:'owned_usage',organizationId:'owned_org',provider:'vercel_gateway',model:'anthropic/claude-sonnet-5',inputTokens:10,outputTokens:5});});
it('never calls a provider after atomic admission refuses the request',async()=>{
 m.admit.mockResolvedValue({ok:false,error:'ai_credit_pool_exhausted'});expect((await codeProposeRealExecutor(context)).ok).toBe(false);expect(m.generate).not.toHaveBeenCalled();expect(m.admitted).not.toHaveBeenCalled();
});
it('uses distinct stable reservations for the first attempt and bounded refinement',async()=>{
 m.generate.mockResolvedValueOnce(reply('synthetic malformed patch','synthetic_first')).mockResolvedValueOnce(reply(patch,'synthetic_second'));m.admitted.mockResolvedValueOnce(reply('synthetic malformed patch','synthetic_first')).mockResolvedValueOnce(reply(patch,'synthetic_second'));
 expect((await codeProposeRealExecutor(context)).ok).toBe(true);expect(m.admit).toHaveBeenCalledTimes(2);expect(m.admitted).toHaveBeenCalledTimes(2);expect(m.generate).not.toHaveBeenCalled();
 const keys=m.admit.mock.calls.map(([input])=>input.idempotencyKey);expect(new Set(keys).size).toBe(2);expect(keys.every(key=>typeof key==='string'&&key.length>=16&&key.length<=200)).toBe(true);
});
it('does not buy a refinement after workspace AI is disabled during the first attempt',async()=>{
 const first=async()=>{m.policy={enabled:false,allowedProviders:[],modelSelections:{},fallbackOrder:[]};return reply('synthetic malformed patch');};m.generate.mockImplementationOnce(first).mockResolvedValue(reply());m.admitted.mockImplementationOnce(first).mockResolvedValue(reply());
 expect((await codeProposeRealExecutor(context)).ok).toBe(false);expect(m.admitted).toHaveBeenCalledTimes(1);expect(m.admit).toHaveBeenCalledTimes(1);expect(m.generate).not.toHaveBeenCalled();
});
it('retains the first accounted attempt when refinement admission is refused',async()=>{
 m.admit.mockResolvedValueOnce({ok:true,admission:{synthetic:true}}).mockResolvedValueOnce({ok:false,error:'ai_credit_pool_exhausted'});m.generate.mockResolvedValueOnce(reply('synthetic malformed patch')).mockResolvedValue(reply());m.admitted.mockResolvedValueOnce(reply('synthetic malformed patch')).mockResolvedValue(reply());
 expect((await codeProposeRealExecutor(context)).ok).toBe(false);expect(m.admitted).toHaveBeenCalledTimes(1);expect(m.generate).not.toHaveBeenCalled();
});
