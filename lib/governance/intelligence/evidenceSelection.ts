import {validateEvidenceEnvelope} from './freshness';
import {discoverySelectionSchema,type DiscoverySelection} from './discovery';
/** History without a recorded read profile cannot invent a new network read. */
export function discoverySelectionFromEvidence(raw:unknown):DiscoverySelection{const e=validateEvidenceEnvelope(raw);if(!e.collectionOperations||e.collectorVersion!=='governance-discovery-read-v1'||e.source==='document')throw Error('governance_collection_profile_required');return discoverySelectionSchema.parse({organizationId:e.organizationId,source:e.source,connectionId:e.connectionId,connectionRevision:e.connectionRevision,selection:e.selection,operations:e.collectionOperations})}
