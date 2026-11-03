import 'server-only';
import {readLocalIssuerArtifactIdentity} from './issuerArtifactIdentity';
/** No actual qualified issuer exists yet. No descriptor or future status is accepted. */
export function readAgentEcsOutboundIssuerDigest():string{
 readLocalIssuerArtifactIdentity();throw Error('governance_agent_ecs_issuer_unavailable');
}
