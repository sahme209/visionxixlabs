import {z} from 'zod';
export const SERVICE_NOW_BASE_SCOPE='axiom.change_management' as const;
export const SERVICE_NOW_PROOF_SCOPE='axiom.change_evidence_read' as const;
export const serviceNowRequestedScopeSchema=z.enum([SERVICE_NOW_BASE_SCOPE,`${SERVICE_NOW_BASE_SCOPE} ${SERVICE_NOW_PROOF_SCOPE}`]);
export const serviceNowGrantedScopesSchema=z.array(z.enum([SERVICE_NOW_BASE_SCOPE,SERVICE_NOW_PROOF_SCOPE])).min(1).max(2).refine(s=>s.includes(SERVICE_NOW_BASE_SCOPE)&&new Set(s).size===s.length).transform(s=>s.includes(SERVICE_NOW_PROOF_SCOPE)?[SERVICE_NOW_BASE_SCOPE,SERVICE_NOW_PROOF_SCOPE]:[SERVICE_NOW_BASE_SCOPE]);
/** Exact approved sets only. Provider ordering is not authority and omitted,
 * duplicate, whitespace-ambiguous or unrelated scopes never imply consent. */
export function parseServiceNowScopeResponse(raw:unknown,requested:unknown):string[]{
 const expected=serviceNowRequestedScopeSchema.parse(requested).split(' '),text=z.string().max(120).regex(/^[a-z_.]+(?: [a-z_.]+)?$/).parse(raw),actual=serviceNowGrantedScopesSchema.parse(text.split(' '));
 if(actual.length!==expected.length||actual.some((s,i)=>s!==expected[i]))throw Error('servicenow_scope_mismatch');return actual;
}
