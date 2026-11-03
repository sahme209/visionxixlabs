import 'server-only';
import {readIssuerIdentity,type IssuerIdentityUnavailable} from '@axiom/verified-issuer-runtime';
/** Read-only external consumer seam. Currently unavailable by construction:
 * never derive a slot digest from source/protocol text or caller descriptors.
 * Roles, policy, source, claims and fleet/legacy qualification remain separate. */
export function readLocalIssuerArtifactIdentity():Readonly<IssuerIdentityUnavailable>{
 return readIssuerIdentity();
}
