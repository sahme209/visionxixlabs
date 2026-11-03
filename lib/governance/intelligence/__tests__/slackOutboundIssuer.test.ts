import {expect,it} from 'vitest';
import {readSlackOutboundIssuerDigest} from '../slackOutboundIssuer';
import {readLocalIssuerArtifactIdentity} from '../issuerArtifactIdentity';
it('actual canonical module is unavailable and cannot provide a digest for an outbound slot',()=>{
 expect(readLocalIssuerArtifactIdentity()).toMatchObject({status:'unavailable',executionAuthorized:false});
 expect(readLocalIssuerArtifactIdentity()).not.toHaveProperty('issuerArtifactDigest');
 expect(()=>readSlackOutboundIssuerDigest()).toThrow('governance_slack_outbound_issuer_unavailable');
});
