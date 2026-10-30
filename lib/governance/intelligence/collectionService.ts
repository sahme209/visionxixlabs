import 'server-only';
import {z} from 'zod';
import {discoverEvidence,discoverySelectionSchema,type DiscoveryPorts} from './discovery';
import type {EvidenceStoreScope,createGovernanceEvidenceStore} from './evidenceStore';
import {identifier} from './contracts';
const principal=z.object({organizationId:identifier,actorUserId:identifier,sessionId:identifier}).strict();
/** Provider reads finish before the durable store opens its transaction. The
 * store independently rechecks current collector authority before committing. */
export function createGovernanceCollectionService(ports:{
 assertCurrent:(scope:EvidenceStoreScope,signal:AbortSignal)=>Promise<void>;
 source:(scope:EvidenceStoreScope,selection:ReturnType<typeof discoverySelectionSchema.parse>)=>DiscoveryPorts;
 store:Pick<ReturnType<typeof createGovernanceEvidenceStore>,'save'>;
}){return{async collect(rawScope:EvidenceStoreScope,rawSelection:unknown,nonce:string,signal:AbortSignal){
 const scope=principal.parse(rawScope),selection=discoverySelectionSchema.parse(rawSelection);z.string().uuid().parse(nonce);
 if(selection.organizationId!==scope.organizationId)throw Error('governance_collection_scope_mismatch');
 signal.throwIfAborted();await ports.assertCurrent(scope,signal);signal.throwIfAborted();
 const snapshot=await discoverEvidence(selection,ports.source(scope,selection),signal);
 await ports.assertCurrent(scope,signal);signal.throwIfAborted();
 return ports.store.save(scope,snapshot,nonce);
}}}
