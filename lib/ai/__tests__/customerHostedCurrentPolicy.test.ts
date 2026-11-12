import {it,expect,vi,beforeEach,afterEach} from 'vitest';
import {createCustomerHostedCurrentReader} from '../customerHostedCurrentPolicy';
import {parseCustomerHostedOperatorConfig} from '../customerHostedConfig';
beforeEach(()=>{vi.stubEnv('AXIOM_OFFLINE_MODE','true')});afterEach(()=>vi.unstubAllEnvs());
function fixture(){
 const now=Date.parse('2026-11-11T12:00:00.000Z');
 const config=parseCustomerHostedOperatorConfig(JSON.stringify({format:'axiom.customer-hosted/1',installationId:'install',revision:'r1',server:{kind:'vllm',baseUrl:'https://models.private.test/v1',allowedHosts:['models.private.test']},models:[{id:'local',maxInputTokens:100,maxOutputTokens:20,maxInputBytes:8192}],budgets:[{organizationId:'org',windowId:'w',startsAt:'2026-11-11T00:00:00.000Z',expiresAt:'2026-11-12T00:00:00.000Z',limitTokens:10000}]}))!;
 const row={enabled:true,allowedProviders:['customer_hosted'],modelSelections:{customer_hosted:'local'},fallbackOrder:[],now};
 const db={$queryRawUnsafe:vi.fn(async()=>[row])},readConfig=vi.fn(()=>config),readLimits=vi.fn(async()=>({reservedTokens:120,expiresAt:now+60000,evidenceSha256:'b'.repeat(64)}));
 return {now,config,row,db,readConfig,readLimits,read:createCustomerHostedCurrentReader({organizationId:'org',actorId:'actor'},{db,readConfig,readLimits})};
}
it('combines current membership/policy with accepted limits and explicit operator budget',async()=>{
 const f=fixture(),result=await f.read();expect(result).toMatchObject({modelId:'local',windowId:'w',reservedTokens:120,budgetLimitTokens:10000,expiresAt:f.now+60000});expect(f.db.$queryRawUnsafe).toHaveBeenCalledTimes(2);
 expect(f.db.$queryRawUnsafe.mock.calls[0].slice(1)).toEqual(['org','actor']);
});
it('refuses revoked membership/policy after awaited evidence IO',async()=>{
 const f=fixture();f.db.$queryRawUnsafe.mockResolvedValueOnce([f.row]).mockResolvedValueOnce([]);await expect(f.read()).rejects.toThrow();
});
it('refuses expired evidence at the final database clock and changed configuration',async()=>{
 const f=fixture();f.db.$queryRawUnsafe.mockResolvedValueOnce([f.row]).mockResolvedValueOnce([{...f.row,now:f.now+60000}]);await expect(f.read()).rejects.toThrow();
 const g=fixture();g.readConfig.mockReturnValueOnce(g.config).mockReturnValueOnce({...g.config,digest:'c'.repeat(64)});await expect(g.read()).rejects.toThrow();
});
it('never substitutes another model/provider or invents an opt-in or cap',async()=>{
 for(const delta of [{enabled:false},{allowedProviders:['vercel_gateway']},{allowedProviders:['customer_hosted','vercel_gateway']},{modelSelections:{}},{modelSelections:{customer_hosted:'unknown'}}]){
  const f=fixture();f.db.$queryRawUnsafe.mockResolvedValue([{...f.row,...delta}] as any);await expect(f.read()).rejects.toThrow();
 }
 const f=fixture();f.readConfig.mockReturnValue({...f.config,budgets:[]});await expect(f.read()).rejects.toThrow();
});
