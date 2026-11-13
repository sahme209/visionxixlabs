import 'server-only';
import {randomUUID} from 'node:crypto';
import {STSClient,AssumeRoleWithWebIdentityCommand} from '@aws-sdk/client-sts';
import {awsReadEndpoint,boundedAwsHandler} from '@/lib/cloud/aws/ecsObservation/boundedAwsHandler';
import {readOperationalManifest} from './kernel';
import type {OperationalCredentialIssuer} from './delegation';
interface Ports{
 /** Must qualify the exact role/trust, generated session policy, original run,
  * immutable image/source and protected token custody. No default supplier. */
 assertQualified:OperationalCredentialIssuer['assertQualified'];
 readWebIdentityToken(manifest:Parameters<OperationalCredentialIssuer['issue']>[0],signal:AbortSignal):Promise<string>;
 /** Rechecks that this actual token is the same consumed private workload.
  * Decoding caller JSON or matching an unverified subject is insufficient. */
 assertTokenCurrent(manifest:Parameters<OperationalCredentialIssuer['issue']>[0],token:string,signal:AbortSignal):Promise<void>;
}
const fail=():never=>{throw Error('operational_sts_issuance_unavailable')};
/** Fixed private regional exchange. The role's permissions still intersect this
 * service-scoped session policy; no broader role, provider action or arbitrary
 * policy may be selected by a request. Real source/custody/IAM qualification is
 * separate and unavailable by default. Issued credentials remain private. */
export function createOperationalStsIssuer(ports:Ports):OperationalCredentialIssuer{return Object.freeze({assertQualified:ports.assertQualified,async issue(rawManifest:Parameters<OperationalCredentialIssuer['issue']>[0],beforeIssue:()=>Promise<void>,signal:AbortSignal){
 let client:STSClient|undefined;
 try{
  const manifest=readOperationalManifest(rawManifest);if(manifest.kind!=='deployment.ecs')return fail();signal.throwIfAborted();
  const token=await ports.readWebIdentityToken(manifest,signal);signal.throwIfAborted();if(typeof token!=='string'||token.length>16384||!/^[-A-Za-z0-9_]+\.[-A-Za-z0-9_]+\.[-A-Za-z0-9_]+$/.test(token))return fail();
  const leaseId=randomUUID(),session='axiom-'+leaseId,endpoint=new URL(awsReadEndpoint('sts',manifest.target.region,'aws'));
  const policy=JSON.stringify({Version:'2012-10-17',Statement:[{Effect:'Allow',Action:['ecs:UpdateService'],Resource:[manifest.target.serviceArn]}]});
  const expected=new Map(Object.entries({Action:'AssumeRoleWithWebIdentity',Version:'2011-06-15',RoleArn:manifest.roleArn,RoleSessionName:session,WebIdentityToken:token,DurationSeconds:'900',Policy:policy}));
  const bounded=boundedAwsHandler(signal,{remaining:65536},{maxBytes:65536,timeoutMs:6000});let used=false;
  const handler={metadata:bounded.metadata,destroy:()=>bounded.destroy(),async handle(request:Parameters<typeof bounded.handle>[0],options:Parameters<typeof bounded.handle>[1]){
   if(used||signal.aborted||request.protocol!=='https:'||request.hostname!==endpoint.hostname||request.port!==undefined&&request.port!==443||request.method!=='POST'||request.path!=='/'||Object.keys(request.query??{}).length||request.headers.authorization||request.headers['x-amz-security-token'])return fail();used=true;
   const bytes=typeof request.body==='string'?Buffer.from(request.body,'utf8'):request.body instanceof Uint8Array?Buffer.from(request.body):null;if(!bytes||bytes.length>32768)return fail();
   const fields=new URLSearchParams(new TextDecoder('utf-8',{fatal:true}).decode(bytes));if(Array.from(fields).length!==expected.size||Array.from(expected).some(([key,value])=>fields.getAll(key).length!==1||fields.get(key)!==value))return fail();
   await ports.assertTokenCurrent(manifest,token,signal);signal.throwIfAborted();await beforeIssue();signal.throwIfAborted();return bounded.handle(request,options);
  }};
  client=new STSClient({region:manifest.target.region,endpoint:endpoint.href,ignoreConfiguredEndpointUrls:true,useFipsEndpoint:false,useDualstackEndpoint:false,maxAttempts:1,credentials:async()=>fail(),requestHandler:handler});
  const result=await client.send(new AssumeRoleWithWebIdentityCommand({RoleArn:manifest.roleArn,RoleSessionName:session,WebIdentityToken:token,DurationSeconds:900,Policy:policy}),{abortSignal:signal});signal.throwIfAborted();
  const credential=result.Credentials,roleName=manifest.roleArn.split('/').at(-1),now=Date.now(),expiresAt=credential?.Expiration?.getTime();
  if(!used||result.$metadata.httpStatusCode!==200||!result.$metadata.requestId||!credential||!credential.AccessKeyId||!credential.SecretAccessKey||!credential.SessionToken||!Number.isSafeInteger(expiresAt)||expiresAt!<=now||expiresAt!>now+900000||result.AssumedRoleUser?.Arn!==`arn:aws:sts::${manifest.target.accountId}:assumed-role/${roleName}/${session}`||!result.AssumedRoleUser.AssumedRoleId?.endsWith(':'+session))return fail();
  return Object.freeze({leaseRef:'platform_credential_'+leaseId,accessKeyId:credential.AccessKeyId,secretAccessKey:credential.SecretAccessKey,sessionToken:credential.SessionToken,expiresAt:expiresAt!});
 }catch{return fail()}finally{client?.destroy()}
}})}
