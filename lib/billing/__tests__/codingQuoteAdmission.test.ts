import { beforeEach, expect, it, vi } from 'vitest';
const m=vi.hoisted(()=>({prepare:vi.fn(),quote:vi.fn(),reserve:vi.fn(),dispatch:vi.fn(),manager:vi.fn(),binding:vi.fn()}));
vi.mock('@/lib/db',()=>({prisma:{}}));
vi.mock('@/lib/workforce/pipelines/codingRunReservation',()=>({codingClaimBinding:m.binding,reserveQuotedCodingCall:m.reserve,dispatchQuotedCodingCall:m.dispatch}));
vi.mock('@/lib/ai/codingRequestQuote',()=>({prepareCodingRequestEnvelope:m.prepare,quoteCodingRequest:m.quote,consumeCodingManagerQuoteForRequest:m.manager}));
import {admitQuotedAIText,consumeGovernedTextAdmission,discardGovernedAIAdmission} from '../governedExtractAdmission';
const scope={organizationId:'org',userId:'actor',correlationId:'corr',source:'coding_proposal' as const,codingRunClaim:{} as never,codingPhase:'initial' as const,codingModel:'anthropic/claude-sonnet-5',idempotencyKey:'key'};
beforeEach(()=>{vi.resetAllMocks();m.binding.mockReturnValue({organizationId:'org',actorId:'actor',correlationId:'corr',runId:'run',stageRunId:'stage',generation:'generation'});m.prepare.mockImplementation(envelope=>({envelope,digest:'digest',payloadBytes:1}));m.quote.mockReturnValue({});m.reserve.mockResolvedValue({ok:true,reused:false,callId:'call',quoteReservation:{},reservation:{id:'hold'}});m.dispatch.mockResolvedValue({managerQuote:{}});m.manager.mockReturnValue({});});
it('derives the envelope from the actual claim and redacted complete request, then uses only quoted accounting',async()=>{
 const admitted=await admitQuotedAIText(scope,{prompt:'actual',system:''});
 expect(admitted.ok).toBe(true);expect(m.prepare).toHaveBeenCalledWith(expect.objectContaining({runId:'run',stageRunId:'stage',claimGeneration:'generation',prompt:'actual',system:'',maxOutputTokens:4096}));
 expect(m.reserve).toHaveBeenCalledWith(expect.anything(),scope.codingRunClaim,expect.objectContaining({organizationId:'org'}),expect.objectContaining({phase:'initial',prepared:expect.anything(),quote:expect.anything()}));
 expect(m.dispatch).toHaveBeenCalledOnce();
 if(!admitted.ok)throw Error('missing admission');
 const authority=consumeGovernedTextAdmission(admitted.admission,{organizationId:'org',correlationId:'corr',model:scope.codingModel,maxTokens:4096,temperature:0.2},{prompt:'actual',system:''});
 expect(authority.codingDispatch).toBeDefined();expect(m.manager).toHaveBeenCalledOnce();
 expect(()=>consumeGovernedTextAdmission(admitted.admission,scope,{prompt:'actual'})).toThrow();
});
it('does not reserve or downgrade when qualification refuses',async()=>{m.quote.mockImplementation(()=>{throw Error('coding_quote_qualification_unavailable')});await expect(admitQuotedAIText(scope,{prompt:'actual'})).rejects.toThrow('coding_quote_qualification_unavailable');expect(m.reserve).not.toHaveBeenCalled();expect(m.dispatch).not.toHaveBeenCalled();});
it('burns a quoted admission rather than letting streaming consume it without an exact payload',async()=>{const a=await admitQuotedAIText(scope,{prompt:'actual'});if(!a.ok)throw Error();expect(()=>consumeGovernedTextAdmission(a.admission,scope)).toThrow();expect(m.manager).not.toHaveBeenCalled();expect(()=>consumeGovernedTextAdmission(a.admission,scope,{prompt:'actual'})).toThrow();});

it('preserves absent system at preparation and burns wrong scope before manager authority',async()=>{const a=await admitQuotedAIText(scope,{prompt:'actual'});expect(Object.hasOwn(m.prepare.mock.calls[0][0],'system')).toBe(false);if(!a.ok)throw Error();expect(()=>consumeGovernedTextAdmission(a.admission,{organizationId:'foreign',correlationId:'corr'},{prompt:'actual'})).toThrow();expect(m.manager).not.toHaveBeenCalled();expect(()=>consumeGovernedTextAdmission(a.admission,scope,{prompt:'actual'})).toThrow();});

it('discard burns only opaque admission authority without creating a replacement or another hold',async()=>{const a=await admitQuotedAIText(scope,{prompt:'actual'});if(!a.ok)throw Error();discardGovernedAIAdmission(a.admission);discardGovernedAIAdmission(a.admission);expect(()=>consumeGovernedTextAdmission(a.admission,{organizationId:'org',correlationId:'corr'},{prompt:'actual'})).toThrow();expect(m.manager).not.toHaveBeenCalled();expect(m.reserve).toHaveBeenCalledOnce();expect(m.dispatch).toHaveBeenCalledOnce();});
