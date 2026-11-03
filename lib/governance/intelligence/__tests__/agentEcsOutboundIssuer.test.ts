import {expect,it} from 'vitest';
import {readAgentEcsOutboundIssuerDigest} from '../agentEcsOutboundIssuer';
import {readLocalIssuerArtifactIdentity} from '../issuerArtifactIdentity';
it('actual canonical module is unavailable and cannot provide a digest for an outbound slot',()=>{
 expect(readLocalIssuerArtifactIdentity()).toMatchObject({status:'unavailable',executionAuthorized:false});
 expect(readLocalIssuerArtifactIdentity()).not.toHaveProperty('issuerArtifactDigest');
 expect(()=>readAgentEcsOutboundIssuerDigest()).toThrow('governance_agent_ecs_issuer_unavailable');
});
