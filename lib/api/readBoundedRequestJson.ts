import 'server-only';
import {withGithubAbort} from '@/lib/connectors/github/boundedGithubRead';
/** Request streams have no Response.ok. Bound bytes/time without casting a request
 * into a provider response, and never retain the raw submitted content in errors. */
export async function readBoundedRequestJson(request:Request,signal:AbortSignal,maxBytes:number):Promise<unknown>{
 if(!Number.isSafeInteger(maxBytes)||maxBytes<1||!request.body)throw Error('invalid_request_body');
 const length=request.headers.get('content-length');if(length!==null&&(!/^\d+$/.test(length)||Number(length)>maxBytes))throw Error('invalid_request_body');
 const reader=request.body.getReader(),chunks:Uint8Array[]=[];let total=0,complete=false;
 try{for(;;){const part=await withGithubAbort(reader.read(),signal);if(part.done){complete=true;break}total+=part.value.byteLength;if(total>maxBytes)throw Error('invalid_request_body');chunks.push(part.value)}const bytes=new Uint8Array(total);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.byteLength}return JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes))}finally{if(!complete)void reader.cancel().catch(()=>{});try{reader.releaseLock()}catch{}}
}
