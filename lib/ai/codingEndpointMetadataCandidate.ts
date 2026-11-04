import 'server-only';
import { createHash } from 'node:crypto';
import { types } from 'node:util';

export const CODING_ENDPOINT_OBSERVATION_URL='https://ai-gateway.vercel.sh/v1/models/anthropic/claude-sonnet-5/endpoints';
const MODEL='anthropic/claude-sonnet-5',MAX_BYTES=131072;
const fail=(reason='invalid_endpoint_metadata'):never=>{throw new Error(reason);};
const sha=(bytes:Uint8Array|string)=>createHash('sha256').update(bytes).digest('hex');
const validUnicode=(s:string)=>!(/[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/u.test(s));
function dataObject(value:unknown):Record<string,unknown>{
 if(!value||typeof value!=='object'||Array.isArray(value)||Object.getPrototypeOf(value)!==Object.prototype)return fail();
 const descriptors=Object.getOwnPropertyDescriptors(value),entries:Array<[string,unknown]>=[];
 for(const key of Reflect.ownKeys(value)){if(typeof key!=='string')return fail();const d=descriptors[key];if(!d||!d.enumerable||!Object.hasOwn(d,'value'))return fail();entries.push([key,d.value]);}
 return Object.fromEntries(entries);
}
function exact(v:Record<string,unknown>,required:readonly string[],optional:readonly string[]=[]){if(required.some(k=>!Object.hasOwn(v,k))||Object.keys(v).some(k=>!required.includes(k)&&!optional.includes(k)))fail();}
function text(v:unknown,max=4096):string{if(typeof v!=='string'||!v.length||v.length>max||!validUnicode(v))return fail();return v;}
function integer(v:unknown,min=0):number{if(!Number.isSafeInteger(v)||(v as number)<min)return fail();return v as number;}
function finite(v:unknown,min=0,max=1e12):number{if(typeof v!=='number'||!Number.isFinite(v)||v<min||v>max)return fail();return v;}
function list(v:unknown,max=32):unknown[]{if(!Array.isArray(v)||v.length>max)return fail();return v;}
function strings(v:unknown,max=32):string[]{const entries=list(v,max).map(x=>text(x,128));if(new Set(entries).size!==entries.length)fail();return entries;}
/** A fresh byte snapshot is hashed and decoded; SharedArrayBuffer input is refused. */
function snapshot(raw:Uint8Array|string):Uint8Array{
 if(typeof raw==='string'){if(raw.length>MAX_BYTES||!validUnicode(raw))return fail('invalid_raw_encoding');const bytes=Buffer.from(raw,'utf8');if(bytes.byteLength>MAX_BYTES)return fail('metadata_too_large');return bytes;}
 if(!(raw instanceof Uint8Array))return fail('invalid_raw_bytes');
 const prototype=Object.getPrototypeOf(Uint8Array.prototype);
 const backing=Object.getOwnPropertyDescriptor(prototype,'buffer')!.get!.call(raw);
 if(types.isSharedArrayBuffer(backing))return fail('shared_raw_input_refused');
 const length=Object.getOwnPropertyDescriptor(prototype,'byteLength')!.get!.call(raw) as number;
 if(length>MAX_BYTES)return fail('metadata_too_large');
 const bytes=new Uint8Array(length);Uint8Array.prototype.set.call(bytes,raw);return bytes;
}
/** Small bounded JSON reader. Duplicate keys are checked AFTER escape decoding. */
function strictJSON(source:string):unknown{
 let at=0,nodes=0;
 const ws=()=>{while(at<source.length&&/[\t\n\r ]/.test(source[at]))at++;};
 function string():string{
  const start=at++;while(at<source.length){if(source[at]==='\\'){at+=2;continue;}if(source[at]==='"'){at++;let result:unknown;try{result=JSON.parse(source.slice(start,at));}catch{return fail('invalid_json');}if(typeof result!=='string'||!validUnicode(result))return fail('invalid_json_unicode');return result;}at++;}return fail('invalid_json');
 }
 function value(depth:number):unknown{
  if(depth>16||++nodes>8192)return fail('metadata_structure_limit');ws();const c=source[at];
  if(c==='"')return string();
  if(c==='{'){
   at++;ws();const entries:Array<[string,unknown]>=[],seen=new Set<string>();if(source[at]==='}'){at++;return {};}
   for(;;){ws();if(source[at]!=='"')return fail('invalid_json');const key=string();if(seen.has(key))return fail('duplicate_json_key');seen.add(key);ws();if(source[at++]!==':')return fail('invalid_json');entries.push([key,value(depth+1)]);ws();const delimiter=source[at++];if(delimiter==='}')return Object.fromEntries(entries);if(delimiter!==',')return fail('invalid_json');}
  }
  if(c==='['){at++;ws();const values:unknown[]=[];if(source[at]===']'){at++;return values;}for(;;){values.push(value(depth+1));ws();const delimiter=source[at++];if(delimiter===']')return values;if(delimiter!==',')return fail('invalid_json');}}
  for(const [token,result] of [['true',true],['false',false],['null',null]] as const)if(source.startsWith(token,at)){at+=token.length;return result;}
  const number=/^-?(?:0|[1-9][0-9]*)(?:\.[0-9]+)?(?:[eE][+-]?[0-9]+)?/.exec(source.slice(at));if(!number)return fail('invalid_json');at+=number[0].length;const result=Number(number[0]);if(!Number.isFinite(result))return fail('invalid_json_number');return result;
 }
 const result=value(0);ws();if(at!==source.length)return fail('invalid_json');return result;
}
function nanos(raw:unknown,positive:boolean):bigint{
 if(typeof raw!=='string'||! /^(?:0|[1-9][0-9]{0,8})(?:\.[0-9]{1,9})?$/.test(raw))return fail('unsupported_decimal_rate');
 const [whole,fraction='']=raw.split('.'),amount=BigInt(whole)*BigInt(1_000_000_000)+BigInt(fraction.padEnd(9,'0'));
 if((positive&&amount===BigInt(0))||amount>BigInt('999999999999999999'))return fail('unsupported_decimal_rate');return amount;
}
const BASE_PRICES=['prompt','completion','request','image','image_output','web_search','internal_reasoning','input_cache_read','input_cache_write','discount'] as const;
const REGION_PRICES=['prompt','completion','input_cache_read','input_cache_write'] as const;
const ANCILLARY=['request','image','image_output','web_search','internal_reasoning','input_cache_read','input_cache_write'] as const;
type Rates=Readonly<{prompt:bigint;completion:bigint;nonzeroFees:readonly string[]}>;
// The observed regional shape overrides four explicitly present token/cache
// dimensions only. Base ancillary fee rejections are always retained, never
// replaced by inferred regional zeroes or an applicability exception.
function pricing(raw:unknown,regional=false):Rates{
 const p=dataObject(raw);exact(p,regional?REGION_PRICES:BASE_PRICES);
 const prompt=nanos(p.prompt,true),completion=nanos(p.completion,true),nonzeroFees:string[]=[];
 for(const k of regional?['input_cache_read','input_cache_write'] as const:ANCILLARY)if(nanos(p[k],false)>BigInt(0))nonzeroFees.push(k);
 if(!regional&&p.discount!==0)return fail('unsupported_discount');
 return {prompt,completion,nonzeroFees};
}
function distribution(raw:unknown){const d=dataObject(raw);exact(d,['p50','p95']);finite(d.p50);finite(d.p95);}
const ENDPOINT_REQUIRED=['name','model_name','context_length','pricing','provider_name','has_zdr','has_no_training','tags','quantization','max_completion_tokens','max_prompt_tokens','supported_parameters','status','uptime_last_15m','uptime_last_1h','uptime_last_1d','latency_last_1h','throughput_last_1h','supports_implicit_caching'];
export interface CodingEndpointRegionObservation {readonly scope:'zone'|'specific';readonly geoRegion:string;readonly providerRegion?:string;readonly promptNanoDollars:string;readonly completionNanoDollars:string}
export interface CodingEndpointMetadataCandidate {
 readonly kind:'observed_coding_endpoint_candidate_v1';readonly qualified:false;readonly quoteEligible:false;
 readonly source:Readonly<{url:typeof CODING_ENDPOINT_OBSERVATION_URL;observedAt:number;rawSha256:string;bytes:number;timestampMeaning:'local_observation_only'}>;
 readonly model:typeof MODEL;readonly upstream:'anthropic';readonly maxPromptNanoDollars:string;readonly maxCompletionNanoDollars:string;
 readonly contextLength:number;readonly maxCompletionTokens:number;readonly maxPromptTokens:number|null;readonly observedStatus:0;
 readonly pricingUnit:'documented_candidate_USD_per_token';readonly regions:readonly CodingEndpointRegionObservation[];
 readonly rejectionReasons:readonly string[];readonly qualificationGaps:readonly string[];readonly normalizedDigest:string;
}
/** Observation only. Even a zero-fee candidate cannot mint a production quote. */
export function parseCodingEndpointMetadataCandidate(raw:Uint8Array|string,observation:unknown):CodingEndpointMetadataCandidate{
 const bytes=snapshot(raw),source=dataObject(observation);exact(source,['url','observedAt','rawSha256']);
 if(source.url!==CODING_ENDPOINT_OBSERVATION_URL||typeof source.rawSha256!=='string'||! /^[a-f0-9]{64}$/.test(source.rawSha256)||sha(bytes)!==source.rawSha256)fail('observation_binding_invalid');
 const observedAt=integer(source.observedAt);
 if(bytes.length>=3&&bytes[0]===0xef&&bytes[1]===0xbb&&bytes[2]===0xbf)fail('invalid_raw_encoding');
 let decoded:string;try{decoded=new TextDecoder('utf-8',{fatal:true}).decode(bytes);}catch{return fail('invalid_raw_encoding');}
 const outer=dataObject(strictJSON(decoded));exact(outer,['data']);const data=dataObject(outer.data);
 exact(data,['id','name','created','released','description','knowledge','architecture','reasoning','endpoints']);
 if(data.id!==MODEL)fail('model_identity_mismatch');text(data.name,256);integer(data.created);integer(data.released);text(data.description,8192);text(data.knowledge,64);
 const architecture=dataObject(data.architecture);exact(architecture,['tokenizer','instruct_type','modality','input_modalities','output_modalities']);
 if(architecture.tokenizer!==null&&typeof architecture.tokenizer!=='string'||architecture.instruct_type!==null&&typeof architecture.instruct_type!=='string')fail();
 text(architecture.modality,128);if(!strings(architecture.input_modalities).includes('text')||!strings(architecture.output_modalities).includes('text'))fail();
 const reasoning=dataObject(data.reasoning);exact(reasoning,['mandatory','supported_efforts','supports_max_tokens']);if(reasoning.mandatory!==false||reasoning.supports_max_tokens!==true||!strings(reasoning.supported_efforts).includes('none'))fail('reasoning_contract_unsupported');
 const endpoints=list(data.endpoints,32);if(!endpoints.length)fail('missing_endpoint');let selected:Record<string,unknown>|undefined;const providers=new Set<string>();
 for(const entry of endpoints){const e=dataObject(entry);exact(e,ENDPOINT_REQUIRED,['inference_regions']);const provider=text(e.provider_name,64);if(providers.has(provider))fail('ambiguous_endpoint');providers.add(provider);text(e.name,256);text(e.model_name,256);integer(e.context_length,1);integer(e.max_completion_tokens,1);if(e.max_prompt_tokens!==null)integer(e.max_prompt_tokens,1);pricing(e.pricing);strings(e.tags);strings(e.supported_parameters);integer(e.status);for(const k of ['has_zdr','has_no_training','supports_implicit_caching'])if(typeof e[k]!=='boolean')fail();if(e.quantization!==null)fail('quantization_unsupported');for(const k of ['uptime_last_15m','uptime_last_1h','uptime_last_1d'])finite(e[k],0,100);distribution(e.latency_last_1h);distribution(e.throughput_last_1h);if(provider==='anthropic')selected=e;}
 if(!selected)return fail('missing_selected_endpoint');
 const e=selected;if(e.name!==`anthropic | ${MODEL}`||e.status!==0||e.supports_implicit_caching!==false||(e.context_length as number)<4096||(e.max_completion_tokens as number)<4096||!strings(e.supported_parameters).includes('max_tokens')||!strings(e.supported_parameters).includes('reasoning'))fail('selected_endpoint_contract_unsupported');
 const base=pricing(e.pricing),rejections=new Set(base.nonzeroFees.map(k=>'nonzero_'+k)),regions:CodingEndpointRegionObservation[]=[],regionIds=new Set<string>();let maxPrompt=base.prompt,maxCompletion=base.completion;
 for(const rawRegion of e.inference_regions===undefined?[]:list(e.inference_regions,64)){
  const region=dataObject(rawRegion);exact(region,['scope','geo_region','pricing'],['provider_region']);const scope=region.scope;if(scope!=='zone'&&scope!=='specific')return fail();const geo=text(region.geo_region,64);if(!/^[a-z][a-z0-9_-]{1,63}$/.test(geo))fail();const providerRegion=Object.hasOwn(region,'provider_region')?text(region.provider_region,128):undefined;if(region.scope==='specific'&&!providerRegion||region.scope==='zone'&&providerRegion!==undefined)fail();
  const id=[region.scope,geo,providerRegion??''].join('|');if(regionIds.has(id))fail('ambiguous_region');regionIds.add(id);const rates=pricing(region.pricing,true);rates.nonzeroFees.forEach(k=>rejections.add('nonzero_'+k));if(rates.prompt>maxPrompt)maxPrompt=rates.prompt;if(rates.completion>maxCompletion)maxCompletion=rates.completion;
  regions.push(Object.freeze({scope,geoRegion:geo,...(providerRegion===undefined?{}:{providerRegion}),promptNanoDollars:rates.prompt.toString(),completionNanoDollars:rates.completion.toString()}));
 }
 regions.sort((a,b)=>{const left=JSON.stringify(a),right=JSON.stringify(b);return left<right?-1:left>right?1:0;});
 const normalized={model:MODEL as typeof MODEL,upstream:'anthropic' as const,maxPromptNanoDollars:maxPrompt.toString(),maxCompletionNanoDollars:maxCompletion.toString(),contextLength:e.context_length as number,maxCompletionTokens:e.max_completion_tokens as number,maxPromptTokens:e.max_prompt_tokens as number|null,observedStatus:0 as const,pricingUnit:'documented_candidate_USD_per_token' as const,regions:Object.freeze(regions),rejectionReasons:Object.freeze([...rejections].sort())};
 return Object.freeze({kind:'observed_coding_endpoint_candidate_v1',qualified:false,quoteEligible:false,source:Object.freeze({url:CODING_ENDPOINT_OBSERVATION_URL,observedAt,rawSha256:source.rawSha256 as string,bytes:bytes.byteLength,timestampMeaning:'local_observation_only'}),...normalized,qualificationGaps:Object.freeze(['untrusted_metadata_snapshot','input_estimator_unqualified','upstream_output_semantics_unqualified','pricing_validity_unqualified']),normalizedDigest:sha(JSON.stringify(normalized))});
}
