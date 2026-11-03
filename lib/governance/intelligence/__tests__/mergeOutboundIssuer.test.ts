import {expect,it} from 'vitest';
import {readMergeOutboundIssuerDigest} from '../mergeOutboundIssuer';
import {readLocalIssuerArtifactIdentity} from '../issuerArtifactIdentity';
it('actual canonical module is unavailable and cannot provide a digest for an outbound slot',()=>{
 expect(readLocalIssuerArtifactIdentity()).toMatchObject({status:'unavailable',executionAuthorized:false});
 expect(readLocalIssuerArtifactIdentity()).not.toHaveProperty('issuerArtifactDigest');
 expect(()=>readMergeOutboundIssuerDigest()).toThrow('governance_merge_outbound_issuer_unavailable');
});
