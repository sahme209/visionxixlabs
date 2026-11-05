import {expect,it,vi} from 'vitest';
// Synthetic adapter test only, not native identity qualification.
const state=vi.hoisted(()=>({value:{status:'unavailable'} as unknown,read:vi.fn()}));
vi.mock('../issuerArtifactIdentity',()=>({readLocalIssuerArtifactIdentity:()=>{state.read();return state.value}}));
import {readMergeOutboundIssuerDigest} from '../mergeOutboundIssuer';
it('reads the actual reader on each call and stops after currentness loss',()=>{
 state.value={status:'current',issuerArtifactDigest:'a'.repeat(64),executionAuthorized:false};
 expect(readMergeOutboundIssuerDigest()).toBe('a'.repeat(64));
 state.value={status:'unavailable'};expect(()=>readMergeOutboundIssuerDigest()).toThrow('governance_merge_outbound_issuer_unavailable');expect(state.read).toHaveBeenCalledTimes(2);
});
it.each([{status:'verified',issuerArtifactDigest:'a'.repeat(64)},{status:'current',issuerArtifactDigest:'bad'},{status:'current',issuerArtifactDigest:undefined}])('refuses malformed or non-current identity data',value=>{state.value=value;expect(()=>readMergeOutboundIssuerDigest()).toThrow('governance_merge_outbound_issuer_unavailable')});
