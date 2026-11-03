import {expect,it} from 'vitest';
import {readTeamsOutboundIssuerDigest} from '../teamsOutboundIssuer';
import {readLocalIssuerArtifactIdentity} from '../issuerArtifactIdentity';
it('actual canonical module is unavailable and cannot provide a digest for an outbound slot',()=>{
 expect(readLocalIssuerArtifactIdentity()).toMatchObject({status:'unavailable',executionAuthorized:false});
 expect(readLocalIssuerArtifactIdentity()).not.toHaveProperty('issuerArtifactDigest');
 expect(()=>readTeamsOutboundIssuerDigest()).toThrow('governance_teams_outbound_issuer_unavailable');
});
