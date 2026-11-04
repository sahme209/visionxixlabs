import { beforeEach, expect, it, vi } from 'vitest';
const io=vi.hoisted(()=>({reserve:vi.fn(),legacyClaim:vi.fn(),v2Claim:vi.fn()}));
vi.mock('@/lib/billing/aiCreditReservation',()=>({reserveAICreditsInTransaction:io.reserve,claimLegacyAICreditDispatch:io.legacyClaim}));
vi.mock('@/lib/billing/newTestSubscription/usageAllocationIO',()=>({claimNewTestBillableDispatch:io.v2Claim}));
vi.mock('@/lib/db',()=>({prisma:{}}));
import {claimCodingRunStage,reserveCodingCall,dispatchCodingCall,lockCodingFinancial,createIsolatedQuotedCodingCoordinator,reserveQuotedCodingCall} from '../codingRunReservation';
import {prepareCodingRequestEnvelope,parseSyntheticCodingPricing,createIsolatedCodingQuoteProtocol} from '@/lib/ai/codingRequestQuote';
const scope={organizationId:'org',userId:'actor',correlationId:'corr'};
function fixture(){
 const run={id:'run',organizationId:'org',pipelineId:'ai_coding',status:'running',triggeredBy:'actor',correlationId:'corr',metadata:{maxCostCents:5000}};
 const stage={id:'stage',runId:'run',stageKind:'code_propose',status:'queued',aiClaimGeneration:null as string|null,startedAt:null as Date|null,costCents:0};
 const calls:any[]=[];let databaseNow=new Date();
 const tx:any={
  $queryRawUnsafe:vi.fn(async(sql:string)=>sql.includes('clock_timestamp()')?[{now:databaseNow}]:sql.includes('OrgMembership')?[{acceptedAt:new Date()}]:sql.includes('PipelineStageRun')?[stage]:[run]),
  pipelineRun:{findUnique:vi.fn(async()=>run)},
  pipelineStageRun:{updateMany:vi.fn(async({data}:any)=>{Object.assign(stage,data);return{count:1}}),findMany:vi.fn(async()=>[stage])},
  pipelineAICallReservation:{findMany:vi.fn(async()=>[]),findFirst:vi.fn(async()=>null),findUnique:vi.fn(async({where}:any)=>calls.find(c=>c.id===where.id||c.workspaceReservationId===where.workspaceReservationId)||null),create:vi.fn(async({data}:any)=>{const call={...data,id:'call',status:'reserved',usageEventId:null,dispatchedAt:null,quoteEvidence:data.admissionContract==='coding_fixed_hold_v1'?null:data.quoteEvidence};calls.push(call);return call}),updateMany:vi.fn(async({where,data}:any)=>{const row=calls.find(c=>c.id===where.id);if(row)Object.assign(row,data);return{count:1}})},
  aIUsageReservation:{findUnique:vi.fn(async()=>{const c=calls[0];return c?{id:c.workspaceReservationId,organizationId:c.organizationId,idempotencyKey:c.idempotencyKey,correlationId:c.correlationId,reservedCents:c.estimatedCents}:null;})},
  organizationBudgetConfig:{findUnique:vi.fn(async()=>null)},
  organizationAIProviderPolicy:{findUnique:vi.fn(async()=>({enabled:true,allowedProviders:['vercel_gateway'],modelSelections:{vercel_gateway:'anthropic/claude-sonnet-5'},fallbackOrder:['vercel_gateway']}))},
 };
 const repo:any={$transaction:vi.fn(async(fn:any)=>fn(tx))};
 return{repo,tx,run,stage,calls,setClock:(now:Date)=>{databaseNow=now;}};
}
beforeEach(()=>{vi.resetAllMocks();io.reserve.mockImplementation(async(_tx,input)=>({ok:true,reused:false,reservation:{id:'hold',reservedCents:input.reservedCents}}));io.legacyClaim.mockResolvedValue(true);io.v2Claim.mockResolvedValue(true)});
it('records fixed admission discriminator and null evidence without changing its hold',async()=>{
 const f=fixture(),claim=await claimCodingRunStage(f.repo,'org','run','stage');
 await reserveCodingCall(f.repo,claim!,scope,{idempotencyKey:'fixed',phase:'initial',model:'anthropic/claude-sonnet-5',estimatedCents:100});
 expect(f.tx.pipelineAICallReservation.create).toHaveBeenCalledWith({data:expect.objectContaining({admissionContract:'coding_fixed_hold_v1',quoteEvidence:expect.anything(),estimatedCents:100})});
 expect(io.reserve).toHaveBeenCalledWith(f.tx,expect.objectContaining({reservedCents:100}),expect.any(Date),undefined);
});
it('fixed dispatch cannot downgrade a quoted row',async()=>{
 const f=fixture(),claim=await claimCodingRunStage(f.repo,'org','run','stage');
 f.calls.push({id:'call',organizationId:'org',runId:'run',stageRunId:'stage',claimGeneration:f.stage.aiClaimGeneration,actorId:'actor',status:'reserved',usageEventId:null,workspaceReservationId:'hold',allocationPolicy:null,admissionContract:'coding_request_quote_v1',quoteEvidence:{forged:true}});
 await expect(dispatchCodingCall(f.repo,claim!,scope,'call','anthropic/claude-sonnet-5')).rejects.toThrow();
 expect(io.legacyClaim).not.toHaveBeenCalled();
});
it('financial reader rejects unknown admission discriminator instead of repricing it',async()=>{
 const f=fixture();f.calls.push({id:'call',organizationId:'org',runId:'run',workspaceReservationId:'hold',estimatedCents:100,admissionContract:'unknown',quoteEvidence:null});
 f.tx.pipelineAICallReservation.findMany.mockResolvedValue(f.calls);
 await expect(lockCodingFinancial(f.tx,'hold')).rejects.toThrow();
});

