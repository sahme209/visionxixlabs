import type {CustodianCredentialObservation} from './custodianCredentialContract';
import 'server-only';
import {randomUUID} from 'node:crypto';
import {STSClient,AssumeRoleCommand} from '@aws-sdk/client-sts';
import {awsReadEndpoint,boundedAwsHandler} from '@/lib/cloud/aws/ecsObservation/boundedAwsHandler';
import {readOperationalManifest} from './kernel';
import type {OperationalCredentialIssuer} from './delegation';
interface CustodianCredential{leaseRef:string;profileDigest:string;accessKeyId:string;secretAccessKey:string;sessionToken:string;expiresAt:number}
export interface PrivateOperationalStsPorts{
 assertQualified:OperationalCredentialIssuer['assertQualified'];
 assertSourceLeaseCurrent:NonNullable<OperationalCredentialIssuer['assertSourceCurrent']>;
 /** Private supplier only, never request JSON or SDK ambient chain. The source
  * lease MUST already be durably registered and qualified for the exact profile;
  * its lifetime is separate from this action's resulting session liability. */
 readCustodianCredential(manifest:Parameters<OperationalCredentialIssuer['issue']>[0],signal:AbortSignal):Promise<CustodianCredential>;
 /** Must recheck actual identity/custody, source lease and immutable profile;
  * structural matching is not a default qualifier. No production supplier. */
 assertCustodianCurrent(manifest:Parameters<OperationalCredentialIssuer['issue']>[0],credential:CustodianCredential,signal:AbortSignal):Promise<void>;
}
const fail=():never=>{throw Error('operational_private_sts_issuance_unavailable')};
/** Prepared private AssumeRole exchange. No GitHub-token input or fallback.
 * Missing issuer profile/registered source custody refuses; no default supplier
 * exists. This transport alone does not prove actual IAM or runtime isolation. */
export function createPrivateOperationalStsIssuer(ports:PrivateOperationalStsPorts):OperationalCredentialIssuer{return Object.freeze({assertQualified:ports.assertQualified,assertSourceCurrent:ports.assertSourceLeaseCurrent,async issue(rawManifest:Parameters<OperationalCredentialIssuer['issue']>[0],beforeIssue:()=>Promise<void>,signal:AbortSignal,recordSource?: (metadata:CustodianCredentialObservation)=>Promise<void>){
 let client:STSClient|undefined;
 try{
  const manifest=readOperationalManifest(rawManifest);if(manifest.kind!=='deployment.ecs')return fail();signal.throwIfAborted();
  if(!manifest.issuerProfileDigest)return fail();
  const supplied=await ports.readCustodianCredential(manifest,signal);signal.throwIfAborted();
  if(!supplied)return fail();const source=Object.freeze({leaseRef:supplied.leaseRef,profileDigest:supplied.profileDigest,accessKeyId:supplied.accessKeyId,secretAccessKey:supplied.secretAccessKey,sessionToken:supplied.sessionToken,expiresAt:supplied.expiresAt});
  if(!source||source.profileDigest!==manifest.issuerProfileDigest||!/^platform_credential_[a-f0-9-]{36}$/.test(source.leaseRef)||![source.accessKeyId,source.secretAccessKey,source.sessionToken].every(v=>typeof v==='string'&&v.length>0&&v.length<=16384&&!/[\r\n]/.test(v))||!Number.isSafeInteger(source.expiresAt)||source.expiresAt<=Date.now())return fail();
  await ports.assertCustodianCurrent(manifest,source,signal);signal.throwIfAborted();if(!recordSource)return fail();await recordSource({leaseRef:source.leaseRef,profileDigest:source.profileDigest,expiresAt:source.expiresAt});signal.throwIfAborted();
  const leaseId=randomUUID(),session='axiom-'+leaseId,endpoint=new URL(awsReadEndpoint('sts',manifest.target.region,'aws'));
  const policy=JSON.stringify({Version:'2012-10-17',Statement:[{Effect:'Allow',Action:['ecs:UpdateService'],Resource:[manifest.target.serviceArn]}]});
  const expected=new Map(Object.entries({Action:'AssumeRole',Version:'2011-06-15',RoleArn:manifest.roleArn,RoleSessionName:session,DurationSeconds:'900',Policy:policy}));
  const bounded=boundedAwsHandler(signal,{remaining:65536},{maxBytes:65536,timeoutMs:6000});let used=false;
  const handler={metadata:bounded.metadata,destroy:()=>bounded.destroy(),async handle(request:Parameters<typeof bounded.handle>[0],options:Parameters<typeof bounded.handle>[1]){
   if(used||signal.aborted||request.protocol!=='https:'||request.hostname!==endpoint.hostname||request.port!==undefined&&request.port!==443||request.method!=='POST'||request.path!=='/'||Object.keys(request.query??{}).length||typeof request.headers.authorization!=='string'||!request.headers.authorization.startsWith('AWS4-HMAC-SHA256 Credential='+source.accessKeyId+'/')||!request.headers.authorization.includes('/'+manifest.target.region+'/sts/aws4_request')||request.headers['x-amz-security-token']!==source.sessionToken)return fail();used=true;
   const bytes=typeof request.body==='string'?Buffer.from(request.body,'utf8'):request.body instanceof Uint8Array?Buffer.from(request.body):null;if(!bytes||bytes.length>32768)return fail();
   const fields=new URLSearchParams(new TextDecoder('utf-8',{fatal:true}).decode(bytes));if(Array.from(fields).length!==expected.size||Array.from(expected).some(([key,value])=>fields.getAll(key).length!==1||fields.get(key)!==value))return fail();
   if(source.expiresAt<=Date.now())return fail();await ports.assertCustodianCurrent(manifest,source,signal);signal.throwIfAborted();await beforeIssue();signal.throwIfAborted();return bounded.handle(request,options);
  }};
  client=new STSClient({region:manifest.target.region,endpoint:endpoint.href,ignoreConfiguredEndpointUrls:true,useFipsEndpoint:false,useDualstackEndpoint:false,maxAttempts:1,credentials:{accessKeyId:source.accessKeyId,secretAccessKey:source.secretAccessKey,sessionToken:source.sessionToken},requestHandler:handler});
  const result=await client.send(new AssumeRoleCommand({RoleArn:manifest.roleArn,RoleSessionName:session,DurationSeconds:900,Policy:policy}),{abortSignal:signal});signal.throwIfAborted();
  const credential=result.Credentials,roleName=manifest.roleArn.split('/').at(-1),now=Date.now(),expiresAt=credential?.Expiration?.getTime();
  if(!used||result.$metadata.httpStatusCode!==200||!result.$metadata.requestId||!credential||!credential.AccessKeyId||!credential.SecretAccessKey||!credential.SessionToken||!Number.isSafeInteger(expiresAt)||expiresAt!<=now||expiresAt!>now+900000||result.AssumedRoleUser?.Arn!==`arn:aws:sts::${manifest.target.accountId}:assumed-role/${roleName}/${session}`||!result.AssumedRoleUser.AssumedRoleId?.endsWith(':'+session))return fail();
  return Object.freeze({leaseRef:'platform_credential_'+leaseId,accessKeyId:credential.AccessKeyId,secretAccessKey:credential.SecretAccessKey,sessionToken:credential.SessionToken,expiresAt:expiresAt!});
 }catch{return fail()}finally{client?.destroy()}
}})}
