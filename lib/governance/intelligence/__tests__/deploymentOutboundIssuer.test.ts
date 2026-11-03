import {expect,it} from 'vitest';
import {readDeploymentOutboundIssuerDigest} from '../deploymentOutboundIssuer';
import {readLocalIssuerArtifactIdentity} from '../issuerArtifactIdentity';
it('actual canonical module is unavailable and cannot provide a digest for an outbound slot',()=>{
 expect(readLocalIssuerArtifactIdentity()).toMatchObject({status:'unavailable',executionAuthorized:false});
 expect(readLocalIssuerArtifactIdentity()).not.toHaveProperty('issuerArtifactDigest');
 expect(()=>readDeploymentOutboundIssuerDigest()).toThrow('governance_deployment_outbound_issuer_unavailable');
});
