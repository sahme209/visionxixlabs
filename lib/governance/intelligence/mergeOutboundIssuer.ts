import 'server-only';
import {readLocalIssuerArtifactIdentity} from './issuerArtifactIdentity';
/** Every use reads the real canonical instance and its fresh native assertions.
 * A current artifact is not an approval, fleet qualification or action grant. */
export function readMergeOutboundIssuerDigest():string {
 const identity=readLocalIssuerArtifactIdentity();
 if(identity.status!=='current'||typeof identity.issuerArtifactDigest!=='string'||!/^[a-f0-9]{64}$/.test(identity.issuerArtifactDigest))throw Error('governance_merge_outbound_issuer_unavailable');
 return identity.issuerArtifactDigest;
}
