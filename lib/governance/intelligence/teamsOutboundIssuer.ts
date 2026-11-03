import 'server-only';
import {readLocalIssuerArtifactIdentity} from './issuerArtifactIdentity';
/** Internal canonical issuer seam. There is currently NO verified variant.
 * Kept typed as a digest for the approved adapter's composition, but always
 * refuses. No copied descriptor, source hash or future status shape is accepted.
 * A real return path requires separately qualified same-artifact launch code. */
export function readTeamsOutboundIssuerDigest():string {
 readLocalIssuerArtifactIdentity();
 throw Error('governance_teams_outbound_issuer_unavailable');
}
