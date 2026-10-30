import {expect,it,vi} from 'vitest';
import {associatedTicketTransactionRepository} from '../associatedTicketTransactionBudget';
it('keeps the associated lifecycle transaction within a fixed budget and forwards its original transaction',async()=>{
 const tx={},repo:any={$queryRaw:vi.fn(),durableAgentWorkflow:{},durableAgentWorkflowEvent:{},$transaction:vi.fn(async(run:any)=>run(tx))};
 const actionRepo=associatedTicketTransactionRepository(repo),run=vi.fn(async(value)=>{expect(value).toBe(tx);return 'verified'});
 expect(await actionRepo.$transaction(run)).toBe('verified');expect(repo.$transaction).toHaveBeenCalledWith(run,{maxWait:2000,timeout:15000});expect(repo.$transaction).toHaveBeenCalledOnce();
 expect(actionRepo.durableAgentWorkflow).toBe(repo.durableAgentWorkflow);expect(actionRepo.durableAgentWorkflowEvent).toBe(repo.durableAgentWorkflowEvent);
});
it('propagates a refusal without a retry or committing a replacement operation',async()=>{
 const refused=Error('source changed'),repo:any={$queryRaw:vi.fn(),durableAgentWorkflow:{},durableAgentWorkflowEvent:{},$transaction:vi.fn(async()=>{throw refused})};
 await expect(associatedTicketTransactionRepository(repo).$transaction(async()=>undefined)).rejects.toBe(refused);expect(repo.$transaction).toHaveBeenCalledOnce();
});
