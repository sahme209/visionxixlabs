import 'server-only';
import {bearerFromHeader} from '@/lib/desktop/desktopToken';
import {platformPrincipalSchema,type PlatformPrincipal} from './contracts';
import {assertCurrentPlatformPrincipal} from './currentAuthority';
import type {PlatformTransaction} from './actionStore';
import {createDeploymentRecoveryService,type DeploymentRecoveryRepository,type DeploymentRecoverySource} from './deploymentRecoveryStore';
interface Ports {repo:DeploymentRecoveryRepository;source:DeploymentRecoverySource;verifyDesktopToken(token:string):{sessionId:string};readAdminEmails():readonly string[]}
const fail=():never=>{throw Error('platform_deployment_recovery_request_unavailable')};
/** Existing signed paired possession/current SQL only. No caller-selected actor,
 * cookie/API-key/workload fallback or source profile inferred from command data. */
export async function createDeploymentRecoveryRequestComposition(request:{headers:Headers;signal?:AbortSignal},ports:Ports){
 function session(){if(request.signal?.aborted)return fail();const token=bearerFromHeader(request.headers.get('authorization'));if(!token||token.length>4096)return fail();try{const p=ports.verifyDesktopToken(token);if(typeof p.sessionId!=='string'||!p.sessionId||p.sessionId.length>256)return fail();return p.sessionId}catch{return fail()}}
 const id=session(),principal=await ports.repo.transaction(async tx=>{await tx.lock('platform-deployment-recovery-auth:'+id);const actor=platformPrincipalSchema.parse(await tx.readSessionPrincipal(id));if(actor.sessionId!==id||session()!==id)return fail();await assertCurrentPlatformPrincipal(tx,actor,ports.readAdminEmails);if(session()!==id)return fail();return actor});
 const possessed=()=>{if(session()!==principal.sessionId)return fail()},authority={async assertCurrent(tx:PlatformTransaction,actor:PlatformPrincipal){possessed();await assertCurrentPlatformPrincipal(tx,actor,ports.readAdminEmails);possessed()}};
 const source:DeploymentRecoverySource={async assertCurrent(tx,plan){possessed();await ports.source.assertCurrent(tx,plan);possessed()},async assertEvidenceCurrent(tx,plan,evidence){possessed();await ports.source.assertEvidenceCurrent(tx,plan,evidence);possessed()},async readTerminal(plan,signal){possessed();const joined=request.signal?AbortSignal.any([request.signal,signal]):signal;joined.throwIfAborted();const result=await ports.source.readTerminal(plan,joined);possessed();joined.throwIfAborted();return result}},store=createDeploymentRecoveryService(ports.repo,authority,source);
 async function call<T>(fn:()=>Promise<T>){possessed();const result=await fn();possessed();return result}
 return Object.freeze({prepare:(selection:unknown,reference:string)=>call(()=>store.prepare(selection,principal,reference)),lookup:(reference:string)=>call(()=>store.lookup(reference,principal)),inspect:(actionId:string)=>call(()=>store.inspect(actionId,principal)),preview:(actionId:string)=>call(()=>store.preview(actionId,principal)),review:(actionId:string,version:number,digest:string)=>call(()=>store.review(actionId,version,digest,principal)),observe:(actionId:string,version:number,digest:string)=>call(()=>store.observe(actionId,version,principal,digest))});
}
