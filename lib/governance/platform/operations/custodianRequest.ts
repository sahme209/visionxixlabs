import 'server-only';
import {bearerFromHeader} from '@/lib/desktop/desktopToken';
import {platformPrincipalSchema,type PlatformPrincipal} from '../contracts';
import {assertCurrentPlatformPrincipal} from '../currentAuthority';
import type {PlatformTransaction} from '../actionStore';
import {createCustodianDrainService} from './custodianDrainStore';
import {createCustodianClosureService,type CustodianClosureRepository} from './custodianClosureStore';
import {custodianClosureSummary} from './custodianClosureSummary';
interface Ports{repo:CustodianClosureRepository;drainSource:Parameters<typeof createCustodianDrainService>[2];closureSource:Parameters<typeof createCustodianClosureService>[2];verifyDesktopToken(token:string):{sessionId:string};readAdminEmails():readonly string[]}
const fail=():never=>{throw Error('custodian_request_unavailable')};
/** Existing paired possession + current platform SQL authority, no new identity
 * scheme, workspace-owner alias, cookie/API-key/workload fallback or self-heal. */
export async function createCustodianRequestComposition(request:{headers:Headers;signal?:AbortSignal},ports:Ports){
 function session(){if(request.signal?.aborted)return fail();const token=bearerFromHeader(request.headers.get('authorization'));if(!token||token.length>4096)return fail();try{const p=ports.verifyDesktopToken(token);if(typeof p.sessionId!=='string'||!p.sessionId||p.sessionId.length>256)return fail();return p.sessionId}catch{return fail()}}
 const id=session(),principal=await ports.repo.transaction(async tx=>{await tx.lock('platform-custodian-auth:'+id);const actor=platformPrincipalSchema.parse(await tx.readSessionPrincipal(id));if(actor.sessionId!==id||session()!==id)return fail();await assertCurrentPlatformPrincipal(tx,actor,ports.readAdminEmails);if(session()!==id)return fail();return actor});
 const possessed=()=>{if(session()!==principal.sessionId)return fail()},authority={async assertCurrent(tx:PlatformTransaction,actor:PlatformPrincipal){possessed();await assertCurrentPlatformPrincipal(tx,actor,ports.readAdminEmails);possessed()}},drain=createCustodianDrainService(ports.repo,authority,ports.drainSource,request.signal),closure=createCustodianClosureService(ports.repo,authority,ports.closureSource);
 async function call<T>(fn:()=>Promise<T>){possessed();const data=await fn();possessed();return data}
 return Object.freeze({
  prepare:(selection:unknown,reference:string)=>call(()=>drain.prepare(selection,principal,reference)),
  lookup:(reference:string)=>call(()=>drain.lookup(reference,principal)),
  inspect:(actionId:string,afterSequence?:number)=>call(()=>drain.inspect(actionId,principal,afterSequence)),
  preview:(actionId:string)=>call(()=>drain.preview(actionId,principal)),
  review:(actionId:string,version:number,digest:string)=>call(()=>drain.review(actionId,version,digest,principal)),
  executeControl:(actionId:string,version:number)=>call(()=>drain.execute(actionId,version,principal)),
  observeClosure:(actionId:string,refresh:boolean)=>call(async()=>{const result=await closure.observe(actionId,principal,refresh,request.signal);return {...result,observation:custodianClosureSummary(result.observation)}}),
 });
}
