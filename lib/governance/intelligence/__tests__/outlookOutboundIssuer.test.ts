import {expect,it} from 'vitest';
import {readOutlookOutboundIssuerDigest} from '../outlookOutboundIssuer';
import {readLocalIssuerArtifactIdentity} from '../issuerArtifactIdentity';
it('actual canonical module is unavailable and cannot provide a digest for an outbound slot',()=>{
 expect(readLocalIssuerArtifactIdentity()).toMatchObject({status:'unavailable',executionAuthorized:false});
 expect(readLocalIssuerArtifactIdentity()).not.toHaveProperty('issuerArtifactDigest');
 expect(()=>readOutlookOutboundIssuerDigest()).toThrow('governance_outlook_outbound_issuer_unavailable');
});
