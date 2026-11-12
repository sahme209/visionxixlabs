import 'server-only';
import {bearerFromHeader} from '@/lib/desktop/desktopToken';
import {platformPrincipalSchema} from '../contracts';
import {assertCurrentPlatformPrincipal} from '../currentAuthority';
import {createOperationalDelegationStore} from './delegation';
interface Ports{
 repo:Parameters<typeof createOperationalDelegationStore>[0];
 source:Parameters<typeof createOperationalDelegationStore>[2];
 identity:Parameters<typeof createOperationalDelegationStore>[3];
 targets?:Parameters<typeof createOperationalDelegationStore>[4];
 verifyDesktopToken(token:string):{sessionId:string};
 readAdminEmails():readonly string[];
}
const fail=():never=>{throw Error('operational_request_unavailable')};
/** Current-human request only. No workload claim, credential issuance, private
 * handle, provider send, caller identity or borrowed-reviewer approval method. */
export async function createOperationalDelegationRequestComposition(request:{headers:Headers;signal?:AbortSignal},ports:Ports){
 function session(){if(request.signal?.aborted)return fail();const token=bearerFromHeader(request.headers.get('authorization'));if(!token||token.length>4096)return fail();try{const parsed=ports.verifyDesktopToken(token);if(typeof parsed.sessionId!=='string'||!parsed.sessionId||parsed.sessionId.length>256)return fail();return parsed.sessionId}catch{return fail()}}
 const sessionId=session(),principal=await ports.repo.transaction(async tx=>{await tx.lock('platform-operational-auth:'+sessionId);const p=platformPrincipalSchema.parse(await tx.readSessionPrincipal(sessionId));if(p.sessionId!==sessionId||session()!==sessionId)return fail();await assertCurrentPlatformPrincipal(tx,p,ports.readAdminEmails);if(session()!==sessionId)return fail();return p});
 const possessed=()=>{if(session()!==principal.sessionId)return fail()};
 const store=createOperationalDelegationStore(ports.repo,{async assertCurrent(tx,p){possessed();await assertCurrentPlatformPrincipal(tx,p,ports.readAdminEmails);possessed()}},ports.source,ports.identity,ports.targets);
 return Object.freeze({
  async inspect(id:string){possessed();return store.inspect(id,principal)},
  async observeTarget(id:string){possessed();return store.observeTarget(id,principal)},
  async delegate(id:string,version:number,planDigest:string){possessed();return store.delegate(id,version,planDigest,principal)},
 });
}
