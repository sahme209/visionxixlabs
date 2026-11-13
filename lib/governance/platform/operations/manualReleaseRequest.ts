import 'server-only';
import type {ExecutionTimeSource} from '../executionTime';
import {createManualReleaseResultInspector,type ManualReleaseResultSupplier} from './manualReleaseResult';
import {bearerFromHeader} from '@/lib/desktop/desktopToken';
import {platformPrincipalSchema} from '../contracts';
import {assertCurrentPlatformPrincipal} from '../currentAuthority';
import {createManualReleaseStore,type ManualReleaseRepository,type ManualReleaseSource} from './manualReleaseStore';
interface Ports{clock:ExecutionTimeSource;repo:ManualReleaseRepository;source:ManualReleaseSource;resultSupplier?:ManualReleaseResultSupplier;verifyDesktopToken(token:string):{sessionId:string};readAdminEmails():readonly string[]}
const fail=():never=>{throw Error('manual_release_request_unavailable')};
/** Server-private composition, never request-supplied ports or principals. */
export async function createManualReleaseRequestComposition(request:{headers:Headers;signal?:AbortSignal},ports:Ports){
 function session(){request.signal?.throwIfAborted();const token=bearerFromHeader(request.headers.get('authorization'));if(!token||token.length>4096)fail();try{const result=ports.verifyDesktopToken(token!);if(typeof result.sessionId!=='string'||!result.sessionId||result.sessionId.length>256)fail();return result.sessionId}catch{return fail()}}
 const sessionId=session(),principal=await ports.repo.transaction(async tx=>{await tx.lock('manual-release-auth:'+sessionId);const p=platformPrincipalSchema.parse(await tx.readSessionPrincipal(sessionId));if(p.sessionId!==sessionId||session()!==sessionId)fail();await assertCurrentPlatformPrincipal(tx,p,ports.readAdminEmails);if(session()!==sessionId)fail();return p});
 const possessed=()=>{if(session()!==principal.sessionId)fail()};
 const sourceClock=ports.clock,clock:ExecutionTimeSource=async s=>{possessed();const value=await sourceClock(s);possessed();return value};
 const source=ports.source,build=source.buildCurrentManifest.bind(source),assertSource=source.assertCurrent.bind(source),readWindow=source.readTimeWindow.bind(source),privateSource:ManualReleaseSource={buildCurrentManifest:build,assertCurrent:assertSource,async readTimeWindow(...args:Parameters<ManualReleaseSource['readTimeWindow']>){possessed();const value=await readWindow(...args);possessed();return value}};
 const store=createManualReleaseStore(ports.repo,{async assertCurrent(tx,p){possessed();await assertCurrentPlatformPrincipal(tx,p,ports.readAdminEmails);possessed()}},privateSource,{clock,signal:request.signal});
 const results=ports.resultSupplier?createManualReleaseResultInspector(id=>store.inspect(id,principal),ports.resultSupplier,{clock,signal:request.signal,authorize:(view,check,signal)=>store.authorizeObservation(view,principal,check,signal)}):null;
 return Object.freeze({
  async prepare(raw:unknown,requestId:string){possessed();return store.prepare(raw,principal,requestId)},
  async lookup(requestId:string){possessed();return store.lookup(requestId,principal)},
  async inspectResult(id:string,deploymentId:string){possessed();if(!results)return fail();return results.inspect(id,deploymentId)},
  async inspect(id:string){possessed();return store.inspect(id,principal)},
  async review(id:string,version:number,digest:string){possessed();return store.review(id,version,digest,principal)},
  async recordNotice(id:string,version:number){possessed();return store.recordNotice(id,version,principal)},
 });
}
