import {expect,it} from 'vitest';
import {readLinearCreateOutboundIssuerDigest} from '../linearCreateOutboundIssuer';
import {readLocalIssuerArtifactIdentity} from '../issuerArtifactIdentity';
it('actual canonical module is unavailable and cannot provide a digest for an outbound slot',()=>{
 expect(readLocalIssuerArtifactIdentity()).toMatchObject({status:'unavailable',executionAuthorized:false});
 expect(readLocalIssuerArtifactIdentity()).not.toHaveProperty('issuerArtifactDigest');
 expect(()=>readLinearCreateOutboundIssuerDigest()).toThrow('governance_linear_create_outbound_issuer_unavailable');
});
