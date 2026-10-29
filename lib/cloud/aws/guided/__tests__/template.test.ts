import {describe,it,expect} from 'vitest';
import {createHash} from 'node:crypto';
import {constructAwsGuidedTemplate} from '../template';
const hash=(x:unknown)=>createHash('sha256').update(JSON.stringify(x)).digest('hex');
// Synthetic generator output is never passed to a provider or production registry.
const p={Version:'2012-10-17',Statement:[{Effect:'Allow',Action:'synthetic:Read',Resource:'synthetic'}]};
const source='def handler(event, context):\n    return {}\n';
const fixture=()=>({readerPolicy:p,callbackPolicy:p,readerDigest:hash(p),callbackDigest:hash(p),generatorReceipt:{tool:'iam-policy-autopilot' as const,sourceDigest:createHash('sha256').update(source).digest('hex'),reviewed:true as const},lambdaSource:source});
describe('local AWS template construction',()=>{
 it('constructs role/callback resources only from matching reviewed generator artifacts',()=>{const t=constructAwsGuidedTemplate(fixture());expect(Object.keys(t.Resources)).toEqual(['ReaderRole','CallbackRole','CallbackFunction','CallbackLogs','ConnectionCallback']);expect(t.Resources.CallbackLogs.Properties.RetentionInDays).toBe(7);expect(t.Resources.ReaderRole.Properties.Policies[0].PolicyDocument).toEqual(p);expect(t.Resources.ConnectionCallback.Properties.FlowId).toEqual({Ref:'FlowId'})});
 it('refuses changed policy or callback source against the exact receipt',()=>{const f=fixture();f.readerDigest='0'.repeat(64);expect(()=>constructAwsGuidedTemplate(f)).toThrow();const g=fixture();g.lambdaSource+='\n# changed';expect(()=>constructAwsGuidedTemplate(g)).toThrow()});
});
