import type {ExecutionTimeSource} from '../executionTime';
import {createSettingsExecutor} from './settingsExecution';
import {createSettingsPreparationStore,type SettingsPreparationSource} from './settingsPreparation';
import 'server-only';
import {bearerFromHeader} from '@/lib/desktop/desktopToken';
import {platformPrincipalSchema} from '../contracts';
import {assertCurrentPlatformPrincipal} from '../currentAuthority';
import {createSettingsArtifactStore,type SettingsArtifactRepository} from './settingsArtifactStore';
interface Ports{
 repo:SettingsArtifactRepository;
 clock?:ExecutionTimeSource;
 preparationSource?:SettingsPreparationSource;
 execution?:{assertWriteProfile:Parameters<typeof createSettingsExecutor>[2]['assertWriteProfile'];transport:Parameters<typeof createSettingsExecutor>[3]};
 source:Parameters<typeof createSettingsArtifactStore>[2];
 verifyDesktopToken(token:string):{sessionId:string};
 readAdminEmails():readonly string[];
}
const fail=():never=>{throw Error('settings_artifact_request_unavailable')};
/** Private server composition only; no public route, principal JSON, cookie,
 * API-key fallback, credential export or provider execution. */
export async function createSettingsArtifactRequestComposition(request:{headers:Headers;signal?:AbortSignal},ports:Ports){
 function session(){if(request.signal?.aborted)return fail();const token=bearerFromHeader(request.headers.get('authorization'));if(!token||token.length>4096)return fail();try{const result=ports.verifyDesktopToken(token);if(typeof result.sessionId!=='string'||!result.sessionId||result.sessionId.length>256)return fail();return result.sessionId}catch{return fail()}}
 const sessionId=session(),principal=await ports.repo.transaction(async tx=>{
  await tx.lock('platform-settings-auth:'+sessionId);const p=platformPrincipalSchema.parse(await tx.readSessionPrincipal(sessionId));
  if(p.sessionId!==sessionId||session()!==sessionId)return fail();await assertCurrentPlatformPrincipal(tx,p,ports.readAdminEmails);if(session()!==sessionId)return fail();return p;
 });
 const possessed=()=>{if(session()!==principal.sessionId)return fail()};
 const clock=ports.clock,timing={clock:async(signal:AbortSignal)=>{possessed();if(typeof clock!=='function')return fail();const value=await clock(signal);possessed();return value},signal:request.signal};
 const store=createSettingsArtifactStore(ports.repo,{async assertCurrent(tx,p){possessed();await assertCurrentPlatformPrincipal(tx,p,ports.readAdminEmails);possessed()}},ports.source,timing);
 const preparation=ports.preparationSource?createSettingsPreparationStore(ports.repo,{async assertCurrent(tx,p){possessed();await assertCurrentPlatformPrincipal(tx,p,ports.readAdminEmails);possessed()}},ports.preparationSource,timing):null;
 const executor=ports.execution?createSettingsExecutor(ports.repo,{async assertCurrent(tx,p){possessed();await assertCurrentPlatformPrincipal(tx,p,ports.readAdminEmails);possessed()}},{...ports.source,assertWriteProfile:ports.execution.assertWriteProfile},ports.execution.transport):null;
 return Object.freeze({
  async executeNext(id:string,effectIndex:number){possessed();if(!executor)return fail();return executor.executeNext(id,principal,effectIndex)},
  async prepare(raw:unknown,requestId:string){possessed();if(!preparation)return fail();return preparation.prepare(raw,requestId,principal)},
  async lookup(requestId:string){possessed();if(!preparation)return fail();return preparation.lookup(requestId,principal)},
  async inspect(id:string){possessed();return store.inspect(id,principal)},
  async claim(id:string,version:number,planDigest:string){possessed();return store.claim(id,version,planDigest,principal)},
  async preview(id:string){possessed();return store.preview(id,principal)},
  async save(id:string,index:number,value:unknown){possessed();return store.save(id,index,principal,value)},
  async review(id:string,version:number,planDigest:string){possessed();return store.review(id,version,planDigest,principal)},
 });
}
