import {z} from 'zod';
export const FIXTURE_TENANT='qualification_workspace' as const;
export const FIXTURE_GENERATION='c3b7bf334ce56a64575183b7a66e5109' as const;
export const FIXTURE_CASE_IDS=['read_execution','prepare_enrolled','execute_enrolled','cancel_prepared','read_operation','execute_unknown','recover_unknown','revoke_before_claim','revoke_after_await','revoke_before_send'] as const;
export const FIXTURE_SCENARIO_IDS=FIXTURE_CASE_IDS;
const token=(actor:'requester'|'reviewer')=>z.string().max(512).regex(new RegExp('^axm\\.desk\\.dsk\\.qualification\\.'+actor+'\\.[a-f0-9]{64}$'));
const scenario=z.object({caseId:z.enum(FIXTURE_CASE_IDS),requestId:z.string().regex(/^[A-Za-z0-9_-]{1,160}$/),planId:z.string().regex(/^release_plan_[a-f0-9]{64}$/),expectedVersion:z.number().int().min(0).max(2),clientRequestId:z.string().regex(/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i)}).strict();
const schema=z.object({tenant:z.literal(FIXTURE_TENANT),requesterToken:token('requester'),reviewerToken:token('reviewer'),scenarios:z.array(scenario).min(1).max(64)}).strict().superRefine((value,context)=>{let last=-1;for(const item of value.scenarios){const index=FIXTURE_CASE_IDS.indexOf(item.caseId);if(index<=last)context.addIssue({code:'custom',message:'fixed source order required'});last=index;}});
export type FixtureAuthorization=z.infer<typeof schema>;
export type FixtureScenario=z.infer<typeof scenario>;
const magic=new TextEncoder().encode('AXQAUTH1'),generation=new TextEncoder().encode(FIXTURE_GENERATION),CAP=65536,HEADER=44;
function uniqueKeys(text:string):unknown{
 const value:unknown=JSON.parse(text);let i=0;
 const ws=()=>{while(/\s/.test(text[i]??'')&&i<text.length)i++;};
 const string=()=>{const start=i++;while(i<text.length){if(text[i++]==='"')break;if(text[i-1]==='\\')i++;}return JSON.parse(text.slice(start,i)) as string;};
 function visit(depth:number){if(depth>16)throw Error();ws();if(text[i]==='{'){i++;ws();const keys=new Set<string>();if(text[i]==='}'){i++;return;}for(;;){ws();const key=string();if(keys.has(key))throw Error();keys.add(key);ws();i++;visit(depth+1);ws();if(text[i++]==='}')return;}}
  else if(text[i]==='['){i++;ws();if(text[i]===']'){i++;return;}for(;;){visit(depth+1);ws();if(text[i++]===']')return;}}
  else if(text[i]==='"')string();else while(i<text.length&&!/[\s,}\]]/.test(text[i]))i++;
 }visit(0);return value;
}
function parsed(value:unknown):Readonly<FixtureAuthorization>{const result=schema.parse(value);for(const entry of result.scenarios)Object.freeze(entry);Object.freeze(result.scenarios);return Object.freeze(result);}
export function encodeFixtureAuthorizationFrame(value:unknown):Uint8Array{const payload=new TextEncoder().encode(JSON.stringify(parsed(value)));if(!payload.length||payload.length>CAP)throw Error('fixture_authorization_frame_invalid');const result=new Uint8Array(HEADER+payload.length);result.set(magic);result.set(generation,8);new DataView(result.buffer).setUint32(40,payload.length);result.set(payload,HEADER);return result;}
export function decodeFixtureAuthorizationFrame(value:Uint8Array):Readonly<FixtureAuthorization>{if(!(value instanceof Uint8Array)||value.byteLength<HEADER||value.byteLength>HEADER+CAP||!magic.every((byte,index)=>value[index]===byte)||!generation.every((byte,index)=>value[index+8]===byte))throw Error('fixture_authorization_frame_invalid');const length=new DataView(value.buffer,value.byteOffset,value.byteLength).getUint32(40);if(!length||length>CAP||value.byteLength!==HEADER+length)throw Error('fixture_authorization_frame_invalid');return parsed(uniqueKeys(new TextDecoder('utf-8',{fatal:true}).decode(value.subarray(HEADER))));}
