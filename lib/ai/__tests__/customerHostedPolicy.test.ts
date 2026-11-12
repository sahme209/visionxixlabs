import {it,expect} from 'vitest';
import {normalizeStoredWorkspaceAIProviderPolicy,resolveWorkspaceAIProviderPolicy} from '../workspaceProviderPolicy';
it('retains explicit customer-hosted opt-in and an exact model without adding a default',()=>{
 const policy=normalizeStoredWorkspaceAIProviderPolicy({enabled:true,allowedProviders:['customer_hosted'],modelSelections:{customer_hosted:'team/model:1'},fallbackOrder:[]});
 expect(policy).toMatchObject({enabled:true,allowedProviders:['customer_hosted'],modelSelections:{customer_hosted:'team/model:1'}});
 expect(resolveWorkspaceAIProviderPolicy({stored:policy,serviceEnabled:[]}).allowedProviders).toEqual([]);
});
it('never invents a customer-hosted model or accepts a URL as one',()=>{
 const missing=normalizeStoredWorkspaceAIProviderPolicy({enabled:true,allowedProviders:['customer_hosted'],modelSelections:{},fallbackOrder:[]});
 expect(resolveWorkspaceAIProviderPolicy({stored:missing,serviceEnabled:['customer_hosted'] as any}).modelSelections).not.toHaveProperty('customer_hosted');
 expect(normalizeStoredWorkspaceAIProviderPolicy({enabled:true,allowedProviders:['customer_hosted'],modelSelections:{customer_hosted:'https://model.private/v1'},fallbackOrder:[]})).toBeNull();
});
it('does not expose a mock/default local model in the static model registry',async()=>{
 const {listModels,defaultModelFor}=await import('../AIModelRegistry');
 expect(listModels('customer_hosted' as any)).toEqual([]);
 expect(defaultModelFor('customer_hosted' as any)).toBe('');
});
