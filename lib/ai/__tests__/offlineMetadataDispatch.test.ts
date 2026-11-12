import {afterEach,it,expect,vi} from 'vitest';
import {prepareSmallSonnetRequest,SMALL_SONNET_MODEL} from '@/lib/billing/smallSonnetRequest';
import {prepareSmallSonnet55Request,SMALL_SONNET_55_MODEL} from '@/lib/billing/smallSonnet55Request';
import {reconcilePendingGatewayUsage} from '@/lib/billing/reconcileGatewayUsage';
afterEach(()=>{vi.unstubAllEnvs();vi.unstubAllGlobals()});
it.each([[prepareSmallSonnetRequest,SMALL_SONNET_MODEL],[prepareSmallSonnet55Request,SMALL_SONNET_55_MODEL]])('refuses endpoint metadata acquisition offline before fetch',async(prepare,model)=>{
 vi.stubEnv('AXIOM_OFFLINE_MODE','true');const fetcher=vi.fn(async()=>Response.json({}));vi.stubGlobal('fetch',fetcher);
 await expect(prepare({organizationId:'org',userId:'actor',correlationId:'request'},{model,text:'private',schemaHint:'shape'})).rejects.toThrow('installation_cloud_ai_unavailable');expect(fetcher).not.toHaveBeenCalled();
});
it('does not read pending liabilities or call Gateway lookup in offline mode',async()=>{
 vi.stubEnv('AXIOM_OFFLINE_MODE','true');const find=vi.fn(async()=>[]),lookup=vi.fn();
 await expect(reconcilePendingGatewayUsage({usageEvent:{findMany:find}} as any,lookup)).rejects.toThrow('installation_cloud_ai_unavailable');expect(find).not.toHaveBeenCalled();expect(lookup).not.toHaveBeenCalled();
});
it('retains pending liabilities when mode changes while the pending read is awaited',async()=>{
 vi.stubEnv('AXIOM_OFFLINE_MODE','false');const lookup=vi.fn(),transaction=vi.fn();
 const repository={usageEvent:{findMany:vi.fn(async()=>{vi.stubEnv('AXIOM_OFFLINE_MODE','true');return [{id:'usage1',externalUsageId:'gen_1'}]})},$transaction:transaction};
 await reconcilePendingGatewayUsage(repository as any,lookup);expect(lookup).not.toHaveBeenCalled();expect(transaction).not.toHaveBeenCalled();
});
