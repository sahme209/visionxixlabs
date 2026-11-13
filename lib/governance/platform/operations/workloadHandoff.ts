import 'server-only';
import {z} from 'zod';
import {readBoundedGithubBody,withGithubAbort} from '@/lib/connectors/github/boundedGithubRead';
import {operationalWorkloadReference} from './contracts';
import {operationalWorkloadCommand} from './workloadCommand';
import {readOperationalEcsResult} from './ecsExecution';
import {digest} from '../contracts';
const captureSchema=operationalWorkloadReference.safeExtend({environment:z.string().regex(/^[-A-Za-z0-9_ ]{1,128}$/),protectionRevision:digest,endpoint:z.string().max(2048),audience:z.string().regex(/^[-A-Za-z0-9_]{1,256}$/),manifestDigest:digest}).strict();
type Command=z.infer<typeof operationalWorkloadCommand>;
export type OperationalHandoffCapture=z.infer<typeof captureSchema>;
/** Protected source only, not HTTP JSON or a workflow input. Must qualify the
 * actual pending/released run, current native protections and fixed ingress.
 * readToken must acquire a fresh exact-audience token in that SAME released job.
 * No default/ambient/GitHub endpoint supplier is installed by this interface. */
export interface OperationalHandoffSource {
 capture(command:Readonly<Command>,signal:AbortSignal):Promise<unknown>;
 assertCurrent(capture:Readonly<OperationalHandoffCapture>,command:Readonly<Command>,signal:AbortSignal):Promise<void>;
 readToken(capture:Readonly<OperationalHandoffCapture>,signal:AbortSignal):Promise<string>;
}
const fail=():never=>{throw Error('operational_handoff_unconfirmed')};
/** One job-local attempt. Only a fresh server-side signed exact-run claim can
 * authorize execution; this sender cannot approve, delegate, select another run
 * or mint an AWS credential. A lost reply stays consumed even before dispatch.
 * Prepared source only: no active workflow or native source qualification. */
export function createOperationalWorkloadHandoff(source:OperationalHandoffSource){
 let used=false;
 return Object.freeze({async submit(raw:unknown,parent:AbortSignal){
  if(used)return fail();used=true;
  const controller=new AbortController(),signal=AbortSignal.any([parent,controller.signal]);
  const timer=setTimeout(()=>controller.abort(),40000);
  try{
   signal.throwIfAborted();const command=Object.freeze(operationalWorkloadCommand.parse(raw));
   const capture=Object.freeze(captureSchema.parse(await withGithubAbort(source.capture(command,signal),signal)));
   const endpoint=new URL(capture.endpoint);
   if(endpoint.protocol!=='https:'||endpoint.username||endpoint.password||endpoint.port||endpoint.search||endpoint.hash||endpoint.href!==capture.endpoint||!/^([a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z][a-z0-9-]*$/.test(endpoint.hostname))return fail();
   await withGithubAbort(source.assertCurrent(capture,command,signal),signal);signal.throwIfAborted();
   const token=await withGithubAbort(source.readToken(capture,signal),signal);
   if(typeof token!=='string'||token.length>16384||!/^[-A-Za-z0-9_]+\.[-A-Za-z0-9_]+\.[-A-Za-z0-9_]+$/.test(token))return fail();
   await withGithubAbort(source.assertCurrent(capture,command,signal),signal);signal.throwIfAborted();
   const response=await withGithubAbort(fetch(endpoint.href,{method:'POST',redirect:'error',credentials:'omit',cache:'no-store',signal,headers:{authorization:'Bearer '+token,'content-type':'application/json'},body:JSON.stringify(command)}),signal);
   if(response.status!==200){void response.body?.cancel().catch(()=>{});return fail()}
   const bytes=await readBoundedGithubBody(response,signal,65536),envelope=z.object({ok:z.literal(true),data:z.unknown()}).strict().parse(JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes))),result=readOperationalEcsResult(envelope.data);
   if(result.actionId!==command.actionId||result.manifestDigest!==capture.manifestDigest)return fail();
   await withGithubAbort(source.assertCurrent(capture,command,signal),signal);signal.throwIfAborted();
   return result;
  }catch{return fail()}finally{clearTimeout(timer);controller.abort()}
 }});
}
