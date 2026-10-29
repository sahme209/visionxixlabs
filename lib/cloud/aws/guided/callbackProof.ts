import 'server-only';
import {z} from 'zod';
import {readBoundedGithubBody,withGithubAbort} from '@/lib/connectors/github/boundedGithubRead';
import type {AwsGuidedRow} from './service';
/** Optional server verifier. Never installed merely by importing this module.
 * Presigned URLs are authentication proofs: never log/persist/return them. */
export function createAwsGuidedCallbackVerifier(fetchImpl:typeof fetch=fetch){return async(row:Readonly<AwsGuidedRow>,raw:unknown,parent:AbortSignal)=>{
 const proof=z.object({signedIdentityRequest:z.string().min(1).max(8192),stackId:z.string().min(1).max(512),region:z.string().regex(/^us-(?:east|west)-[12]$/)}).strict().parse(raw);
 const v=z.object({choice:z.object({accountId:z.string().regex(/^\d{12}$/),region:z.string()}).passthrough()}).passthrough().parse(row.inputJson);
 const u=new URL(proof.signedIdentityRequest);const keys=['Action','Version','X-Amz-Algorithm','X-Amz-Credential','X-Amz-Date','X-Amz-Expires','X-Amz-SignedHeaders','X-Amz-Signature','X-Amz-Security-Token'];
 if(proof.region!==v.choice.region||u.protocol!=='https:'||u.hostname!==`sts.${v.choice.region}.amazonaws.com`||u.port||u.username||u.password||u.hash||u.pathname!=='/'||[...u.searchParams.keys()].some(k=>!keys.includes(k))||keys.some(k=>u.searchParams.getAll(k).length!==1)||u.searchParams.get('Action')!=='GetCallerIdentity'||u.searchParams.get('Version')!=='2011-06-15'||u.searchParams.get('X-Amz-Algorithm')!=='AWS4-HMAC-SHA256'||u.searchParams.get('X-Amz-SignedHeaders')!=='host'||!/^(?:[1-9]|[12]\d|30)$/.test(u.searchParams.get('X-Amz-Expires')??'')||!u.searchParams.get('X-Amz-Credential')?.includes(`/${v.choice.region}/sts/aws4_request`))throw Error('aws_guided_proof_invalid');
 const signal=AbortSignal.any([parent,AbortSignal.timeout(6000)]);signal.throwIfAborted();let response:Response|undefined;
 try{const pending=fetchImpl(u.toString(),{method:'GET',redirect:'error',credentials:'omit',cache:'no-store',signal});void pending.then(r=>{if(signal.aborted)void r.body?.cancel().catch(()=>{})},()=>{});response=await withGithubAbort(pending,signal);signal.throwIfAborted();const bytes=await readBoundedGithubBody(response,signal,16384);const xml=new TextDecoder('utf-8',{fatal:true}).decode(bytes);signal.throwIfAborted();
  if(/<!|&/.test(xml)||!xml.includes('<GetCallerIdentityResponse')||xml.includes('<Error'))throw Error('aws_guided_proof_invalid');
  const accounts=[...xml.matchAll(/<Account>(\d{12})<\/Account>/g)],arns=[...xml.matchAll(/<Arn>([^<>]+)<\/Arn>/g)];const role=`AxiomCallback-${row.id.slice(-24)}`;
  if(accounts.length!==1||accounts[0][1]!==v.choice.accountId||arns.length!==1||!new RegExp(`^arn:aws:sts::${v.choice.accountId}:assumed-role/${role}/[A-Za-z0-9+=,.@_-]{1,128}$`).test(arns[0][1]))throw Error('aws_guided_proof_invalid');
  return{accountId:accounts[0][1],region:proof.region,stackId:proof.stackId};
 }finally{if(signal.aborted)void response?.body?.cancel().catch(()=>{})}
};}
