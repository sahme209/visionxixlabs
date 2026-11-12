import {it,expect,vi,afterEach} from 'vitest';
const mocks=vi.hoisted(()=>({offline:vi.fn(async()=>({ok:true,extract:async()=>({data:{ok:true}})})),credit:vi.fn(),manager:vi.fn(),catalog:vi.fn()}));
vi.mock('../customerHostedGovernedAiCall',()=>({resolveCustomerHostedGovernedAiCall:mocks.offline}));
vi.mock('@/lib/billing/checkWorkspaceAICredits',()=>({checkWorkspaceAICredits:mocks.credit}));
vi.mock('@/lib/ai/AIProviderManager',()=>({getAIProviderManager:mocks.manager}));
vi.mock('@/lib/ai/gatewayModelCatalog',async original=>({...await original<typeof import('@/lib/ai/gatewayModelCatalog')>(),loadGatewayModelCatalog:mocks.catalog}));
import {resolveGovernedAiCall} from '../governedAiCall';
afterEach(()=>{vi.unstubAllEnvs();vi.clearAllMocks()});
it('routes offline before cloud credit, manager or catalog access',async()=>{
 vi.stubEnv('AXIOM_OFFLINE_MODE','true');expect(await resolveGovernedAiCall('org','customer_hosted','actor','local')).toMatchObject({ok:true});expect(mocks.offline).toHaveBeenCalledOnce();expect(mocks.credit).not.toHaveBeenCalled();expect(mocks.manager).not.toHaveBeenCalled();expect(mocks.catalog).not.toHaveBeenCalled();
});
it('refuses malformed mode and online customer-hosted before cloud admission',async()=>{
 for(const mode of ['invalid','false']){
  vi.stubEnv('AXIOM_OFFLINE_MODE',mode);expect(await resolveGovernedAiCall('org','customer_hosted','actor','local')).toMatchObject({ok:false});
 }
 expect(mocks.offline).not.toHaveBeenCalled();expect(mocks.credit).not.toHaveBeenCalled();
});
