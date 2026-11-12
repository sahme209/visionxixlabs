import {it,expect} from 'vitest';
import {customerHostedAttestedHold} from '../customerHostedLimitEvidence';
const config={digest:'a'.repeat(64),models:[{id:'local',maxInputTokens:100,maxOutputTokens:20}]};
const evidence=()=>JSON.stringify({format:'axiom.operator-model-limits/1',configDigest:config.digest,modelId:'local',maxInputTokens:100,maxOutputTokens:20,expiresAt:'2026-11-12T00:00:00.000Z',evidenceSha256:'b'.repeat(64)});
it('reads the complete attested input plus output proposal, never a byte-token estimate',()=>{
 expect(customerHostedAttestedHold(config,'local',evidence(),Date.parse('2026-11-11T00:00:00Z'))).toBe(120);
});
it('refuses missing, expired, wrong-model and wrong-config qualification',()=>{
 const at=Date.parse('2026-11-11T00:00:00Z');
 for(const raw of [undefined,'{}',evidence().replace('local','other'),evidence().replace('a'.repeat(64),'c'.repeat(64)),evidence().replace('2026-11-12','2026-11-10'),evidence().replace('"maxInputTokens":100','"maxInputTokens":50')])expect(customerHostedAttestedHold(config,'local',raw,at)).toBeNull();
});
