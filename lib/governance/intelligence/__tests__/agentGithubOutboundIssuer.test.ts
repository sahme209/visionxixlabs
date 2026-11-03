import {expect,it} from 'vitest';
import {readAgentGithubOutboundIssuerDigest} from '../agentGithubOutboundIssuer';
import {readLocalIssuerArtifactIdentity} from '../issuerArtifactIdentity';
it('actual canonical module is unavailable and cannot provide a digest for an outbound slot',()=>{
 expect(readLocalIssuerArtifactIdentity()).toMatchObject({status:'unavailable',executionAuthorized:false});
 expect(readLocalIssuerArtifactIdentity()).not.toHaveProperty('issuerArtifactDigest');
 expect(()=>readAgentGithubOutboundIssuerDigest()).toThrow('governance_agent_github_issuer_unavailable');
});
