import { expect, it, vi } from 'vitest';
import type { Prisma } from '@prisma/client';
vi.mock('@/lib/db',()=>({prisma:{}}));
import { assertTextAdmissionPolicy, type TextAdmissionPolicyRequirement } from '../textAdmissionPolicy';
const org='synthetic-policy-workspace',model='anthropic/claude-sonnet-5';
const requirement:TextAdmissionPolicyRequirement={provider:'vercel_gateway',model};
const valid=()=>({enabled:true,allowedProviders:['vercel_gateway'],modelSelections:{vercel_gateway:model},fallbackOrder:['vercel_gateway']});
function fixture(rows:unknown){
 const query=vi.fn().mockResolvedValue(rows);
 return {query,tx:{$queryRawUnsafe:query} as unknown as Pick<Prisma.TransactionClient,'$queryRawUnsafe'>};
}
it('accepts the exact enabled selected model under a tenant-bound shared row lock',async()=>{
 const {tx,query}=fixture([valid()]);
 await expect(assertTextAdmissionPolicy(tx,org,requirement)).resolves.toBeUndefined();
 expect(query).toHaveBeenCalledTimes(1);
 const [sql,...bindings]=query.mock.calls[0];
 expect(sql).toMatch(/FROM\s+"OrganizationAIProviderPolicy"/i);expect(sql).toMatch(/FOR\s+SHARE/i);
 expect(sql).toMatch(/"organizationId"\s*=\s*\$1/);expect(bindings).toEqual([org]);
});
it.each([
 ['missing row',[]],
 ['disabled policy',[{...valid(),enabled:false}]],
 ['malformed policy',[{...valid(),modelSelections:'malformed'}]],
 ['changed selected model',[{...valid(),modelSelections:{vercel_gateway:'anthropic/claude-haiku-4.5'}}]],
 ['provider no longer allowed',[{...valid(),allowedProviders:['openai'],modelSelections:{openai:'gpt-4o-mini'},fallbackOrder:['openai']}]],
 ['ambiguous duplicate rows',[valid(),valid()]],
])('refuses %s without treating it as current permission',async(_label,rows)=>{
 const {tx}=fixture(rows);await expect(assertTextAdmissionPolicy(tx,org,requirement)).rejects.toThrow('ai_text_policy_unavailable');
});
it.each([
 {provider:'openai',model},
 {provider:'vercel_gateway',model:''},
 {provider:'vercel_gateway',model:42},
 null,
])('refuses an invalid private requirement before relying on stored policy: %j',async raw=>{
 const {tx}=fixture([valid()]);await expect(assertTextAdmissionPolicy(tx,org,raw as unknown as TextAdmissionPolicyRequirement)).rejects.toThrow('ai_text_policy_unavailable');
});
it('refuses a policy read failure with the fixed unavailable diagnostic',async()=>{
 const {tx,query}=fixture([]);query.mockRejectedValue(new Error('synthetic database failure'));
 await expect(assertTextAdmissionPolicy(tx,org,requirement)).rejects.toThrow('ai_text_policy_unavailable');
});
it('resolves stored service-default only against the server-pinned concrete default',async()=>{
 const {tx}=fixture([{...valid(),modelSelections:{vercel_gateway:'service-default'}}]);
 await expect(assertTextAdmissionPolicy(tx,org,{...requirement,defaultModel:model})).resolves.toBeUndefined();
});
it('refuses stored service-default without a pinned default',async()=>{
 const {tx}=fixture([{...valid(),modelSelections:{vercel_gateway:'service-default'}}]);
 await expect(assertTextAdmissionPolicy(tx,org,requirement)).rejects.toThrow('ai_text_policy_unavailable');
});
it('refuses a pinned default that no longer matches the admitted concrete model',async()=>{
 const {tx}=fixture([{...valid(),modelSelections:{vercel_gateway:'service-default'}}]);
 await expect(assertTextAdmissionPolicy(tx,org,{...requirement,defaultModel:'anthropic/claude-haiku-4.5'})).rejects.toThrow('ai_text_policy_unavailable');
});
it.each(['service-default','vmc/synthetic-model'])('refuses nonconcrete actual model %s even if the stored selection matches',async actual=>{
 const {tx}=fixture([{...valid(),modelSelections:{vercel_gateway:actual}}]);
 await expect(assertTextAdmissionPolicy(tx,org,{provider:'vercel_gateway',model:actual,defaultModel:model})).rejects.toThrow('ai_text_policy_unavailable');
});
