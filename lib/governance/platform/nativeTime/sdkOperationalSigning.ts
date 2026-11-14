import 'server-only';
import type {AwsSdkSigV4AuthResolvedConfig} from '@aws-sdk/core/httpAuthSchemes';
import {assertExecutionWindow,type ExecutionTimeSource,type ExecutionTimeWindow} from '../executionTime';
import {readOperationalTimeObservation} from './operationalSource';
const fail=():never=>{throw Error('operational_sdk_signing_unavailable')};
const dateText=(date:Date)=>date.toISOString().replace(/[:-]|\.\d{3}/g,'');
/** The actual installed resolved signer remains the cryptographic authority.
 * Operational dates are display/SDK millisecond conversions ONLY: exact ns
 * authorization precedes conversion and never uses the rounded date. */
export async function bindOperationalSdkSigning(client:{config:AwsSdkSigV4AuthResolvedConfig},clock:ExecutionTimeSource,window:ExecutionTimeWindow,signal:AbortSignal){
 const restriction=Object.freeze({...window}),first=await assertExecutionWindow(clock,restriction,signal),original=readOperationalTimeObservation(first),operational=original!==undefined;
 let expectedDate:string|undefined;
 async function presigningDate():Promise<Date|undefined>{
  const observation=await assertExecutionWindow(clock,restriction,signal),value=readOperationalTimeObservation(observation);
  if(!operational){if(value)return fail();return undefined}
  if(!value||value.profileDigest!==original!.profileDigest||value.revision!==original!.revision||value.hostGeneration!==original!.hostGeneration||value.sourceGeneration!==original!.sourceGeneration)return fail();
  // AWS SigV4 serializes dates to seconds; this conversion does not establish
  // not-before/expiry or project the observation to signing/HTTP completion.
  const date=new Date(Number(value.unixTimeNs/BigInt(1000000)));if(!Number.isFinite(date.getTime()))return fail();return date;
 }
 if(operational){
  if(!client.config||typeof client.config.signer!=='function')return fail();
  const provider=client.config.signer.bind(client.config);
  client.config.disableClockSkewCorrection=async()=>true;
  client.config.signer=async scheme=>{const signer=await provider(scheme);return {async sign(request,options){
   const signingDate=await presigningDate();if(!signingDate)return fail();
   const signed=await signer.sign(request,{...options,signingDate});signal.throwIfAborted();
   const wanted=dateText(signingDate);if(signed.headers['x-amz-date']!==wanted)return fail();expectedDate=wanted;return signed;
  }}};
 }
 return Object.freeze({presigningDate,
  assertSignedRequest(request:{headers:Record<string,string|undefined>}){if(operational&&(!expectedDate||request.headers['x-amz-date']!==expectedDate))return fail();signal.throwIfAborted()},
  assertPresignedUrl(url:string,date:Date|undefined){if(operational&&(!date||new URL(url).searchParams.get('X-Amz-Date')!==dateText(date)))return fail();signal.throwIfAborted()},
 });
}
