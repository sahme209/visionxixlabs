import {it,expect,vi,beforeEach} from 'vitest';
import {NextRequest} from 'next/server';
const m=vi.hoisted(()=>({unenrolled:vi.fn(),load:vi.fn(),save:vi.fn()}));
vi.mock('@/lib/governance/intelligence/enrolledRefusal',()=>({workspaceUnenrolled:m.unenrolled}));
vi.mock('@/lib/auth/currentContext',()=>({currentContext:async()=>({isAuthenticated:true,organizationId:'org',userId:'owner',roles:['owner']})}));
vi.mock('@/lib/auth/platformAdmin',()=>({isAdminOrOwner:()=>true}));
vi.mock('@/lib/desktop/resolveRequestDesktopSession',()=>({resolveRequestDesktopSession:async()=>({organizationId:'org',userId:'owner'})}));
vi.mock('@/lib/ai/AIProviderManager',()=>({getAIProviderManager:()=>({status:()=>[{provider:'vercel_gateway',configured:true}]})}));
vi.mock('@/lib/ai/gatewayModelCatalog',async original=>({...await original<typeof import('@/lib/ai/gatewayModelCatalog')>(),loadGatewayModelCatalog:async()=>[{id:'xai/grok-4'}]}));
vi.mock('@/lib/ai/workspaceProviderPolicy',async original=>({...await original<typeof import('@/lib/ai/workspaceProviderPolicy')>(),loadWorkspaceAIProviderPolicyWithState:m.load,saveWorkspaceAIProviderPolicy:m.save}));
vi.mock('@/lib/audit/secureAudit',()=>({record:async()=>{}}));
vi.mock('@/lib/releaseops/auditEventResponder',()=>({appendAuditEvent:async()=>{}}));
import {PUT as account} from '@/app/api/account/ai-policy/route';
import {PUT as desktop} from '@/app/api/desktop/ai-providers/route';
beforeEach(()=>{vi.clearAllMocks();m.unenrolled.mockResolvedValue(false);m.load.mockResolvedValue({storageState:'ready',policy:null});m.save.mockResolvedValue(undefined)});
for(const [name,route] of [['account',account],['desktop',desktop]] as const){
 it(`${name} refuses widening before persistence when enrolled`,async()=>{
  const body={enabled:true,allowedProviders:['vercel_gateway'],modelSelections:{vercel_gateway:'xai/grok-4'},fallbackOrder:[]};
  const result=await route(new NextRequest('https://visionxixlabs.com/api/policy',{method:'PUT',headers:{origin:'https://visionxixlabs.com','content-type':'application/json'},body:JSON.stringify(body)}));
  expect(result.status).toBe(409);expect(m.save).not.toHaveBeenCalled();
 });
 it(`${name} still allows disabling while enrolled`,async()=>{
  const result=await route(new NextRequest('https://visionxixlabs.com/api/policy',{method:'PUT',headers:{origin:'https://visionxixlabs.com','content-type':'application/json'},body:JSON.stringify({enabled:false,allowedProviders:[],modelSelections:{},fallbackOrder:[]})}));
  expect(result.status).toBe(200);expect(m.save).toHaveBeenCalledOnce();
 });
}
it('treats changing an approved customer-hosted model as increased reach',async()=>{
 const {providerPolicyChangeRefusal}=await import('../workspacePolicyChange');
 const before={enabled:true,allowedProviders:['customer_hosted'],modelSelections:{customer_hosted:'local-a'},fallbackOrder:[]};
 m.load.mockResolvedValue({storageState:'ready',policy:before});
 expect(await providerPolicyChangeRefusal('org',{...before,modelSelections:{customer_hosted:'local-b'}} as any)).toBe('governance_enrolled_policy_loosening');
 expect(await providerPolicyChangeRefusal('org',before as any)).toBeNull();
});
it('fails closed on an unreadable policy but always permits the stop switch',async()=>{
 const {providerPolicyChangeRefusal}=await import('../workspacePolicyChange');m.load.mockResolvedValue({storageState:'unavailable',policy:null});
 expect(await providerPolicyChangeRefusal('org',{enabled:true,allowedProviders:['customer_hosted'],modelSelections:{customer_hosted:'local'},fallbackOrder:[]})).toBe('provider_policy_unavailable');
 expect(await providerPolicyChangeRefusal('org',{enabled:false,allowedProviders:[],modelSelections:{},fallbackOrder:[]})).toBeNull();
});
