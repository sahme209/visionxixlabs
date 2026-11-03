import {expect,it} from 'vitest';
import {readServiceNowOutboundIssuerDigest} from '../serviceNowOutboundIssuer';
import {readLocalIssuerArtifactIdentity} from '../issuerArtifactIdentity';
it('actual canonical module is unavailable and cannot provide a digest for an outbound slot',()=>{
 expect(readLocalIssuerArtifactIdentity()).toMatchObject({status:'unavailable',executionAuthorized:false});
 expect(readLocalIssuerArtifactIdentity()).not.toHaveProperty('issuerArtifactDigest');
 expect(()=>readServiceNowOutboundIssuerDigest()).toThrow('governance_servicenow_outbound_issuer_unavailable');
});
