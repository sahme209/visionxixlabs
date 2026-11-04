import {beforeEach,expect,it,vi} from 'vitest';
const coding=vi.hoisted(()=>({lock:vi.fn(),settle:vi.fn()}));
vi.mock('server-only',()=>({}));
vi.mock('@/lib/db',()=>({prisma:{}}));
vi.mock('ai',()=>({gateway:{getGenerationInfo:vi.fn()}}));
vi.mock('@/lib/workforce/pipelines/codingRunReservation',()=>({lockCodingFinancial:coding.lock,settleCodingLedger:coding.settle,codingBudgetUnavailable:()=>{throw Error('coding_run_budget_unavailable')}}));
import {settleGatewayGenerationInTransaction,type GatewayGenerationUsage} from '../reconcileGatewayUsage';
const event={id:'usage',externalUsageId:'generation'};
const receipt=(totalCost:number):GatewayGenerationUsage=>({id:'generation',totalCost,model:'synthetic/model',providerName:'synthetic',promptTokens:5,completionTokens:2,cachedTokens:0});
beforeEach(()=>vi.resetAllMocks());
it.each([[0,0],[-0,0],[0.07,7],[0.07000000000000002,8],[0.012,2],[1e-7,1],[Number.MIN_VALUE,1],[1e-2,1],[1.23,123],[1.0000000000000002,101],[0.010000000000000002,2]])('settles canonical decimal USD %s as %s cents without binary rounding inflation',async(usd,cents)=>{
 const updateMany=vi.fn().mockResolvedValue({count:1});
 await settleGatewayGenerationInTransaction({usageEvent:{findMany:vi.fn(),updateMany}},event,receipt(usd));
 expect(updateMany).toHaveBeenCalledWith(expect.objectContaining({data:expect.objectContaining({costCents:cents,billingStatus:'settled'})}));
});
it.each([-1,NaN,Infinity,-Infinity,Number.MAX_VALUE,Number.MAX_SAFE_INTEGER])('refuses invalid or unsafe receipt cost %s before any ledger write',async usd=>{
 const updateMany=vi.fn();
 await expect(settleGatewayGenerationInTransaction({usageEvent:{findMany:vi.fn(),updateMany}},event,receipt(usd))).rejects.toThrow();
 expect(updateMany).not.toHaveBeenCalled();
});
it('does not silently reprice historical settled eight-cent evidence when a new seven-cent receipt is observed',async()=>{
 const updateUsage=vi.fn(),updateHold=vi.fn();
 const tx:any={
  $queryRawUnsafe:vi.fn(),
  usageEvent:{findUnique:vi.fn().mockResolvedValue({billingStatus:'settled',costCents:8,billedCents:12,model:'synthetic/model',inputTokens:5,outputTokens:2,cachedReadTokens:0}),updateMany:updateUsage},
  aIUsageReservation:{findUnique:vi.fn().mockResolvedValue({id:'hold',organizationId:'org',reservedCents:17}),updateMany:updateHold},
 };
 coding.lock.mockResolvedValue({status:'settled',externalUsageId:'generation',providerCents:8});
 await expect(settleGatewayGenerationInTransaction(tx,event,receipt(0.07))).rejects.toThrow('coding_run_budget_unavailable');
 expect(updateUsage).not.toHaveBeenCalled();expect(updateHold).not.toHaveBeenCalled();expect(coding.settle).not.toHaveBeenCalled();
});

it('records the Number-interface precision limit rather than pretending to recover a lost JSON decimal lexeme',()=>{
 expect(0.07000000000000001).toBe(0.07);
 expect((0.07000000000000001).toString()).toBe('0.07');
 expect((0.07000000000000002).toString()).toBe('0.07000000000000002');
});