async function quotedFixture(){
 const f=fixture(),claim=await claimCodingRunStage(f.repo,'org','run','stage');
 const now=Date.now();f.setClock(new Date(now));
 const prepared=prepareCodingRequestEnvelope({...scope,runId:'run',stageRunId:'stage',claimGeneration:f.stage.aiClaimGeneration,phase:'initial',idempotencyKey:'quoted',task:'generate_text',model:'anthropic/claude-sonnet-5',prompt:'synthetic code',temperature:0.2,maxOutputTokens:4096,maxRetries:0,adapterContract:'coding_gateway_text_v1',routing:{only:['anthropic'],thinking:'disabled',region:'default',cache:'none'}});
 const protocol=createIsolatedCodingQuoteProtocol(),coordinator=createIsolatedQuotedCodingCoordinator(protocol);
 const pricing=parseSyntheticCodingPricing({schema:'synthetic_coding_pricing_v1',model:prepared.envelope.model,currency:'USD',unit:'nano_dollars_per_token',inputRate:'3000',outputRate:'15000',requestFee:'0',ancillaryFee:'0',route:'anthropic',region:'default',retrievedAt:now,expiresAt:now+120000});
 const quote=protocol.quote(prepared,pricing,1000,now);
 return{...f,claim:claim!,now,prepared,quote,protocol,coordinator,input:{idempotencyKey:'quoted',phase:'initial' as const,prepared,quote}};
}
it.each([null,'axiom_public_anniversary_v1','axiom_test_anniversary_v2'])('uses the same quoted H before one dispatch on allocation %s',async allocationPolicy=>{
 const f=await quotedFixture();io.reserve.mockImplementation(async(_tx,input)=>({ok:true,reused:false,reservation:{id:'hold',reservedCents:input.reservedCents},allocationPolicy}));
 const held=await f.coordinator.reserveQuotedCodingCall(f.repo,f.claim,scope,f.input);
 expect(held.callId).toBe('call');
 const row=f.calls[0];expect(row.admissionContract).toBe('coding_request_quote_v1');expect(row.estimatedCents).toBe(row.quoteEvidence.reservedCents);
 expect(io.reserve).toHaveBeenCalledWith(f.tx,expect.objectContaining({reservedCents:row.estimatedCents}),expect.any(Date),undefined);
 const result=await f.coordinator.dispatchQuotedCodingCall(f.repo,f.claim,scope,held.callId,f.prepared,held.quoteReservation);
 expect(result.managerQuote).toBeDefined();expect(row.status).toBe('dispatch_unknown');
 expect(allocationPolicy==='axiom_test_anniversary_v2'?io.v2Claim:io.legacyClaim).toHaveBeenCalledTimes(1);
 await expect(f.coordinator.dispatchQuotedCodingCall(f.repo,f.claim,scope,held.callId,f.prepared,held.quoteReservation)).rejects.toThrow();
});
it('canonical coordinator refuses synthetic quotes before funding',async()=>{
 const f=await quotedFixture();await expect(reserveQuotedCodingCall(f.repo,f.claim,scope,f.input)).rejects.toThrow();expect(io.reserve).not.toHaveBeenCalled();
});
it('expiry while funding awaits prevents companion creation and cannot reuse quote',async()=>{
 const f=await quotedFixture();io.reserve.mockImplementation(async(_tx,input)=>{f.setClock(new Date(f.now+120000));return{ok:true,reused:false,reservation:{id:'hold',reservedCents:input.reservedCents}}});
 await expect(f.coordinator.reserveQuotedCodingCall(f.repo,f.claim,scope,f.input)).rejects.toThrow();expect(f.tx.pipelineAICallReservation.create).not.toHaveBeenCalled();
 f.setClock(new Date(f.now));await expect(f.coordinator.reserveQuotedCodingCall(f.repo,f.claim,scope,f.input)).rejects.toThrow();expect(io.reserve).toHaveBeenCalledTimes(1);
});
it('expiry during funding claim prevents durable dispatch transition and retry authority',async()=>{
 const f=await quotedFixture(),held=await f.coordinator.reserveQuotedCodingCall(f.repo,f.claim,scope,f.input);
 io.legacyClaim.mockImplementation(async()=>{f.setClock(new Date(f.now+120000));return true});
 await expect(f.coordinator.dispatchQuotedCodingCall(f.repo,f.claim,scope,held.callId,f.prepared,held.quoteReservation)).rejects.toThrow();
 expect(f.tx.pipelineAICallReservation.updateMany).not.toHaveBeenCalled();
 f.setClock(new Date(f.now));await expect(f.coordinator.dispatchQuotedCodingCall(f.repo,f.claim,scope,held.callId,f.prepared,held.quoteReservation)).rejects.toThrow();expect(io.legacyClaim).toHaveBeenCalledTimes(1);
});
it('removing quote evidence cannot downgrade the exact reserved dispatch',async()=>{
 const f=await quotedFixture(),held=await f.coordinator.reserveQuotedCodingCall(f.repo,f.claim,scope,f.input);
 f.calls[0].admissionContract='coding_fixed_hold_v1';f.calls[0].quoteEvidence=null;
 await expect(f.coordinator.dispatchQuotedCodingCall(f.repo,f.claim,scope,held.callId,f.prepared,held.quoteReservation)).rejects.toThrow();expect(io.legacyClaim).not.toHaveBeenCalled();
});
it('expired historical evidence remains financial history but scope-copy and changed H refuse',async()=>{
 const f=await quotedFixture(),held=await f.coordinator.reserveQuotedCodingCall(f.repo,f.claim,scope,f.input);
 f.tx.pipelineAICallReservation.findMany.mockResolvedValue(f.calls);f.setClock(new Date(f.now+240000));
 expect((await lockCodingFinancial(f.tx,'hold'))?.id).toBe(held.callId);
 f.calls[0].runId='other';await expect(lockCodingFinancial(f.tx,'hold')).rejects.toThrow();
 f.calls[0].runId='run';f.calls[0].estimatedCents++;await expect(lockCodingFinancial(f.tx,'hold')).rejects.toThrow();
});

