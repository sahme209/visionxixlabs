import 'server-only';
import {readLocalIssuerArtifactIdentity} from './issuerArtifactIdentity';
/** Internal canonical issuer seam. There is currently NO verified variant.
 * Kept typed as a digest for the approved adapter's composition, but always
 * refuses. No copied descriptor, source hash or future status shape is accepted.
 * A real return path requires separately qualified same-artifact launch code. */
export function readLinearCreateOutboundIssuerDigest():string {
 readLocalIssuerArtifactIdentity();
 throw Error('governance_linear_create_outbound_issuer_unavailable');
}
