import 'server-only';
import { createHash } from 'node:crypto';

const fail = (): never => { throw new Error('coding_quote_invalid'); };
const hash = (value: unknown) => createHash('sha256').update(JSON.stringify(value)).digest('hex');
function object(value: unknown): Record<string, unknown> {
 if (!value || typeof value !== 'object' || Array.isArray(value) || Object.getPrototypeOf(value) !== Object.prototype) return fail();
 const descriptors=Object.getOwnPropertyDescriptors(value),entries:Array<[string,unknown]>=[];
 for(const key of Reflect.ownKeys(value)){
  if(typeof key!=='string')return fail();
  const descriptor=descriptors[key];
  if(!descriptor||!descriptor.enumerable||!Object.hasOwn(descriptor,'value')||descriptor.get||descriptor.set)return fail();
  entries.push([key,descriptor.value]);
 }
 // Snapshot data descriptors once: validation and returned evidence see the same values.
 return Object.fromEntries(entries);
}
function exactAnthropicRoute(value:unknown):void {
 if(!Array.isArray(value)||Object.getPrototypeOf(value)!==Array.prototype)return fail();
 const ownKeys=Reflect.ownKeys(value);
 if(ownKeys.length!==2||!ownKeys.includes('0')||!ownKeys.includes('length'))return fail();
 const item=Object.getOwnPropertyDescriptor(value,'0'),length=Object.getOwnPropertyDescriptor(value,'length');
 if(!item||!item.enumerable||!Object.hasOwn(item,'value')||item.get||item.set||item.value!=='anthropic'||!length||!Object.hasOwn(length,'value')||length.value!==1)return fail();
}
function keys(value: Record<string, unknown>, expected: readonly string[], optional: readonly string[] = []) { if (Object.keys(value).some(k => !expected.includes(k) && !optional.includes(k)) || expected.some(k => !Object.hasOwn(value,k))) fail(); }
function text(value: unknown, maximum = 1024): string { if (typeof value !== 'string' || !value.length || value.length > maximum || /[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/u.test(value)) return fail(); return value; }
function payloadText(value: unknown): string { if (value === '') return ''; return text(value,131072); }
function integer(value: unknown, minimum = 0): number { if (!Number.isSafeInteger(value) || (value as number) < minimum) return fail(); return value as number; }
function digest(value: unknown): string { if (typeof value !== 'string' || !/^[a-f0-9]{64}$/.test(value)) return fail(); return value; }
export interface CodingRequestEnvelope {
 organizationId:string; userId:string; correlationId:string; runId:string; stageRunId:string; claimGeneration:string;
 phase:'initial'|'refinement'; idempotencyKey:string; task:'generate_text'; model:string; prompt:string; system?:string;
 temperature:0.2; maxOutputTokens:4096; maxRetries:0; adapterContract:'coding_gateway_text_v1';
 routing: Readonly<{only:readonly ['anthropic'];thinking:'disabled';region:'default';cache:'none'}>;
}
export interface PreparedCodingRequest { readonly envelope: Readonly<CodingRequestEnvelope>; readonly digest:string; readonly payloadBytes:number }
const scopeKeys = ['organizationId','userId','correlationId','runId','stageRunId','claimGeneration','phase','idempotencyKey'] as const;
export function prepareCodingRequestEnvelope(raw:unknown): PreparedCodingRequest {
 const v=object(raw); keys(v,[...scopeKeys,'task','model','prompt','temperature','maxOutputTokens','maxRetries','adapterContract','routing'],['system']);
 for(const k of scopeKeys)text(v[k]);
 if(!['initial','refinement'].includes(v.phase as string)||v.task!=='generate_text'||v.temperature!==0.2||v.maxOutputTokens!==4096||v.maxRetries!==0||v.adapterContract!=='coding_gateway_text_v1')fail();
 const model=text(v.model),prompt=payloadText(v.prompt); const hasSystem=Object.hasOwn(v,'system'), system=hasSystem?payloadText(v.system):undefined;
 const route=object(v.routing);keys(route,['only','thinking','region','cache']);
 exactAnthropicRoute(route.only);if(route.thinking!=='disabled'||route.region!=='default'||route.cache!=='none')fail();
 const routing=Object.freeze({only:Object.freeze(['anthropic'] as const),thinking:'disabled' as const,region:'default' as const,cache:'none' as const});
 const envelope=Object.freeze({...Object.fromEntries(scopeKeys.map(k=>[k,v[k]])),task:'generate_text',model,prompt,...(hasSystem?{system}:{}),temperature:0.2,maxOutputTokens:4096,maxRetries:0,adapterContract:'coding_gateway_text_v1',routing}) as Readonly<CodingRequestEnvelope>;
 const payloadBytes=Buffer.byteLength(prompt,'utf8')+Buffer.byteLength(system??'','utf8');if(payloadBytes>131072)fail();
 return Object.freeze({envelope,digest:hash(envelope),payloadBytes});
}
export interface SyntheticCodingPricing {readonly schema:'synthetic_coding_pricing_v1';readonly model:string;readonly inputRate:string;readonly outputRate:string;readonly retrievedAt:number;readonly expiresAt:number;readonly digest:string;readonly sourceKind:'synthetic_fixture';readonly sourceOrigin:'urn:axiom:synthetic-coding-pricing:v1';readonly syntheticInputDigest:string}
export function parseSyntheticCodingPricing(raw:unknown):SyntheticCodingPricing {
 const v=object(raw);keys(v,['schema','model','currency','unit','inputRate','outputRate','requestFee','ancillaryFee','route','region','retrievedAt','expiresAt']);
 if(v.schema!=='synthetic_coding_pricing_v1'||v.currency!=='USD'||v.unit!=='nano_dollars_per_token'||v.requestFee!=='0'||v.ancillaryFee!=='0'||v.route!=='anthropic'||v.region!=='default')fail();
 for(const k of ['inputRate','outputRate'])if(typeof v[k]!=='string'||!/^[1-9][0-9]{0,17}$/.test(v[k] as string))fail();
 const model=text(v.model),retrievedAt=integer(v.retrievedAt),expiresAt=integer(v.expiresAt);if(expiresAt<=retrievedAt)fail();
 const normalized={schema:'synthetic_coding_pricing_v1' as const,model,inputRate:v.inputRate as string,outputRate:v.outputRate as string,retrievedAt,expiresAt};
 const syntheticInputDigest=hash({...normalized,currency:'USD',unit:'nano_dollars_per_token',requestFee:'0',ancillaryFee:'0',route:'anthropic',region:'default'});
 return Object.freeze({...normalized,digest:hash(normalized),sourceKind:'synthetic_fixture' as const,sourceOrigin:'urn:axiom:synthetic-coding-pricing:v1' as const,syntheticInputDigest});
}
const ceil=(a:bigint,b:bigint)=>(a+b-BigInt(1))/b;
export function calculateCodingQuote(pricing:SyntheticCodingPricing,inputTokens:number):{providerCents:number;reservedCents:number} {
 integer(inputTokens,1); if(pricing.schema!=='synthetic_coding_pricing_v1'||!(/^[1-9][0-9]{0,17}$/.test(pricing.inputRate))||!(/^[1-9][0-9]{0,17}$/.test(pricing.outputRate)))fail(); const p=ceil(BigInt(inputTokens)*BigInt(pricing.inputRate)+BigInt(4096)*BigInt(pricing.outputRate),BigInt(10_000_000));
 const h=ceil(ceil(BigInt(3)*p,BigInt(2))*BigInt(3),BigInt(2));if(p<BigInt(1)||h>BigInt(Number.MAX_SAFE_INTEGER))fail();return {providerCents:Number(p),reservedCents:Number(h)};
}
export interface CodingQuoteEvidence {
 readonly version:'coding_request_quote_v1';readonly requestDigest:string;readonly bindingDigest:string;readonly pricingDigest:string;
 readonly model:string;readonly inputTokens:number;readonly maxOutputTokens:4096;readonly providerCents:number;readonly reservedCents:number;
 readonly inputRate:string;readonly outputRate:string;readonly quotedAt:number;readonly expiresAt:number;readonly pricingRetrievedAt:number;readonly pricingExpiresAt:number;
 readonly payloadBytes:number;readonly upstream:'anthropic';readonly region:'default';readonly cache:'none';readonly thinking:'disabled';readonly policyVersion:'coding_quote_margin150_buffer150_v1';readonly pricingSourceKind:'synthetic_fixture';readonly pricingOrigin:'urn:axiom:synthetic-coding-pricing:v1';readonly syntheticInputDigest:string;
 readonly adapterContract:'coding_gateway_text_v1';readonly estimatorContract:'synthetic_explicit_input_v1';readonly pricingSchema:'synthetic_coding_pricing_v1';
}
const bindingDigest=(v:Readonly<CodingRequestEnvelope>|Record<string,unknown>)=>hash(Object.fromEntries(scopeKeys.map(k=>[k,v[k]])));
export function parseStoredCodingQuoteEvidence(raw:unknown,expected?:PreparedCodingRequest|Record<string,unknown>):CodingQuoteEvidence {
 const v=object(raw); keys(v,['version','requestDigest','bindingDigest','pricingDigest','model','inputTokens','maxOutputTokens','providerCents','reservedCents','inputRate','outputRate','quotedAt','expiresAt','pricingRetrievedAt','pricingExpiresAt','payloadBytes','upstream','region','cache','thinking','policyVersion','pricingSourceKind','pricingOrigin','syntheticInputDigest','adapterContract','estimatorContract','pricingSchema']);
 if(v.version!=='coding_request_quote_v1'||v.maxOutputTokens!==4096||v.adapterContract!=='coding_gateway_text_v1'||v.estimatorContract!=='synthetic_explicit_input_v1'||v.pricingSchema!=='synthetic_coding_pricing_v1')fail();
 if(v.upstream!=='anthropic'||v.region!=='default'||v.cache!=='none'||v.thinking!=='disabled'||v.policyVersion!=='coding_quote_margin150_buffer150_v1'||v.pricingSourceKind!=='synthetic_fixture'||v.pricingOrigin!=='urn:axiom:synthetic-coding-pricing:v1')fail();
 integer(v.payloadBytes);if((v.payloadBytes as number)>131072)fail();digest(v.syntheticInputDigest);
 digest(v.requestDigest);digest(v.bindingDigest);digest(v.pricingDigest);text(v.model);integer(v.inputTokens,1);integer(v.providerCents,1);integer(v.reservedCents,1);integer(v.quotedAt);integer(v.expiresAt);integer(v.pricingRetrievedAt);integer(v.pricingExpiresAt);
 if((v.expiresAt as number)<=(v.quotedAt as number)||(v.expiresAt as number)-(v.quotedAt as number)>120000||(v.pricingRetrievedAt as number)>(v.quotedAt as number)||(v.expiresAt as number)>(v.pricingExpiresAt as number))fail();
 for(const k of ['inputRate','outputRate'])if(typeof v[k]!=='string'||!/^[1-9][0-9]{0,17}$/.test(v[k] as string))fail();
 const pricingDigest=hash({schema:v.pricingSchema,model:v.model,inputRate:v.inputRate,outputRate:v.outputRate,retrievedAt:v.pricingRetrievedAt,expiresAt:v.pricingExpiresAt});if(pricingDigest!==v.pricingDigest)fail();
 const syntheticInputDigest=hash({schema:v.pricingSchema,model:v.model,inputRate:v.inputRate,outputRate:v.outputRate,retrievedAt:v.pricingRetrievedAt,expiresAt:v.pricingExpiresAt,currency:'USD',unit:'nano_dollars_per_token',requestFee:'0',ancillaryFee:'0',route:'anthropic',region:'default'});if(syntheticInputDigest!==v.syntheticInputDigest)fail();
 const amount=calculateCodingQuote({...v,schema:v.pricingSchema} as unknown as SyntheticCodingPricing,v.inputTokens as number);if(amount.providerCents!==v.providerCents||amount.reservedCents!==v.reservedCents)fail();
 if(expected){if('envelope' in expected){const p=expected as PreparedCodingRequest;if(v.requestDigest!==p.digest||v.payloadBytes!==p.payloadBytes||v.model!==p.envelope.model||v.bindingDigest!==bindingDigest(p.envelope))fail();}else{for(const k of scopeKeys)text(expected[k]);if(v.bindingDigest!==bindingDigest(expected))fail();if(expected.model!==undefined&&v.model!==expected.model)fail();if(expected.requestDigest!==undefined&&v.requestDigest!==expected.requestDigest)fail();}}
 return Object.freeze({...v}) as unknown as CodingQuoteEvidence;
}
declare const quoteBrand:unique symbol;declare const reservationBrand:unique symbol;declare const managerBrand:unique symbol;declare const dispatchBrand:unique symbol;
export interface CodingQuoteHandle {readonly [quoteBrand]:true} export interface CodingReservationQuote {readonly [reservationBrand]:true} export interface CodingManagerQuote {readonly [managerBrand]:true} export interface CodingProviderDispatch {readonly [dispatchBrand]:true}
type State={prepared:PreparedCodingRequest;evidence:CodingQuoteEvidence;lastNow:number};
export interface CodingActualRequest {prompt:string;system?:string;model:string;maxTokens?:number;temperature?:number;organizationId?:string;correlationId?:string}
function buildProtocol(isolated:boolean){
 const quotes=new WeakMap<object,State>(),reservations=new WeakMap<object,State>(),managers=new WeakMap<object,State>(),dispatches=new WeakMap<object,State>();
 const token=<T>(map:WeakMap<object,State>,state:State):T=>{const handle=Object.freeze({});map.set(handle,state);return handle as T;};
 const take=(map:WeakMap<object,State>,handle:object,prepared:PreparedCodingRequest,now:number):State=>{const state=map.get(handle);map.delete(handle);if(!state)return fail();integer(now);const actual=prepareCodingRequestEnvelope(prepared.envelope);if(actual.digest!==state.prepared.digest||now<state.lastNow||now>=state.evidence.expiresAt)fail();return {...state,lastNow:now};};
 const takeRequest=(map:WeakMap<object,State>,handle:object,actual:CodingActualRequest,now:number):State=>{const s=map.get(handle);if(!s)return fail();const {system:_old,...base}=s.prepared.envelope;let prepared:PreparedCodingRequest;try{prepared=prepareCodingRequestEnvelope({...base,prompt:actual.prompt,...(Object.hasOwn(actual,'system')?{system:actual.system}:{}),model:actual.model,maxOutputTokens:actual.maxTokens,temperature:actual.temperature,organizationId:actual.organizationId,correlationId:actual.correlationId});}catch(e){map.delete(handle);throw e;}return take(map,handle,prepared,now);};
 return Object.freeze({
 quote(prepared:PreparedCodingRequest,pricing:SyntheticCodingPricing,inputTokens:number,now:number):CodingQuoteHandle {if(!isolated)throw new Error('coding_quote_qualification_unavailable');const p=prepareCodingRequestEnvelope(prepared.envelope);if(p.digest!==prepared.digest)fail();integer(now);if(pricing.digest!==hash({schema:pricing.schema,model:pricing.model,inputRate:pricing.inputRate,outputRate:pricing.outputRate,retrievedAt:pricing.retrievedAt,expiresAt:pricing.expiresAt})||pricing.sourceKind!=='synthetic_fixture'||pricing.sourceOrigin!=='urn:axiom:synthetic-coding-pricing:v1'||pricing.model!==p.envelope.model||now<pricing.retrievedAt||now>=pricing.expiresAt)fail();const amount=calculateCodingQuote(pricing,inputTokens);const evidence=parseStoredCodingQuoteEvidence({version:'coding_request_quote_v1',requestDigest:p.digest,bindingDigest:bindingDigest(p.envelope),pricingDigest:pricing.digest,model:p.envelope.model,inputTokens,maxOutputTokens:4096,...amount,inputRate:pricing.inputRate,outputRate:pricing.outputRate,quotedAt:now,expiresAt:Math.min(now+120000,pricing.expiresAt),pricingRetrievedAt:pricing.retrievedAt,pricingExpiresAt:pricing.expiresAt,payloadBytes:p.payloadBytes,upstream:'anthropic',region:'default',cache:'none',thinking:'disabled',policyVersion:'coding_quote_margin150_buffer150_v1',pricingSourceKind:pricing.sourceKind,pricingOrigin:pricing.sourceOrigin,syntheticInputDigest:pricing.syntheticInputDigest,adapterContract:'coding_gateway_text_v1',estimatorContract:'synthetic_explicit_input_v1',pricingSchema:'synthetic_coding_pricing_v1'},p);return token(quotes,{prepared:p,evidence,lastNow:now});},
 consumeForReservation(handle:CodingQuoteHandle,p:PreparedCodingRequest,now:number){const s=take(quotes,handle,p,now);return Object.freeze({handle:token<CodingReservationQuote>(reservations,s),evidence:s.evidence});},
 consumeForDispatch(handle:CodingReservationQuote,p:PreparedCodingRequest,now:number){return token<CodingManagerQuote>(managers,take(reservations,handle,p,now));},
 consumeManager(handle:CodingManagerQuote,p:PreparedCodingRequest,now:number){return token<CodingProviderDispatch>(dispatches,take(managers,handle,p,now));},
 consumeManagerForRequest(handle:CodingManagerQuote,actual:CodingActualRequest,now:number){return token<CodingProviderDispatch>(dispatches,takeRequest(managers,handle,actual,now));},
 consumeProvider(handle:CodingProviderDispatch,p:PreparedCodingRequest,now:number){return take(dispatches,handle,p,now).evidence;},
 consumeProviderForRequest(handle:CodingProviderDispatch,actual:CodingActualRequest,now:number){const s=takeRequest(dispatches,handle,actual,now);return Object.freeze({evidence:s.evidence,prompt:s.prepared.envelope.prompt,...(Object.hasOwn(s.prepared.envelope,'system')?{system:s.prepared.envelope.system}:{}),maxOutputTokens:4096 as const,maxRetries:0 as const,temperature:0.2 as const,providerOptions:{gateway:{only:['anthropic'] as ['anthropic']},anthropic:{thinking:{type:'disabled' as const}}}});},
 });
}
/** Isolated synthetic protocol: its capabilities are NEVER accepted by the canonical singleton. */
export const createIsolatedCodingQuoteProtocol=()=>{if(process.env.NODE_ENV!=='test')throw new Error('coding_quote_isolated_test_required');return buildProtocol(true);};
const canonical=buildProtocol(false);
export const quoteCodingRequest=(_prepared:PreparedCodingRequest):never=>{throw new Error('coding_quote_qualification_unavailable');};
export const consumeCodingQuoteForReservation=canonical.consumeForReservation;
export const consumeCodingReservationForDispatch=canonical.consumeForDispatch;
export const consumeCodingManagerQuote=canonical.consumeManager;
export const consumeCodingManagerQuoteForRequest=canonical.consumeManagerForRequest;
export const consumeCodingProviderDispatch=canonical.consumeProvider;
export const consumeCodingProviderDispatchForRequest=canonical.consumeProviderForRequest;
export type CodingQuoteProtocol=ReturnType<typeof createIsolatedCodingQuoteProtocol>;
export type CodingQuote = CodingQuoteHandle;
export const codingRequestQuoteProtocol: CodingQuoteProtocol = canonical;
