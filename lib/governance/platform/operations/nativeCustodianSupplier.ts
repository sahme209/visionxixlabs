import {assertExecutionWindow} from '../executionTime';
import 'server-only';
import {randomUUID} from 'node:crypto';
import {z} from 'zod';
import {readOperationalManifest} from './kernel';
import {readNativeCustodianResponse} from './nativeCustodianHttp';
import type {PrivateOperationalStsPorts} from './privateStsIssuer';

type Manifest=Parameters<PrivateOperationalStsPorts['readCustodianCredential']>[0];
type Credential=Awaited<ReturnType<PrivateOperationalStsPorts['readCustodianCredential']>>;
/** Private launch capture only. These structural fields NEVER qualify a host.
 * The supplied qualifier must establish actual protected runtime/trust/fleet
 * evidence and current trusted time; no production qualifier is implemented. */
export interface NativeCustodianCapture {
 readonly profileDigest:string;
 readonly relativePath:string;
 readonly sourceRoleArn:string;
 readonly maximumExpiresAt:number;
}
export interface NativeCustodianQualification {
 assertQualified:PrivateOperationalStsPorts['assertQualified'];
 assertSourceLeaseCurrent:PrivateOperationalStsPorts['assertSourceLeaseCurrent'];
 capture(manifest:Manifest,signal:AbortSignal):Promise<NativeCustodianCapture>;
 assertCurrent(manifest:Manifest,capture:Readonly<NativeCustodianCapture>,signal:AbortSignal):Promise<void>;
 clock(signal:AbortSignal):Promise<{earliest:number;latest:number}>;
}
const credentialText=(max:number)=>z.string().min(1).max(max).refine(v=>!/[\s\x00-\x1f\x7f]/.test(v));
const response=z.object({RoleArn:z.string().max(2048),AccessKeyId:credentialText(128),SecretAccessKey:credentialText(8192),Token:credentialText(16384),Expiration:z.string().datetime()}).strict();
const fail=():never=>{throw Error('custodian_native_supplier_unavailable')};
/** Supplies the actual private STS port, retaining opaque credential ownership.
 * Called by the existing runner only AFTER durable source-intent admission.
 * No ambient credentials, defaults, refresh, memoization or public registration.
 * Native acquisition uncertainty is handled by the original delegation ledger. */
export function createNativeCustodianPorts(qualification:NativeCustodianQualification):PrivateOperationalStsPorts {
 const clock=qualification.clock.bind(qualification);
 const issued=new WeakMap<object,{manifestDigest:string;capture:Readonly<NativeCustodianCapture>}>();
 async function current(manifest:Manifest,capture:Readonly<NativeCustodianCapture>,signal:AbortSignal,expiresAt?:number){
  signal.throwIfAborted();await qualification.assertCurrent(manifest,capture,signal);signal.throwIfAborted();
  if(expiresAt!==undefined&&expiresAt>capture.maximumExpiresAt)return fail();
  await assertExecutionWindow(clock,{expiresAt:expiresAt??capture.maximumExpiresAt},signal);
  await qualification.assertCurrent(manifest,capture,signal);signal.throwIfAborted();
 }
 return Object.freeze({clock,assertQualified:qualification.assertQualified,assertSourceLeaseCurrent:qualification.assertSourceLeaseCurrent,
  async readCustodianCredential(raw:Manifest,signal:AbortSignal){try{
   const manifest=readOperationalManifest(raw);if(manifest.kind!=='deployment.ecs'||!manifest.issuerProfileDigest)return fail();signal.throwIfAborted();
   const supplied=await qualification.capture(manifest,signal);signal.throwIfAborted();
   const capture=Object.freeze({profileDigest:supplied.profileDigest,relativePath:supplied.relativePath,sourceRoleArn:supplied.sourceRoleArn,maximumExpiresAt:supplied.maximumExpiresAt});
   if(capture.profileDigest!==manifest.issuerProfileDigest||!/^\/v2\/credentials\/[A-Za-z0-9_-]{1,128}$/.test(capture.relativePath)||!/^arn:aws:iam::[0-9]{12}:role\/[A-Za-z0-9_+=,.@\/-]+$/.test(capture.sourceRoleArn)||capture.sourceRoleArn===manifest.roleArn||!capture.sourceRoleArn.startsWith(`arn:aws:iam::${manifest.target.accountId}:role/`)||!Number.isSafeInteger(capture.maximumExpiresAt))return fail();
   await current(manifest,capture,signal);
   const text=await readNativeCustodianResponse(capture.relativePath,signal);signal.throwIfAborted();
   const native=response.parse(JSON.parse(text)),expiresAt=Date.parse(native.Expiration);
   if(native.RoleArn!==capture.sourceRoleArn||!Number.isSafeInteger(expiresAt))return fail();
   await current(manifest,capture,signal,expiresAt);
   const credential=Object.freeze({leaseRef:'platform_credential_'+randomUUID(),profileDigest:capture.profileDigest,accessKeyId:native.AccessKeyId,secretAccessKey:native.SecretAccessKey,sessionToken:native.Token,expiresAt});
   issued.set(credential,{manifestDigest:manifest.digest,capture});return credential;
  }catch{return fail()}},
  async assertCustodianCurrent(raw:Manifest,credential:Credential,signal:AbortSignal){try{
   const manifest=readOperationalManifest(raw),held=issued.get(credential);
   if(!held||manifest.kind!=='deployment.ecs'||held.manifestDigest!==manifest.digest||manifest.issuerProfileDigest!==held.capture.profileDigest)return fail();
   await current(manifest,held.capture,signal,credential.expiresAt);
  }catch{return fail()}}
 });
}
