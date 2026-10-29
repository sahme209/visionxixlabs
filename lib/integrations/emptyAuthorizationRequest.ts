import 'server-only';
import {withGithubAbort} from '@/lib/connectors/github/boundedGithubRead';
/** Node can expose a zero-byte browser POST as a non-null stream. Only actual
 * emptiness is allowed; caller payloads, stalled bodies and chunk floods fail closed. */
export async function hasEmptyAuthorizationBody(request:Request,signal:AbortSignal):Promise<boolean>{
 signal.throwIfAborted();if(!request.body)return true;const reader=request.body.getReader();
 try{for(let reads=0;reads<32;reads++){const next=await withGithubAbort(reader.read(),signal);if(next.done)return true;if(next.value.byteLength)return false}return false}
 finally{void reader.cancel().catch(()=>{});reader.releaseLock()}
}