it('financial reader rejects a workspace hold with a smaller amount than quoted H',async()=>{
 const f=await quotedFixture();await f.coordinator.reserveQuotedCodingCall(f.repo,f.claim,scope,f.input);
 f.tx.pipelineAICallReservation.findMany.mockResolvedValue(f.calls);
 f.tx.aIUsageReservation.findUnique.mockResolvedValue({id:'hold',organizationId:'org',idempotencyKey:'quoted',correlationId:'corr',reservedCents:1});
 await expect(lockCodingFinancial(f.tx,'hold')).rejects.toThrow();
});
it('does not construct the synthetic coordinator in a production runtime',()=>{
 vi.stubEnv('NODE_ENV','production');
 try{expect(()=>createIsolatedQuotedCodingCoordinator(createIsolatedCodingQuoteProtocol())).toThrow();}
 finally{vi.unstubAllEnvs();}
});
it('refuses a backwards DB clock after funding even while both readings are inside the TTL',async()=>{
 const f=await quotedFixture();f.setClock(new Date(f.now+20));
 io.reserve.mockImplementation(async(_tx,input)=>{f.setClock(new Date(f.now+10));return{ok:true,reused:false,reservation:{id:'hold',reservedCents:input.reservedCents}}});
 await expect(f.coordinator.reserveQuotedCodingCall(f.repo,f.claim,scope,f.input)).rejects.toThrow();
 expect(f.tx.pipelineAICallReservation.create).not.toHaveBeenCalled();
});
it('refuses DB/server skew above one second without changing quote TTL',async()=>{
 const f=await quotedFixture();f.setClock(new Date(f.now+5000));
 await expect(f.coordinator.reserveQuotedCodingCall(f.repo,f.claim,scope,f.input)).rejects.toThrow();
 expect(io.reserve).not.toHaveBeenCalled();
});
it('retains the post-funding DB observation across the reservation and dispatch boundary',async()=>{
 const f=await quotedFixture();
 io.reserve.mockImplementation(async(_tx,input)=>{f.setClock(new Date(f.now+30));return{ok:true,reused:false,reservation:{id:'hold',reservedCents:input.reservedCents}}});
 const held=await f.coordinator.reserveQuotedCodingCall(f.repo,f.claim,scope,f.input);
 f.setClock(new Date(f.now+20));
 await expect(f.coordinator.dispatchQuotedCodingCall(f.repo,f.claim,scope,held.callId,f.prepared,held.quoteReservation)).rejects.toThrow();
 expect(io.legacyClaim).not.toHaveBeenCalled();
});
it('refuses a DB rewind during the workspace dispatch claim without returning manager authority',async()=>{
 const f=await quotedFixture(),held=await f.coordinator.reserveQuotedCodingCall(f.repo,f.claim,scope,f.input);
 f.setClock(new Date(f.now+40));io.legacyClaim.mockImplementation(async()=>{f.setClock(new Date(f.now+30));return true});
 await expect(f.coordinator.dispatchQuotedCodingCall(f.repo,f.claim,scope,held.callId,f.prepared,held.quoteReservation)).rejects.toThrow();
 expect(f.tx.pipelineAICallReservation.updateMany).not.toHaveBeenCalled();
});
it('refuses a DB rewind during policy reads before funding starts',async()=>{
 const f=await quotedFixture();f.setClock(new Date(f.now+20));
 const read=f.tx.$queryRawUnsafe.getMockImplementation();
 f.tx.$queryRawUnsafe.mockImplementation(async(sql:string,...args:unknown[])=>{const result=await read(sql,...args);if(sql.includes('OrgMembership'))f.setClock(new Date(f.now+10));return result;});
 await expect(f.coordinator.reserveQuotedCodingCall(f.repo,f.claim,scope,f.input)).rejects.toThrow();expect(io.reserve).not.toHaveBeenCalled();
});
it('refuses a backwards server clock inside the TTL while DB time stays monotone',async()=>{
 const f=await quotedFixture();f.setClock(new Date(f.now+20));
 const now=vi.spyOn(Date,'now').mockReturnValue(f.now+20);
 io.reserve.mockImplementation(async(_tx,input)=>{now.mockReturnValue(f.now+10);return{ok:true,reused:false,reservation:{id:'hold',reservedCents:input.reservedCents}}});
 try{await expect(f.coordinator.reserveQuotedCodingCall(f.repo,f.claim,scope,f.input)).rejects.toThrow();expect(f.tx.pipelineAICallReservation.create).not.toHaveBeenCalled();}
 finally{now.mockRestore();}
});
