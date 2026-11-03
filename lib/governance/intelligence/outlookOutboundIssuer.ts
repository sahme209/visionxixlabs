import 'server-only';
import {readLocalIssuerArtifactIdentity} from './issuerArtifactIdentity';
/** Actual canonical executing identity remains unavailable. No request, copied
 * descriptor, package hash or caller flag can initialize or replace it. */
export function readOutlookOutboundIssuerDigest():string {
 readLocalIssuerArtifactIdentity();
 throw Error('governance_outlook_outbound_issuer_unavailable');
}
