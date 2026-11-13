import type {EcsDecisionTimeSource} from './ecsDecisionTime';
import type {ExecutionTimeSource} from '../executionTime';
import {createEcsPreparationStore,type EcsPreparationSource} from './ecsPreparation';
import 'server-only';
import {bearerFromHeader} from '@/lib/desktop/desktopToken';
import {platformPrincipalSchema} from '../contracts';
import {assertCurrentPlatformPrincipal} from '../currentAuthority';
import {createOperationalDelegationStore} from './delegation';
interface Ports{
 clock?:ExecutionTimeSource;
 repo:Parameters<typeof createOperationalDelegationStore>[0];
 source:Parameters<typeof createOperationalDelegationStore>[2];
 identity:Parameters<typeof createOperationalDelegationStore>[3];
 preparationSource?:EcsPreparationSource;
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
 const clock=ports.clock,guardedClock:ExecutionTimeSource=async signal=>{possessed();if(typeof clock!=='function')return fail();const result=await clock(signal);possessed();return result},timing={clock:guardedClock,signal:request.signal};
 const authority={async assertCurrent(tx:import('../actionStore').PlatformTransaction,p:import('../contracts').PlatformPrincipal){possessed();await assertCurrentPlatformPrincipal(tx,p,ports.readAdminEmails);possessed()}};
 function guardedWindow(source:EcsDecisionTimeSource){const read=source.readTimeWindow?.bind(source);return read?async(...args:Parameters<NonNullable<EcsDecisionTimeSource['readTimeWindow']>>)=>{possessed();const value=await read(...args);possessed();return value}:undefined}
 const source=ports.source,preparationSource=ports.preparationSource;
 const privateSource={readManifest:source.readManifest.bind(source),assertCurrent:source.assertCurrent.bind(source),readTimeWindow:guardedWindow(source)},privatePreparation=preparationSource?{assertCurrent:preparationSource.assertCurrent.bind(preparationSource),readTimeWindow:guardedWindow(preparationSource)}:{assertCurrent:async()=>fail()};
 const store=createOperationalDelegationStore(ports.repo,authority,privateSource,ports.identity,ports.targets,undefined,undefined,undefined,timing),preparation=createEcsPreparationStore(ports.repo,authority,privatePreparation,timing);
 return Object.freeze({
  async preview(id:string){possessed();return preparation.preview(id,principal)},
  async review(id:string,version:number,planDigest:string){possessed();return preparation.review(id,version,planDigest,principal)},
  async prepare(selection:unknown,requestId:string){possessed();return preparation.prepare(selection,requestId,principal)},
  async lookup(requestId:string){possessed();return preparation.lookup(requestId,principal)},
  async inspect(id:string){possessed();return store.inspect(id,principal)},
  async observeTarget(id:string){possessed();return store.observeTarget(id,principal)},
  async delegate(id:string,version:number,planDigest:string){possessed();return store.delegate(id,version,planDigest,principal)},
 });
}
