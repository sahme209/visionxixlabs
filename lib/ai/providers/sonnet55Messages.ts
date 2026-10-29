import 'server-only';
import {consumeSmallSonnet55Dispatch} from '@/lib/billing/smallSonnet55Request';
import {denyIsolatedExternalIO} from '@/lib/billing/isolatedApplication/runtime';
import {redact} from '@/lib/security/redaction';
import type {AIRequestOptions,AITextResponse} from '../AIProvider';
/** Native Messages, exact admitted model and bounded total output. No retries/tools. */
export async function sendSmallSonnet55Messages(prompt:string,options:AIRequestOptions):Promise<AITextResponse>{
 denyIsolatedExternalIO();const started=Date.now();
 const signal=AbortSignal.any([AbortSignal.timeout(Math.min(options.timeoutMs??30000,30000)),...(options.abortSignal?[options.abortSignal]:[])]);signal.throwIfAborted();
 if(!options.smallAgent55Dispatch)throw Error('sonnet55_dispatch_unavailable');
 const wire=consumeSmallSonnet55Dispatch(options.smallAgent55Dispatch,{...options,model:options.model!,prompt:redact(prompt),system:options.system===undefined?undefined:redact(options.system)});
 if(wire.wireContract!=='anthropic_messages_v1'||wire.model!=='anthropic/claude-sonnet-5.5'||wire.maxTokens!==4096)throw Error('sonnet55_wire_unavailable');
 const key=process.env.AI_GATEWAY_API_KEY||process.env.VERCEL_OIDC_TOKEN;if(!key)throw Error('gateway_not_configured');
 let rejectAbort!:(reason:unknown)=>void;const stopped=new Promise<never>((_resolve,reject)=>{rejectAbort=reject});const onAbort=()=>rejectAbort(signal.reason??new Error('sonnet55_aborted'));signal.addEventListener('abort',onAbort,{once:true});void stopped.catch(()=>{});const wait=<T>(promise:Promise<T>):Promise<T>=>Promise.race([promise,stopped]);
 let finished=false;
 try{
 const response=await wait(fetch('https://ai-gateway.vercel.sh/v1/messages',{method:'POST',redirect:'error',cache:'no-store',signal,headers:{Authorization:`Bearer ${key}`,'content-type':'application/json','anthropic-version':'2023-06-01'},body:JSON.stringify({model:wire.model,max_tokens:wire.maxTokens,stream:false,thinking:wire.thinking,output_config:wire.outputConfig,system:redact(options.system??''),messages:[{role:'user',content:redact(prompt)}],providerOptions:{gateway:{...wire.gateway,user:options.organizationId,tags:['product:axiom-agent',options.correlationId?`correlation:${options.correlationId}`.slice(0,64):'request:unattributed']}}})}).then(response=>{if(finished||signal.aborted){void response.body?.cancel().catch(()=>{});signal.throwIfAborted();throw Error('sonnet55_dispatch_finished')}return response}));
 if(!response.ok){void response.body?.cancel().catch(()=>{});throw Error('sonnet55_provider_request_failed')}
 const reader=response.body?.getReader();if(!reader)throw Error('sonnet55_empty_response');let bytes=0;const parts:Uint8Array[]=[];
 try{while(true){signal.throwIfAborted();const part=await wait(reader.read());if(part.done)break;bytes+=part.value.byteLength;if(bytes>1048576)throw Error('sonnet55_response_too_large');parts.push(part.value)}}catch(error){void reader.cancel().catch(()=>{});throw error}finally{reader.releaseLock()}
 signal.throwIfAborted();const value=JSON.parse(Buffer.concat(parts).toString('utf8'));
 const usage=value.usage,id=value.provider_metadata?.gateway?.generationId;
 if(value.type!=='message'||value.role!=='assistant'||value.model!==wire.model||typeof id!=='string'||!/^gen_[A-Za-z0-9_-]{1,200}$/.test(id)||!Array.isArray(value.content)||value.content.length>128||!usage)throw Error('sonnet55_unverified_response');
 const counts=[usage.input_tokens,usage.output_tokens,usage.cache_creation_input_tokens??0,usage.cache_read_input_tokens??0];
 if(!counts.every(n=>Number.isSafeInteger(n)&&n>=0)||usage.output_tokens>wire.maxTokens)throw Error('sonnet55_unverified_usage');
 let text='';for(const block of value.content){if(block.type!=='text'||typeof block.text!=='string')throw Error('sonnet55_unexpected_content');text+=block.text}
 const input=counts[0]+counts[2]+counts[3];if(!Number.isSafeInteger(input)||!Number.isSafeInteger(input+counts[1]))throw Error('sonnet55_unverified_usage');
 return{text,provider:'vercel_gateway',model:wire.model,latencyMs:Date.now()-started,finishReason:value.stop_reason==='end_turn'?'stop':value.stop_reason==='max_tokens'?'length':'unknown',usage:{promptTokens:input,completionTokens:counts[1],totalTokens:input+counts[1]},gatewayGenerationId:id};
 }finally{finished=true;signal.removeEventListener('abort',onAbort)}
}
