import {operationalWorkloadCommand as command} from './workloadCommand';
import 'server-only';
import {createOperationalDelegationStore,type OperationalCredentialIssuer} from './delegation';
import {createPrivateOperationalStsIssuer,type PrivateOperationalStsPorts} from './privateStsIssuer';
import {readOperationalManifest} from './kernel';
import type {OperationalEcsTransport} from './ecsExecution';
type StoreArgs=Parameters<typeof createOperationalDelegationStore>;
interface Ports{repo:StoreArgs[0];authority:StoreArgs[1];source:StoreArgs[2];identity:StoreArgs[3];targets:NonNullable<StoreArgs[4]>;custodian:PrivateOperationalStsPorts;transport:OperationalEcsTransport}
const fail=():never=>{throw Error('operational_workload_result_unconfirmed')};
/** One private orchestration, not an HTTP/default issuer. Requires explicitly
 * qualified source/workload/native/custody/IAM/transport ports. No prepare,
 * review, human-token fallback, credential/phase-proof export or retry/resume.
 * Durable parent/identity claims prevent another invocation from replaying. */
export function createOperationalWorkloadRunner(ports:Ports){return Object.freeze({async run(raw:unknown,webIdentityToken:unknown,signal:AbortSignal){
 try{
  const selected=command.parse(raw);signal.throwIfAborted();if(typeof webIdentityToken!=='string'||webIdentityToken.length>16384||webIdentityToken.startsWith('axm.desk.')||!/^[-A-Za-z0-9_]+\.[-A-Za-z0-9_]+\.[-A-Za-z0-9_]+$/.test(webIdentityToken))return fail();
  if(!ports.custodian)return fail();const token=webIdentityToken,stopped=()=>signal.throwIfAborted();
  const authority:StoreArgs[1]={async assertCurrent(tx,principal){stopped();await ports.authority.assertCurrent(tx,principal);stopped()}};
  const source:StoreArgs[2]={async readManifest(tx,parent){stopped();const value=readOperationalManifest(await ports.source.readManifest(tx,parent));stopped();if(value.kind!=='deployment.ecs'||!value.issuerProfileDigest||!value.workload.environment||!value.workload.protectionRevision)return fail();return value},async assertCurrent(tx,manifest){stopped();await ports.source.assertCurrent(tx,manifest);stopped();if(!manifest.issuerProfileDigest||!manifest.workload.environment||!manifest.workload.protectionRevision)return fail();await ports.custodian.assertQualified(tx,manifest);stopped()}};
  const identity:StoreArgs[3]={async authenticate(tx,value,binding){stopped();const proof=await ports.identity.authenticate(tx,value,binding);stopped();return proof},async consume(tx,proof,binding){stopped();const principal=await ports.identity.consume(tx,proof,binding);stopped();return principal},async assertConsumedCurrent(tx,proof,binding){stopped();await ports.identity.assertConsumedCurrent(tx,proof,binding);stopped()}};
  const targets:NonNullable<StoreArgs[4]>={async reserve(tx,binding){stopped();const ref=await ports.targets.reserve(tx,binding);stopped();return ref},async assertHeld(tx,binding,ref){stopped();await ports.targets.assertHeld(tx,binding,ref);stopped()}};
  const sts=createPrivateOperationalStsIssuer({assertQualified:async(tx,manifest)=>{stopped();await ports.custodian.assertQualified(tx,manifest);stopped()},readCustodianCredential:async(manifest,internalSignal)=>{stopped();const credential=await ports.custodian.readCustodianCredential(manifest,AbortSignal.any([signal,internalSignal]));stopped();return credential},assertCustodianCurrent:async(manifest,credential,internalSignal)=>{stopped();await ports.custodian.assertCustodianCurrent(manifest,credential,AbortSignal.any([signal,internalSignal]));stopped()}});
  const issuer:OperationalCredentialIssuer={assertQualified:sts.assertQualified,issue:(manifest,before,internalSignal,recordSource)=>sts.issue(manifest,before,AbortSignal.any([signal,internalSignal]),recordSource)};
  const transport:OperationalEcsTransport={async assertQualified(tx,manifest){stopped();await ports.transport.assertQualified(tx,manifest);stopped()},send:(manifest,credential,before,internalSignal)=>ports.transport.send(manifest,credential,before,AbortSignal.any([signal,internalSignal]))};
  const store=createOperationalDelegationStore(ports.repo,authority,source,identity,targets,issuer,transport);
  const claimed=await store.claim(selected.actionId,selected.delegationVersion,token),pending=await store.beginCredential(claimed.proof),issued=await store.issueCredential(pending.proof);
  if(!issued.credentialHandle)return fail();const result=await store.executeCredential(issued.credentialHandle);stopped();return result;
 }catch{return fail()}
}})}
