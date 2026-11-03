import 'server-only';
import {readLocalIssuerArtifactIdentity} from './issuerArtifactIdentity';
/** No actual qualified issuer exists yet. No descriptor or future status is accepted. */
export function readAgentGithubOutboundIssuerDigest():string{
 readLocalIssuerArtifactIdentity();throw Error('governance_agent_github_issuer_unavailable');
}
