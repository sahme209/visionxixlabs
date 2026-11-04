import {expect,it} from 'vitest';
const modulePath='../codingRunBudget';
async function kernel() { return import(/* @vite-ignore */ modulePath).catch(()=>({})) as Promise<Record<string,any>>; }
it('counts full unresolved estimates, exact provider settlement, and excludes linked stage display totals',async()=>{
 const m=await kernel();expect(m.runBudgetExposure).toBeTypeOf('function');
 expect(m.runBudgetExposure([{status:'pending_settlement',estimatedCents:300,providerCents:null},{status:'settled',estimatedCents:300,providerCents:41}], [{costCents:41,linked:true},{costCents:12,linked:false}])).toBe(353);
});
it('refuses default1000 hold against500 cap and permits an exact inclusive boundary',async()=>{
 const m=await kernel();expect(m.assertRunAdmission).toBeTypeOf('function');
 expect(()=>m.assertRunAdmission(0,1000,500)).toThrow('coding_run_budget_exceeded');
 expect(()=>m.assertRunAdmission(250,250,500)).not.toThrow();
});
it('never converts unknown or malformed authoritative cost to zero',async()=>{
 const m=await kernel();expect(m.runBudgetExposure).toBeTypeOf('function');
 for(const row of [{status:'settled',estimatedCents:300,providerCents:null},{status:'expired',estimatedCents:300,providerCents:null},{status:'pending_settlement',estimatedCents:-1,providerCents:null}])expect(()=>m.runBudgetExposure([row],[])).toThrow();
 expect(m.runBudgetExposure([{status:'dispatch_unknown',estimatedCents:300,providerCents:null}],[])).toBe(300);
 expect(m.runBudgetExposure([{status:'released',estimatedCents:300,providerCents:null}],[])).toBe(0);
});
it('retains public coding reserved capacity past TTL while ordinary reservations expire',async()=>{
 const {allocatePublicCredits,makePublicCreditAttribution}=await import('@/lib/billing/publicCreditAllocation');
 const {publicFreeAllowanceCandidate}=await import('@/lib/billing/publicSubscriptionAllowance');
 const now=new Date('2026-10-22T12:00:00Z');
 const enrollment={organizationId:'org',id:'enroll',accountId:'acct_test',livemode:false,policy:'axiom_public_anniversary_v1' as const,legacyFreeMonth:'2026-10',legacyFreeUsedCents:0};
 const w=publicFreeAllowanceCandidate({policy:enrollment.policy,enrollmentId:enrollment.id,organizationId:'org'},now);if(w.kind!=='public_allowance_candidate')throw Error('fixture');
 const h={id:'hold',organizationId:'org',reservedCents:100,settledCents:null,status:'reserved',createdAt:now,expiresAt:new Date(now.getTime()-1),usageEventId:null,attribution:makePublicCreditAttribution('hold',w,[{source:'included',bucketId:w.bucketId,maxCents:100}],now),linkedUsageId:null,usageOrg:null,usageBilledCents:null,usageBillingStatus:null,codingHold:true};
 expect(allocatePublicCredits(enrollment,w,[h],[],now).heldCents).toBe(100);
 expect(allocatePublicCredits(enrollment,w,[{...h,codingHold:false}],[],now).heldCents).toBe(0);
});
it('only a successful queued-to-running compare-and-swap mints an opaque stage handle',async()=>{
 const path='../codingRunReservation';const m=await import(/* @vite-ignore */ path).catch(()=>({}));
 expect(m.claimCodingRunStage).toBeTypeOf('function');
 const seen:unknown[]=[];
 const tx={$queryRawUnsafe:async()=>[{id:'run',organizationId:'org',pipelineId:'ai_coding',status:'running',triggeredBy:'actor',correlationId:'correlation'}],pipelineStageRun:{updateMany:async(args:unknown)=>{seen.push(args);return {count:0};}}};
 const repo={$transaction:async(fn:Function)=>fn(tx)};
 expect(await m.claimCodingRunStage(repo,'org','run','stage')).toBeNull();
 expect(seen).toHaveLength(1);
 expect(seen[0]).toMatchObject({where:{id:'stage',runId:'run',stageKind:'code_propose',status:'queued',aiClaimGeneration:null},data:{status:'running',aiClaimGeneration:expect.any(String)}});
 tx.pipelineStageRun.updateMany=async()=>({count:1});
 const handle=await m.claimCodingRunStage(repo,'org','run','stage');expect(handle).toEqual({});expect(Object.isFrozen(handle)).toBe(true);
});
it('refuses released rows carrying provider cost instead of erasing exposure',async()=>{
 const m=await kernel();expect(()=>m.runBudgetExposure([{status:'released',estimatedCents:300,providerCents:1}],[])).toThrow('coding_run_budget_unavailable');
});
