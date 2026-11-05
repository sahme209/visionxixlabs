import 'server-only';
import {readIssuerIdentity,type IssuerIdentity} from '@axiom/verified-issuer-runtime';
/** Read-only external consumer seam. Unbound imports remain unavailable:
 * never derive a slot digest from source/protocol text or caller descriptors.
 * Roles, policy, source, claims and fleet/legacy qualification remain separate. */
export function readLocalIssuerArtifactIdentity():Readonly<IssuerIdentity>{
 return readIssuerIdentity();
}
