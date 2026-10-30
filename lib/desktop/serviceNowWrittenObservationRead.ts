import 'server-only';
import {z} from 'zod';
import {serviceNowInstanceOriginSchema} from '@/lib/releaseops/serviceNowTicketLifecycleContract';
import {serviceNowTicketCredentialSchema} from '@/lib/releaseops/serviceNowTicketTransport';
import {writtenJournalProofSchema} from '@/lib/releaseops/serviceNowWrittenLinkObservationContract';
import {readBoundedJiraJson,untilAbort} from '@/lib/releaseops/jiraTicketTransport';
const identity=z.string().min(1).max(240),hash=z.string().regex(/^[a-f0-9]{64}$/);
export const serviceNowWrittenObservationTargetSchema=z.object({organizationId:identity,connectionId:identity,connectionRevision:z.string().datetime(),instanceOrigin:serviceNowInstanceOriginSchema,issue:z.object({sysId:z.string().regex(/^[a-f0-9]{32}$/),number:z.string().regex(/^CHG[0-9]{1,20}$/)}).strict(),noteDigest:hash}).strict();
export type ServiceNowWrittenObservationTarget=z.infer<typeof serviceNowWrittenObservationTargetSchema>;
/** Historical transport expiry never grants execution authority. This is a
 * separate fixed GET read of current exact-note proof using current access. */
export async function readServiceNowWrittenObservationProof(rawTarget:ServiceNowWrittenObservationTarget,parent:AbortSignal,ports:{apiNamespace:string;assertCurrent:(signal:AbortSignal)=>Promise<void>;readCredential:(signal:AbortSignal)=>Promise<unknown>;fetch?:typeof fetch;now?:()=>number}){
 const target=serviceNowWrittenObservationTargetSchema.parse(rawTarget),namespace=z.string().regex(/^[A-Za-z0-9_]{1,80}$/).parse(ports.apiNamespace),signal=AbortSignal.any([parent,AbortSignal.timeout(10000)]),now=ports.now??Date.now;
 signal.throwIfAborted();await untilAbort(ports.assertCurrent(signal),signal);
 const credential=serviceNowTicketCredentialSchema.parse(await untilAbort(ports.readCredential(signal),signal));
 if(credential.organizationId!==target.organizationId||credential.connectionId!==target.connectionId||credential.connectionRevision!==target.connectionRevision||credential.instanceOrigin!==target.instanceOrigin||!credential.permissions.read||!credential.permissions.journalRead||credential.permissions.write||credential.expiresAt<=now()+15000)throw Error('servicenow_observation_read_unavailable');
 const url=target.instanceOrigin+'/api/'+namespace+'/v1/axiom_evidence/change/'+target.issue.sysId+'/journal-proof?'+new URLSearchParams({note_digest:target.noteDigest});
 const response=await untilAbort((ports.fetch??fetch)(url,{method:'GET',headers:{Accept:'application/json',Authorization:`Bearer ${credential.accessToken}`},redirect:'error',credentials:'omit',cache:'no-store',signal}),signal,r=>{void r.body?.cancel().catch(()=>{})});
 if(response.status!==200||response.redirected||response.headers.get('content-type')?.split(';')[0].trim().toLowerCase()!=='application/json'){void response.body?.cancel().catch(()=>{});throw Error('servicenow_observation_proof_unavailable')}
 const proof=z.object({result:writtenJournalProofSchema}).strict().parse(await readBoundedJiraJson(response,signal)).result;
 await untilAbort(ports.assertCurrent(signal),signal);signal.throwIfAborted();const observed=Date.parse(proof.observedAt.replace(' ','T')+'Z'),created=Date.parse(proof.entry.createdAt.replace(' ','T')+'Z'),at=now();
 if(!Number.isFinite(at)||!Number.isFinite(observed)||!Number.isFinite(created)||observed>at||at-observed>30000||created>observed||proof.changeSysId!==target.issue.sysId||proof.entryDigest!==target.noteDigest||credential.expiresAt<=at)throw Error('servicenow_observation_proof_changed');
 return proof;
}
